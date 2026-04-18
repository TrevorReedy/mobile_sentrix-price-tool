function loadPopup() {
  chrome.storage.sync.get(["laborConfig", "markupConfig"], (result) => {
    const stored = result.laborConfig || {};
    const defs = DEFAULT_CONFIG;

    const phone       = document.getElementById("phone");
    const tablet      = document.getElementById("tablet");
    const computer    = document.getElementById("computer");
    const consoleInp  = document.getElementById("console");
    const switchInp   = document.getElementById("switch");

    const backHousing = document.getElementById("backHousing");
    const soldering   = document.getElementById("soldering");
    const iphoneChargePort   = document.getElementById("iphoneChargePort");

    // --- labor placeholders show defaults (current behavior) ---
    phone.placeholder       = defs.defaults.phone;
    tablet.placeholder      = defs.defaults.tablet;
    computer.placeholder    = defs.defaults.computer;
    consoleInp.placeholder  = defs.defaults.console;
    switchInp.placeholder   = defs.defaults.switch;

    backHousing.placeholder = defs.advanced.backHousing;
    soldering.placeholder   = defs.advanced.soldering;
    iphoneChargePort.placeholder = defs.advanced.iphoneChargePort;

    if (stored.defaults) {
      if (stored.defaults.phone != null)      phone.value      = stored.defaults.phone;
      if (stored.defaults.tablet != null)     tablet.value     = stored.defaults.tablet;
      if (stored.defaults.computer != null)   computer.value   = stored.defaults.computer;
      if (stored.defaults.console != null)    consoleInp.value = stored.defaults.console;
      if (stored.defaults.switch != null)     switchInp.value  = stored.defaults.switch;
    }

    if (stored.advanced) {
      if (stored.advanced.backHousing != null)      backHousing.value = stored.advanced.backHousing;
      if (stored.advanced.soldering != null)        soldering.value   = stored.advanced.soldering;
      if (stored.advanced.iphoneChargePort != null) iphoneChargePort.value = stored.advanced.iphoneChargePort;
    }

    // --- MARKUP: placeholders should show the EFFECTIVE configured value (stored override OR default) ---
    const storedMarkup = result.markupConfig || {};
    const defsMarkup =
      (typeof window !== "undefined" && window.CPR_MARKUP_DEFAULT_CONFIG) || {};

    for (let i = 1; i <= 6; i++) {
      const id = `level_${i}`;
      const el = document.getElementById(id);
      if (!el) continue;

      const effective = (storedMarkup[id] != null)
        ? storedMarkup[id]
        : (defsMarkup[id] != null ? defsMarkup[id] : 0);

      // show the configured value even if input is empty
      el.placeholder = effective;

      // only fill the input box if user has an override saved
      if (storedMarkup[id] != null) el.value = storedMarkup[id];
      else el.value = ""; // keep blank = "use placeholder/default"
    }
  });
}

function toNumberOrNull(input) {
  const v = input.value.trim();
  if (v === "") return null;        // means "use default"
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function savePopup() {
  const cfg = {
    defaults: {},
    advanced: {},
  };

  // --- labor ---
  const phone = toNumberOrNull(document.getElementById("phone"));
  const tablet = toNumberOrNull(document.getElementById("tablet"));
  const computer = toNumberOrNull(document.getElementById("computer"));
  const consoleInp = toNumberOrNull(document.getElementById("console"));
  const switchInp = toNumberOrNull(document.getElementById("switch"));

  if (phone !== null) cfg.defaults.phone = phone;
  if (tablet !== null) cfg.defaults.tablet = tablet;
  if (computer !== null) cfg.defaults.computer = computer;
  if (consoleInp !== null) cfg.defaults.console = consoleInp;
  if (switchInp !== null) cfg.defaults.switch = switchInp;

  const backHousing = toNumberOrNull(document.getElementById("backHousing"));
  const soldering = toNumberOrNull(document.getElementById("soldering"));
  const iphoneChargePort = toNumberOrNull(document.getElementById("iphoneChargePort"));

  if (backHousing !== null) cfg.advanced.backHousing = backHousing;
  if (soldering !== null) cfg.advanced.soldering = soldering;
  if (iphoneChargePort !== null) cfg.advanced.iphoneChargePort = iphoneChargePort;

  // --- markup (SAVE IT) ---
  const markupCfg = {};
  for (let i = 1; i <= 6; i++) {
    const id = `level_${i}`;
    const el = document.getElementById(id);
    if (!el) continue;

    const val = toNumberOrNull(el);
    if (val !== null) markupCfg[id] = val; // only store overrides
  }

  chrome.storage.sync.set({ laborConfig: cfg, markupConfig: markupCfg }, () => {
    const status = document.getElementById("status");
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 1500);

    // refresh placeholders to reflect what is now configured
    loadPopup();
  });
}

document.addEventListener("DOMContentLoaded", loadPopup);
document.getElementById("save").addEventListener("click", savePopup);
