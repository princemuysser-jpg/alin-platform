// === library/printing.js ===
/* ===== library/js/print-canvas-v119.js ===== */
/* V119: protected in-app PDF canvas preview. No native PDF viewer and no download toolbar. */
(function(){
  'use strict';
  let activeOrder=null;
  let activePdf=null;
  let activeBytes=null;
  let rendering=false;

  const toastSafe=(m)=>typeof toast==='function'?toast(m):alert(m);
  const escSafe=(v)=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copies=(o)=>Math.max(1,Number(o?.qty||o?.quantity||1));
  function findOrder(id){try{return (db.orders||[]).find(x=>String(x.id)===String(id));}catch(_){return null;}}
  function findBooklet(order){
    try{
      if(typeof alinV59OrderBooklet==='function') return alinV59OrderBooklet(order);
      return (db.booklets||[]).find(x=>String(x.id)===String(order?.item_id));
    }catch(_){return null;}
  }
  async function resolveSource(path){
    if(typeof alinResolveStoredFile!=='function')throw new Error('خدمة المستندات الخاصة غير متاحة');
    const resolved=await alinResolveStoredFile(path,'booklets');
    if(!resolved?.blob&&!resolved?.url)throw new Error('ملف الملزمة غير محمي أو غير مرتبط بهذا الطلب');
    return resolved;
  }
  async function ensurePdfJs(){
    if(window.pdfjsLib) return window.pdfjsLib;
    await new Promise((resolve,reject)=>{
      const old=document.querySelector('script[data-alin-pdfjs]');
      if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      s.dataset.alinPdfjs='1';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
    if(!window.pdfjsLib) throw new Error('PDF.js unavailable');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    return window.pdfjsLib;
  }
  function renderShell(order){
    const qty=copies(order);
    checkoutBox.innerHTML=`
      <section class="alin-print-v119">
        <header class="alin-print-v119-head">
          <div><small>عرض آمن للطباعة فقط</small><h2>${escSafe(order?.title||'ملزمة')}</h2><p>رقم الطلب: <b>${escSafe(order?.order_number||order?.id||'—')}</b> • الطالب: <b>${escSafe(order?.student_name||'—')}</b></p></div>
          <span class="alin-print-v119-copies">المطلوب ${qty} نسخة</span>
        </header>
        <div class="alin-print-v119-toolbar no-print">
          <div><b>معاينة داخل المنصة</b><span>الملف لا يفتح في عارض PDF الأصلي ولا يظهر زر تنزيل.</span></div>
          <button type="button" class="alin-print-v119-print" onclick="printLibraryCanvasV119()">طباعة ${qty} نسخة</button>
          <button type="button" class="secondary" onclick="closeCheckout()">إغلاق</button>
        </div>
        <div id="alinPrintCanvasStatus" class="alin-print-v119-status"><span></span><b>جاري تجهيز صفحات الملزمة...</b></div>
        <div id="alinPrintCanvasPages" class="alin-print-v119-pages" aria-label="معاينة صفحات الملزمة"></div>
      </section>`;
  }
  async function renderPreview(pdf){
    const pages=document.getElementById('alinPrintCanvasPages');
    const status=document.getElementById('alinPrintCanvasStatus');
    if(!pages||!status) return;
    pages.innerHTML='';
    const maxWidth=Math.min(900,Math.max(320,pages.clientWidth-24));
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n);
      const base=page.getViewport({scale:1});
      const scale=Math.min(1.45,maxWidth/base.width);
      const viewport=page.getViewport({scale});
      const wrap=document.createElement('article');
      wrap.className='alin-print-v119-page';
      const label=document.createElement('small');label.textContent=`صفحة ${n} من ${pdf.numPages}`;
      const surface=document.createElement('div');
      surface.className='alin-print-v119-surface';
      surface.style.maxWidth=`${Math.ceil(viewport.width)}px`;
      surface.style.aspectRatio=`${viewport.width} / ${viewport.height}`;
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      canvas.setAttribute('aria-label',`صفحة ${n}`);
      surface.appendChild(canvas);wrap.append(label,surface);pages.appendChild(wrap);
      await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
    }
    status.hidden=true;
    status.style.display='none';
  }
  async function openPreview(orderId){
    if(rendering) return;
    const order=findOrder(orderId);
    if(!order||order.kind!=='booklet') return toastSafe('هذا الطلب لا يحتوي ملف PDF');
    const booklet=findBooklet(order);
    if(!booklet?.file_path) return toastSafe('لا يوجد ملف PDF لهذه الملزمة');
    activeOrder=order; activePdf=null; activeBytes=null; rendering=true;
    checkoutModal.classList.remove('hidden');
    const close=document.querySelector('#checkoutModal .x');
    if(close){close.textContent='إغلاق';close.setAttribute('aria-label','إغلاق المعاينة');}
    renderShell(order);
    try{
      const pdfjs=await ensurePdfJs();
      const source=await resolveSource(booklet.file_path);
      if(source.blob){
        activeBytes=await source.blob.arrayBuffer();
      }else{
        const response=await fetch(String(source.url).split('#')[0],{cache:'no-store'});
        if(!response.ok) throw new Error('PDF '+response.status);
        activeBytes=await response.arrayBuffer();
      }
      activePdf=await pdfjs.getDocument({data:activeBytes.slice(0)}).promise;
      await renderPreview(activePdf);
    }catch(err){
      console.error('[ALIN preview error]',err);
      const status=document.getElementById('alinPrintCanvasStatus');
      const message=String(err?.message||'تعذر عرض ملف الملزمة');
      if(status) status.innerHTML=`<div class="alin-print-v119-error"><h3>تعذر تجهيز المعاينة</h3><p>${escSafe(message)}</p></div>`;
      toastSafe(message);
    }finally{rendering=false;}
  }
  async function printPreview(){
    if(!activePdf||!activeBytes) return toastSafe('انتظر حتى تكتمل معاينة الملف');
    const qty=copies(activeOrder);
    const button=document.querySelector('.alin-print-v119-print');
    if(button){button.disabled=true;button.textContent='جاري تجهيز الطباعة...';}
    try{
      const images=[];
      for(let n=1;n<=activePdf.numPages;n++){
        const page=await activePdf.getPage(n);
        const viewport=page.getViewport({scale:2});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
        images.push(canvas.toDataURL('image/jpeg',0.96));
      }
      let frame=document.getElementById('alinPrintFrameV119');
      if(frame) frame.remove();
      frame=document.createElement('iframe');frame.id='alinPrintFrameV119';frame.style.position='fixed';frame.style.left='-10000px';frame.style.width='1px';frame.style.height='1px';frame.style.border='0';document.body.appendChild(frame);
      const doc=frame.contentDocument;
      doc.open();
      doc.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>طباعة ملزمة</title><style>@page{size:auto;margin:8mm}html,body{margin:0;padding:0;background:#fff}.page{page-break-after:always;break-after:page;text-align:center}.page:last-child{page-break-after:auto;break-after:auto}img{display:block;width:100%;height:auto;max-width:100%;margin:0 auto}</style></head><body>${images.map(src=>`<div class="page"><img src="${src}"></div>`).join('')}</body></html>`);
      doc.close();
      await new Promise(resolve=>setTimeout(resolve,500));
      frame.contentWindow.focus();
      frame.contentWindow.print();
      toastSafe(`اختر الطابعة واضبط عدد النسخ على ${qty}`);
    }catch(err){
      console.error('[ALIN print error]',err);
      toastSafe('تعذر تجهيز الطباعة، أعد المحاولة');
    }finally{
      if(button){button.disabled=false;button.textContent=`طباعة ${qty} نسخة`;}
    }
  }
  window.openLibraryBookletPdf=openPreview;
  window.openOrderPdf=openPreview;
  window.printLibraryBookletDirect=openPreview;
  window.printLibraryPreviewV118=printPreview;
  window.printLibraryCanvasV119=printPreview;
  window.AlinLibraryModules=window.AlinLibraryModules||{};
  window.AlinLibraryModules.openLibraryBookletPdf=openPreview;
})();


;
