import storage from '../lib/storage';

const KEY_CURRENT = 'sn_current';
const KEY_PENDING_COMPLETE = 'sn_pending_complete';

let _payload    = null;
let _instanceId = null;

function keys(id) {
  return {
    payload: `sn_payload_${id}`,
    skus:    `sn_skus_${id}`,
    answers: `sn_answers_${id}`,
  };
}

export const assessmentStore = {
  _purgeStale: async (keepInstanceId) => {
    try {
      const allKeys = await storage.getAllKeys();
      const keep = new Set([
        KEY_CURRENT,
        ...(keepInstanceId ? Object.values(keys(keepInstanceId)) : []),
        `sn_sku_draft_${keepInstanceId}`,
        `sn_catidx_${keepInstanceId}`,
      ]);
      const toRemove = allKeys.filter(k => !keep.has(k));
      if (toRemove.length) await storage.multiRemove(toRemove);
    } catch (_) {}
  },

  set: async (p, fallbackId) => {
    _payload    = p;
    _instanceId = p.instance_sys_id || fallbackId || 'session';
    const k = keys(_instanceId);
    const pairs = [
      [KEY_CURRENT, _instanceId],
      [k.payload,   JSON.stringify(p)],
    ];
    try {
      await storage.multiSet(pairs);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota') || e.message?.includes('exceeded')) {
        await assessmentStore._purgeStale(_instanceId);
        await storage.multiSet(pairs);
      } else {
        throw e;
      }
    }
  },

  get: () => _payload,

  hydrate: async () => {
    if (_payload) return _payload;
    try {
      const id = await storage.getItem(KEY_CURRENT);
      if (!id) return null;
      _instanceId = id;
      const s = await storage.getItem(keys(id).payload);
      if (s) _payload = JSON.parse(s);
    } catch (_) {}
    return _payload;
  },

  saveSkus: async (skus) => {
    try {
      const id = _instanceId || await storage.getItem(KEY_CURRENT);
      if (!id) return;
      await storage.setItem(keys(id).skus, JSON.stringify(skus));
    } catch (_) {}
  },

  loadSkus: async () => {
    try {
      const id = _instanceId || await storage.getItem(KEY_CURRENT);
      if (!id) return null;
      const s = await storage.getItem(keys(id).skus);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  saveSkuDraft: async (draft) => {
    try {
      const id = _instanceId || await storage.getItem(KEY_CURRENT);
      if (!id) return;
      await storage.setItem(`sn_sku_draft_${id}`, JSON.stringify(draft));
    } catch (_) {}
  },

  loadSkuDraft: async () => {
    try {
      const id = _instanceId || await storage.getItem(KEY_CURRENT);
      if (!id) return null;
      const s = await storage.getItem(`sn_sku_draft_${id}`);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  saveAnswers: async (answers) => {
    try {
      const id = _instanceId || await storage.getItem(KEY_CURRENT);
      if (!id) return;
      const serialized = JSON.stringify(answers);
      try {
        await storage.setItem(keys(id).answers, serialized);
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.message?.includes('quota') || e.message?.includes('exceeded')) {
          await assessmentStore._purgeStale(id);
          try {
            await storage.setItem(keys(id).answers, serialized);
          } catch {
            throw new Error('QUOTA_EXCEEDED');
          }
        }
      }
    } catch (e) {
      if (e.message === 'QUOTA_EXCEEDED') throw e;
    }
  },

  loadAnswers: async () => {
    try {
      const id = _instanceId || await storage.getItem(KEY_CURRENT);
      if (!id) return null;
      const s = await storage.getItem(keys(id).answers);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  saveCategoryIndex: async (index) => {
    try {
      const id = _instanceId || await storage.getItem(KEY_CURRENT);
      if (!id) return;
      await storage.setItem(`sn_catidx_${id}`, String(index));
    } catch (_) {}
  },

  loadCategoryIndex: async () => {
    try {
      const id = _instanceId || await storage.getItem(KEY_CURRENT);
      if (!id) return 0;
      const s = await storage.getItem(`sn_catidx_${id}`);
      return s !== null ? parseInt(s, 10) : 0;
    } catch (_) { return 0; }
  },

  loadAnswersByInstanceId: async (id) => {
    try {
      if (!id) return null;
      const s = await storage.getItem(keys(id).answers);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  clearByInstanceId: async (id) => {
    if (!id) return;
    try {
      const k = keys(id);
      await storage.multiRemove([KEY_CURRENT, k.payload, k.skus, k.answers, `sn_sku_draft_${id}`, `sn_catidx_${id}`]);
    } catch (_) {}
  },

  savePendingComplete: async (data) => {
    try {
      await storage.setItem(KEY_PENDING_COMPLETE, JSON.stringify(data));
    } catch (_) {}
  },

  loadPendingComplete: async () => {
    try {
      const s = await storage.getItem(KEY_PENDING_COMPLETE);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  clearPendingComplete: async () => {
    try {
      await storage.removeItem(KEY_PENDING_COMPLETE);
    } catch (_) {}
  },

  clear: async () => {
    const id = _instanceId;
    _payload    = null;
    _instanceId = null;
    try {
      const toRemove = [KEY_CURRENT];
      if (id) {
        const k = keys(id);
        toRemove.push(k.payload, k.skus, k.answers, `sn_sku_draft_${id}`, `sn_catidx_${id}`);
      }
      await storage.multiRemove(toRemove);
    } catch (_) {}
  },
};
