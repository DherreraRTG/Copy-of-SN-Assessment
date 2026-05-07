import { getPendingResponses, updateResponse, removeFromQueue } from '../db';
import { submitAssessment, completeAssessment, uploadAttachment } from './assessmentService';
import { assessmentStore } from '../store/assessmentStore';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 30000];

class SyncManager {
  constructor() {
    this._listeners = [];
    this._running = false;
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _notify() { this._listeners.forEach(fn => fn()); }

  async sync() {
    if (this._running) return;
    this._running = true;
    try {
      const pending = await getPendingResponses();
      for (const item of pending) {
        await this._submitOne(item);
      }
    } finally {
      this._running = false;
      this._notify();
    }
  }

  async _submitOne(item) {
    await updateResponse(item.sys_id, { status: 'submitting' });
    this._notify();

    try {
      const result = await submitAssessment(item.payload);
      const instanceId = item.payload.instance_sys_id || result?.body?.instance_sys_id;

      // Load attachment answers from assessmentStore (not duplicated in queue item)
      if (instanceId && item.storeInstanceId) {
        const savedAnswers = await assessmentStore.loadAnswersByInstanceId(item.storeInstanceId);
        if (savedAnswers) {
          const attachmentEntries = Object.entries(savedAnswers).flatMap(([metricID, val]) => {
            const files = Array.isArray(val) ? val : (typeof val === 'string' && val.startsWith('data:') ? [val] : []);
            return files.map(base64 => ({ metricID, base64 }));
          });
          await Promise.all(
            attachmentEntries.map(({ metricID, base64 }) =>
              uploadAttachment(instanceId, metricID, base64).catch(() => {})
            )
          );
        }
        await assessmentStore.clearByInstanceId(item.storeInstanceId);
      }

      if (instanceId) await completeAssessment(instanceId);
      await removeFromQueue(item.sys_id);
    } catch (err) {
      const retries = (item.retry_count || 0) + 1;
      const status = retries >= MAX_RETRIES ? 'failed' : 'pending';
      await updateResponse(item.sys_id, { status, retry_count: retries, last_error: err.message });
      if (status === 'pending') {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[retries - 1] || 30000));
      }
    }
    this._notify();
  }

  async retryItem(sys_id) {
    await updateResponse(sys_id, { status: 'pending', retry_count: 0 });
    this.sync();
  }
}

export const syncManager = new SyncManager();
