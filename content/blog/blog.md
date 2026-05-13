# Mobile Sentrix Pricing Tool for CPR Stores  
**By Trevor Reedy**

---

## Introduction: A Simple Idea Meets a Real Production Website

I started working at Cell Phone Repair in August 2025 and was first introduced to our internal pricing tool as a Chrome extension. At a glance, the extension did its job: it injected repair pricing into product listings and helped employees generate quotes quickly.

However, after using it in real store workflow, I found that the tool had three major reliability problems.

1. **Dynamic content was not handled**  
   Product rows were not always present when the page first loaded. The site used lazy loading and Single Page Application behavior, so the first batch of visible products might receive injected pricing, but newly loaded products often did not.

2. **Labor calculation logic was too simple**  
   A flat labor rate worked for basic repairs, but it failed for advanced repairs. A screen repair, soldering job, back housing replacement, iPhone charging port repair, tablet repair, and console repair do not all belong in the same pricing bucket.

3. **Repair knowledge lived outside the system**  
   As I learned the job, I picked up repair-specific knowledge that experienced technicians already knew. For example, some devices have special part behavior, some iPhone back glass repairs require a housing replacement, and certain iPad screens are fused assemblies rather than separate LCD and digitizer repairs.

The original extension was useful, but it was more of a DOM hack than a stable system. The rebuild turned it into a small browser-based pricing platform with configuration, injection, pricing calculation, cart aggregation, and persistent device notes.

---

## The Stack from Top to Bottom

At a high level, this project is a Chrome extension that runs JavaScript inside supported parts websites. It does not control the website backend. Instead, it observes the page that already exists, finds product price elements, calculates repair prices, and injects extra UI into the page.

The stack can be thought of in layers:

```txt
User / Technician
        ↓
Chrome Extension Content Scripts
        ↓
Injector Module
        ↓
Configuration Layer
        ↓
Pricing + Labor Calculation Layer
        ↓
DOM Injection Layer
        ↓
Repair Calculator / Cart UI
        ↓
Chrome Storage Sync
```

Each layer has a specific job.

- The **user** browses product listings normally.
- The **content scripts** run inside the browser tab.
- The **injector module** starts the extension, loads settings, watches the page, and reruns injection when the SPA changes.
- The **configuration layer** loads labor and markup settings from `chrome.storage`.
- The **pricing layer** parses part prices, chooses labor, applies markup, and calculates a final repair quote.
- The **DOM injection layer** creates the visible repair table and add-to-cart button for each product.
- The **repair calculator UI** aggregates selected repairs into a sidebar.
- The **notes system** persists device-specific notes through Chrome sync.

This is why the project became more than “add a table under a price.” The real challenge was making the extension deterministic inside a page that is constantly changing.

---

## File-Level Architecture

The project is split into small JavaScript files with clear responsibilities.

```txt
laborConfig.js
  Defines default labor categories and advanced labor override fields.

markupConfig.js
  Defines default markup levels.

inject.js
  Starts the extension, loads settings, injects the sidebar calculator,
  watches the DOM, and calls the pricing injection function.

helper.js
  Finds product prices, determines device type, calculates labor and repair
  pricing, creates repair tables, and adds per-product buttons.

notes.js
  Adds a persistent notes box to supported device/category pages.

RepairCart module
  Referenced by inject.js as window.RepairCartModule.
  This handles selected repair items inside the calculator sidebar.
```

This separation matters because each file answers a different question:

```txt
laborConfig.js      → What labor categories exist?
markupConfig.js     → What markup tiers exist?
inject.js           → When should the extension run?
helper.js           → What price should be shown?
notes.js            → What device-specific knowledge should be saved?
RepairCart module   → What has the technician selected?
```

Without this separation, the project would collapse back into one large content script where DOM logic, business rules, configuration, and UI state are all mixed together.

---

## Why the Original Version Broke

The first version followed the common content-script pattern:

1. Check the current URL.
2. Pick a labor rate from the URL.
3. Find every `.price` element.
4. Append a repair price table.
5. Stop.

That works on a traditional static page, but it breaks on a Single Page Application.

---

## V1 Injection Logic: Runs Once

```js
function main() {
  let url = document.URL;

  const blacklist = ["tools", "brands/", "refurbishing", "accessories", "checkout"];
  if (blacklist.some((word) => url.includes(word))) return;

  const tablets = ["ipad", "surface", "galaxy-tab", "samsung/tab"];
  const consoles = ["game-console", "sony", "xbox", "nintendo", "macbook-parts"];

  let labor = 75;
  if (tablets.some((word) => url.includes(word))) labor = 100;
  if (consoles.some((word) => url.includes(word))) labor = 130;

  addPrices(labor);
}

main();
```

The issue is not that this code is “wrong.” The issue is that it assumes the page is finished loading when `main()` runs. On a modern product listing page, that assumption is unsafe.

The website can load more products after scrolling, replace sections of the page without a full refresh, or update content after filters are changed. When that happens, `main()` does not automatically run again.

---

## V1 DOM Loop: One-Pass Injection

