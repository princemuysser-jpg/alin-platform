-- ============================================================
-- ALIN v2.4.2 — المرحلة الأولى المعاد بناؤها بدقة
-- حماية PDF/DOCX وربط كل ملف بصاحبه أو بطلب المكتبة المخصص.
-- قابل لإعادة التشغيل بأمان بعد RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql
-- ============================================================

begin;

-- 1) التخزين العام يبقى للصور فقط. منع أي PDF/DOCX جديد من الدخول إليه.
update storage.buckets
set public=true,
    file_size_limit=5242880,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/webp'
    ]
where id='alin-files';

-- المدرس يرفع صورته الشخصية في teachers/ فقط؛ لا يسمح له برفع مستندات إلى التخزين العام.
drop policy if exists alin_files_teacher_insert on storage.objects;
create policy alin_files_teacher_insert on storage.objects for insert to authenticated
with check (
  bucket_id='alin-files'
  and public.alin_current_role()='teacher'
  and (storage.foldername(name))[1]='teachers'
  and lower(split_part(name,'.',array_length(string_to_array(name,'.'),1))) in ('jpg','jpeg','png','webp')
);

-- 2) مستودع خاص للمستندات فقط، وغير قابل للعرض العام.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'alin-private','alin-private',false,26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

-- المسارات الجديدة الإلزامية:
-- PDF  : booklets/<booklet_id>/<random>.pdf
-- DOCX : teacher-requests/<teacher_account_id>/<request_id>/<random>.docx

create or replace function public.alin_private_can_insert(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage
as $$
declare
  v_parts text[]:=storage.foldername(p_name);
  v_role text:=public.alin_current_role();
  v_account text:=public.alin_current_account_id();
  v_ext text:=lower(split_part(p_name,'.',array_length(string_to_array(p_name,'.'),1)));
begin
  if public.alin_is_admin() then
    return (
      (v_parts[1]='booklets' and array_length(v_parts,1)=2 and v_ext='pdf')
      or
      (v_parts[1]='teacher-requests' and array_length(v_parts,1)=3 and v_ext='docx')
    );
  end if;

  if v_role='teacher' and v_account is not null then
    return v_parts[1]='teacher-requests'
       and array_length(v_parts,1)=3
       and v_parts[2]=v_account
       and length(coalesce(v_parts[3],''))>0
       and v_ext='docx';
  end if;

  return false;
end
$$;

create or replace function public.alin_library_has_booklet_order(p_booklet_id text)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.orders o
    cross join lateral (select to_jsonb(o) as j) x
    where public.alin_current_role()='library'
      and public.alin_current_account_id() is not null
      and coalesce(x.j->>'item_id',x.j->>'booklet_id',x.j->'item'->>'id','')=p_booklet_id
      and public.alin_current_account_id() in (
        coalesce(x.j->>'library_id',''),
        coalesce(x.j->>'pickup_library_id',''),
        coalesce(x.j->>'assigned_library_id','')
      )
      and lower(coalesce(x.j->>'kind',x.j->>'item_kind',x.j->>'item_type','booklet'))
          in ('booklet','booklets','booklet_product','ملزمة','ملازم')
      and lower(coalesce(x.j->>'status',x.j->>'order_status','new'))
          in ('new','pending','pending_admin','assigned','accepted','processing','printing','ready','جديد','قيد الطباعة','جاهز')
  )
$$;

create or replace function public.alin_private_can_select(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage
as $$
declare
  v_parts text[]:=storage.foldername(p_name);
  v_role text:=public.alin_current_role();
  v_account text:=public.alin_current_account_id();
  v_root text:=coalesce(v_parts[1],'');
  v_entity text:='';
begin
  if public.alin_is_admin() then return true; end if;
  if v_account is null then return false; end if;

  if v_root='teacher-requests' then
    if array_length(v_parts,1)<>3 then return false; end if;
    if v_role<>'teacher' or v_parts[2]<>v_account then return false; end if;
    v_entity:=v_parts[3];
    return exists(
      select 1 from public.teacher_requests r
      where r.id::text=v_entity and r.teacher_id::text=v_account
    );
  end if;

  if v_root='booklets' then
    if array_length(v_parts,1)<>2 then return false; end if;
    v_entity:=v_parts[2];
    if v_role='teacher' then
      return exists(
        select 1 from public.booklets b
        where b.id::text=v_entity and b.teacher_id::text=v_account
      );
    end if;
    if v_role='library' then
      return public.alin_library_has_booklet_order(v_entity);
    end if;
  end if;

  return false;
end
$$;

revoke all on function public.alin_private_can_insert(text) from public;
revoke all on function public.alin_private_can_select(text) from public;
revoke all on function public.alin_library_has_booklet_order(text) from public;
grant execute on function public.alin_private_can_insert(text) to authenticated;
grant execute on function public.alin_private_can_select(text) to authenticated;
grant execute on function public.alin_library_has_booklet_order(text) to authenticated;

-- إزالة كل سياسات المرحلة الأولى السابقة قبل إنشاء السياسات الدقيقة.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname like 'alin_private_%'
  loop
    execute format('drop policy if exists %I on storage.objects',p.policyname);
  end loop;
end
$$;

-- لا توجد أي سياسة للزائر anon على alin-private.
create policy alin_private_select_exact
on storage.objects for select to authenticated
using (
  bucket_id='alin-private'
  and public.alin_private_can_select(name)
);

create policy alin_private_insert_exact
on storage.objects for insert to authenticated
with check (
  bucket_id='alin-private'
  and public.alin_private_can_insert(name)
);

-- تعديل أو حذف المستندات من التخزين محصور بالإدارة.
create policy alin_private_update_admin
on storage.objects for update to authenticated
using (bucket_id='alin-private' and public.alin_is_admin())
with check (bucket_id='alin-private' and public.alin_is_admin());

create policy alin_private_delete_admin
on storage.objects for delete to authenticated
using (bucket_id='alin-private' and public.alin_is_admin());

notify pgrst,'reload schema';
commit;

-- ============================================================
-- فحص بعد التنفيذ: يجب أن يرجع صفاً واحداً بقيمة true في كل عمود.
-- ============================================================
select
  exists(select 1 from storage.buckets where id='alin-private' and public=false) as private_bucket_ok,
  exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='alin_private_select_exact') as select_policy_ok,
  exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='alin_private_insert_exact') as insert_policy_ok,
  not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and roles::text like '%anon%' and qual like '%alin-private%') as no_anon_policy_ok;

-- تدقيق فقط، لا يحذف شيئاً: هذه ملفات قديمة بقيت عامة ويجب إعادة رفعها ثم حذفها يدوياً.
select name,metadata->>'mimetype' as mime_type,created_at
from storage.objects
where bucket_id='alin-files'
  and (
    name like 'booklets/%'
    or name like 'teacher-requests/%'
    or lower(split_part(name,'.',array_length(string_to_array(name,'.'),1))) in ('pdf','docx')
  )
order by created_at desc;
