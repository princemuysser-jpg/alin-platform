// === store/discovery-details.js ===
// Product details, related items, sharing, stock alerts, reviews and bundles.
(()=>{
  'use strict';
  const ctx=window.AlinStoreDiscovery;
  if(!ctx)throw new Error('AlinStoreDiscovery core must load before details');
  const {$,esc,num,fmt,imageUrl,state,canonicalItems,activeDeal,effectivePrice,badges,findItem,isFavorite,openModal,hasSb,stableKey}=ctx;

  const reviewsFor=item=>(state.tables.product_reviews||[]).filter(row=>row.kind===item.kind&&String(row.item_id)===item.id&&['approved','published'].includes(row.status||'approved'));
  function relatedItems(item){
    return canonicalItems().filter(candidate=>stableKey(candidate.kind,candidate.id)!==stableKey(item.kind,item.id)).map(candidate=>({
      item:candidate,
      score:(candidate.subject&&candidate.subject===item.subject?5:0)
        +(candidate.grade&&candidate.grade===item.grade?4:0)
        +(candidate.teacherId&&String(candidate.teacherId)===String(item.teacherId)?3:0)
        +(candidate.category&&candidate.category===item.category?2:0)
    })).filter(row=>row.score>0).sort((a,b)=>b.score-a.score).slice(0,6).map(row=>row.item);
  }
  function relatedDetailHtml(item){
    const rows=relatedItems(item);
    return rows.length?`<section class="v99-related"><div class="v99-section-head"><div><h2>مواد مرتبطة</h2><small>اقتراحات من نفس المادة أو المرحلة</small></div></div><div class="v99-rail">${rows.map(ctx.miniCard).join('')}</div></section>`:'';
  }

  function openDetails(kind,id){
    const item=findItem(kind,id);
    if(!item)return;
    const reviews=reviewsFor(item);
    const average=reviews.length?reviews.reduce((sum,row)=>sum+num(row.rating),0)/reviews.length:0;
    const out=item.stock!==null&&item.stock<=0;
    openModal(`<div class="v99-detail"><div class="v99-detail-media">${item.image?`<img src="${esc(imageUrl(item.image))}" alt="${esc(item.title)}">`:'<span class="v99-placeholder">ALIN</span>'}</div><div class="v99-detail-copy"><div class="v99-badges">${badges(item).map(label=>`<span class="v99-badge">${esc(label)}</span>`).join('')}</div><h2>${esc(item.title)}</h2><p>${esc([item.teacher,item.subject,item.grade,item.category].filter(Boolean).join(' • '))}</p><p>${esc(item.description||'مادة مختارة من متجر آلين، راجع التفاصيل وحدد طريقة الاستلام أو التوصيل عند إكمال الطلب.')}</p><div class="v99-price">${fmt(effectivePrice(item))} د.ع ${activeDeal(item)?`<del>${fmt(item.price)}</del>`:''}</div><div class="v99-card-meta"><span>${out?'غير متوفر حالياً':item.stock===null?'متاح للطلب':`المخزون ${fmt(item.stock)}`}</span><span>${item.prep?`تقدير التجهيز ${fmt(item.prep)} دقيقة`:'وقت التجهيز تؤكده المكتبة'}</span></div><div class="v99-notice">يمكنك اختيار الاستلام من المكتبة أو التوصيل عند إكمال الطلب. تبقى الكوبونات الحالية متاحة داخل السلة.</div><div class="v99-qty"><label for="v99DetailQty">الكمية</label><input id="v99DetailQty" type="number" min="1" max="99" value="1"></div><div class="v99-actions">${out?`<button data-v99-action="stockForm" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">أبلغني عند التوفر</button>`:`<button data-v99-action="cartQty" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">أضف للسلة</button><button class="v99-secondary" data-v99-action="buy" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">شراء الآن</button>`}<button class="v99-ghost" data-v99-action="share" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">مشاركة</button><button class="v99-ghost" data-v99-action="favorite" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">${isFavorite(item)?'إزالة من المفضلة':'حفظ بالمفضلة'}</button></div></div></div><section class="v99-reviews"><h3>التقييمات ${reviews.length?`— ${average.toFixed(1)} من 5`:''}</h3>${reviews.map(review=>`<div class="row"><div><b>${fmt(review.rating)} / 5</b><small>${esc(review.comment||'')}</small></div></div>`).join('')||'<p class="muted">لا توجد تقييمات منشورة بعد.</p>'}<button data-v99-action="reviewForm" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">أضف تقييمك</button></section>${relatedDetailHtml(item)}`);
  }

  async function shareItem(item){
    const url=new URL(location.href);
    url.hash='';
    url.searchParams.set('item',stableKey(item.kind,item.id));
    const data={title:item.title,text:`${item.title} — ${fmt(effectivePrice(item))} د.ع`,url:url.toString()};
    try{
      if(navigator.share)await navigator.share(data);
      else{await navigator.clipboard.writeText(`${data.text}\n${data.url}`);if(typeof window.toast==='function')window.toast('تم نسخ رابط المنتج')}
    }catch(error){if(error.name!=='AbortError')alert('تعذر نسخ الرابط')}
  }

  function stockForm(item){
    openModal(`<h2>أبلغني عند التوفر</h2><p>سنحفظ طلب التنبيه في النظام فقط إذا كانت الخدمة مفعلة.</p><div class="v99-form"><input id="v99StockContact" placeholder="رقم الهاتف"><button data-v99-action="stockSubmit" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">حفظ التنبيه</button><div id="v99FormMsg"></div></div>`);
  }
  async function stockSubmit(item){
    const contact=$('#v99StockContact')?.value.trim(),message=$('#v99FormMsg');
    if(!contact){if(message)message.innerHTML='<div class="v99-notice error">اكتب رقم الهاتف.</div>';return}
    if(!state.schema.stock_alerts||!hasSb()){if(message)message.innerHTML='<div class="v99-notice error">خدمة التنبيه غير مفعلة على قاعدة البيانات.</div>';return}
    try{
      const {error}=await window.sb.from('stock_alerts').insert({kind:item.kind,item_id:item.id,contact,status:'pending'});
      if(error)throw error;
      if(message)message.innerHTML='<div class="v99-notice success">تم تسجيل طلب التنبيه.</div>';
    }catch(error){if(message)message.innerHTML=`<div class="v99-notice error">لم يتم الحفظ: ${esc(error.message||'راجع إعدادات الخدمة')}</div>`}
  }

  function reviewForm(item){
    openModal(`<h2>قيّم ${esc(item.title)}</h2><div class="v99-form"><input id="v99ReviewContact" placeholder="رقم الهاتف"><select id="v99ReviewRating"><option value="5">5 — ممتاز</option><option value="4">4 — جيد جداً</option><option value="3">3 — جيد</option><option value="2">2 — مقبول</option><option value="1">1 — ضعيف</option></select><textarea id="v99ReviewComment" placeholder="اكتب رأيك"></textarea><button data-v99-action="reviewSubmit" data-kind="${esc(item.kind)}" data-id="${esc(item.id)}">إرسال للمراجعة</button><div id="v99FormMsg"></div></div>`);
  }
  async function reviewSubmit(item){
    const message=$('#v99FormMsg'),contact=$('#v99ReviewContact')?.value.trim(),rating=num($('#v99ReviewRating')?.value),comment=$('#v99ReviewComment')?.value.trim();
    if(!contact||!comment){if(message)message.innerHTML='<div class="v99-notice error">أكمل رقم الهاتف والتعليق.</div>';return}
    if(!state.schema.product_reviews||!hasSb()){if(message)message.innerHTML='<div class="v99-notice error">خدمة التقييمات غير مفعلة.</div>';return}
    try{
      const {error}=await window.sb.from('product_reviews').insert({kind:item.kind,item_id:item.id,student_contact:contact,rating,comment,status:'pending'});
      if(error)throw error;
      if(message)message.innerHTML='<div class="v99-notice success">تم إرسال تقييمك للمراجعة قبل النشر.</div>';
    }catch(error){if(message)message.innerHTML=`<div class="v99-notice error">لم يتم الإرسال: ${esc(error.message||'راجع إعدادات الخدمة')}</div>`}
  }

  function teacherModal(id){
    const teacher=ctx.publicTeachers?.().find(row=>String(row.id)===String(id));
    if(!teacher)return;
    const books=canonicalItems().filter(item=>item.kind==='booklet'&&String(item.teacherId)===String(id));
    openModal(`<div class="v99-detail"><div><span class="v99-avatar">${teacher.avatar_path||teacher.image_path?`<img src="${esc(imageUrl(teacher.avatar_path||teacher.image_path))}" alt="">`:esc((teacher.name||'آ').slice(0,1))}</span></div><div class="v99-detail-copy"><span class="v99-kicker">ملف المدرس</span><h2>${esc(teacher.name)}</h2><p><b>${esc(teacher.specialty||'مدرس معتمد')}</b></p><p>${esc(teacher.bio||'مدرس معتمد في منصة آلين.')}</p></div></div><div class="v99-rail">${books.map(ctx.miniCard).join('')||'<div class="v99-empty">لا توجد ملازم منشورة حالياً.</div>'}</div>`);
  }

  function bundleModal(id){
    const bundle=(state.tables.bundles||[]).find(row=>String(row.id)===String(id));
    if(!bundle)return;
    const lines=(state.tables.bundle_items||[]).filter(row=>String(row.bundle_id)===String(id));
    const mapped=lines.map(line=>({...line,item:findItem(line.kind,String(line.item_id))})).filter(row=>row.item);
    openModal(`<h2>${esc(bundle.name||bundle.title)}</h2><p>${esc(bundle.description||'')}</p><div>${mapped.map(row=>`<div class="row"><div><b>${esc(row.item.title)}</b><small>الكمية ${fmt(row.quantity||1)}</small></div><span>${fmt(effectivePrice(row.item))} د.ع</span></div>`).join('')||'<div class="v99-empty">لا توجد عناصر متاحة في هذه الحزمة.</div>'}</div><div class="v99-price">سعر الحزمة: ${fmt(bundle.bundle_price||bundle.price)} د.ع</div><button data-v99-action="bundleAdd" data-id="${esc(id)}" ${mapped.length?'':'disabled'}>أضف الحزمة للسلة</button>`);
  }

  function addBundle(id){
    const lines=(state.tables.bundle_items||[]).filter(row=>String(row.bundle_id)===String(id));
    for(const line of lines){for(let index=0;index<Math.max(1,num(line.quantity));index++)window.addToCart?.(line.kind,String(line.item_id))}
    ctx.updateDesktopHeader();
    ctx.updateMobileHeader();
    if(typeof window.toast==='function')window.toast('أضيفت عناصر الحزمة المتاحة إلى السلة');
  }

  Object.assign(ctx,{reviewsFor,relatedItems,relatedDetailHtml,openDetails,shareItem,stockForm,stockSubmit,reviewForm,reviewSubmit,teacherModal,bundleModal,addBundle});
  window.v99OpenDetails=openDetails;
})();
