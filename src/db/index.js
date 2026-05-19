import storage from '../lib/storage';

const KEYS = {
  assessmentList: 'assessments:list',
  assessment: (id) => `assessments:${id}`,
  responseQueue: 'queue:list',
  response: (id) => `queue:${id}`,
};

export async function saveAssessment(payload) {
  const { sys_id } = payload;
  const list = await getAssessmentList();
  if (!list.includes(sys_id)) {
    await storage.setItem(KEYS.assessmentList, JSON.stringify([...list, sys_id]));
  }
  await storage.setItem(KEYS.assessment(sys_id), JSON.stringify({
    sys_id,
    title: payload.title,
    downloaded_at: new Date().toISOString(),
    status: 'ready',
    payload,
  }));
}

export async function getAssessmentList() {
  const raw = await storage.getItem(KEYS.assessmentList);
  return raw ? JSON.parse(raw) : [];
}

export async function getAllAssessments() {
  const ids = await getAssessmentList();
  const records = await Promise.all(ids.map(id => getAssessment(id)));
  return records.filter(Boolean);
}

export async function getAssessment(sys_id) {
  const raw = await storage.getItem(KEYS.assessment(sys_id));
  return raw ? JSON.parse(raw) : null;
}

export async function deleteAssessment(sys_id) {
  const list = await getAssessmentList();
  await storage.setItem(KEYS.assessmentList, JSON.stringify(list.filter(id => id !== sys_id)));
  await storage.removeItem(KEYS.assessment(sys_id));
}

export async function saveResponse(sys_id, data) {
  const list = await getQueueList();
  if (!list.includes(sys_id)) {
    await storage.setItem(KEYS.responseQueue, JSON.stringify([...list, sys_id]));
  }
  await storage.setItem(KEYS.response(sys_id), JSON.stringify({
    sys_id,
    updated_at: new Date().toISOString(),
    retry_count: 0,
    ...data,
  }));
}

export async function updateResponse(sys_id, updates) {
  const existing = await getResponse(sys_id);
  if (!existing) return;
  await storage.setItem(KEYS.response(sys_id), JSON.stringify({ ...existing, ...updates }));
}

export async function getResponse(sys_id) {
  const raw = await storage.getItem(KEYS.response(sys_id));
  return raw ? JSON.parse(raw) : null;
}

export async function getQueueList() {
  const raw = await storage.getItem(KEYS.responseQueue);
  return raw ? JSON.parse(raw) : [];
}

export async function getPendingResponses() {
  const ids = await getQueueList();
  const all = await Promise.all(ids.map(id => getResponse(id)));
  return all.filter(r => r && (r.status === 'pending' || r.status === 'failed') && (r.retry_count || 0) < 3);
}

export async function removeFromQueue(sys_id) {
  const list = await getQueueList();
  await storage.setItem(KEYS.responseQueue, JSON.stringify(list.filter(id => id !== sys_id)));
  await storage.removeItem(KEYS.response(sys_id));
}
