/**
 * inject.js - INJECTOR MODULE
 * Handles: UI injection, settings loading, DOM observation
 */
(() => {
  "use strict";

  const CART_IDS = {
    root: "repairCalc",
    empty: "rcEmpty",
    list: "rcList",
    parts: "rcPartsTotal",
    laborRow: "rcLaborRow",
    labor: "rcLaborTotal",
    grand: "rcGrandTotal",
    clear: "rcClear",
  };

  // ---- CONFIG HANDLING ----
  async function loadLaborSettings() {
    try {
      const keys = ["rate", "laborRate", "baseLabor", "config", "laborConfig"];
      let res = {};

      // Try chrome storage (sync first, then local)
      if (typeof chrome !== "undefined" && chrome.storage) {
        try {
          // Try sync first
          res = await new Promise((resolve) => {
            chrome.storage.sync.get(keys, (result) => resolve(result || {}));
          });
          // If sync is empty, try local
          if (!res.laborConfig) {
            res = await new Promise((resolve) => {
              chrome.storage.local.get(keys, (result) => resolve(result || {}));
            });
          }
          console.log("Loaded from storage:", res);
        } catch (e) {
          console.log("Could not load from chrome storage:", e);
        }
      }

      // Get rate (fallback only)
      let rate = Number(res.rate) || Number(res.laborRate) || Number(res.baseLabor) || 0;

      // Get config (storage override), else use the shared DEFAULT_CONFIG
      let config = res.config || res.laborConfig;
      if (!config) {
        console.log("No config in storage, using default config.");
        config = (typeof window !== "undefined" && window.CPR_LABOR_DEFAULT_CONFIG) || {
          defaults: { phone: 75, tablet: 100, switch: 100, computer: 130, console: 130 },
          advanced: { iphoneChargePort: 100, backHousing: 100, soldering: 130 }
        };
      } else {
        console.log("Using config from storage override:", config);
      }

      // Merge storage override ON TOP of default config
      const baseDefaults = (typeof window !== "undefined" && window.CPR_LABOR_DEFAULT_CONFIG && window.CPR_LABOR_DEFAULT_CONFIG.defaults) || {};
      const baseAdvanced = (typeof window !== "undefined" && window.CPR_LABOR_DEFAULT_CONFIG && window.CPR_LABOR_DEFAULT_CONFIG.advanced) || {};
      config = {
        defaults: { ...baseDefaults, ...(config.defaults || {}) },
        advanced: { ...baseAdvanced, ...(config.advanced || {}) },
      };

      return { rate, config };
    } catch (e) {
      console.error("loadLaborSettings failed:", e);
      return { rate: 0, config: (typeof window !== "undefined" && window.CPR_LABOR_DEFAULT_CONFIG) || {} };
    }
  }


  async function loadMarkupSettings() {
  const keys = ["markupConfig"];
  let res = {};

  if (typeof chrome !== "undefined" && chrome.storage) {
    res = await new Promise((resolve) => {
      chrome.storage.sync.get(keys, (result) => resolve(result || {}));
    });
    if (!res.markupConfig) {
      res = await new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
      });
    }
  }

  const base =
    (typeof window !== "undefined" && window.CPR_MARKUP_DEFAULT_CONFIG) ||
    { level_1:0, level_2:0, level_3:0, level_4:0, level_5:0, level_6:0 };

  return { ...base, ...(res.markupConfig || {}) };
}
// ---- UI INJECTION ----
// Updated injectCartHTML function - replace in inject.js
function injectCartHTML() {
  // 1. Already exists check
  if (document.getElementById(CART_IDS.root)) return;

  // 2. More specific check for cart/checkout pages
  const currentPath = window.location.pathname.toLowerCase();
  const currentUrl = window.location.href.toLowerCase();
  
  // Don't inject on actual cart/checkout pages
  const cartKeywords = ['/cart', '/checkout', '/basket', '/order', '/payment', '/shipping', '/placeorder'];
  // const urlKeywords = ['/cart', '/checkout', '/basket', '/placeorder'];
  
  if (cartKeywords.some(keyword => currentPath.includes(keyword))) {
    console.log("On cart/checkout page, skipping injection due to " + keyword);
    return;
  }
  
  // if (urlKeywords.some(keyword => currentUrl.includes(keyword))) {
  //   console.log("URL contains cart/checkout keyword, skipping injection");
  //   return;
  // }

  // 3. Don't inject if we're viewing a mini-cart/modal cart
  // Check for common cart containers but only if they're visible/populated
  const cartContainers = [
    '.block-content.showcart-1.display_cart',
    '.mini-products-list',
    '#np-cart',
    '.np-cart',
    '.minicart'
  ];
  
  for (const selector of cartContainers) {
    const cartElement = document.querySelector(selector);
    if (cartElement && cartElement.offsetParent !== null) {
      // Check if cart has items (not just empty)
      const hasItems = cartElement.querySelector('li.item, .product-item, .cart-item');
      if (hasItems) {
        console.log(`Found active cart with items: ${selector}, skipping injection`);
        return;
      }
    }
  }

  // 4. Create and inject the HTML
  const aside = document.createElement("aside");
  aside.id = CART_IDS.root;
  aside.className = "repair-calc";
  aside.innerHTML = `
    <div class="rc-head">
      <div class="rc-title">Repair Calculator</div>
    </div>

    <div id="${CART_IDS.empty}" class="rc-empty">No items yet.</div>
    <ul id="${CART_IDS.list}" class="rc-list"></ul>

    <div class="rc-totals">
      <div class="rc-row">
        <span>Parts</span>
        <strong id="${CART_IDS.parts}">$0.00</strong>
      </div>

      <div class="rc-row" id="${CART_IDS.laborRow}" style="display:none;">
        <span>Labor</span>
        <strong id="${CART_IDS.labor}">$0.00</strong>
      </div>

      <div class="rc-row rc-grand">
        <span>Total</span>
        <strong id="${CART_IDS.grand}">$0.00</strong>
      </div>
    </div>

    <div class="rc-actions">
      <button id="${CART_IDS.clear}" type="button" class="rc-btn">Clear</button>
    </div>
  `;

  document.body.appendChild(aside);
  console.log("Cart HTML injected");
}

  // ---- MAIN EXECUTION ----
  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  let SETTINGS = { rate: 0, config: {} };
  let RepairCart = null;

  async function runPass() {
    

    // 1. Inject HTML
    injectCartHTML();

    // 2. Initialize RepairCart module if available
    if (typeof window.RepairCartModule !== "undefined" && !RepairCart) {
      RepairCart = window.RepairCartModule.init(CART_IDS.root);
      window.RepairCart = RepairCart; // Expose globally for helper.js
      console.log("RepairCart module initialized");
    }

    // 3. Run addPrices if available
    if (typeof window.addPrices === "function") {
      console.log("Running addPrices with settings:", SETTINGS);
      window.addPrices(SETTINGS.rate, SETTINGS.config, SETTINGS.markup);
      
      // Update button states after prices are added
      if (RepairCart && typeof RepairCart.updateAllButtonStates === "function") {
        setTimeout(() => RepairCart.updateAllButtonStates(), 100);
      }
    }
  }

  async function init() {
    console.log("Initializing injector...");
    
    // Load settings
    const labor = await loadLaborSettings();
    const markup = await loadMarkupSettings();
    SETTINGS = {...labor, markup}
    window.__CPR_LABOR__ = SETTINGS;
    
    // Initial run
    await runPass();

    // Set up observers for dynamic content
    const runPassDebounced = debounce(runPass, 250);

    const obs = new MutationObserver(() => runPassDebounced());
    obs.observe(document.documentElement, { childList: true, subtree: true });
    
    // Re-run on navigation
    window.addEventListener("popstate", runPassDebounced);
    window.addEventListener("hashchange", runPassDebounced);
    
    console.log("Injector initialized successfully");
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    setTimeout(init, 100);
  }
})();