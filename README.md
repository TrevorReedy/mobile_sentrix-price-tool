# Mobile Sentrix Price Tool (Chrome Extension)

A developer-focused Chrome extension that injects:
- A **repair price breakdown table** next to product prices
- A floating **Repair Calculator cart**
- Customizable labor values 
- **Per-item “Include labor” toggles** (first item defaults ON, additional items default OFF)
- Optional **Device Notes** textarea (auto-saves per device)

Built for  that contain product price elements and are hosted on mobile sentrix.

---

## Features

### 1) Repair Price Table Injection
For each product price element (`.price`) on supported pages, the tool injects a small table showing:
- **Part Price**
- **Labor**
- **Repair Price** (your pricing formula + rounding)

It also adds an **“Add to cart”** button per product.

**Where it lives:** `src/inject/helper.js`

---

### 2) Repair Calculator Cart (Floating UI)
Injects a sidebar cart UI that lists chosen items and totals:
- Parts total
- Labor total (only if any items have labor available)
- Grand total

Includes **Clear** button.

**Where it lives:** `src/inject/inject.js` + `src/inject/repairCart.js`

---

### 3) Labor Rules (Device Type + Advanced Overrides)
**FOUND BY CLICKING THE EXTENSION ICON**
Labor is computed per product using:
- **Device type detection** (phone/tablet/switch/computer/console)
- Default labor per device type
- Advanced overrides for:
  - iPhone charge port
  - back housing / mid-frame
  - soldering required
  - “casper” forces labor to 0

**Where it lives:** `src/inject/helper.js` and default config in `src/inject/laborConfig.js`

---

### 4) SPA / Dynamic Page Support
The injector re-runs automatically when content changes:
- MutationObserver watches DOM changes
- Re-run on `popstate` and `hashchange`

**Where it lives:** `src/inject/inject.js`

---

### 5) Device Notes (Auto-save per device)
Adds a “Device Notes” textarea near the page title on certain pages and saves notes keyed by device.

**Where it lives:** `src/inject/notes.js`

> NOTE: `notes.js` currently bails out unless the URL includes `replacement-parts` (and also skips login page).

---

## Installation (Dev Mode / Unpacked)

1. Clone or download this repo.
2. Open Chrome and go to:
   - `chrome://extensions`
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the repo folder (the one containing `manifest.json`).

Now browse to a mobile sentrix site/page and you should see:
- Repair price tables + “Add to cart” buttons near prices
- The Repair Calculator sidebar injected into the page

---