```js
function addPrices(labor) {
  const url = document.URL;
  let elements = [];

  if (
    url.includes("sentrix") ||
    url.includes("defenders") ||
    url.includes("cpr")
  ) {
    elements = Array.from(document.getElementsByClassName("price"));
  }

  for (const part_item of elements) {
    if (!part_item) continue;

    const parent = part_item.parentElement;
    if (!parent) continue;

    addHTML(labor, part_item, url);
  }
}
```

This loop only sees the price elements that exist at the time it runs. If twenty more products are added to the DOM afterward, this function knows nothing about them.

That was the core architectural problem: the extension treated the DOM as static, but the site behaved dynamically.

---

## The Rebuilt Runtime Model

The rebuilt version uses a different mental model:

```txt
Do not assume the page is done.
Instead, observe the page and safely rerun the injection pass.
```

The extension now performs repeatable injection passes. Each pass does three things:

1. Make sure the calculator sidebar exists.
2. Make sure the cart module is initialized.
3. Find any new price elements that have not been processed yet.

That flow lives in `inject.js`.

```js
async function runPass() {
  console.log("Running injection pass...");

  // 1. Inject HTML
  injectCartHTML();

  // 2. Initialize RepairCart module if available
  if (typeof window.RepairCartModule !== "undefined" && !RepairCart) {
    RepairCart = window.RepairCartModule.init(CART_IDS.root);
    window.RepairCart = RepairCart;
    console.log("RepairCart module initialized");
  }

  // 3. Run addPrices if available
  if (typeof window.addPrices === "function") {
    console.log("Running addPrices with settings:", SETTINGS);
    window.addPrices(SETTINGS.rate, SETTINGS.config, SETTINGS.markup);

    if (RepairCart && typeof RepairCart.updateAllButtonStates === "function") {
      setTimeout(() => RepairCart.updateAllButtonStates(), 100);
    }
  }
}
```

This function is the center of the runtime. It does not directly calculate repair prices itself. Instead, it coordinates the system.

`inject.js` is responsible for orchestration. `helper.js` is responsible for pricing and per-product UI injection.

---

## Extension Bootstrapping

The extension cannot safely manipulate the DOM before the page exists. So the initializer checks the document state before starting.

```js
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  setTimeout(init, 100);
}
```

This does two things:

- If the page is still loading, wait for `DOMContentLoaded`.
- If the page is already loaded, delay slightly and then initialize.

That small delay helps with SPA pages because some frameworks continue rendering shortly after the browser reports that the document is ready.

---

## Loading Configuration Before Running

Before the extension calculates prices, it loads the labor and markup settings.

```js
async function init() {
  console.log("Initializing injector...");

  const labor = await loadLaborSettings();
  const markup = await loadMarkupSettings();

  SETTINGS = { ...labor, markup };
  window.__CPR_LABOR__ = SETTINGS;

  await runPass();

  const runPassDebounced = debounce(runPass, 250);

  const obs = new MutationObserver(() => runPassDebounced());
  obs.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", runPassDebounced);
  window.addEventListener("hashchange", runPassDebounced);

  console.log("Injector initialized successfully");
}
```

This function is important because it defines the order of operations:

```txt
Load labor settings
        ↓
Load markup settings
        ↓
Save settings in memory
        ↓
Run the first injection pass
        ↓
Start observing the page
        ↓
Rerun safely when the page changes
```

The initial pass handles content already present on the page. The observer handles content that appears later.

---

## Why Debouncing Is Required

A `MutationObserver` can fire many times in a short period. A SPA may add a wrapper, then add a row, then add text, then add images, then update attributes. If the extension ran a full injection pass for every mutation, performance would suffer.

The solution is debouncing.

```js
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
```

Debouncing means:

```txt
A change happened.
Wait 250ms.
If another change happens, reset the timer.
Only run once after changes settle.
```

That protects the browser from unnecessary repeated work.

```js
const runPassDebounced = debounce(runPass, 250);

const obs = new MutationObserver(() => runPassDebounced());
obs.observe(document.documentElement, { childList: true, subtree: true });
```

This gives the extension a reliable way to react to lazy-loaded products without constantly hammering the DOM.

---

## SPA Navigation Support

Single Page Applications often change the page without performing a traditional browser reload. That means normal content-script startup does not always happen again.

To handle this, the extension listens for browser navigation events.

```js
window.addEventListener("popstate", runPassDebounced);
window.addEventListener("hashchange", runPassDebounced);
```

These events help catch cases where the user moves between product categories, filter states, or client-side routes without a full page refresh.

The end result is that the extension behaves more like part of the page lifecycle instead of a one-time script.

---

## The Configuration Layer

The extension uses two config files as default global configuration sources.

### `laborConfig.js`

```js
const DEFAULT_CONFIG = {
  defaults: {
    phone: 0,
    tablet: 0,
    switch: 0,
    computer: 0,
    console: 0,
  },
  advanced: {
    iphoneChargePort: 0,
    backHousing: 0,
    soldering: 0,
  },
};

if (typeof window !== "undefined") {
  window.CPR_LABOR_DEFAULT_CONFIG = DEFAULT_CONFIG;
}
```

This file defines the shape of labor configuration.

There are two categories:

```txt
defaults
  Baseline labor by device type.

advanced
  Overrides for repairs that should not use normal device labor.
```

Examples:

