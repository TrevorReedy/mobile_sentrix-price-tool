// 1-line in-memory store
const store = {};

global.chrome = {
  storage: {
    sync: {
      get: jest.fn((keys, cb) => {
        // return only the requested keys
        const out = {};
        if (keys === 'deviceNotes') out.deviceNotes = store.deviceNotes || {};
        else if (typeof keys === 'string') out[keys] = store[keys];
        else if (Array.isArray(keys)) keys.forEach(k => out[k] = store[k] || {});
        cb(out);
      }),
      set: jest.fn((obj, cb) => {
        // actually write to the bag
        Object.assign(store, obj);
        if (cb) cb();
      })
    }
  }
};