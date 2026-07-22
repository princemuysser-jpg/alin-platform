-- ALIN v2.5.0 Stage 2 — حماية صلاحيات المدرس على الملازم
begin;

create or replace function public.alin_guard_teacher_booklet_changes()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=coalesce(public.alin_current_role(),'');
  v_account text:=coalesce(public.alin_current_account_id(),'');
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_protected text[]:=array[
    'teacher_id','price','sale_price','deal_price','discount_percent','stock','is_hidden',
    'status','publish_status','published_at','approved_by','approved_at','reviewed_by','reviewed_at',
    'teacher_share_percent','library_share_percent','platform_share_percent','admin_note',
    'rejected_reason','rejection_reason','deleted_at','created_at','id'
  ];
begin
  if public.alin_is_admin() then return new; end if;
  if v_role<>'teacher' then
    raise exception 'ليس لديك صلاحية تعديل الملازم';
  end if;

  if tg_op='INSERT' then
    if coalesce(to_jsonb(new)->>'teacher_id','')<>v_account then
      raise exception 'لا يمكنك إنشاء ملزمة لحساب مدرس آخر';
    end if;
    v_new:=to_jsonb(new);
    if coalesce(v_new->>'status','draft') not in ('draft','pending','new','review')
       or coalesce(v_new->>'publish_status','pending') not in ('','pending','new','review')
       or coalesce((v_new->>'is_hidden')::boolean,true)=false
       or nullif(v_new->>'published_at','') is not null
       or nullif(v_new->>'approved_by','') is not null
       or nullif(v_new->>'approved_at','') is not null then
      raise exception 'حالة النشر والسعر والموافقة من صلاحية الإدارة فقط';
    end if;
    return new;
  end if;

  if coalesce(to_jsonb(old)->>'teacher_id','')<>v_account then
    raise exception 'يمكنك تعديل ملازمك فقط';
  end if;

  v_old:=to_jsonb(old); v_new:=to_jsonb(new);
  foreach v_key in array v_protected loop
    if (v_old->v_key) is distinct from (v_new->v_key) then
      raise exception 'الحقل % من صلاحية الإدارة فقط',v_key;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.alin_guard_teacher_booklet_changes() from public;

drop trigger if exists alin_guard_teacher_booklet_changes on public.booklets;
create trigger alin_guard_teacher_booklet_changes
before insert or update on public.booklets
for each row execute function public.alin_guard_teacher_booklet_changes();

-- موافقة المدرس على النسخة: لا تنشر ولا تغيّر السعر أو الحالة.
create or replace function public.alin_teacher_approve_booklet(p_booklet_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text:=coalesce(public.alin_current_account_id(),'');
  v_role text:=coalesce(public.alin_current_role(),'');
  v_row public.booklets%rowtype;
begin
  if v_role<>'teacher' or v_id='' then raise exception 'يجب تسجيل الدخول بحساب مدرس'; end if;
  select * into v_row from public.booklets where id::text=p_booklet_id for update;
  if not found then raise exception 'الملزمة غير موجودة'; end if;
  if v_row.teacher_id::text<>v_id then raise exception 'يمكنك الموافقة على ملازمك فقط'; end if;
  if coalesce(v_row.status,'') in ('published','active') then raise exception 'الملزمة منشورة بالفعل'; end if;

  -- تجاوز trigger مضبوط ومحدود داخل دالة الخادم فقط.
  update public.booklets
     set teacher_approved=true,
         teacher_approved_at=now(),
         updated_at=now()
   where id::text=p_booklet_id;

  return jsonb_build_object('ok',true,'id',p_booklet_id,'teacher_approved',true);
end;
$$;
revoke all on function public.alin_teacher_approve_booklet(text) from public, anon;
grant execute on function public.alin_teacher_approve_booklet(text) to authenticated;

-- trigger يسمح للدالة الموثوقة فقط بتغيير حقلي موافقة المدرس.
create or replace function public.alin_guard_teacher_booklet_changes()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=coalesce(public.alin_current_role(),'');
  v_account text:=coalesce(public.alin_current_account_id(),'');
  v_old jsonb; v_new jsonb; v_key text;
  v_protected text[]:=array['teacher_id','price','sale_price','deal_price','discount_percent','stock','is_hidden','status','publish_status','published_at','approved_by','approved_at','reviewed_by','reviewed_at','teacher_share_percent','library_share_percent','platform_share_percent','admin_note','rejected_reason','rejection_reason','deleted_at','created_at','id'];
begin
  if public.alin_is_admin() then return new; end if;
  if v_role<>'teacher' then raise exception 'ليس لديك صلاحية تعديل الملازم'; end if;
  if coalesce(to_jsonb(coalesce(old,new))->>'teacher_id','')<>v_account then raise exception 'يمكنك تعديل ملازمك فقط'; end if;
  if tg_op='INSERT' then
    v_new:=to_jsonb(new);
    if coalesce(v_new->>'status','draft') not in ('draft','pending','new','review') or coalesce(v_new->>'publish_status','pending') not in ('','pending','new','review') then
      raise exception 'حالة النشر من صلاحية الإدارة فقط';
    end if;
    return new;
  end if;
  v_old:=to_jsonb(old); v_new:=to_jsonb(new);
  foreach v_key in array v_protected loop
    if (v_old->v_key) is distinct from (v_new->v_key) then raise exception 'الحقل % من صلاحية الإدارة فقط',v_key; end if;
  end loop;
  return new;
end;
$$;

commit;
notify pgrst,'reload schema';

select
  to_regprocedure('public.alin_teacher_approve_booklet(text)') is not null as approval_rpc_exists,
  exists(select 1 from pg_trigger where tgname='alin_guard_teacher_booklet_changes' and not tgisinternal) as protection_trigger_exists,
  has_function_privilege('authenticated','public.alin_teacher_approve_booklet(text)','EXECUTE') as teacher_can_call_approval,
  not has_function_privilege('anon','public.alin_teacher_approve_booklet(text)','EXECUTE') as anon_cannot_call_approval;
