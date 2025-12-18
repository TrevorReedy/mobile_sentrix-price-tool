/**
 * @author Riley Brust <brust.developer@gmail.com>
 * @version 0.1.0
 * @description Chrome extension that displays repair cost in the websites.
 * @file inject.js
 */

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.laborConfig) {
    location.reload(); // reload the actual product page
  }
});


async function main() {
  const url = document.URL;
  const blacklist = ["tools", "brands/", "refurbishing", "accessories", "checkout"];
  if (blacklist.some((word) => url.includes(word))) return;


  const switch_device = ["switch"];
  const tablets  = ["ipad", "surface", "galaxy-tab", "samsung/tab"];
  const consoles = ["game-console", "sony", "xbox", "nintendo", "macbook", "imac"];
  
  const config = await loadConfig();
  const defs = config.defaults;

  // Base labor from config, not hardcoded
  let baseLabor = defs.phone;

  if (switch_device.some((word) => url.includes(word)))  baseLabor = defs.switch;
  if (consoles.some((word)  => url.includes(word)) && !url.includes(switch_device)) baseLabor = defs.console; 
  if (tablets.some((word) => url.includes(word)))  baseLabor = defs.switch;

  // Initial pass
  addPrices(baseLabor, config);

  // Mutation observer for lazy-loaded products
  const observer = new MutationObserver((mutations) => {
    let shouldRun = false;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.classList && node.classList.contains("price")) {
          shouldRun = true;
          break;
        }
        if (node.querySelector && node.querySelector(".price")) {
          shouldRun = true;
          break;
        }
      }
      if (shouldRun) break;
    }

    if (shouldRun) {
      addPrices(baseLabor, config);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}


function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["laborConfig"], (result) => {
      if (result && result.laborConfig) {
        // Merge with defaults in case you add new fields later
        const cfg = result.laborConfig;
        const merged = {
          defaults: { ...DEFAULT_CONFIG.defaults, ...(cfg.defaults || {}) },
          advanced: { ...DEFAULT_CONFIG.advanced, ...(cfg.advanced || {}) },
        };
        resolve(merged);
      } else {
        resolve(DEFAULT_CONFIG);
      }
    });
  });
}



function addHTML(labor, part_item, url) {
    // 🔹 1) Skip if this price is inside a summary/subtotal container
    let el = part_item;
    while (el && el !== document.body) {
        // Look at class, id, and aria-label
        const meta =
            (el.className || '') + ' ' +
            (el.id || '') + ' ' +
            (el.getAttribute && el.getAttribute('aria-label') || '');

        const lower = meta.toLowerCase();

        if (lower.includes('summary') || lower.includes('subtotal') || lower.includes('product-details')) {
            // Don't inject into order summary / cart subtotal / etc.
            return;
        }

        el = el.parentElement;
    }

    // 🔹 2) Normal logic below

    const costText = part_item.textContent || '';
    const cost = costText.replace('$', '');
    const repair_price = calcRepair(Number(cost), labor);

    // Build a small table with Part Price, Labor, and Repair Price
    const partPrice = Math.max(0, repair_price - Number(labor || 0));

    const table = document.createElement('table');
    table.className = 'repair-table';
    table.style.fontFamily = 'Arial, sans-serif';
    table.style.fontSize = '14px';

    const tbody = document.createElement('tbody');

    const makeRow = (label, value, valueClass) => {
        const tr = document.createElement('tr');
        const tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        tdLabel.className = 'repair-table-label';
        const tdValue = document.createElement('td');
        tdValue.textContent = value;
        tdValue.className = valueClass || 'repair-table-value';
        tr.appendChild(tdLabel);
        tr.appendChild(tdValue);
        return tr;
    };

    // (You had Part Price twice before – now just once)
    tbody.appendChild(makeRow('Part Price:', '$' + partPrice.toFixed(2)));
    tbody.appendChild(makeRow('Labor:', '$' + Number(labor).toFixed(2)));
    tbody.appendChild(
        makeRow('Repair Price:', '$' + Number(repair_price).toFixed(2), 'repair-table-repair')
    );

    table.appendChild(tbody);

    const container = document.createElement('div');
    container.className = 'repair-container';

    if (!url.includes('replacement-parts') && url.includes('cpr.parts')) {
        const spacer = document.createElement('br');
        container.appendChild(spacer);
    }

    container.appendChild(table);

    const parent = part_item.parentElement;
    if (parent) parent.appendChild(container);
}





main();