```txt
defaults.phone
defaults.tablet
defaults.computer
defaults.console
advanced.iphoneChargePort
advanced.backHousing
advanced.soldering
```

The values shown here are zero because this file acts as the default shape. Real values can be loaded from Chrome storage.

---

### `markupConfig.js`

```js
const MARKUP_CONFIG = {
  level_1: 0,
  level_2: 0,
  level_3: 0,
  level_4: 0,
  level_5: 0,
  level_6: 0,
};

if (typeof window !== "undefined") {
  window.CPR_MARKUP_DEFAULT_CONFIG = MARKUP_CONFIG;
}
```

Markup config works the same way. It defines the expected keys for markup tiers.

The pricing logic later maps part-cost ranges to these levels:

```txt
$0.01  - $9.99    → level_1
$10.00 - $24.99   → level_2
$25.00 - $49.99   → level_3
$50.00 - $99.99   → level_4
$100.00 - $199.99 → level_5
$200.00+          → level_6
```

This makes markup adjustable without changing the price calculation code.

---

## Chrome Storage as the Settings Backend

A normal website might store settings in a database. This extension stores settings with Chrome extension storage.

The injector attempts to load labor settings from `chrome.storage.sync` first, then falls back to `chrome.storage.local`.

```js
const keys = ["rate", "laborRate", "baseLabor", "config", "laborConfig"];
let res = {};

if (typeof chrome !== "undefined" && chrome.storage) {
  try {
    res = await new Promise((resolve) => {
      chrome.storage.sync.get(keys, (result) => resolve(result || {}));
    });

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
```

The storage priority is intentional:

```txt
chrome.storage.sync
        ↓
chrome.storage.local
        ↓
default config
```

`sync` is preferred because it can follow the Chrome profile across devices. `local` is useful as a fallback when sync is unavailable or empty.

---

## Merging Defaults with Overrides

The extension does not simply trust storage blindly. It merges stored settings over known defaults.

```js
const baseDefaults =
  (typeof window !== "undefined" &&
    window.CPR_LABOR_DEFAULT_CONFIG &&
    window.CPR_LABOR_DEFAULT_CONFIG.defaults) ||
  {};

const baseAdvanced =
  (typeof window !== "undefined" &&
    window.CPR_LABOR_DEFAULT_CONFIG &&
    window.CPR_LABOR_DEFAULT_CONFIG.advanced) ||
  {};

config = {
  defaults: { ...baseDefaults, ...(config.defaults || {}) },
  advanced: { ...baseAdvanced, ...(config.advanced || {}) },
};
```

This pattern is important because it prevents missing config fields from breaking the extension.

For example, if storage only contains:

```js
{
  defaults: {
    phone: 75
  }
}
```

The merge still preserves the rest of the expected structure:

```js
{
  defaults: {
    phone: 75,
    tablet: 0,
    switch: 0,
    computer: 0,
    console: 0
  },
  advanced: {
    iphoneChargePort: 0,
    backHousing: 0,
    soldering: 0
  }
}
```

That means the code can safely access `config.defaults` and `config.advanced` without constantly checking whether those objects exist.

---

## Markup Settings Loading

Markup follows the same pattern.

```js
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
    { level_1: 0, level_2: 0, level_3: 0, level_4: 0, level_5: 0, level_6: 0 };

  return { ...base, ...(res.markupConfig || {}) };
}
```

The important idea is that pricing rules are no longer hardcoded into the injection flow. They are treated as configuration.

That makes the extension easier to maintain because changing pricing policy does not require rewriting the DOM injection logic.

---

## The Main Injector UI

The calculator sidebar is created in `inject.js`.

The extension first checks whether the calculator already exists:

```js
if (document.getElementById(CART_IDS.root)) return;
```

This makes sidebar injection idempotent. If the sidebar already exists, the function exits before creating another one.

That is critical because `runPass()` may execute many times during one browsing session.

---

## Avoiding Cart and Checkout Pages

The extension should not inject the repair calculator into checkout, cart, shipping, or payment pages. Those pages already have prices, cart state, and order flow. Injecting repair pricing there could confuse the user or create duplicate UI.

The injector checks the current path first.

```js
const currentPath = window.location.pathname.toLowerCase();

const cartKeywords = [
  "/cart",
  "/checkout",
  "/basket",
  "/order",
  "/payment",
  "/shipping",
  "/placeorder"
];

if (cartKeywords.some(keyword => currentPath.includes(keyword))) {
  console.log("On cart/checkout page, skipping injection due to " + keyword);
  return;
}
```

This is a defensive rule. It prevents the extension from injecting UI in places where it should not participate.

---

## Avoiding Mini-Cart and Modal Cart Areas

Some websites show mini-carts or slide-out carts without changing the URL. That means URL checking is not enough.

The injector also checks for visible cart containers.

```js
const cartContainers = [
  ".block-content.showcart-1.display_cart",
  ".mini-products-list",
  "#np-cart",
  ".np-cart",
  ".minicart"
];

for (const selector of cartContainers) {
  const cartElement = document.querySelector(selector);
  if (cartElement && cartElement.offsetParent !== null) {
    const hasItems = cartElement.querySelector("li.item, .product-item, .cart-item");
    if (hasItems) {
      console.log(`Found active cart with items: ${selector}, skipping injection`);
      return;
    }
  }
}
```

