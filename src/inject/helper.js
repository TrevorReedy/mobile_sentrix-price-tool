/**
 * helper.js - Creates repair tables and buttons
 */

// ---------- Labor logic  ----------
function pickDeviceType(url, name) {
  const u = String(url || "").toLowerCase();
  const n = String(name || "").toLowerCase();
  const hay = `${u} ${n}`;

  // Tablet
  if (
    hay.includes("ipad") ||
    hay.includes("tablet") ||
    hay.includes("galaxy tab") ||
    hay.includes("surface")
  ) {
    return "tablet";
  }

  // Switch
  if (hay.includes("nintendo switch") || hay.includes("/switch") || hay.includes(" switch ")) {
    return "switch";
  }

  // Computer
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

  // Console
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

  // Default
  return "phone";
}

function getHeadingTextNear(part_item) {
  let container = part_item.closest("li.item, .product-item, .item, .product-view, .product-essential");
  let heading = container
    ? container.querySelector("h2.product-name, h1, .product-name, .page-title")
    : null;

  if (!heading) heading = document.querySelector("h1, h2.product-name, .product-name, .page-title");
  return heading ? heading.textContent : "";
}

function getLaborSingle(part_item, baseLabor, config, url) {
  const defaults = (config && config.defaults) ? config.defaults : {};
  const advanced = (config && config.advanced) ? config.advanced : {};

  const headingText = getHeadingTextNear(part_item);
  const name = String(headingText || "").toLowerCase();
  const deviceType = pickDeviceType(url, name);

  const fallback = Number(baseLabor) || 0;
  const defaultForType = Number(defaults[deviceType]);

  // Baseline labor comes from config.defaults
  let perItemLabor =
    (Number.isFinite(defaultForType) && defaultForType > 0)
      ? defaultForType
      : fallback;

  // Advanced overrides
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
  } else if (name.includes("back") && name.includes("housing") 
    || name.includes("mid-frame") &&
    String(url || "").toLowerCase().includes("iphone")
  ) {
    const adv = Number(advanced.backHousing);
    if (Number.isFinite(adv) && adv > 0) perItemLabor = adv;
  }

  return perItemLabor;
}

// ---------- Price calc ----------
function calcRepair(partcost, labor) {
  var mult;
  if (partcost > 0 && partcost <= 9.99) mult = 5;
  else if (partcost >= 10 & partcost <= 24.99) mult = 2.5;
  else if (partcost >= 25 & partcost <= 49.99) mult = 2.25;
  else if (partcost >= 50 & partcost <= 99.99) mult = 2.00;
  else if (partcost >= 100 & partcost <= 199.99) mult = 1.5;
  else if (partcost >= 200) mult = 1.25;
  else mult = 1;

  var price = (partcost * mult) + labor;
  var rounded = Math.ceil(price / 10) * 10;
  return Math.round(rounded) - .01;
}

function parseMoney(text) {
  const n = Number(String(text || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

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

function stableId(priceEl) {
  const txt = (priceEl.textContent || "").trim();
  return `${location.href}::${txt}::${priceEl.offsetTop}`;
}

// ---------- Main DOM injection ----------
function addPrices(rate, config) {
  const url = document.URL;
  if (!(url.includes("sentrix") || url.includes("defenders") || url.includes("cpr"))) return;

  const allPriceElements = document.querySelectorAll('.price:not([data-cpr-calc-applied="1"])');
  if (!allPriceElements.length) return;

  for (const priceEl of allPriceElements) {
    // avoid cart/checkout areas
    if (
      priceEl.closest("#np-cart") ||
      priceEl.closest(".np-cart") ||
      priceEl.closest(".cart") ||
      priceEl.closest(".minicart") ||
      priceEl.closest(".checkout")
    ) {
      continue;
    }

    const partCost = parseMoney(priceEl.textContent || "");
    if (!partCost) continue;

    const labor = getLaborSingle(priceEl, rate, config, url);
    const repair_price = calcRepair(partCost, labor);
    const partPrice = Math.max(0, repair_price - Number(labor || 0));

    const parent = priceEl.parentElement;
    if (!parent) continue;

    const container = document.createElement("div");
    container.className = "repair-container";
    container.innerHTML = `
      <table class="repair-table">
        <tbody>
          <tr><td class="repair-table-label">Part Price:</td><td class="repair-table-value">$${partPrice.toFixed(2)}</td></tr>
          <tr><td class="repair-table-label">Labor:</td><td class="repair-table-value">$${Number(labor).toFixed(2)}</td></tr>
          <tr><td class="repair-table-label">Repair Price:</td><td class="repair-table-repair">$${Number(repair_price).toFixed(2)}</td></tr>
        </tbody>
      </table>
    `;

    // per-product button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rc-add-btn";
    btn.textContent = "Add to cart";

    btn.dataset.rcId = stableId(priceEl);
    btn.dataset.rcName = guessNameNear(priceEl);
    btn.dataset.rcPartPrice = String(partPrice.toFixed(2));
    btn.dataset.rcLabor = String(Number(labor || 0).toFixed(2));

    // Keep direct handler (works even if delegation changes later)
    btn.onclick = function (e) {
      e.stopPropagation();
      if (window.RepairCart && typeof window.RepairCart.toggleItem === "function") {
        window.RepairCart.toggleItem(this);
      }
    };

    container.appendChild(btn);
    parent.appendChild(container);

    priceEl.dataset.cprCalcApplied = "1";
  }
}

// expose globally
if (typeof window !== "undefined") {
  window.calcRepair = calcRepair;
  window.getLaborSingle = getLaborSingle;
  window.addPrices = addPrices;
}
