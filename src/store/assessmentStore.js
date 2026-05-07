import AsyncStorage from '@react-native-async-storage/async-storage';

// Points to the instance_sys_id of whoever last loaded an assessment on this device.
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
  // Wipe everything except the current session — call when storage is full
  _purgeStale: async (keepInstanceId) => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keep = new Set([
        KEY_CURRENT,
        ...(keepInstanceId ? Object.values(keys(keepInstanceId)) : []),
        `sn_sku_draft_${keepInstanceId}`,
        `sn_catidx_${keepInstanceId}`,
      ]);
      const toRemove = allKeys.filter(k => !keep.has(k));
      if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
    } catch (_) {}
  },

  // Store payload — keyed by instance_sys_id so multiple users don't collide
  set: async (p, fallbackId) => {
    _payload    = p;
    _instanceId = p.instance_sys_id || fallbackId || 'session';
    const k = keys(_instanceId);
    const pairs = [
      [KEY_CURRENT, _instanceId],
      [k.payload,   JSON.stringify(p)],
    ];
    try {
      await AsyncStorage.multiSet(pairs);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota') || e.message?.includes('exceeded')) {
        // Storage full — purge all stale data (old queues, old payloads) and retry
        await assessmentStore._purgeStale(_instanceId);
        await AsyncStorage.multiSet(pairs);
      } else {
        throw e;
      }
    }
  },

  get: () => _payload,

  // Restore from disk after app restart using the last active instance_sys_id
  hydrate: async () => {
    if (_payload) return _payload;
    try {
      const id = await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return null;
      _instanceId = id;
      const s = await AsyncStorage.getItem(keys(id).payload);
      if (s) _payload = JSON.parse(s);
    } catch (_) {}
    return _payload;
  },

  saveSkus: async (skus) => {
    try {
      const id = _instanceId || await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return;
      await AsyncStorage.setItem(keys(id).skus, JSON.stringify(skus));
    } catch (_) {}
  },

  loadSkus: async () => {
    try {
      const id = _instanceId || await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return null;
      const s = await AsyncStorage.getItem(keys(id).skus);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  saveSkuDraft: async (draft) => {
    try {
      const id = _instanceId || await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return;
      await AsyncStorage.setItem(`sn_sku_draft_${id}`, JSON.stringify(draft));
    } catch (_) {}
  },

  loadSkuDraft: async () => {
    try {
      const id = _instanceId || await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return null;
      const s = await AsyncStorage.getItem(`sn_sku_draft_${id}`);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  saveAnswers: async (answers) => {
    try {
      const id = _instanceId || await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return;
      const serialized = JSON.stringify(answers);
      try {
        await AsyncStorage.setItem(keys(id).answers, serialized);
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.message?.includes('quota') || e.message?.includes('exceeded')) {
          await assessmentStore._purgeStale(id);
          try {
            await AsyncStorage.setItem(keys(id).answers, serialized);
          } catch {
            // Still too large after purge — signal caller
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
      const id = _instanceId || await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return null;
      const s = await AsyncStorage.getItem(keys(id).answers);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  saveCategoryIndex: async (index) => {
    try {
      const id = _instanceId || await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return;
      await AsyncStorage.setItem(`sn_catidx_${id}`, String(index));
    } catch (_) {}
  },

  loadCategoryIndex: async () => {
    try {
      const id = _instanceId || await AsyncStorage.getItem(KEY_CURRENT);
      if (!id) return 0;
      const s = await AsyncStorage.getItem(`sn_catidx_${id}`);
      return s !== null ? parseInt(s, 10) : 0;
    } catch (_) { return 0; }
  },

  savePendingComplete: async (data) => {
    try {
      await AsyncStorage.setItem(KEY_PENDING_COMPLETE, JSON.stringify(data));
    } catch (_) {}
  },

  loadPendingComplete: async () => {
    try {
      const s = await AsyncStorage.getItem(KEY_PENDING_COMPLETE);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  },

  clearPendingComplete: async () => {
    try {
      await AsyncStorage.removeItem(KEY_PENDING_COMPLETE);
    } catch (_) {}
  },

  // Wipe the current session (on submit or before loading a new assessment)
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
      await AsyncStorage.multiRemove(toRemove);
    } catch (_) {}
  },
};