This is an example of adapting to real-world DOM conditions. The extension is not just checking what page it is on. It is checking what region of the page is currently active.

---

## Creating the Calculator Sidebar

Once the page is considered safe, the injector creates the calculator.

```js
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
```

The sidebar has stable IDs for each important part:

```js
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
```

Using a centralized ID map avoids scattering raw strings throughout the code. If one ID changes, it can be updated in one place.

---

## How `inject.js` Talks to `helper.js`

The injector does not import `helper.js` using ES modules. Instead, the helper exposes functions globally on `window`.

```js
if (typeof window !== "undefined") {
  window.calcRepair = calcRepair;
  window.getLaborSingle = getLaborSingle;
  window.addPrices = addPrices;
}
```

Then `inject.js` checks for the global function before using it:

```js
if (typeof window.addPrices === "function") {
  window.addPrices(SETTINGS.rate, SETTINGS.config, SETTINGS.markup);
}
```

This is a practical Chrome extension pattern when content scripts are loaded in a specific order and direct module imports are inconvenient.

The boundary is simple:

```txt
inject.js loads settings
inject.js calls window.addPrices(...)
helper.js owns addPrices(...)
helper.js injects per-product pricing UI
```

---

## The Pricing Layer

The pricing layer lives mostly in `helper.js`.

Its job is to answer four questions:

```txt
What kind of device is this?
What labor should this repair use?
What markup applies to the part cost?
What final repair price should be displayed?
```

---

## Device Type Detection

The first step is to infer the device type from the URL and nearby product name.

```js
function pickDeviceType(url, name) {
  const u = String(url || "").toLowerCase();
  const n = String(name || "").toLowerCase();
  const hay = `${u} ${n}`;

  if (
    hay.includes("ipad") ||
    hay.includes("tablet") ||
    hay.includes("galaxy tab") ||
    hay.includes("surface")
  ) {
    return "tablet";
  }

  if (hay.includes("nintendo switch") || hay.includes("/switch") || hay.includes(" switch ")) {
    return "switch";
  }

  if (
    hay.includes("macbook") ||
    hay.includes("imac") ||
    hay.includes("laptop") ||
    hay.includes("notebook") ||
    hay.includes("chromebook") ||
    hay.includes("pc ") ||
    hay.includes("computer")
  ) {
    return "computer";
  }

  if (
    hay.includes("playstation") ||
    hay.includes("ps5") ||
    hay.includes("ps4") ||
    hay.includes("xbox") ||
    hay.includes("series x") ||
    hay.includes("series s") ||
    hay.includes("nintendo wii") ||
    hay.includes("console")
  ) {
    return "console";
  }

  return "phone";
}
```

This function builds one searchable string called `hay` from the URL and product name.

That means it can detect device type from either source:

```txt
URL contains /ipad/       → tablet
Product name says MacBook → computer
URL contains /switch/     → switch
Product name says PS5     → console
No match                  → phone
```

The default is `phone` because most repair parts in this context are phone parts.

---

## Finding the Product Name Near a Price

The extension needs product context before deciding labor. A price element alone only tells us the cost. It does not tell us whether the product is a screen, charge port, housing, or soldering repair.

The helper searches near the price element for a heading.

```js
function getHeadingTextNear(part_item) {
  let container = part_item.closest(
    "li.item, .product-item, .item, .product-view, .product-essential"
  );

  let heading = container
    ? container.querySelector("h2.product-name, h1, .product-name, .page-title")
    : null;

  if (!heading) {
    heading = document.querySelector("h1, h2.product-name, .product-name, .page-title");
  }

  return heading ? heading.textContent : "";
}
```

This is another real-world DOM compromise. Product pages and listing pages do not always share the same markup. The function first searches near the item, then falls back to a page-level heading.

---

## Labor Calculation

Labor is calculated by `getLaborSingle`.

```js
function getLaborSingle(part_item, baseLabor, config, url) {
  const defaults = (config && config.defaults) ? config.defaults : {};
  const advanced = (config && config.advanced) ? config.advanced : {};

  const headingText = getHeadingTextNear(part_item);
  const name = String(headingText || "").toLowerCase();
  const deviceType = pickDeviceType(url, name);

  const fallback = Number(baseLabor) || 0;
  const defaultForType = Number(defaults[deviceType]);

  let perItemLabor =
    (Number.isFinite(defaultForType) && defaultForType > 0)
      ? defaultForType
      : fallback;

  if (name.includes("casper")) {
    perItemLabor = 0;
  } else if (name.includes("soldering required")) {
    const adv = Number(advanced.soldering);
    if (Number.isFinite(adv) && adv > 0) perItemLabor = adv;
  } else if (
    name.includes("charging") &&
    name.includes("port") &&
    String(url || "").toLowerCase().includes("iphone")
  ) {
    const adv = Number(advanced.iphoneChargePort);
    if (Number.isFinite(adv) && adv > 0) perItemLabor = adv;
  } else if (
    (
      (name.includes("back") && name.includes("housing")) ||
      name.includes("mid-frame")
    ) &&
    String(url || "").toLowerCase().includes("iphone")
  ) {
    const adv = Number(advanced.backHousing);
    if (Number.isFinite(adv) && adv > 0) perItemLabor = adv;
  }

  return perItemLabor;
}
```

