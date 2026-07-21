// ALIN Admin Booklets — single implementation (v2.2.2)
(function(){
  'use strict';

  const state={q:'',status:'all',grade:'all',subject:'all',teacher:'all'};
  const escv=value=>typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const moneyv=value=>typeof window.money==='function'?window.money(value):Number(value||0).toLocaleString('ar-IQ');
  const books=()=>Array.isArray(window.db?.booklets)?window.db.booklets:[];
  const teachers=()=>Array.isArray(window.db?.accounts?.teachers)?window.db.accounts.teachers:[];
  const orders=()=>Array.isArray(window.db?.orders)?window.db.orders:[];
  const root=()=>window.adminContent||document.getElementById('adminContent');
  const statusValue=book=>String(book?.publish_status||book?.status||'draft').toLowerCase();
  const statusLabel=status=>({published:'منشورة',hidden:'مخفية',draft:'مسودة',review:'قيد المراجعة',pending:'قيد المراجعة',archived:'مؤرشفة'}[String(status||'draft').toLowerCase()]||String(status||'مسودة'));
  const teacherName=id=>teachers().find(item=>String(item.id)===String(id))?.name||'مدرس غير محدد';
  const unique=values=>[...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))];
  const orderCount=id=>orders().filter(order=>{
    const itemId=order.item_id||order.booklet_id||order.item?.id;
    const kind=String(order.kind||order.item_kind||order.item_type||'booklet').toLowerCase();
    return String(itemId)===String(id)&&kind==='booklet';
  }).length;
  const coverUrl=book=>{
    const value=book?.cover_path||book?.cover_url||book?.cover||'';
    if(!value)return '';
    try{return typeof window.mediaUrl==='function'?window.mediaUrl(value):value}catch(_){return value}
  };
  const upload=async(bucket,file,options)=>{
    if(!file||!file.name)return '';
    const uploader=window.uploadFileV52||window.uploadFile;
    if(typeof uploader!=='function')throw new Error('خدمة رفع الملفات غير متاحة');
    return uploader(bucket,file,options);
  };
  const statusPayload=status=>{
    const normalized=String(status||'draft');
    return {
      status:normalized,
      publish_status:normalized,
      published:normalized==='published',
      is_published:normalized==='published'
    };
  };

  async function reloadAndRender(){
    if(typeof window.load==='function')await window.load();
    renderBookletsAdmin();
  }

  function filteredBooks(){
    let list=[...books()];
    const q=state.q.trim().toLowerCase();
    if(q)list=list.filter(book=>[book.title,book.subject,book.grade,teacherName(book.teacher_id)].some(value=>String(value||'').toLowerCase().includes(q)));
    if(state.status!=='all')list=list.filter(book=>statusValue(book)===state.status||(state.status==='review'&&statusValue(book)==='pending'));
    if(state.grade!=='all')list=list.filter(book=>String(book.grade||'')===state.grade);
    if(state.subject!=='all')list=list.filter(book=>String(book.subject||'')===state.subject);
    if(state.teacher!=='all')list=list.filter(book=>String(book.teacher_id||'')===state.teacher);
    return list.sort((a,b)=>String(b.updated_at||b.created_at||b.id||'').localeCompare(String(a.updated_at||a.created_at||a.id||'')));
  }

  function ensureModal(){
    let modal=document.getElementById('alinBookletEditorModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='alinBookletEditorModal';
    modal.className='modal hidden';
    modal.innerHTML='<div class="modal-card"><button class="x" type="button" onclick="closeBookletEditor()">×</button><div id="alinBookletEditorBody"></div></div>';
    document.body.appendChild(modal);
    return modal;
  }

  function formHtml(book={}){
    return `<form id="alinBookletEditorForm" class="form-grid" data-id="${escv(book.id||'')}">
      <input name="title" value="${escv(book.title||'')}" placeholder="اسم الملزمة" required>
      <select name="teacherId" required><option value="">اختر المدرس</option>${teachers().filter(item=>String(item.status||'active')==='active'||String(item.id)===String(book.teacher_id)).map(item=>`<option value="${escv(item.id)}" ${String(item.id)===String(book.teacher_id)?'selected':''}>${escv(item.name)}</option>`).join('')}</select>
      <input name="subject" value="${escv(book.subject||'')}" placeholder="المادة">
      <input name="grade" value="${escv(book.grade||'')}" placeholder="الصف">
      <input name="term" value="${escv(book.term||'')}" placeholder="الفصل">
      <input name="edition" value="${escv(book.edition||book.year||'')}" placeholder="الإصدار أو السنة">
      <input name="price" type="number" min="0" value="${Number(book.price||0)}" placeholder="السعر" required>
      <input name="teacherShare" type="number" min="0" max="100" value="${Number(book.teacher_share_percent||0)}" placeholder="نسبة المدرس %">
      <label>غلاف الملزمة<input name="cover" type="file" accept="image/*"></label>
      <label>ملف PDF ${book.file_path?'(اتركه فارغًا للاحتفاظ بالحالي)':''}<input name="bookletFile" type="file" accept=".pdf,application/pdf" ${book.file_path?'':'required'}></label>
      <textarea name="adminNote" rows="3" placeholder="ملاحظة داخلية">${escv(book.admin_note||'')}</textarea>
      <div class="row-actions"><button type="button" class="secondary" onclick="saveBooklet('draft')">حفظ مسودة</button><button type="button" class="warning" onclick="saveBooklet('review')">قيد المراجعة</button><button type="button" onclick="saveBooklet('published')">حفظ ونشر</button></div>
    </form>`;
  }

  function openBookletEditor(id=''){
    const book=id?books().find(item=>String(item.id)===String(id)):{};
    if(id&&!book)return;
    const modal=ensureModal();
    modal.querySelector('#alinBookletEditorBody').innerHTML=`<h2>${id?'تعديل الملزمة':'إضافة ملزمة'}</h2>${formHtml(book||{})}`;
    modal.classList.remove('hidden');
    modal.hidden=false;
  }

  function closeBookletEditor(){
    const modal=document.getElementById('alinBookletEditorModal');
    if(!modal)return;
    modal.classList.add('hidden');
    modal.hidden=true;
  }

  async function saveBooklet(status='published'){
    const form=document.getElementById('alinBookletEditorForm')||document.getElementById('bookForm');
    if(!form)return;
    const data=new FormData(form);
    const id=String(form.dataset.id||'');
    const existing=id?books().find(item=>String(item.id)===id):null;
    const title=String(data.get('title')||'').trim();
    const teacherId=String(data.get('teacherId')||'').trim();
    const price=Number(data.get('price')||0);
    if(!title)return alert('اكتب اسم الملزمة');
    if(!teacherId)return alert('اختر المدرس');
    if(!Number.isFinite(price)||price<0)return alert('السعر غير صحيح');
    try{
      const coverFile=data.get('cover');
      const pdfFile=data.get('bookletFile');
      let coverPath=existing?.cover_path||'';
      let filePath=existing?.file_path||'';
      let fileName=existing?.file_name||'';
      if(coverFile&&coverFile.name)coverPath=await upload('covers',coverFile,{type:'image'});
      if(pdfFile&&pdfFile.name){filePath=await upload('booklets',pdfFile,{type:'pdf',required:true});fileName=pdfFile.name}
      if(!filePath)throw new Error('ملف PDF مطلوب');
      const payload={
        title,teacher_id:teacherId,
        subject:String(data.get('subject')||'').trim(),
        grade:String(data.get('grade')||'').trim(),
        term:String(data.get('term')||'').trim(),
        edition:String(data.get('edition')||'').trim(),
        year:String(data.get('edition')||'').trim(),
        price,
        teacher_share_percent:Math.max(0,Math.min(100,Number(data.get('teacherShare')||0))),
        admin_note:String(data.get('adminNote')||'').trim(),
        cover_path:coverPath,file_path:filePath,file_name:fileName,
        updated_at:new Date().toISOString(),
        ...statusPayload(status)
      };
      if(existing){
        await window.update('booklets',payload,{id:existing.id});
        if(typeof window.audit==='function')await window.audit('booklet',`تعديل الملزمة ${title} وحفظها بحالة ${statusLabel(status)}`);
      }else{
        payload.id=typeof window.uid==='function'?window.uid('B'):`B-${Date.now()}`;
        payload.created_at=new Date().toISOString();
        await window.insert('booklets',payload);
        if(typeof window.audit==='function')await window.audit('booklet',`إضافة الملزمة ${title} بحالة ${statusLabel(status)}`);
      }
      closeBookletEditor();
      await reloadAndRender();
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast(existing?'تم تحديث الملزمة':'تمت إضافة الملزمة');
    }catch(error){
      console.error('[ALIN booklet save]',error);
      alert(error?.message||'تعذر حفظ الملزمة');
    }
  }

  async function setBookStatus(id,status){
    const book=books().find(item=>String(item.id)===String(id));if(!book)return;
    try{
      await window.update('booklets',{...statusPayload(status),updated_at:new Date().toISOString()},{id:book.id});
      if(typeof window.audit==='function')await window.audit('booklet',`تغيير حالة الملزمة ${book.title||book.id} إلى ${statusLabel(status)}`);
      await reloadAndRender();
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast(`تم تغيير الحالة إلى ${statusLabel(status)}`);
    }catch(error){alert(error?.message||'تعذر تغيير حالة الملزمة')}
  }

  async function deleteBooklet(id){
    const book=books().find(item=>String(item.id)===String(id));if(!book)return;
    const count=orderCount(id);
    if(count>0){
      if(confirm(`الملزمة مرتبطة بـ ${count} طلب ولا يمكن حذفها. هل تريد إخفاءها؟`))await setBookStatus(id,'hidden');
      return;
    }
    if(!confirm(`حذف الملزمة ${book.title||''} نهائيًا؟`))return;
    try{
      await window.removeRow('booklets',{id:book.id});
      if(typeof window.audit==='function')await window.audit('booklet',`حذف الملزمة ${book.title||book.id}`);
      await reloadAndRender();
      if(typeof window.renderStore==='function')window.renderStore();
      if(typeof window.toast==='function')window.toast('تم حذف الملزمة');
    }catch(error){alert(error?.message||'تعذر حذف الملزمة')}
  }

  function previewBooklet(id){
    const book=books().find(item=>String(item.id)===String(id));if(!book?.file_path)return alert('ملف PDF غير متاح');
    try{window.open(typeof window.mediaUrl==='function'?window.mediaUrl(book.file_path):book.file_path,'_blank','noopener')}catch(_){alert('تعذر فتح المعاينة')}
  }

  function card(book){
    const status=statusValue(book);
    const cover=coverUrl(book);
    return `<article class="admin-v128-card"><div class="admin-v128-cover">${cover?`<img src="${escv(cover)}" alt="غلاف ${escv(book.title||'الملزمة')}">`:'<span>آ</span>'}<em class="admin-v128-status ${escv(status)}">${statusLabel(status)}</em></div><div class="admin-v128-card-body"><h3>${escv(book.title||'ملزمة بدون اسم')}</h3><div class="admin-v128-card-meta"><div><small>المدرس</small><b>${escv(teacherName(book.teacher_id))}</b></div><div><small>المادة / الصف</small><b>${escv(book.subject||'—')} • ${escv(book.grade||'—')}</b></div><div><small>الإصدار</small><b>${escv(book.edition||book.year||'—')}</b></div><div><small>الطلبات</small><b>${orderCount(book.id)}</b></div><div><small>السعر</small><b class="price">${moneyv(book.price)} د.ع</b></div></div><div class="admin-v128-card-actions"><button type="button" class="secondary" onclick="previewBooklet('${escv(book.id)}')">معاينة</button><button type="button" class="secondary" onclick="editBooklet('${escv(book.id)}')">تعديل</button><button type="button" class="warning" onclick="setBookStatus('${escv(book.id)}','${status==='published'?'hidden':'published'}')">${status==='published'?'إخفاء':'نشر'}</button><button type="button" class="danger" onclick="deleteBooklet('${escv(book.id)}')">حذف</button></div></div></article>`;
  }

  function renderBookletsAdmin(){
    const container=root();if(!container)return;
    const all=books();
    const list=filteredBooks();
    const grades=unique(all.map(item=>item.grade));
    const subjects=unique(all.map(item=>item.subject));
    const counts={published:0,hidden:0,draft:0,review:0};
    all.forEach(item=>{const status=statusValue(item)==='pending'?'review':statusValue(item);if(Object.prototype.hasOwnProperty.call(counts,status))counts[status]++});
    container.innerHTML=`<section class="admin-v128-booklets"><header class="admin-v128-head"><div><h2>إدارة الملازم</h2><p>إضافة وتعديل ونشر الملازم من تنفيذ واحد مستقل عن platform.js.</p></div><button type="button" onclick="uploadBooklet()">إضافة ملزمة</button></header><section class="admin-v128-stats"><article><small>الإجمالي</small><strong>${all.length}</strong></article><article class="green"><small>المنشورة</small><strong>${counts.published}</strong></article><article class="gray"><small>المخفية</small><strong>${counts.hidden}</strong></article><article class="gold"><small>المسودات والمراجعة</small><strong>${counts.draft+counts.review}</strong></article></section><section class="admin-v128-toolbar"><input id="alinBookletSearch" value="${escv(state.q)}" placeholder="بحث باسم الملزمة أو المدرس أو المادة"><select id="alinBookletStatus"><option value="all">كل الحالات</option><option value="published" ${state.status==='published'?'selected':''}>منشورة</option><option value="hidden" ${state.status==='hidden'?'selected':''}>مخفية</option><option value="draft" ${state.status==='draft'?'selected':''}>مسودة</option><option value="review" ${state.status==='review'?'selected':''}>قيد المراجعة</option><option value="archived" ${state.status==='archived'?'selected':''}>مؤرشفة</option></select><select id="alinBookletGrade"><option value="all">كل الصفوف</option>${grades.map(value=>`<option value="${escv(value)}" ${state.grade===value?'selected':''}>${escv(value)}</option>`).join('')}</select><select id="alinBookletSubject"><option value="all">كل المواد</option>${subjects.map(value=>`<option value="${escv(value)}" ${state.subject===value?'selected':''}>${escv(value)}</option>`).join('')}</select><select id="alinBookletTeacher"><option value="all">كل المدرسين</option>${teachers().map(item=>`<option value="${escv(item.id)}" ${state.teacher===String(item.id)?'selected':''}>${escv(item.name)}</option>`).join('')}</select></section><div class="admin-v128-results"><span>تم العثور على <b>${list.length}</b> ملزمة</span></div>${list.length?`<section class="admin-v128-grid">${list.map(card).join('')}</section>`:'<div class="empty">لا توجد ملازم مطابقة.</div>'}</section>`;
    const bind=(id,key,event='change')=>document.getElementById(id)?.addEventListener(event,eventObject=>{state[key]=eventObject.target.value;renderBookletsAdmin()});
    bind('alinBookletSearch','q','input');bind('alinBookletStatus','status');bind('alinBookletGrade','grade');bind('alinBookletSubject','subject');bind('alinBookletTeacher','teacher');
  }

  window.renderBookletsAdmin=renderBookletsAdmin;
  window.uploadBooklet=()=>openBookletEditor('');
  window.editBooklet=openBookletEditor;
  window.saveBooklet=saveBooklet;
  window.closeBookletEditor=closeBookletEditor;
  window.setBookStatus=setBookStatus;
  window.deleteBooklet=deleteBooklet;
  window.archiveBooklet=id=>setBookStatus(id,'archived');
  window.previewBooklet=previewBooklet;
  window.AlinAdminModules?.register?.('booklets',renderBookletsAdmin);
})();
