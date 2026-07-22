// === admin/couriers.js ===
/*
  إدارة المندوبين ومناطقهم موجودة في modules/courier/admin.js و modules/courier/areas.js.
  نموذج إنشاء حساب المندوب أصبح جزءاً أصيلاً من modules/admin/accounts.js
  بدون تغليف renderAccountsAdmin أو addAccount.
*/
(function(){
  'use strict';
  window.AlinAdminModules?.register?.('couriers',root=>{
    if(root)root.dataset.courierAccountsIntegrated='true';
  });
})();

;
