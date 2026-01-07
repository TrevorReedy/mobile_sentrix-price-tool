// repairCart.js - CORE CART LOGIC MODULE
const RepairCart = (() => {
  const cart = new Map();

  // Public API
  const api = {
    cart,
    
    init: function(containerId = "repairCalc") {
      this.containerId = containerId;
      this.bindEvents();
      this.render();
      return this;
    },

    bindEvents: function() {
      // Click handler for Add/Remove buttons
      document.addEventListener("click", (e) => {
        // Add to cart buttons
        const addBtn = e.target.closest(".rc-add-btn");
        if (addBtn) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleItem(addBtn);
          return;
        }

        // Remove buttons in cart
        const removeBtn = e.target.closest(".rc-remove");
        if (removeBtn) {
          e.preventDefault();
          e.stopPropagation();
          const id = removeBtn.dataset.id;
          if (id) this.removeItem(id);
          return;
        }
      });

      // Per-item include labor checkbox
      document.addEventListener("change", (e) => {
        const cb = e.target.closest(".rc-inc-labor-cb");
        if (!cb) return;

        const id = cb.dataset.id;
        const item = cart.get(id);
        if (!item) return;

        item.includeLabor = cb.checked;
        this.render();
      });

      // Clear button
      const clearBtn = document.getElementById("rcClear");
      if (clearBtn && !clearBtn.dataset.bound) {
        clearBtn.dataset.bound = "1";
        clearBtn.addEventListener("click", () => this.clearCart());
      }
    },

    render: function() {
      const container = document.getElementById(this.containerId);
      if (!container) {
        console.error(`Cart container #${this.containerId} not found`);
        return;
      }
      
      // Show/hide the container based on cart size
      container.style.display = cart.size ? "block" : "none";

      const emptyEl = container.querySelector("#rcEmpty");
      const listEl = container.querySelector("#rcList");
      const partsEl = container.querySelector("#rcPartsTotal");
      const laborEl = container.querySelector("#rcLaborTotal");
      const grandEl = container.querySelector("#rcGrandTotal");
      const laborRow = container.querySelector("#rcLaborRow");

      if (!listEl || !emptyEl || !partsEl || !laborEl || !grandEl || !laborRow) return;

      // Clear and rebuild list
      listEl.innerHTML = "";
      emptyEl.style.display = cart.size ? "none" : "block";

      let partsTotal = 0;
      let laborTotal = 0;

      for (const [id, item] of cart.entries()) {
        partsTotal += item.price;
        
        // Sum labor if checkbox is checked
        if (item.includeLabor && item.labor) {
          laborTotal += item.labor;
        }

        const li = document.createElement("li");
        li.className = "rc-item";
        li.dataset.id = id;
        li.innerHTML = `
          <div>
            <div class="rc-name">${this.escapeHtml(item.name)}</div>
            <div class="rc-sub">
              Parts: ${this.money(item.price)}
              ${item.labor ? ` • Labor: ${this.money(item.labor)}` : ""}
            </div>
          </div>

          <div class="rc-item-controls">
            ${
              item.labor
                ? `
              <label class="rc-inc-labor">
                <input class="rc-inc-labor-cb" type="checkbox" data-id="${id}" ${
                  item.includeLabor ? "checked" : ""
                } />
                Include labor
              </label>
            `
                : ""
            }
            <button class="rc-remove" data-id="${id}">Remove</button>
          </div>
        `;
        listEl.appendChild(li);
      }

      // Show labor row if ANY labor is included (even if total is 0)
      const hasLaborItems = Array.from(cart.values()).some(item => item.labor > 0);
      laborRow.style.display = hasLaborItems ? "flex" : "none";
      
      partsEl.textContent = this.money(partsTotal);
      laborEl.textContent = this.money(laborTotal);
      grandEl.textContent = this.money(partsTotal + laborTotal);

      this.updateAllButtonStates();
    },

    toggleItem: function(btn) {
      const id = btn.dataset.rcId;
      if (!id) {
        console.error("No ID found on button:", btn);
        return;
      }

      if (cart.has(id)) {
        cart.delete(id);
        this.updateButtonState(btn, false);
      } else {
        // Default to INCLUDING labor for the first item
        // For subsequent items, default to EXCLUDING labor (user can toggle on if needed)
        const isFirstItem = cart.size === 0;
        const includeLaborDefault = isFirstItem ? true : false;

        cart.set(id, {
          id,
          name: btn.dataset.rcName || "Repair item",
          price: this.parseNum(btn.dataset.rcPartPrice),
          labor: this.parseNum(btn.dataset.rcLabor),
          includeLabor: includeLaborDefault,
        });
        this.updateButtonState(btn, true);
      }

      this.render();
    },

    removeItem: function(id) {
      cart.delete(id);
      this.render();
      this.updateAllButtonStates();
    },

    clearCart: function() {
      cart.clear();
      this.render();
      this.updateAllButtonStates();
    },

    updateButtonState: function(btn, isInCart) {
      if (!btn) return;
      btn.textContent = isInCart ? "Remove from cart" : "Add to Calculator";
      btn.classList.toggle("added", isInCart);
      btn.dataset.inCart = isInCart ? "1" : "0";
    },

    updateAllButtonStates: function() {
      document.querySelectorAll(".rc-add-btn").forEach(btn => {
        const id = btn.dataset.rcId;
        if (id) {
          this.updateButtonState(btn, cart.has(id));
        }
      });
    },

    // Utility functions
    money: function(n) {
      return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      });
    },

    parseNum: function(v) {
      return Number(String(v ?? "").replace(/[^\d.]/g, "")) || 0;
    },

    escapeHtml: function(str) {
      return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    },

    // Helper to get current totals (for debugging)
    getTotals: function() {
      let parts = 0;
      let labor = 0;
      
      for (const item of cart.values()) {
        parts += item.price;
        if (item.includeLabor && item.labor) {
          labor += item.labor;
        }
      }
      
      return {
        parts,
        labor,
        total: parts + labor
      };
    }
  };

  return api;
})();

// Export for use in inject.js
if (typeof window !== "undefined") {
  window.RepairCartModule = RepairCart;
}