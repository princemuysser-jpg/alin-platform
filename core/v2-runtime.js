(()=>{
  'use strict';
  window.addEventListener('error',e=>console.error('[ALIN v2 runtime]',e.error||e.message));
  window.addEventListener('unhandledrejection',e=>console.error('[ALIN v2 promise]',e.reason));
})();
