-- ALIN v2.7.3 — إصلاح تعارض حماية الطلب مع الإنهاء الداخلي للطلب
-- السبب: دالة المرحلة الرابعة تنشئ الطلب ثم تضع مفاتيح منع التكرار وحجز المخزون،
-- وكان trigger حماية الطلب يعتبر هذا التحديث الداخلي تحديثاً من زائر ويرفضه.
-- الإصلاح لا يضعف حماية المكتبة أو المندوب؛ يسمح فقط بأربعة حقول مشتقة من الخادم.
-- آمن لإعادة التنفيذ ولا يحذف طلبات أو مخزوناً.

begin;

create or replace function public.alin_protect_order_update()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text := public.alin_current_role();
  v_allowed text[];
  v_old_status text := lower(coalesce(old.status,'new'));
  v_new_status text := lower(coalesce(new.status,v_old_status));
begin
  -- Internal checkout finalization. The caller cannot choose these values;
  -- alin_create_store_orders_guarded derives them on the server.
  if current_setting('alin.internal_order_update',true)='stage4_checkout_finalize' then
    v_allowed:=array[
      'checkout_request_key','checkout_group_id','stock_reserved','stock_restored_at'
    ];
    if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then
      raise exception 'تم منع تعديل داخلي غير مصرح في الطلب';
    end if;
    return new;
  end if;

  if public.alin_is_admin() then
    return new;
  end if;

  if v_role='library' then
    v_allowed:=array[
      'status','status_history','updated_at','processing_at','ready_at',
      'completed_at','delivered_at','cancelled_at','cancellation_reason',
      'cancel_reason','payment_status','notes','library_note'
    ];

    if old.status is distinct from new.status then
      if not (
        (v_old_status in ('new','pending','pending_admin','accepted') and v_new_status in ('processing','cancelled'))
        or (v_old_status in ('processing','printing') and v_new_status in ('ready','cancelled'))
        or (v_old_status='ready' and v_new_status in ('completed','delivered','cancelled'))
      ) then
        raise exception 'انتقال حالة الطلب غير مسموح للمكتبة: % إلى %',old.status,new.status;
      end if;
    end if;

    -- توافق بين اسم الحقل القديم والجديد.
    if new.cancellation_reason is distinct from old.cancellation_reason and new.cancel_reason is not distinct from old.cancel_reason then
      new.cancel_reason:=new.cancellation_reason;
    elsif new.cancel_reason is distinct from old.cancel_reason and new.cancellation_reason is not distinct from old.cancellation_reason then
      new.cancellation_reason:=new.cancel_reason;
    end if;

    if v_new_status in ('completed','delivered') then
      new.payment_status:='paid';
    elsif new.payment_status is distinct from old.payment_status then
      raise exception 'لا يمكن للمكتبة تغيير حالة الدفع قبل إكمال الطلب';
    end if;

  elsif v_role='courier' then
    v_allowed:=array[
      'status','assignment_status','updated_at','accepted_at','picked_up_at',
      'out_for_delivery_at','completed_at','delivered_at','rejected_at','cancelled_at',
      'delivery_note','proof_path','handoff_token'
    ];

    if old.status is distinct from new.status then
      if not (
        (v_old_status in ('pending','new','pending_admin','assigned') and v_new_status in ('accepted','rejected'))
        or (v_old_status='accepted' and v_new_status in ('picked_up','rejected'))
        or (v_old_status='picked_up' and v_new_status in ('out_for_delivery','rejected'))
        or (v_old_status in ('out_for_delivery','out_delivery','processing') and v_new_status in ('completed','delivered'))
      ) then
        raise exception 'انتقال حالة الطلب غير مسموح للمندوب: % إلى %',old.status,new.status;
      end if;
    end if;
  else
    raise exception 'غير مسموح بتعديل الطلب';
  end if;

  if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then
    raise exception 'تم منع تعديل بيانات حساسة في الطلب';
  end if;

  return new;
end
$$;

