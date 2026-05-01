import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BASE_URL = Constants.expoConfig?.extra?.snInstance || 'https://roomstogodev.service-now.com';
const API_BASE = `${BASE_URL}/api/x_rtg_npm/offline_assessment`;

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('sn_token');
  if (token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  const user = await AsyncStorage.getItem('sn_user');
  const pass = await AsyncStorage.getItem('sn_pass');
  if (user && pass) {
    const encoded = btoa(`${user}:${pass}`);
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${encoded}`,
    };
  }

  throw new Error('Not authenticated. Please log in.');
}

export async function fetchAssessmentByInstance(instanceSysId) {
  if (!instanceSysId) throw new Error('instanceSysId is required');

  const response = await fetch(`${API_BASE}/${instanceSysId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  const result = json.result || json;
  if (result.status === 'error') {
    throw new Error(result.error_message || 'Unknown API error');
  }

  return result.body ?? result;
}

export async function fetchMyAssessments() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/list`, { method: 'GET', headers });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const json = await response.json();
  return json.result || json;
}

// Submits the assessment payload — caller is responsible for stripping base64 before calling.
export async function submitAssessment(payload) {
  let headers = { 'Content-Type': 'application/json' };
  try { headers = await getAuthHeaders(); } catch {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status}`);
    }

    const json = await response.json();
    const result = json.result || json;

    if (result.status === 'error') {
      throw new Error(result.error_message || 'Submit error');
    }

    return result;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('Submit timed out. Your answers have been saved offline.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// Uploads a single base64 attachment to the matching instance question after submit.
export async function uploadAttachment(instanceSysId, metricSysId, base64Data) {
  let headers = { 'Content-Type': 'application/json' };
  try { headers = await getAuthHeaders(); } catch {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_BASE}/upload-attachment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instance_sys_id: instanceSysId,
        metric_sys_id: metricSysId,
        base64_data: base64Data,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Attachment upload failed: ${response.status}`);
    }

    const json = await response.json();
    return json.result || json;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('Attachment upload timed out.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