This function has two layers of logic.

First, it chooses baseline labor from the detected device type:

```txt
phone    → config.defaults.phone
tablet   → config.defaults.tablet
switch   → config.defaults.switch
computer → config.defaults.computer
console  → config.defaults.console
```

Then it applies advanced overrides:

```txt
Casper item                  → $0 labor
Soldering required           → advanced.soldering
iPhone charging port         → advanced.iphoneChargePort
iPhone back housing/midframe → advanced.backHousing
```

The important design decision is that advanced repair patterns override baseline device labor. That matches the real business rule: some repair types are special regardless of the normal device category.

---

## Parsing Money from the Page

Product prices appear as text in the DOM. The extension has to turn text like `"$89.99"` into a number.

```js
function parseMoney(text) {
  const n = Number(String(text || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
```

This strips out anything that is not a digit or decimal point.

Examples:

```txt
"$89.99"       → 89.99
"Price: $120"  → 120
""             → 0
```

This is small but important. All pricing math depends on converting DOM text into a usable number.

---

## Markup Tier Selection

Once the part cost is known, the helper chooses a markup multiplier.

```js
function getMarkupMultiplier(partcost, markupCfg) {
  const m = markupCfg || {};

  if (partcost > 0 && partcost <= 9.99) return Number(m.level_1) || 0;
  if (partcost >= 10 && partcost <= 24.99) return Number(m.level_2) || 0;
  if (partcost >= 25 && partcost <= 49.99) return Number(m.level_3) || 0;
  if (partcost >= 50 && partcost <= 99.99) return Number(m.level_4) || 0;
  if (partcost >= 100 && partcost <= 199.99) return Number(m.level_5) || 0;
  if (partcost >= 200) return Number(m.level_6) || 0;

  return 0;
}
```

This creates a configurable pricing ladder. Cheap parts and expensive parts can have different multipliers.

For example, a $5 part and a $250 part should not necessarily use the same pricing strategy. The level system allows the store to tune pricing by cost range.

---

## Final Repair Price Calculation

The actual repair quote is calculated by `calcRepair`.

```js
function calcRepair(partcost, labor, markupCfg) {
  const mult = getMarkupMultiplier(partcost, markupCfg);
  const price = (partcost * mult) + labor;
  const rounded = Math.ceil(price / 10) * 10;
  return Math.round(rounded) - 0.01;
}
```

The formula is:

```txt
repair price = (part cost × markup multiplier) + labor
```

Then the value is rounded up to the next ten-dollar increment and reduced by one cent.

Example:

```txt
part cost: $42.00
markup: 2
labor: $75.00

(42 × 2) + 75 = 159
round up to next 10 = 160
final display price = 159.99
```

The `- 0.01` gives the common retail-style price ending.

---

## Main DOM Injection in `helper.js`

The heart of the per-product injection is `addPrices`.

```js
function addPrices(rate, config, markup) {
  const url = document.URL;

  if (!(url.includes("sentrix") || url.includes("defenders") || url.includes("cpr"))) {
    return;
  }

  const allPriceElements =
    document.querySelectorAll('.price:not([data-cpr-calc-applied="1"])');

  if (!allPriceElements.length) return;

  for (const priceEl of allPriceElements) {
    // product processing happens here
  }
}
```

There are two key ideas here.

First, the function only runs on supported sites:

```txt
sentrix
defenders
cpr
```

Second, it only selects price elements that have not already been processed:

```js
'.price:not([data-cpr-calc-applied="1"])'
```

That selector is one of the most important stability improvements in the project.

---

## Guarded Incremental Injection

Each processed price element is marked after injection.

```js
priceEl.dataset.cprCalcApplied = "1";
```

That creates this attribute in the DOM:

```html
<span class="price" data-cpr-calc-applied="1">$89.99</span>
```

Future passes ignore that element because it no longer matches the selector:

```js
document.querySelectorAll('.price:not([data-cpr-calc-applied="1"])');
```

This makes injection idempotent.

Idempotent means the operation can run multiple times without duplicating the result. That is exactly what a browser extension needs inside a SPA.

Without this guard, every mutation could append another repair table to the same product.

---

## Why This Scales Better

The original version effectively did this:

```txt
Every pass:
  Find all prices
  Reprocess all prices
  Risk duplicate UI
```

The rebuilt version does this:

```txt
Every pass:
  Find only unprocessed prices
  Process each new price once
  Mark it as processed
```

That means performance becomes proportional to newly loaded content, not total page size.

If a page has 500 products already processed and 20 more load in, the extension only needs to process the 20 new ones.

---

## Avoiding Product Prices Inside Cart Areas

The helper also avoids injecting repair tables into cart, checkout, mini-cart, summary, order, payment, and shipping areas.

```js
if (
  priceEl.closest(".block-content.showcart-1.display_cart") ||
  priceEl.closest("#np-cart") ||
  priceEl.closest(".cart") ||
  priceEl.closest(".minicart") ||
  priceEl.closest(".checkout") ||
  priceEl.closest(".summary") ||
  priceEl.closest("mini-products-list") ||
  priceEl.closest(".cart-index") ||
  priceEl.closest(".checkout-index") ||
  priceEl.closest(".opc")
) {
  continue;
}
```

