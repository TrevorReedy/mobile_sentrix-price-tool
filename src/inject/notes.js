

(() => {
  /* ---- 1.  bail-out if we are on the login page ---------- */
  if (location.href.includes('account/login')) return;
  if(!location.href.includes("replacement-parts")) return;

  const CONTAINER_ID = 'device-notes-container';
  const STORAGE_KEY  = 'deviceNotes';

  /* -------------- utilities -------------------------------- */
  function waitForAny(selectors, timeout = 12000) {
    return new Promise(resolve => {
      const find = () => selectors.map(s => document.querySelector(s)).find(Boolean);
      const immediate = find();
      if (immediate) return resolve(immediate);
      const obs = new MutationObserver(() => {
        const el = find();
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(document.documentElement, {childList: true, subtree: true});
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });
  }



  function slugifyKey(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /* -------------- name extraction -------------------------- */
  function extractDeviceNameFromPage() {
    const selectors = [
      '#category-title-h1', 'h1', '.category-title',
      '.page-title', '.product-title', '.device-name'
    ];
    let el = null;
    for (const s of selectors) {
      const tmp = document.querySelector(s);
      if (tmp && tmp.textContent && tmp.textContent.trim().length > 5) { el = tmp; break; }
    }
    if (!el) return null;
    let raw = el.textContent
      .replace(/\b(Replacement Parts|Repair Parts|Parts|Accessories|Tools)\b/gi, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\b(A\d{4}|M\d|M\d\s*[Cc]hip|M\d\s*[Pp]rocessor)\b/gi, '')
      .replace(/\s+/g, ' ').trim();
    return raw || null;
  }

  function buildNotesKey(deviceName) {
    if (!deviceName) return '';
    let key = deviceName;
    if (/^macbook\b/i.test(key)) {
      const inchMatch = key.match(/(\d+(?:\.\d+)?)"/);
      if (inchMatch) key = key.replace(/"/, ` ${inchMatch[1]} inch`);
    }
    return slugifyKey(key);
  }

  /* -------------- UI (NO iFixit link) ---------------------- */
  function createNotesUI(notesKey, deviceName) {
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    Object.assign(container.style, {
      border: '1px solid #ddd', background: '#fafafa', padding: '10px',
      marginBottom: '12px', borderRadius: '6px', fontFamily: 'Arial, sans-serif'
    });

    const heading = document.createElement('strong');
    heading.textContent = 'Device Notes';
    heading.style.display = 'block'; heading.style.marginBottom = '6px';
    container.appendChild(heading);

    const ta = document.createElement('textarea');
    Object.assign(ta.style, {
      width: '100%', minHeight: '60px', marginTop: '6px', padding: '8px',
      borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'Arial, sans-serif',
      fontSize: '14px'
    });
    ta.placeholder = 'Add notes for this device… (auto-saves)';
    container.appendChild(ta);

    chrome.storage.sync.get([STORAGE_KEY], res => {
      ta.value = res?.[STORAGE_KEY]?.[notesKey] || '';
    });

    let t;
    ta.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        chrome.storage.sync.get([STORAGE_KEY], res => {
          const all = res?.[STORAGE_KEY] || {};
          all[notesKey] = ta.value;
          chrome.storage.sync.set({ [STORAGE_KEY]: all });
        });
      }, 300);
    });
    return container;
  }

  /* -------------- injection -------------------------------- */
  async function inject() {
    if (document.getElementById(CONTAINER_ID)) return;
    const titleEl = await waitForAny(['#category-title-h1', 'h1', '.category-title']);
    if (!titleEl) return;
    const deviceName = extractDeviceNameFromPage();
    if (!deviceName) return console.log('Could not extract device name');
    const notesKey = buildNotesKey(deviceName);
    titleEl.parentElement.insertBefore(
      createNotesUI(notesKey, deviceName),
      titleEl
    );
  }



  /* -------------- bootstrap -------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  /* -------------- SPA support ------------------------------ */
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById(CONTAINER_ID)?.remove();
      setTimeout(inject, 1000);
    }
  }).observe(document, {subtree: true, childList: true});



  // single bootstrap (only once)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } 
  

})();

beforeEach(() => document.body.innerHTML = '');

test('injects textarea under h1 when on replacement-parts page', async () => {
  document.body.innerHTML = `
    <h1 class="category-title">iPhone 12 Pro Max</h1>
  `;
  location.href = 'https://cpr.parts/replacement-parts/iphone-12-pro-max';
  await inject();
  expect(document.querySelector('textarea')).toBeTruthy();
  expect(document.querySelector('textarea').placeholder)
    .toMatch(/Add notes for this device/);
});

