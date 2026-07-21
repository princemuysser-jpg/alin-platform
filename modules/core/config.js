// === core/config.js ===
/* ALIN v2.3.5 — one public runtime configuration source. */
window.ALIN_CONFIG=Object.freeze({
  version:'2.3.5',
  desktopPage:'./store-desktop.html',
  mobilePage:'./store-mobile.html',
  currency:'د.ع',
  locale:'ar-IQ',
  locales:{ar:'ar-IQ',ku:'ckb-IQ',en:'en-IQ'},
  authEnabled:true,
  authEmailDomain:'users.alin.local',
  supabaseUrl:'https://jyavewwlgiaibtdqyzpd.supabase.co',
  supabaseAnonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5YXZld3dsZ2lhaWJ0ZHF5enBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTczMzcsImV4cCI6MjA5ODk5MzMzN30.fcjx4JrNdwd5Xrm_Nn1CaWWJoJLF6_DyYGakFPuGwGQ'
});
window.Alin=window.Alin||{};
window.Alin.helpers={
  byId:id=>document.getElementById(id),
  one:(selector,root=document)=>root.querySelector(selector),
  all:(selector,root=document)=>[...root.querySelectorAll(selector)],
  money:value=>Number(value||0).toLocaleString(window.AlinI18n?.locale?.()||'ar-IQ')+' د.ع'
};

;