This solves a different class of bug. A website can contain many `.price` elements, but not all prices are product-listing prices.

Some prices belong to:

```txt
mini carts
checkout totals
order summaries
shipping/payment pages
```

Those should not receive repair tables.

---

## URL-Level Cart Protection

The helper also checks the current URL.

```js
const currentUrl = url.toLowerCase();

if (
  currentUrl.includes("/cart") ||
  currentUrl.includes("/checkout") ||
  currentUrl.includes("/basket") ||
  currentUrl.includes("/order") ||
  currentUrl.includes("/payment") ||
  currentUrl.includes("/shipping")
) {
  continue;
}
```

The DOM checks and URL checks overlap intentionally.

The URL check catches full-page cart and checkout views. The DOM check catches embedded mini-cart views.

Together they reduce false positives.

---

## Building the Repair Table

Once a price element passes the safety checks, the helper parses the part cost, calculates labor, calculates the final repair price, and creates a table.

```js
const partCost = parseMoney(priceEl.textContent || "");
if (!partCost) continue;

const labor = getLaborSingle(priceEl, rate, config, url);

const repair_price = calcRepair(partCost, labor, markup);
const partPrice = Math.max(0, repair_price - Number(labor || 0));
```

Then it builds the DOM.

```js
const container = document.createElement("div");
container.className = "repair-container";

container.innerHTML = `
  <table class="repair-table">
    <tbody>
      <tr>
        <td class="repair-table-label">Part Price:</td>
        <td class="repair-table-value">$${partPrice.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="repair-table-label">Labor:</td>
        <td class="repair-table-value">$${Number(labor).toFixed(2)}</td>
      </tr>
      <tr>
        <td class="repair-table-label">Repair Price:</td>
        <td class="repair-table-repair">$${Number(repair_price).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
`;
```

The table shows three numbers:

```txt
Part Price
  The marked-up part portion of the quote.

Labor
  The labor portion of the quote.

Repair Price
  The full customer-facing repair quote.
```

This is useful in-store because the technician can see how the final number was formed instead of seeing only a black-box total.

---

## Choosing Where to Insert the Repair Table

The extension tries to attach the injected table to a product-level parent.

```js
const parent =
  priceEl.closest(".product-listing-item") || priceEl.parentElement;

if (!parent) continue;
```

This matters because the table should visually belong to the product row or product card, not to a random nested span.

The priority is:

```txt
Use product listing container if available.
Otherwise, fall back to the price element's direct parent.
```

This gives the extension enough flexibility to work across slightly different product page structures.

---

## Per-Product Add Button

Each injected repair table also receives an add button.

```js
const btn = document.createElement("button");
btn.type = "button";
btn.className = "rc-add-btn";
btn.textContent = "Add to cart";
```

The button stores repair metadata in `data-*` attributes.

```js
btn.dataset.rcId = stableId(priceEl);
btn.dataset.rcName = guessNameNear(priceEl);
btn.dataset.rcPartPrice = String(partPrice.toFixed(2));
btn.dataset.rcLabor = String(Number(labor || 0).toFixed(2));
```

This turns the button into a self-contained data object.

In the DOM, it would look conceptually like this:

```html
<button
  class="rc-add-btn"
  data-rc-id="..."
  data-rc-name="iPhone 14 Screen"
  data-rc-part-price="129.99"
  data-rc-labor="75.00"
>
  Add to cart
</button>
```

The cart module can read these values without needing to recalculate the product.

---

## Stable Item IDs

The helper creates a stable-ish ID for each product button.

```js
function stableId(priceEl) {
  const txt = (priceEl.textContent || "").trim();
  return `${location.href}::${txt}::${priceEl.offsetTop}`;
}
```

The ID combines:

```txt
current URL
price text
vertical position
```

This is not a database ID, but it is practical for a DOM-based browser extension. It helps distinguish one injected item from another on the same page.

---

## Guessing Product Names

The helper tries to infer a readable product name near the price.

```js
function guessNameNear(priceEl) {
  const host =
    priceEl.closest("li.item") ||
    priceEl.closest(".product-item") ||
    priceEl.closest(".item") ||
    priceEl.closest(".product") ||
    priceEl.closest("article") ||
    priceEl.closest("li") ||
    priceEl.closest("div");

  return (
    host?.querySelector("[data-name]")?.textContent?.trim() ||
    host?.querySelector("h2,h3,h4")?.textContent?.trim() ||
    host?.querySelector("a")?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim() ||
    "Repair item"
  );
}
```

This is defensive DOM scraping. The code tries several possible sources:

```txt
[data-name]
h2 / h3 / h4
link text
page h1
fallback: "Repair item"
```

This makes the extension more resilient across different site layouts.

---

## Button-to-Cart Communication

The button uses a direct click handler.

```js
btn.onclick = function (e) {
  e.stopPropagation();

  if (window.RepairCart && typeof window.RepairCart.toggleItem === "function") {
    window.RepairCart.toggleItem(this);
  }
};
```

This means when a technician clicks “Add to cart,” the button passes itself to the cart module.

The cart module can then read:

```js
button.dataset.rcId
button.dataset.rcName
button.dataset.rcPartPrice
button.dataset.rcLabor
```

This keeps the integration simple. The pricing table does not need to know how the cart works. It only needs to provide enough data for the cart to consume.

---

## The RepairCart Boundary

`inject.js` references this module:

```js
if (typeof window.RepairCartModule !== "undefined" && !RepairCart) {
  RepairCart = window.RepairCartModule.init(CART_IDS.root);
  window.RepairCart = RepairCart;
}
```

Even though the cart module is separate, this code tells us the expected interface.

The module should expose:

```js
window.RepairCartModule.init(rootId)
```

And the initialized cart should expose:

```js
RepairCart.toggleItem(button)
RepairCart.updateAllButtonStates()
```

That gives the project a clean boundary:

```txt
helper.js creates buttons with data attributes.
RepairCart reads those buttons and manages selected state.
inject.js initializes RepairCart and keeps button states synced.
```

That separation is useful because pricing and cart state are different concerns.

---

## Device Notes System

The notes system is implemented in `notes.js`.

Its purpose is to let technicians store repair-specific knowledge directly on device pages.

For example, a note could say:

```txt
iPad Pro screen is fused. Quote as full display assembly.
```

or:

```txt
Pre-iPhone 14 back glass requires housing-style repair.
```

This turns the extension into more than a calculator. It becomes a lightweight knowledge layer.

---

## Notes Page Eligibility

The notes script exits early if it is on a login page or if the URL is not a replacement-parts page.

```js
if (location.href.includes("account/login")) return;
if (!location.href.includes("replacement-parts")) return;
```

This prevents notes UI from appearing globally across the website.

---

## Waiting for the Page Title

Because the website may render page headings dynamically, the notes script includes a utility that waits for one of several selectors.

```js
function waitForAny(selectors, timeout = 12000) {
  return new Promise(resolve => {
    const find = () => selectors.map(s => document.querySelector(s)).find(Boolean);
    const immediate = find();

    if (immediate) return resolve(immediate);

    const obs = new MutationObserver(() => {
      const el = find();
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });

    obs.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      resolve(null);
    }, timeout);
  });
}
```

This solves the same general problem as the pricing injector: the target DOM node may not exist immediately.

The function waits for selectors such as:

```js
[
  "#category-title-h1",
  "h1",
  ".category-title"
]
```

If one appears before the timeout, notes injection continues. If none appear, the function gives up safely.

---

## Creating a Stable Notes Key

Notes need to be saved under a repeatable key. The script first extracts the device name, then converts it into a slug.

```js
function slugifyKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

Example:

```txt
"iPhone 14 Pro Max Replacement Parts"
        ↓
"iphone-14-pro-max"
```

The script also cleans page titles before slugifying them.

```js
let raw = el.textContent
  .replace(/\b(Replacement Parts|Repair Parts|Parts|Accessories|Tools)\b/gi, "")
  .replace(/\([^)]*\)/g, "")
  .replace(/\b(A\d{4}|M\d|M\d\s*[Cc]hip|M\d\s*[Pp]rocessor)\b/gi, "")
  .replace(/\s+/g, " ")
  .trim();
```

This removes generic words and extra hardware labels so the notes key is tied to the device instead of the page title noise.

---

## MacBook Name Normalization

The notes system also handles MacBook names specially.

```js
function buildNotesKey(deviceName) {
  if (!deviceName) return "";

  let key = deviceName;

  if (/^macbook\b/i.test(key)) {
    const inchMatch = key.match(/(\d+(?:\.\d+)?)"/);
    if (inchMatch) key = key.replace(/"/, ` ${inchMatch[1]} inch`);
  }

  return slugifyKey(key);
}
```

This helps normalize names like:

```txt
MacBook Pro 13"
```

into a more searchable/stable key like:

```txt
macbook-pro-13-inch
```

That reduces the chance of creating separate notes for the same device due to small title formatting differences.

---

## Notes UI Creation

The notes UI is a simple container with a heading and textarea.

```js
function createNotesUI(notesKey, deviceName) {
  const container = document.createElement("div");
  container.id = CONTAINER_ID;

  Object.assign(container.style, {
    border: "1px solid #ddd",
    background: "#fafafa",
    padding: "10px",
    marginBottom: "12px",
    borderRadius: "6px",
    fontFamily: "Arial, sans-serif"
  });

  const heading = document.createElement("strong");
  heading.textContent = "Device Notes";
  heading.style.display = "block";
  heading.style.marginBottom = "6px";
  container.appendChild(heading);

  const ta = document.createElement("textarea");
  ta.placeholder = "Add notes for this device… (auto-saves)";
  container.appendChild(ta);

  return container;
}
```

This is intentionally lightweight. The value of the feature is not a complex interface; it is having the right note visible at the right time.

---

## Loading and Saving Notes

Notes are saved in `chrome.storage.sync` under the key `deviceNotes`.

```js
const STORAGE_KEY = "deviceNotes";
```

When the notes box is created, the script loads any existing note.

```js
chrome.storage.sync.get([STORAGE_KEY], res => {
  ta.value = res?.[STORAGE_KEY]?.[notesKey] || "";
});
```

When the technician types, the script saves the note after a short delay.

```js
let t;

ta.addEventListener("input", () => {
  clearTimeout(t);

  t = setTimeout(() => {
    chrome.storage.sync.get([STORAGE_KEY], res => {
      const all = res?.[STORAGE_KEY] || {};
      all[notesKey] = ta.value;
      chrome.storage.sync.set({ [STORAGE_KEY]: all });
    });
  }, 300);
});
```

This is another debouncing pattern.

Instead of saving on every keystroke immediately, the script waits 300 milliseconds after typing pauses. That reduces unnecessary storage writes while still feeling automatic to the user.

---

## Injecting Notes into the Page

The notes injection function waits for a title, extracts the device name, builds the storage key, creates the UI, and inserts it before the title.

```js
async function inject() {
  if (document.getElementById(CONTAINER_ID)) return;

  const titleEl = await waitForAny(["#category-title-h1", "h1", ".category-title"]);
  if (!titleEl) return;

  const deviceName = extractDeviceNameFromPage();
  if (!deviceName) return console.log("Could not extract device name");

  const notesKey = buildNotesKey(deviceName);

  titleEl.parentElement.insertBefore(
    createNotesUI(notesKey, deviceName),
    titleEl
  );
}
```

The first line prevents duplicate notes boxes:

```js
if (document.getElementById(CONTAINER_ID)) return;
```

That is the same idempotency idea used by the pricing injector.

---

## Notes SPA Support

The notes script also watches for URL changes.

```js
let lastUrl = location.href;

new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    document.getElementById(CONTAINER_ID)?.remove();
    setTimeout(inject, 1000);
  }
}).observe(document, { subtree: true, childList: true });
```

When the URL changes:

```txt
Remove the old notes box.
Wait briefly.
Inject notes for the new page.
```

This is necessary because a SPA can move from one device page to another without refreshing the whole browser tab.

---

## End-to-End Runtime Flow

Here is the complete flow from page load to displayed repair pricing:

```txt
1. User opens a supported product page.
2. Chrome loads the extension content scripts.
3. laborConfig.js exposes default labor config on window.
4. markupConfig.js exposes default markup config on window.
5. helper.js exposes pricing functions on window.
6. inject.js starts after DOMContentLoaded or a short delay.
7. inject.js loads labor settings from chrome.storage.
8. inject.js loads markup settings from chrome.storage.
9. inject.js injects the repair calculator sidebar if safe.
10. inject.js initializes RepairCart if available.
11. inject.js calls window.addPrices(...).
12. helper.js finds unprocessed .price elements.
13. helper.js skips cart and checkout areas.
14. helper.js parses the part cost.
15. helper.js determines device type from URL/product text.
16. helper.js chooses baseline labor.
17. helper.js applies advanced labor overrides if needed.
18. helper.js chooses a markup multiplier.
19. helper.js calculates the repair price.
20. helper.js injects a repair table and add button.
21. helper.js marks the price element as processed.
22. MutationObserver watches for future dynamic content.
23. New products are processed once when they appear.
```

This is the main architectural improvement: the extension does not rely on perfect timing. It keeps itself synchronized with the page.

---

## Why This Became an Architecture Problem

The original bug looked small:

```txt
Some products are missing repair tables.
```

But the cause was architectural:

```txt
The extension assumed a static page.
The website behaved like a dynamic application.
```

The fix was not just “rerun the function.” Rerunning blindly would create a new set of problems:

```txt
duplicate tables
duplicate buttons
excessive DOM work
calculator appearing in cart
incorrect prices in checkout summaries
race conditions with lazy-loaded content
```

The rebuilt version solves those issues with several patterns:

```txt
Debounced observers
Idempotent injection
data-* processed markers
URL safety checks
DOM containment checks
config defaults
storage override merging
global module boundaries
```

Those patterns are what make the extension stable.

---

## Trust and Human Workflow

This project also matters because it supports real customer-facing decisions.

If a technician gives a customer an incorrect quote, that creates a trust problem. A pricing calculator is only useful if the employee believes it is accurate and consistent.

That is why the extension shows the breakdown:

```txt
Part Price
Labor
Repair Price
```

And why the notes system exists. Pricing alone is not enough. Repair work also depends on knowledge, context, exceptions, and device-specific experience.

The extension helps preserve that context where it is needed: directly on the page where the technician is looking up parts.

---

## Conclusion: From DOM Hack to Stable Browser Tool

What began as a quick DOM injection script became a small, layered browser tool.

The rebuilt extension now has:

```txt
A configuration layer for labor and markup
A storage layer using chrome.storage.sync/local
An injector layer that controls lifecycle and observation
A pricing layer that calculates repair quotes
A DOM layer that safely injects tables and buttons
A cart integration boundary for selected repairs
A notes layer for persistent device-specific knowledge
```

The biggest lesson from this project was that browser extensions live inside someone else’s application. That means the extension has to be defensive. It has to expect late-rendered DOM nodes, changing URLs, mini-carts, missing headings, inconsistent product markup, and partial page updates.

The final system is more reliable because it treats the page as a moving target. It does not assume the DOM is finished. It observes, waits, filters, injects once, and stores the state it needs to remain consistent.

That is what turned the tool from a fragile script into a practical system for real store workflow.
