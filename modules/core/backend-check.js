// === core/backend-check.js ===
/* ALIN 2.0.1 — backend readiness diagnostics */
(function(){
  'use strict';
  async function checkBackendReadiness(){
    const result={ok:true,auth:false,accounts:false,orderRpc:false,issues:[]};
    try{
      const c=window.sb||(window.AlinCloud&&window.AlinCloud.client?.());
      if(!c){result.ok=false;result.issues.push('Supabase client unavailable');return result}
      result.auth=!!c.auth;
      const probe=await c.from('accounts').select('id',{head:true,count:'exact'}).limit(1);
      if(probe.error){result.ok=false;result.issues.push('accounts: '+probe.error.message)}else result.accounts=true;
      const rpc=await c.rpc('alin_create_store_orders',{p_items:[],p_customer:{name:'',phone:''},p_fulfillment:{},p_coupon_code:null});
      if(!rpc.error){result.orderRpc=true}
      else{
        const text=String(rpc.error.message||'')+' '+String(rpc.error.code||'');
        if(/PGRST202|Could not find the function|schema cache/i.test(text)){
          result.ok=false;result.issues.push('alin_create_store_orders RPC missing');
        }else result.orderRpc=true;
      }
    }catch(error){result.ok=false;result.issues.push(error?.message||String(error))}
    window.__ALIN_BACKEND_STATUS__=result;
    return result;
  }
  window.AlinBackendCheck=checkBackendReadiness;
})();
