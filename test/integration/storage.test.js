test('writes and reads notes', (done) => {
  const noteKey = 'iphone-12-pro-max';
  const value   = 'Test note';

  // 1️⃣  write
  chrome.storage.sync.set({ deviceNotes: { [noteKey]: value } }, () => {
    // 2️⃣  read
    chrome.storage.sync.get('deviceNotes', (res) => {
      expect(res.deviceNotes).toBeDefined();
      expect(res.deviceNotes[noteKey]).toBe(value);
      done();
    });
  });
});