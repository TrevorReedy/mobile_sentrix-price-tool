

````md
# Mobile Sentrix Pricing Tool for CPR Stores  
**By Trevor Reedy**

---

## Introduction: A Simple Idea Meets a SPA

I started working at Cell Phone Repair in August 2025 and was first introduced to our internal pricing tool in the form of a Chrome extension. At a glance, the extension did its job: it injected repair pricing into product listings and helped employees generate quotes quickly.

However, as I spent more time using it—and relying on it—I discovered three critical flaws that limited its reliability and, in some cases, actively caused incorrect quotes.

1. **Dynamic content was not handled**  
   The extension failed to inject repair price tables for products that loaded dynamically. The site used lazy loading, meaning only the first batch of products received pricing calculations. Any additional rows loaded afterward were left untouched.

2. **Labor calculation logic was overly simplistic**  
   While labor is relatively consistent for basic repairs, it changes significantly for advanced work such as soldering, back housing replacements, or iPhone charge port repairs.

3. **Repair knowledge lived outside the system**  
   As I learned the trade, I picked up nuances that more experienced technicians already knew—such as iPad Pro screens having a fused display instead of a separate LCD and digitizer, or that iPhone backs prior to the iPhone 14 were not removable and require a full housing replacement.

Together, these issues made it clear that the problem wasn’t just bugs—it was architecture.

---

## Injecting UI into a Moving Target

The first issue—missing price tables—turned out to be more complex than it initially appeared. Since the extension was originally written, the site had transitioned to a Single Page Application (SPA).

This page uses lazy row generation to speed up site load times, but it also means not all elements are rendered into the DOM on initial load.

The first version of this application followed the classic approach: write a content script, find a DOM node, and append a pricing panel. This worked exactly once—on the initial page load.

---

## V1 Injection Logic (Runs Once)

```js
function main(){
  let url = document.URL;

  const blacklist = ["tools","brands/","refurbishing","accessories","checkout"];
  if (blacklist.some((word) => url.includes(word))) return;

  const tablets = ["ipad","surface","galaxy-tab","samsung/tab"];
  const consoles = ["game-console","sony","xbox","nintendo","macbook-parts"];

  var labor = 75;
  if (tablets.some((word) => url.includes(word))) labor = 100;
  if (consoles.some((word)=> url.includes(word))) labor = 130;

  addPrices(labor);
}

main();
````

This logic executed exactly once. Any content loaded after initial execution was invisible to the extension.

---

## V1 DOM Loop (One-Pass Injection)

```js
function addPrices(labor){
  const url = document.URL;
  let elements = [];

  if (url.includes('sentrix') || url.includes('defenders') || url.includes('cpr')) {
    elements = Array.from(document.getElementsByClassName('price'));
  }

  for (const part_item of elements) {
    if (!part_item) continue;

    const parent = part_item.parentElement;
    if (!parent) continue;

    addHTML(labor, part_item, url);
  }
}
```

This approach fundamentally breaks in a SPA environment.

---

## From One-Shot Injection to Deterministic Reinjection

To make injection reliable, I refactored the extension to run deterministic reinjection passes. Instead of assuming a static DOM, the extension now reacts to navigation events and DOM mutations.

---

## Debounced Reinjection Engine

In a Single Page Application, DOM mutations and navigation events often occur in rapid bursts rather than as isolated actions. Without safeguards, this would cause the extension’s injection logic to run repeatedly for the same logical event—leading to unnecessary CPU usage, layout thrashing, and degraded browser performance.

To address this, I wrapped the core injection pass in a debounced function. Debouncing ensures that no matter how many times an event fires in a short window, the injection logic only executes once after changes have “settled.”

In practice, this allows the SPA to complete its rendering work before the extension responds, ensuring the DOM is in a stable state before manipulation begins.

```js
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const runPassDebounced = debounce(runPass, 250);

const obs = new MutationObserver(() => runPassDebounced());
obs.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("popstate", runPassDebounced);
window.addEventListener("hashchange", runPassDebounced);
```

This approach strikes a balance between responsiveness and efficiency. The extension remains reactive to navigation and content changes, but avoids overwhelming the browser with repeated, overlapping injection passes.

---

## Guarded Incremental Injection

Guarded incremental injection is the mechanism that allows the extension to scale with dynamic content rather than degrade as the page grows.

Instead of reprocessing the entire DOM on every injection pass, the extension explicitly targets only elements that have not yet been handled.

Each eligible price element is marked with a lightweight `data-*` attribute after injection. Subsequent passes query only for elements lacking this marker, guaranteeing that each product is processed exactly once.

Key implications:

* Performance becomes proportional to **newly loaded content**, not total page size
* Injection becomes **idempotent** (safe to re-run)
* Eliminates duplicate UI elements, incorrect totals, and inconsistent state

```js
const allPriceElements =
  document.querySelectorAll('.price:not([data-cpr-calc-applied="1"])');

for (const priceEl of allPriceElements) {
  // inject pricing UI
  priceEl.dataset.cprCalcApplied = "1";
}
```

Each element is injected exactly once, ensuring performance scales with new content rather than total page size.

Together with debouncing, guarded incremental injection forms the backbone of the extension’s stability. The system can respond aggressively to SPA changes while remaining predictable, efficient, and safe under heavy usage.

---

## Decoupling Pricing Logic with `chrome.storage.sync`

Labor defaults were originally hardcoded, creating a deployment bottleneck. I replaced this with a declarative configuration model backed by `chrome.storage.sync`.

### Loading and Merging Configuration

```js
chrome.storage.sync.get(["laborConfig"], (result) => {
  const cfg = result.laborConfig || {};
  const merged = {
    defaults: { ...DEFAULT.defaults, ...(cfg.defaults || {}) },
    advanced: { ...DEFAULT.advanced, ...(cfg.advanced || {}) },
  };
});
```

This allowed managers to adjust pricing without touching source code, while ensuring safe defaults always exist.

---

## Externalized Knowledge: Persistent Device Notes

To capture repair nuances, I added per-device notes persisted via `chrome.storage.sync`.

```js
const STORAGE_KEY = "deviceNotes";

chrome.storage.sync.get([STORAGE_KEY], res => {
  textarea.value = res?.[STORAGE_KEY]?.[key] || "";
});

chrome.storage.sync.set({ [STORAGE_KEY]: notes });
```

---

## Conclusion: From Hacks to a Stable System

What began as a quick DOM hack evolved into a stable, configurable, and resilient pricing system. This project forced me to confront real-world constraints: SPAs, performance, state management, and human trust in automation.

The result is a system I’m proud of—one that behaves deterministically, scales with the application it lives in, and can evolve without constant redeployment.
