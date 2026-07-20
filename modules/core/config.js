// === core/config.js ===
/* ===== core/js/config.js ===== */
/* ALIN 2.0.1 central configuration. Keep secrets outside the repository. */
window.ALIN_CONFIG = Object.freeze({
  version: '2.0.12',
  desktopPage: './store-desktop.html',
  mobilePage: './store-mobile.html',
  currency: 'د.ع',
  locale: 'ar-IQ'
  ,authEnabled: true
  ,authEmailDomain: 'users.alin.local'
});

/* ===== core/js/helpers.js ===== */
/* Shared helpers for new modular code. Legacy helpers remain in platform-legacy.js until phase 2. */
window.Alin = window.Alin || {};
window.Alin.helpers = {
  byId(id){ return document.getElementById(id); },
  one(selector, root=document){ return root.querySelector(selector); },
  all(selector, root=document){ return [...root.querySelectorAll(selector)]; },
  money(value){ return Number(value || 0).toLocaleString('ar-IQ') + ' د.ع'; }
};


;
