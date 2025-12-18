function loadPopup() {
  chrome.storage.sync.get(["laborConfig"], (result) => {
    const stored = result.laborConfig || {};
    const defs = DEFAULT_CONFIG;

    const phone       = document.getElementById("phone");
    const tablet      = document.getElementById("tablet");
    const computer    = document.getElementById("computer");
    const consoleInp  = document.getElementById("console");
    const switchInp   = document.getElementById("switch");

    const backHousing = document.getElementById("backHousing");
    const soldering   = document.getElementById("soldering");
    const chargePort   = document.getElementById("chargeport");
    
  
    phone.placeholder       = defs.defaults.phone;
    tablet.placeholder      = defs.defaults.tablet;
    computer.placeholder    = defs.defaults.computer;
    consoleInp.placeholder  = defs.defaults.console;
    switchInp.placeholder   = defs.defaults.switch;

    backHousing.placeholder = defs.advanced.backHousing;
    soldering.placeholder   = defs.advanced.soldering;
    chargePort.placeholder = defs.advanced.chargePort;

    if (stored.defaults) {
      if (stored.defaults.phone != null)      phone.value      = stored.defaults.phone;
      if (stored.defaults.tablet != null)     tablet.value     = stored.defaults.tablet;
      if (stored.defaults.computer != null)   computer.value   = stored.defaults.computer;
      if (stored.defaults.console != null)    consoleInp.value = stored.defaults.console;
      if (stored.defaults.switch != null)     switchInp.value = stored.defaults.switch;
    }

    if (stored.advanced) {
      if (stored.advanced.backHousing != null) backHousing.value = stored.advanced.backHousing;
      if (stored.advanced.soldering != null)   soldering.value   = stored.advanced.soldering;
      if (stored.advanced.chargePort != null)   chargePort.value   = stored.advanced.chargePort;
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
  
  // Only add defaults that have values
  const phone = toNumberOrNull(document.getElementById("phone"));
  const tablet = toNumberOrNull(document.getElementById("tablet"));
  const computer = toNumberOrNull(document.getElementById("computer"));
  const consoleInp = toNumberOrNull(document.getElementById("console"));
  
  if (phone !== null) cfg.defaults.phone = phone;
  if (tablet !== null) cfg.defaults.tablet = tablet;
  if (computer !== null) cfg.defaults.computer = computer;
  if (consoleInp !== null) cfg.defaults.console = consoleInp;
  
  // Only add advanced that have values
  const backHousing = toNumberOrNull(document.getElementById("backHousing"));
  const soldering = toNumberOrNull(document.getElementById("soldering"));
  const chargePort = toNumberOrNull(document.getElementById("chargeport"));
  
  if (backHousing !== null) cfg.advanced.backHousing = backHousing;
  if (soldering !== null) cfg.advanced.soldering = soldering;
  if (chargePort !== null) cfg.advanced.chargePort = chargePort;
  
  chrome.storage.sync.set({ laborConfig: cfg }, () => {
    const status = document.getElementById("status");
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 1500);
  });
}
document.addEventListener("DOMContentLoaded", loadPopup);
document.getElementById("save").addEventListener("click", savePopup);
