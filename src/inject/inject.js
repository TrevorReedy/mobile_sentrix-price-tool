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

  const tablets  = ["ipad", "surface", "galaxy-tab", "samsung/tab"];
  const consoles = ["game-console", "sony", "xbox", "nintendo", "macbook"];

  const config = await loadConfig();
  const defs = config.defaults;

  // Base labor from config, not hardcoded
  let baseLabor = defs.phone;

  if (tablets.some((word) => url.includes(word)))  baseLabor = defs.tablet;
  if (consoles.some((word) => url.includes(word))) baseLabor = defs.console; // or defs.computer for Macs

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
    var cost = part_item.textContent;
    cost = cost.replace('$', '');
    var repair_price = calcRepair(Number(cost), labor); 

    var repair_div = document.createElement('div');
    repair_div.style.color      = "#e3051b";
    repair_div.style.fontFamily = "Arial, sans-serif";
    repair_div.style.fontWeight = "bold";
    repair_div.className        = "price-div";

    var costs_div = document.createElement('div');
    costs_div.className   = "repair-div";
    costs_div.style.color = "black";
    costs_div.style.fontSize = "14px";
    
    if (url.includes("mobiledefenders")) {
        repair_div.style.paddingTop    = "5px";
        repair_div.style.paddingBottom = "5px";
    }

    repair_div.style.display = "inline";

    var breakr  = document.createElement("br");
    var breakr2 = document.createElement("br");

    repair_div.appendChild(document.createTextNode(" Repair Price: $" + repair_price));
    repair_div.appendChild(breakr);
    repair_div.appendChild(breakr2);

    var part_price = repair_price + 0.01 - labor;
    costs_div.appendChild(
        document.createTextNode(
            "Part Price: $" + Number(part_price - 0.01) + " • Labor: $" + labor
        )
    );

    var parent = part_item.parentElement;
    parent.insertBefore(breakr, parent.lastChild);
    if (!url.includes("replacement-parts") & url.includes("cpr.parts")) {
        parent.insertBefore(breakr2, parent.lastChild);
    }

    parent.insertBefore(repair_div, parent.lastChild);
    parent.insertBefore(costs_div, parent.lastChild);
}






main();
