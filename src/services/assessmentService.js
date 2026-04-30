/**
 * assessmentService.js
 * Handles all API calls to the SN Offline Assessment Scripted REST endpoints.
 *
 * GET  /api/x_rtg_npm/offline_assessment/{instance_sys_id}
 * POST /api/x_rtg_npm/offline_assessment
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BASE_URL = Constants.expoConfig?.extra?.snInstance || 'https://roomstogodev.service-now.com';
const API_BASE = `${BASE_URL}/api/x_rtg_npm/offline_assessment`;

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('sn_token');
  if (token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // Fallback: Basic auth (dev/testing only)
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

// ─────────────────────────────────────────────
// GET — fetch by assessment instance sys_id
// ─────────────────────────────────────────────

/**
 * Fetches the full assessment payload for a given asmt_assessment_instance sys_id.
 * Used when launched via deep link from the SN mobile UI Action.
 *
 * @param {string} instanceSysId - sys_id of asmt_assessment_instance
 * @returns {Promise<object>} Full payload body from OfflineAssessmentUtils
 */
export async function fetchAssessmentByInstance(instanceSysId) {
  if (!instanceSysId) throw new Error('instanceSysId is required');

  const url = `${API_BASE}/${instanceSysId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();

  // SN wraps in { result: { status, status_code, body } }
  const result = json.result || json;
  if (result.status === 'error') {
    throw new Error(result.error_message || 'Unknown API error');
  }

  return result.body ?? result;
}

// ─────────────────────────────────────────────
// GET — fetch list of assessments for current user
// Used by MyAssessments screen
// ─────────────────────────────────────────────

/**
 * Fetches assessments assigned to the current user.
 * Endpoint should return a list — adjust URL to your list endpoint.
 */
export async function fetchMyAssessments() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/list`, { method: 'GET', headers });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  const json = await response.json();
  return json.result || json;
}

// ─────────────────────────────────────────────
// POST — submit completed answers
// ─────────────────────────────────────────────

/**
 * Submits completed assessment answers to SN.
 * Body shape matches OfflineAssessmentUtils.submitAssessmentAnswers.
 *
 * @param {object} payload
 * @param {string} payload.metric_type_sys_id
 * @param {string} [payload.instance_sys_id]
 * @param {string} [payload.submitted_by]
 * @param {string} [payload.submitted_at]
 * @param {Array}  payload.categories
 */
export async function submitAssessment(payload) {
  let headers = { 'Content-Type': 'application/json' };
  try { headers = await getAuthHeaders(); } catch {}

  // Strip base64 attachment data out of the main JSON body — SN handles
  // the upload separately via _uploadAttachment using a dedicated field.
  // Keeping full base64 in the body makes payloads huge and causes timeouts.
  const attachments = {};
  const cleanPayload = {
    ...payload,
    categories: (payload.categories || []).map(cat => ({
      ...cat,
      questions: (cat.questions || []).map(q => {
        if (q.value && q.value.startsWith('data:')) {
          attachments[q.metricID] = q.value;
          return { ...q, value: '', string_value: q.value }; // keep base64 in string_value for SN _uploadAttachment
        }
        return q;
      }),
    })),
    _attachments: attachments, // separate map SN can use if needed
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(cleanPayload),
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