// === core/cloud-status-ui.js ===
/* ALIN v2.3.9 — final boot verification for modular cloud services. */
(function(){
  'use strict';
  const required=['enabled','loginFromUI','signOut','restoreSession','secureCheckout','createAccountFromAdmin','updateAccountFromAdmin','resetPasswordFromAdmin'];
  const auth=window.ALINAuth||{};
  const missing=required.filter(name=>typeof auth[name]!=='function');
  if(missing.length)console.error('[ALIN cloud modules missing]',missing);
  else window.dispatchEvent(new CustomEvent('alin:cloud-services-ready',{detail:{services:required.slice()}}));
})();