revoke all on function public.alin_protect_order_update() from public,anon,authenticated;

drop trigger if exists alin_orders_protect_update on public.orders;
create trigger alin_orders_protect_update
before update on public.orders
for each row execute function public.alin_protect_order_update();

create or replace function public.alin_create_store_orders_guarded(
  p_items jsonb,
  p_customer jsonb,
  p_fulfillment jsonb default '{}'::jsonb,
  p_coupon_code text default null,
  p_request_key text default null,
  p_device_id text default null
)
returns table(order_number text,order_id text)
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_request_key text:=lower(btrim(coalesce(p_request_key,'')));
  v_device_id text:=btrim(coalesce(p_device_id,''));
  v_phone text:=translate(btrim(coalesce(p_customer->>'phone','')),'٠١٢٣٤٥٦٧٨٩','0123456789');
  v_phone_hash text;
  v_device_hash text;
  v_payload_hash text;
  v_request_id uuid;
  v_existing jsonb;
  v_result jsonb;
  v_count integer;
begin
  v_phone:=regexp_replace(v_phone,'[^0-9+]','','g');
  if v_request_key !~ '^[a-z0-9-]{20,80}$' then
    raise exception 'رمز تأكيد الطلب غير صالح. حدّث الصفحة وحاول مجدداً';
  end if;
  if length(v_device_id)<16 or length(v_device_id)>160 then
    raise exception 'تعذر التحقق من جهاز الطلب. حدّث الصفحة وحاول مجدداً';
  end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'اكتب رقم هاتف صحيح';
  end if;

  v_phone_hash:=encode(digest('alin-phone-v1:'||v_phone,'sha256'),'hex');
  v_device_hash:=encode(digest('alin-device-v1:'||v_device_id,'sha256'),'hex');
  v_payload_hash:=encode(digest(jsonb_build_object(
    'items',coalesce(p_items,'[]'::jsonb),
    'customer',jsonb_build_object('name',btrim(coalesce(p_customer->>'name','')),'phone',v_phone),
    'fulfillment',coalesce(p_fulfillment,'{}'::jsonb),
    'coupon',lower(btrim(coalesce(p_coupon_code,'')))
  )::text,'sha256'),'hex');

  -- نفس المفتاح يرجع نفس الطلب ولا يخصم المخزون مرة ثانية.
  select to_jsonb(r) into v_existing
  from public.checkout_requests r
  where r.request_key=v_request_key;

  if v_existing is not null then
    if coalesce(v_existing->>'payload_hash','')<>v_payload_hash then
      raise exception 'رمز الطلب مستخدم لمحتوى مختلف. حدّث الصفحة وحاول مجدداً';
    end if;
    if coalesce(v_existing->>'status','')='completed'
       and jsonb_typeof(v_existing->'result')='array' then
      return query
      select x.order_number,x.order_id
      from jsonb_to_recordset(v_existing->'result') as x(order_number text,order_id text);
      return;
    end if;
    raise exception 'الطلب نفسه قيد المعالجة. انتظر لحظات ولا تضغط مرة أخرى';
  end if;

  -- إذا أعاد المتصفح نفس السلة خلال دقيقتين، نرجع النتيجة السابقة.
  select r.result into v_result
  from public.checkout_requests r
  where r.phone_hash=v_phone_hash
    and r.payload_hash=v_payload_hash
    and r.status='completed'
    and r.created_at>now()-interval '2 minutes'
  order by r.created_at desc
  limit 1;

  if jsonb_typeof(v_result)='array' then
    return query
    select x.order_number,x.order_id
    from jsonb_to_recordset(v_result) as x(order_number text,order_id text);
    return;
  end if;

  select count(*) into v_count
  from public.checkout_requests r
  where r.phone_hash=v_phone_hash and r.created_at>now()-interval '5 minutes';
  if v_count>=4 then
    raise exception 'تم إرسال طلبات كثيرة لهذا الرقم. انتظر خمس دقائق ثم حاول مجدداً';
  end if;

  select count(*) into v_count
  from public.checkout_requests r
  where r.phone_hash=v_phone_hash and r.created_at>now()-interval '24 hours';
  if v_count>=20 then
    raise exception 'وصل هذا الرقم إلى الحد اليومي للطلبات';
  end if;

  select count(*) into v_count
  from public.checkout_requests r
  where r.device_hash=v_device_hash and r.created_at>now()-interval '5 minutes';
  if v_count>=8 then
    raise exception 'تم إرسال طلبات كثيرة من هذا الجهاز. انتظر خمس دقائق ثم حاول مجدداً';
  end if;

  select count(*) into v_count
  from public.checkout_requests r
  where r.device_hash=v_device_hash and r.created_at>now()-interval '24 hours';
  if v_count>=50 then
    raise exception 'وصل هذا الجهاز إلى الحد اليومي للطلبات';
  end if;

  insert into public.checkout_requests(request_key,device_hash,phone_hash,payload_hash,status)
  values(v_request_key,v_device_hash,v_phone_hash,v_payload_hash,'pending')
  on conflict(request_key) do nothing
  returning id into v_request_id;

  -- معالجة طلبين متزامنين يحملان المفتاح نفسه.
  if v_request_id is null then
    select to_jsonb(r) into v_existing
    from public.checkout_requests r
    where r.request_key=v_request_key;
    if coalesce(v_existing->>'payload_hash','')<>v_payload_hash then
      raise exception 'رمز الطلب مستخدم لمحتوى مختلف';
    end if;
    if coalesce(v_existing->>'status','')='completed'
       and jsonb_typeof(v_existing->'result')='array' then
      return query
      select x.order_number,x.order_id
      from jsonb_to_recordset(v_existing->'result') as x(order_number text,order_id text);
      return;
    end if;
    raise exception 'الطلب نفسه قيد المعالجة. انتظر لحظات';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result
  from public.alin_create_store_orders(p_items,p_customer,p_fulfillment,p_coupon_code) x;

  if jsonb_array_length(v_result)=0 then
    raise exception 'لم يُنشئ الخادم أي طلب';
  end if;

  -- Pass a transaction-local, narrow marker to the protection trigger.
  perform set_config('alin.internal_order_update','stage4_checkout_finalize',true);

  update public.orders o set
    checkout_request_key=v_request_key,
    checkout_group_id=v_request_id::text,
    stock_reserved=case
      when lower(coalesce(o.kind,'')) in ('booklet','booklets','ملزمة','ملازم') then false
      else true
    end,
    stock_restored_at=null
  where o.id::text in (
    select x.order_id
    from jsonb_to_recordset(v_result) as x(order_number text,order_id text)
  );

  perform set_config('alin.internal_order_update','',true);

  update public.checkout_requests set
    status='completed',result=v_result,completed_at=now()
  where id=v_request_id;

  return query
  select x.order_number,x.order_id
  from jsonb_to_recordset(v_result) as x(order_number text,order_id text);
end
$$;

revoke all on function public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text) from public;
grant execute on function public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;

-- يجب أن تكون القيم الأربع true.
select
  coalesce((select p.prosrc like '%stage4_checkout_finalize%' from pg_proc p where p.oid=to_regprocedure('public.alin_protect_order_update()')),false) as trigger_accepts_internal_finalize,
  coalesce((select p.prosrc like '%set_config(''alin.internal_order_update'',''stage4_checkout_finalize'',true)%' from pg_proc p where p.oid=to_regprocedure('public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text)')),false) as guarded_rpc_sets_internal_marker,
  coalesce((select p.prosrc like '%checkout_request_key%checkout_group_id%stock_reserved%stock_restored_at%' from pg_proc p where p.oid=to_regprocedure('public.alin_protect_order_update()')),false) as internal_fields_are_limited,
  exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='alin_orders_protect_update' and not tgisinternal) as protection_trigger_exists;
