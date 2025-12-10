

function loadOptions() {
  chrome.storage.sync.get(["laborConfig"], (result) => {
    const cfg = result.laborConfig;

    document.getElementById("phone").value       = cfg.defaults.phone;
    document.getElementById("tablet").value      = cfg.defaults.tablet;
    document.getElementById("computer").value    = cfg.defaults.computer;
    document.getElementById("console").value     = cfg.defaults.console;
    document.getElementById("backHousing").value = cfg.advanced.backHousing;
    document.getElementById("soldering").value   = cfg.advanced.soldering;
  });
}

function saveOptions() {
  const cfg = {
    defaults: {
      phone: Number(document.getElementById("phone").value),
      tablet: Number(document.getElementById("tablet").value),
      computer: Number(document.getElementById("computer").value),
      console: Number(document.getElementById("console").value),
    },
    advanced: {
      backHousing: Number(document.getElementById("backHousing").value),
      soldering: Number(document.getElementById("soldering").value),
    },
  };

  chrome.storage.sync.set({ laborConfig: cfg }, () => {
    const status = document.getElementById("status");
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 1500);
  });
}

document.addEventListener("DOMContentLoaded", loadOptions);
document.getElementById("save").addEventListener("click", saveOptions);
