/* ===== core/js/helpers.js ===== */
/* Shared helpers for new modular code. Legacy helpers remain in platform-legacy.js until phase 2. */
window.Alin = window.Alin || {};
window.Alin.helpers = {
  byId(id){ return document.getElementById(id); },
  one(selector, root=document){ return root.querySelector(selector); },
  all(selector, root=document){ return [...root.querySelectorAll(selector)]; },
  money(value){ return Number(value || 0).toLocaleString('ar-IQ') + ' د.ع'; }
};

