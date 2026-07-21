// === core/notifications.js ===
/* ALIN v2.2.6 — authoritative notification data service. */
(function(){
  'use strict';

  const FALLBACK_KEY='alin_notifications_fallback_v226';
  const arr=value=>Array.isArray(value)?value:[];
  const text=value=>String(value??'').trim();
  const now=()=>new Date().toISOString();
  const roleAliases={
    customer:'student',store:'student',students:'student',
    teachers:'teacher',libraries:'library',delegates:'courier',delegate:'courier',couriers:'courier'
  };

  function normalizedRole(value){
    const role=text(value||'all').toLowerCase();
    return roleAliases[role]||role||'all';
  }

  function accountContext(input={}){
    const current=window.current||{};
    return {
      role:normalizedRole(input.role||current.role||'student'),
      id:text(input.id||current.id||current.account_id||current.user_id||'')
    };
  }

  function fallbackRows(){
    try{return arr(JSON.parse(localStorage.getItem(FALLBACK_KEY)||'[]'))}
    catch(_){return []}
  }

  function saveFallback(rows){
    try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(arr(rows).slice(0,500)))}catch(_){}
  }

  function databaseRows(){
    return arr(window.db?.notifications);
  }

  function rowKey(row,index=0){
    return text(row?.id)||`${text(row?.created_at)}:${text(row?.title)}:${index}`;
  }

  function rows(){
    const unique=new Map();
    [...databaseRows(),...fallbackRows()].forEach((row,index)=>{
      if(!row)return;
      const key=rowKey(row,index);
      if(!unique.has(key))unique.set(key,row);
    });
    return [...unique.values()]
      .filter(row=>!['deleted','inactive','hidden'].includes(text(row.status||'active').toLowerCase()))
      .sort((a,b)=>text(b.created_at).localeCompare(text(a.created_at)));
  }

  function targetId(row){
    return text(row?.target_id||row?.account_id||row?.user_id||row?.recipient_id||row?.teacher_id||row?.library_id||row?.courier_id||'');
  }

  function targetRole(row){
    return normalizedRole(row?.target_role||row?.recipient_role||row?.audience||row?.role||'all');
  }

  function matches(row,input={}){
    const context=accountContext(input);
    const target=targetId(row);
    if(target)return Boolean(context.id)&&target===context.id;
    const role=targetRole(row);
    return role==='all'||role===context.role;
  }

  function visible(input={}){
    return rows().filter(row=>matches(row,input));
  }

  function seenKey(input={}){
    const context=accountContext(input);
    return `alin_notifications_seen_v226:${context.role}:${context.id||'guest'}`;
  }

  function seen(input={}){
    try{return new Set(arr(JSON.parse(localStorage.getItem(seenKey(input))||'[]')).map(String))}
    catch(_){return new Set()}
  }

  function saveSeen(values,input={}){
    try{localStorage.setItem(seenKey(input),JSON.stringify([...values]))}catch(_){}
  }

  function isRead(row,input={}){
    if(!row)return true;
    const context=accountContext(input);
    const id=rowKey(row);
    if(seen(context).has(id))return true;
    const target=targetId(row);
    return Boolean(target&&target===context.id&&(row.read_at||row.is_read));
  }

  function unreadCount(input={}){
    return visible(input).filter(row=>!isRead(row,input)).length;
  }

  function updateLocalRow(id,patch){
    const dbRows=databaseRows();
    const dbRow=dbRows.find(row=>rowKey(row)===String(id));
    if(dbRow)Object.assign(dbRow,patch);
    const local=fallbackRows();
    const localRow=local.find(row=>rowKey(row)===String(id));
    if(localRow){Object.assign(localRow,patch);saveFallback(local)}
  }

  function emit(reason='changed'){
    window.dispatchEvent(new CustomEvent('alin:notifications-updated',{detail:{reason,count:rows().length}}));
  }

  async function refresh(){
    try{
      if(typeof window.query!=='function')return rows();
      const fresh=await window.query('notifications');
      if(window.db)window.db.notifications=arr(fresh);
      emit('refresh');
      return rows();
    }catch(error){
      console.warn('[ALIN notifications] refresh',error);
      return rows();
    }
  }

  async function send(input={}){
    const row={
      id:text(input.id)||(typeof window.uid==='function'?window.uid('NT'):`NT-${Date.now()}`),
      title:text(input.title)||'إشعار',
      message:text(input.message||input.text),
      target_role:normalizedRole(input.target_role||input.role||input.audience||'all'),
      target_id:text(input.target_id||input.userId||input.account_id)||null,
      status:text(input.status||'active')||'active',
      from_user:text(input.from_user||window.current?.name||window.current?.username||window.current?.role||'admin'),
      created_at:input.created_at||now()
    };
    const displayRow={...row,text:row.message,audience:row.target_role,priority:text(input.priority||'normal')||'normal'};
    if(!row.message)throw new Error('اكتب نص الإشعار');
    try{
      if(typeof window.insert!=='function')throw new Error('خدمة الإشعارات غير جاهزة');
      await window.insert('notifications',row);
      emit('send');
      return {...displayRow,remote:true};
    }catch(error){
      const local=fallbackRows();local.unshift(displayRow);saveFallback(local);emit('fallback-send');
      console.warn('[ALIN notifications] stored locally',error);
      return {...displayRow,remote:false,error};
    }
  }

  async function markRead(id,input={}){
    const row=rows().find(item=>rowKey(item)===String(id));
    if(!row)return false;
    const context=accountContext(input);
    const values=seen(context);values.add(rowKey(row));saveSeen(values,context);
    const target=targetId(row);
    if(target&&target===context.id&&typeof window.update==='function'){
      const stamp=now();
      try{await window.update('notifications',{read_at:stamp},{id:row.id});updateLocalRow(rowKey(row),{read_at:stamp,is_read:true})}
      catch(error){console.warn('[ALIN notifications] remote read state',error)}
    }
    emit('read');
    return true;
  }

  async function markAll(input={}){
    const context=accountContext(input);
    const values=seen(context);
    const visibleRows=visible(context);
    visibleRows.forEach(row=>values.add(rowKey(row)));
    saveSeen(values,context);
    for(const row of visibleRows){
      const target=targetId(row);
      if(target&&target===context.id&&!(row.read_at||row.is_read)&&typeof window.update==='function'){
        const stamp=now();
        try{await window.update('notifications',{read_at:stamp},{id:row.id});updateLocalRow(rowKey(row),{read_at:stamp,is_read:true})}
        catch(error){console.warn('[ALIN notifications] mark all',error)}
      }
    }
    emit('read-all');
    return true;
  }

  async function remove(id){
    if(typeof window.removeRow!=='function')throw new Error('خدمة حذف الإشعار غير جاهزة');
    await window.removeRow('notifications',{id});
    if(window.db&&Array.isArray(window.db.notifications))window.db.notifications=window.db.notifications.filter(row=>String(row.id)!==String(id));
    const local=fallbackRows().filter(row=>String(row.id)!==String(id));saveFallback(local);
    emit('delete');
    return true;
  }

  const api=Object.freeze({rows,visible,matches,isRead,unreadCount,refresh,send,markRead,markAll,remove,context:accountContext});
  window.AlinNotifications=api;

  window.addEventListener('alin:data-refreshed',()=>emit('data-refreshed'));
})();
