// === core/i18n.js ===
/* ALIN v2.3.9 — language runtime for every role and page. Dictionaries load separately. */
(function(){
  'use strict';

  const STORAGE_KEY='alin_language_v110';
  const SUPPORTED=['ar','ku','en'];
  const LOCALES={ar:'ar-IQ',ku:'ckb-IQ',en:'en-IQ'};
  const HTML_LANG={ar:'ar',ku:'ckb',en:'en'};
  const RTL=new Set(['ar','ku']);

  const registry=window.__ALIN_I18N_DICTIONARIES__||Object.create(null);
  const en=registry.en||Object.freeze({});
  const ku=registry.ku||Object.freeze({});
  if(!registry.en||!registry.ku)console.error('ALIN i18n: translation dictionaries were not loaded before the runtime.');

  const dictionaries=Object.freeze({ar:Object.freeze({}),ku,en});
  try{Object.freeze(registry)}catch(_){}
  const reverse={en:new Map(),ku:new Map()};
  for(const lang of ['en','ku'])for(const [ar,value] of Object.entries(dictionaries[lang]))if(value)reverse[lang].set(value,ar);
  const textState=new WeakMap();
  const attrState=new WeakMap();
  let applying=false;
  let observer=null;

  function normalizeLanguage(value){return SUPPORTED.includes(value)?value:'ar'}
  function current(){try{return normalizeLanguage(localStorage.getItem(STORAGE_KEY)||'ar')}catch(_){return'ar'}}
  function locale(code=current()){return LOCALES[normalizeLanguage(code)]}
  function direction(code=current()){return RTL.has(normalizeLanguage(code))?'rtl':'ltr'}

  function canonicalExact(value){
    if(en[value]||ku[value])return value;
    for(const lang of ['en','ku'])if(reverse[lang].has(value))return reverse[lang].get(value);
    return value;
  }

  function translateExact(value,lang){
    const canonical=canonicalExact(value);
    if(lang==='ar')return canonical;
    return dictionaries[lang][canonical]||value;
  }

  const partialKeys=Object.keys(en).filter(key=>key.includes(' ')||/[.:،•]/.test(key)).sort((a,b)=>b.length-a.length);
  function replaceKnownPhrases(value,lang){
    let output=String(value);
    if(lang==='ar'){
      for(const sourceLang of ['en','ku']){
        const entries=[...reverse[sourceLang].entries()].filter(([key])=>key.includes(' ')||/[.:،•]/.test(key)).sort((a,b)=>b[0].length-a[0].length);
        for(const [translated,arabic] of entries)if(output.includes(translated))output=output.split(translated).join(arabic);
      }
      return output;
    }
    for(const key of partialKeys){const translated=dictionaries[lang][key];if(translated&&output.includes(key))output=output.split(key).join(translated)}
    return output;
  }

  function applyPatterns(value,lang){
    if(lang==='ar')return value;
    const terms=lang==='en'?{
      order:'order',orders:'orders',booklet:'booklet',booklets:'booklets',product:'product',products:'products',teacher:'teacher',teachers:'teachers',library:'library',libraries:'libraries',courier:'courier',couriers:'couriers',page:'Page',of:'of',available:'available',copy:'copy',copies:'copies',result:'result',results:'results',area:'area',areas:'areas',item:'item',items:'items',inCart:'in cart',welcome:'Welcome',hello:'Hello',from5:'out of 5'
    }:{
      order:'داواکاری',orders:'داواکاری',booklet:'ملزمە',booklets:'ملزمە',product:'بەرهەم',products:'بەرهەم',teacher:'مامۆستا',teachers:'مامۆستا',library:'کتێبخانە',libraries:'کتێبخانە',courier:'گەیەنەر',couriers:'گەیەنەر',page:'پەڕە',of:'لە',available:'بەردەست',copy:'دانە',copies:'دانە',result:'ئەنجام',results:'ئەنجام',area:'ناوچە',areas:'ناوچە',item:'کاڵا',items:'کاڵا',inCart:'لە سەبەتە',welcome:'بەخێربێیت',hello:'سڵاو',from5:'لە 5'
    };
    let out=value;
    out=out.replace(/(\d+[٠-٩]*)\s+طلب(?:ات)?/g,(_,n)=>`${n} ${Number(n)===1?terms.order:terms.orders}`);
    out=out.replace(/(\d+[٠-٩]*)\s+ملزم(?:ة|ات)/g,(_,n)=>`${n} ${Number(n)===1?terms.booklet:terms.booklets}`);
    out=out.replace(/(\d+[٠-٩]*)\s+منتج(?:ات)?/g,(_,n)=>`${n} ${Number(n)===1?terms.product:terms.products}`);
    out=out.replace(/(\d+[٠-٩]*)\s+مدرس(?:ين|ون)?/g,(_,n)=>`${n} ${Number(n)===1?terms.teacher:terms.teachers}`);
    out=out.replace(/(\d+[٠-٩]*)\s+مكتبة/g,(_,n)=>`${n} ${Number(n)===1?terms.library:terms.libraries}`);
    out=out.replace(/(\d+[٠-٩]*)\s+مندوب(?:ين|ون)?/g,(_,n)=>`${n} ${Number(n)===1?terms.courier:terms.couriers}`);
    out=out.replace(/صفحة\s+(\d+)\s+من\s+(\d+)/g,(_,a,b)=>`${terms.page} ${a} ${terms.of} ${b}`);
    out=out.replace(/(\d+)\s+نتيجة/g,(_,n)=>`${n} ${Number(n)===1?terms.result:terms.results}`);
    out=out.replace(/(\d+)\s+نسخ(?:ة)?/g,(_,n)=>`${n} ${Number(n)===1?terms.copy:terms.copies}`);
    out=out.replace(/(\d+)\s+مناطق/g,(_,n)=>`${n} ${terms.areas}`);
    out=out.replace(/(\d+)\s+مادة في السلة/g,(_,n)=>`${n} ${Number(n)===1?terms.item:terms.items} ${terms.inCart}`);
    out=out.replace(/مرحباً\s+(.+)/,(_,name)=>`${terms.welcome} ${name}`);
    out=out.replace(/أهلاً\s+(.+)/,(_,name)=>`${terms.hello} ${name}`);
    out=out.replace(/—\s*(\d+(?:\.\d+)?)\s+من\s+5/g,(_,n)=>`— ${n} ${terms.from5}`);
    if(lang==='en')out=out.replace(/د\.ع/g,'IQD');
    return out;
  }

  function translate(value,lang=current()){
    if(value==null)return value;
    const input=String(value);
    if(!input.trim())return input;
    const leading=input.match(/^\s*/)?.[0]||'';
    const trailing=input.match(/\s*$/)?.[0]||'';
    const core=input.slice(leading.length,input.length-trailing.length);
    const exact=translateExact(core,lang);
    const mixed=exact!==core?exact:applyPatterns(replaceKnownPhrases(core,lang),lang);
    return leading+mixed+trailing;
  }

  function shouldSkip(element){
    if(!element)return true;
    if(['SCRIPT','STYLE','NOSCRIPT','CODE','PRE','TEXTAREA'].includes(element.tagName))return true;
    return Boolean(element.closest?.('[data-i18n-skip],[data-no-translate],[translate="no"],[contenteditable="true"],[data-lang]'));
  }

  function translateTextNode(node,lang){
    const parent=node.parentElement;
    if(!parent||shouldSkip(parent))return;
    let state=textState.get(node);
    if(!state||(!applying&&node.nodeValue!==state.last))state={source:node.nodeValue,last:node.nodeValue};
    const next=translate(state.source,lang);
    state.last=next;textState.set(node,state);
    if(node.nodeValue!==next)node.nodeValue=next;
  }

  const ATTRS=['placeholder','title','aria-label','data-label'];
  function translateAttributes(element,lang){
    if(shouldSkip(element))return;
    let state=attrState.get(element)||{};
    for(const attr of ATTRS){
      if(!element.hasAttribute?.(attr))continue;
      const now=element.getAttribute(attr)||'';
      const old=state[attr];
      if(!old||(!applying&&now!==old.last))state[attr]={source:now,last:now};
      const next=translate(state[attr].source,lang);
      state[attr].last=next;
      if(now!==next)element.setAttribute(attr,next);
    }
    if(element.tagName==='INPUT'&&['button','submit','reset'].includes(String(element.type).toLowerCase())){
      const now=element.value||'',old=state.value;
      if(!old||(!applying&&now!==old.last))state.value={source:now,last:now};
      const next=translate(state.value.source,lang);state.value.last=next;if(now!==next)element.value=next;
    }
    attrState.set(element,state);
  }

  function translateTree(root=document,lang=current()){
    if(!root)return;
    applying=true;
    try{
      if(root.nodeType===3)translateTextNode(root,lang);
      if(root.nodeType===1)translateAttributes(root,lang);
      const walker=document.createTreeWalker?.(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
      if(walker){let node;while((node=walker.nextNode()))node.nodeType===3?translateTextNode(node,lang):translateAttributes(node,lang)}
    }finally{applying=false}
  }

  function applyDocument(code=current(),options={}){
    const lang=normalizeLanguage(code);
    try{localStorage.setItem(STORAGE_KEY,lang)}catch(_){}
    const html=document.documentElement;
    if(html){html.lang=HTML_LANG[lang];html.dir=direction(lang);html.dataset.alinLanguage=lang}
    if(document.body){document.body.dir=direction(lang);document.body.classList.toggle('alin-ltr',lang==='en');document.body.classList.toggle('alin-rtl',lang!=='en')}
    translateTree(document,lang);
    if(options.emit)window.dispatchEvent(new CustomEvent('alin:language-applied',{detail:{language:lang,locale:locale(lang),direction:direction(lang)}}));
    return lang;
  }

  function setLanguage(code,options={}){
    const lang=applyDocument(code,{emit:options.emit!==false});
    if(options.announce)window.toast?.(translate('تم تغيير اللغة',lang));
    return lang;
  }

  function formatNumber(value,options,code=current()){return Number(value||0).toLocaleString(locale(code),options)}
  function formatMoney(value,code=current()){return `${formatNumber(value,{maximumFractionDigits:0},code)} ${code==='en'?'IQD':'د.ع'}`}
  function formatDate(value,options,code=current()){const date=value instanceof Date?value:new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString(locale(code),options)}

  function startObserver(){
    if(observer||typeof MutationObserver!=='function'||!document.documentElement)return;
    observer=new MutationObserver(records=>{
      if(applying)return;
      const lang=current();
      for(const record of records){
        if(record.type==='characterData')translateTextNode(record.target,lang);
        else if(record.type==='attributes')translateAttributes(record.target,lang);
        else for(const node of record.addedNodes)translateTree(node,lang);
      }
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  }

  const nativeDialogs={alert:window.alert?.bind(window),confirm:window.confirm?.bind(window),prompt:window.prompt?.bind(window)};
  if(nativeDialogs.alert)window.alert=message=>nativeDialogs.alert(translate(message));
  if(nativeDialogs.confirm)window.confirm=message=>nativeDialogs.confirm(translate(message));
  if(nativeDialogs.prompt)window.prompt=(message,defaultValue)=>nativeDialogs.prompt(translate(message),defaultValue);

  window.AlinI18n=Object.freeze({
    languages:[...SUPPORTED],current,locale,direction,t:translate,translate,translateTree,apply:applyDocument,setLanguage,formatNumber,formatMoney,formatDate,
    dictionaries:Object.freeze({en:Object.freeze(en),ku:Object.freeze(ku)})
  });
  window.alinT=translate;

  window.addEventListener('alin:language-changed',event=>applyDocument(event.detail?.language||current(),{emit:true}));
  window.addEventListener('alin:rendered',()=>translateTree(document,current()));
  window.addEventListener('alin:data-refreshed',()=>translateTree(document,current()));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{applyDocument(current());startObserver()},{once:true});
  else{applyDocument(current());startObserver()}
})();
