import storage from '../lib/storage';

const DEFAULT_INSTANCE = import.meta.env.VITE_SN_INSTANCE || 'https://roomstogodev.service-now.com';
const INSTANCE_KEY = 'sn_instance';
const TOKEN_KEY    = 'sn_oauth_token';
const EXPIRY_KEY   = 'sn_oauth_expiry';
const REFRESH_KEY  = 'sn_oauth_refresh';
const SCHEME_KEY   = 'sn_oauth_scheme';

export async function setSnInstance(value) {
  if (!value) return;
  const full = value.startsWith('http')
    ? value.replace(/\/$/, '')
    : `https://${value.replace(/\/$/, '')}.service-now.com`;
  await storage.setItem(INSTANCE_KEY, full);
  await storage.multiRemove([TOKEN_KEY, EXPIRY_KEY, REFRESH_KEY, SCHEME_KEY]);
}

async function getApiBase() {
  const stored = await storage.getItem(INSTANCE_KEY);
  return `${stored || DEFAULT_INSTANCE}/api/x_rtg_npm/offline_assessment`;
}

async function callTokenProxy(body) {
  const stored = await storage.getItem(INSTANCE_KEY);
  const instanceKey = stored
    ? stored.replace(/^https?:\/\//, '').split('.')[0]
    : null;

  const TOKEN_PROXY_URL = import.meta.env.VITE_TOKEN_PROXY_URL || '/api/token';
  const res = await fetch(TOKEN_PROXY_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...body, ...(instanceKey ? { instance_key: instanceKey } : {}) }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || 'Auth failed');

  const expiresAt = Date.now() + (json.expires_in - 60) * 1000;
  await storage.multiSet([
    [TOKEN_KEY,  json.access_token],
    [EXPIRY_KEY, String(expiresAt)],
    [SCHEME_KEY, json.scheme || 'Bearer'],
    ...(json.refresh_token ? [[REFRESH_KEY, json.refresh_token]] : []),
  ]);
  return json.access_token;
}

async function fetchNewToken() {
  return callTokenProxy({});
}

async function refreshToken() {
  const refresh = await storage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error('No refresh token');
  return callTokenProxy({ refresh_token: refresh });
}

async function getValidToken() {
  const [token, expiry] = await storage.multiGet([TOKEN_KEY, EXPIRY_KEY])
    .then(pairs => pairs.map(([, v]) => v));

  if (token && expiry && Date.now() < Number(expiry)) return token;

  try { return await refreshToken(); } catch {}
  return fetchNewToken();
}

async function getAuthHeaders() {
  const token = await getValidToken();
  const scheme = await storage.getItem(SCHEME_KEY) || 'Bearer';
  return { 'Content-Type': 'application/json', 'Authorization': `${scheme} ${token}` };
}

async function apiFetch(url, options, retried = false) {
  const res = await fetch(url, options);
  if (res.status === 401 && !retried) {
    try {
      const token = await fetchNewToken();
      const scheme = await storage.getItem(SCHEME_KEY) || 'Bearer';
      const headers = { ...options.headers, Authorization: `${scheme} ${token}` };
      return apiFetch(url, { ...options, headers }, true);
    } catch {
      throw new Error('Your session has expired. Please reconnect to the internet to re-authenticate.');
    }
  }
  if (res.status === 401) {
    throw new Error('Your session has expired. Please reconnect to the internet to re-authenticate.');
  }
  return res;
}

export async function initAuth() {
  try { await getValidToken(); } catch {}
}

export async function fetchAssessmentByInstance(instanceSysId) {
  if (!instanceSysId) throw new Error('instanceSysId is required');

  const headers = await getAuthHeaders();
  const res = await apiFetch(`${await getApiBase()}/${instanceSysId}`, { method: 'GET', headers });

  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);

  const json = await res.json();
  const result = json.result || json;
  if (result.status === 'error') throw new Error(result.error_message || 'Unknown API error');

  return result.body ?? result;
}

export async function submitAssessment(payload) {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  try {
    const res = await apiFetch(`${await getApiBase()}/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Submit failed: ${res.status}`);

    const json = await res.json();
    const result = json.result || json;
    if (result.status === 'error') throw new Error(result.error_message || 'Submit error');
    return result;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Submit timed out. Your answers have been saved offline.');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function completeAssessment(instanceSysId) {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await apiFetch(`${await getApiBase()}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instance_sys_id: instanceSysId }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Complete failed: ${res.status}`);
    const json = await res.json();
    return json.result || json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Complete timed out');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadAttachment(instanceSysId, metricSysId, base64Data) {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await apiFetch(`${await getApiBase()}/upload-attachment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instance_sys_id: instanceSysId,
        metric_sys_id:   metricSysId,
        base64_data:     base64Data,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Attachment upload failed: ${res.status}`);
    const json = await res.json();
    return json.result || json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Attachment upload timed out.');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
