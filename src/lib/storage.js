// Drop-in localStorage adapter matching the AsyncStorage API surface used in this app.
const storage = {
  async getItem(key) {
    return localStorage.getItem(key);
  },
  async setItem(key, value) {
    localStorage.setItem(key, value);
  },
  async removeItem(key) {
    localStorage.removeItem(key);
  },
  async multiGet(keys) {
    return keys.map(key => [key, localStorage.getItem(key)]);
  },
  async multiSet(pairs) {
    pairs.forEach(([key, value]) => localStorage.setItem(key, value));
  },
  async multiRemove(keys) {
    keys.forEach(key => localStorage.removeItem(key));
  },
  async getAllKeys() {
    return Object.keys(localStorage);
  },
};

export default storage;
