-- ArtLog Supabase schema + RLS + RPC
-- Supabase SQL Editor: paste ALL of this file, then Run (not the file path)

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('admin', 'parent');
exception when duplicate_object then null; end $$;

-- ─── Core tables ─────────────────────────────────────────
create table if not exists academies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null default '아트뮤즈',
  tagline text default '꿈을 향한 날개짓, 여기서 시작하세요',
  phone text,
  addr text,
  email text,
  logo_url text,
  bank_name text,
  bank_account text,
  notifs jsonb not null default jsonb_build_object(
    'attendPush', true,
    'feedbackPush', true,
    'paymentRemind', true,
    'noticePush', true
  ),
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  academy_id uuid references academies(id) on delete set null,
  role user_role not null default 'parent',
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists academy_options (
  academy_id uuid primary key references academies(id) on delete cascade,
  class_times jsonb not null default to_jsonb(array['14:00','15:00','16:00','17:00']::text[]),
  monthly_fees jsonb not null default to_jsonb(array[100000,120000,130000,150000,170000,200000]::int[]),
  fee_due_days jsonb not null default to_jsonb(array[1,5,10,15,20,25]::int[])
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  name text not null,
  school text,
  grade text,
  grade_as_of_year int,
  class_days text[] not null default array[]::text[],
  class_time text,
  tags text[] not null default array[]::text[],
  status text,
  fee_status text default '예정',
  art_emoji text default '🎨',
  photo_url text,
  photo_path text,
  use_emoji_avatar boolean not null default false,
  gender text,
  art_count int not null default 0,
  phone text,
  parent_phone text,
  enroll_date date,
  monthly_fee int default 150000,
  fee_due_day int default 5,
  last_payment_date date,
  last_payment_method text,
  fee_paid_month text,
  fee_payments jsonb not null default '{}'::jsonb,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists artworks (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  title text not null,
  medium text,
  work_date date not null default current_date,
  emoji text default '🎨',
  progress int not null default 100,
  description text,
  photo_url text,
  photo_path text,
  uploaded_by text not null default 'teacher',
  created_at timestamptz not null default now()
);

create table if not exists feedbacks (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  student_name text,
  content text not null,
  feedback_date date not null default current_date,
  is_read boolean not null default false,
  artwork_title text,
  art_emoji text default '🎨',
  notify_scheduled_at timestamptz,
  notify_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  title text not null,
  content text not null,
  notice_date date not null default current_date,
  important boolean not null default false,
  notice_scope text not null default 'general',
  student_id uuid references students(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  schedule_date date not null,
  schedule_type text not null default 'class',
  title text not null,
  schedule_time text,
  student_name text,
  student_ids uuid[] not null default '{}',
  auto_holiday boolean not null default false,
  substitute boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  code text not null unique,
  student_id uuid not null references students(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false,
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists parent_student_links (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  invite_id uuid references invites(id),
  push_enabled boolean not null default true,
  joined_at timestamptz not null default now(),
  unique(parent_user_id, student_id)
);

create table if not exists parent_link_history (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  parent_user_id uuid,
  parent_name text not null default '',
  parent_phone text default '',
  student_id uuid,
  student_name text not null default '',
  student_art text default '🎨',
  joined_at timestamptz,
  disconnected_at timestamptz not null default now(),
  reason text not null default 'withdrawn'
);

create index if not exists idx_plh_academy on parent_link_history(academy_id, disconnected_at desc);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  student_name text,
  attendance_date date not null,
  class_time text not null,
  status text not null,
  checked_at timestamptz not null default now(),
  unique(academy_id, student_id, attendance_date, class_time)
);

create index if not exists idx_students_academy on students(academy_id);
create index if not exists idx_artworks_academy on artworks(academy_id);
create index if not exists idx_feedbacks_academy on feedbacks(academy_id);
create index if not exists idx_attendance_academy_date on attendance(academy_id, attendance_date);

-- 기존 DB 마이그레이션 (RLS·정책 적용 전에 실행)
alter table academies add column if not exists bank_name text;
alter table academies add column if not exists bank_account text;
alter table notices add column if not exists notice_scope text default 'general';
update notices set notice_scope = 'general' where notice_scope is null;
alter table notices alter column notice_scope set default 'general';
alter table notices alter column notice_scope set not null;
alter table notices add column if not exists student_id uuid references students(id) on delete cascade;
alter table feedbacks add column if not exists notify_scheduled_at timestamptz;
alter table feedbacks add column if not exists notify_sent boolean not null default false;
alter table students add column if not exists grade_as_of_year int;
alter table students add column if not exists photo_url text;
alter table students add column if not exists photo_path text;
alter table students add column if not exists use_emoji_avatar boolean not null default false;
alter table students add column if not exists gender text;

create or replace function public.my_academy_id()
returns uuid language sql stable security definer set search_path = public as $$
  select academy_id from profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.is_academy_admin(p_academy_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and academy_id = p_academy_id
  )
$$;

create or replace function public.is_linked_parent(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from parent_student_links
    where parent_user_id = auth.uid() and student_id = p_student_id
  )
$$;

create or replace function public.is_linked_parent_academy(p_academy_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from parent_student_links
    where parent_user_id = auth.uid() and academy_id = p_academy_id
  )
$$;

create or replace function public.bootstrap_admin_academy(p_user_id uuid, p_email text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $func$
declare v_academy_id uuid;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception '권한이 없습니다.';
  end if;

  select academy_id into v_academy_id from profiles where id = p_user_id;
  if v_academy_id is not null then
    return v_academy_id;
  end if;

  insert into academies(name, email, owner_id)
  values ('아트뮤즈', p_email, p_user_id)
  returning id into v_academy_id;

  insert into profiles(id, academy_id, role, full_name)
  values (p_user_id, v_academy_id, 'admin', p_full_name)
  on conflict (id) do update set academy_id = v_academy_id, role = 'admin';

  insert into academy_options(academy_id) values (v_academy_id)
  on conflict do nothing;

  return v_academy_id;
end;
$func$;

create or replace function public.peek_invite(p_code text)
returns json language plpgsql security definer set search_path = public as $func$
declare v_inv invites%rowtype;
declare v_student students%rowtype;
begin
  select * into v_inv from invites where upper(code) = upper(p_code);
  if not found then
    return json_build_object('ok', false, 'error', '유효하지 않은 코드입니다.');
  end if;
  if v_inv.used then
    return json_build_object('ok', false, 'error', '이미 사용된 코드입니다.');
  end if;
  if v_inv.expires_at < now() then
    return json_build_object('ok', false, 'error', '만료된 코드입니다. 학원에 새 코드를 요청해 주세요.');
  end if;
  select * into v_student from students where id = v_inv.student_id;
  return json_build_object(
    'ok', true,
    'student_id', v_student.id,
    'student_name', v_student.name,
    'student_art', v_student.art_emoji,
    'academy_id', v_inv.academy_id
  );
end;
$func$;

create or replace function public.link_parent_with_invite(p_invite_code text)
returns json language plpgsql security definer set search_path = public as $func$
declare v_inv invites%rowtype;
declare v_student students%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_inv from invites where upper(code) = upper(p_invite_code) for update;
  if not found then raise exception '유효하지 않은 코드입니다.'; end if;

  select * into v_student from students where id = v_inv.student_id;

  if v_inv.used then
    if v_inv.used_by = auth.uid() then
      insert into parent_student_links(academy_id, parent_user_id, student_id, invite_id)
      values (v_inv.academy_id, auth.uid(), v_inv.student_id, v_inv.id)
      on conflict (parent_user_id, student_id) do nothing;

      insert into profiles(id, academy_id, role)
      values (auth.uid(), v_inv.academy_id, 'parent')
      on conflict (id) do update set academy_id = excluded.academy_id, role = 'parent';

      return json_build_object(
        'ok', true,
        'student_id', v_student.id,
        'student_name', v_student.name,
        'student_art', v_student.art_emoji
      );
    end if;
    raise exception '이미 다른 계정에서 사용된 코드입니다.';
  end if;

  if v_inv.expires_at < now() then raise exception '만료된 코드입니다.'; end if;

  insert into parent_student_links(academy_id, parent_user_id, student_id, invite_id)
  values (v_inv.academy_id, auth.uid(), v_inv.student_id, v_inv.id)
  on conflict (parent_user_id, student_id) do nothing;

  update invites set used = true, used_by = auth.uid() where id = v_inv.id;

  insert into profiles(id, academy_id, role)
  values (auth.uid(), v_inv.academy_id, 'parent')
  on conflict (id) do update set academy_id = excluded.academy_id, role = 'parent';

  return json_build_object(
    'ok', true,
    'student_id', v_student.id,
    'student_name', v_student.name,
    'student_art', v_student.art_emoji
  );
end;
$func$;

create or replace function public.sync_parent_profile_from_links()
returns void language plpgsql security definer set search_path = public as $func$
declare v_academy_id uuid;
begin
  if auth.uid() is null then return; end if;
  select academy_id into v_academy_id
  from parent_student_links
  where parent_user_id = auth.uid()
  order by joined_at desc
  limit 1;
  if v_academy_id is null then return; end if;
  insert into profiles(id, academy_id, role)
  values (auth.uid(), v_academy_id, 'parent')
  on conflict (id) do update set academy_id = excluded.academy_id, role = 'parent';
end;
$func$;

create or replace function public.withdraw_parent_account()
returns json language plpgsql security definer set search_path = public as $func$
declare
  v_link parent_student_links%rowtype;
  v_profile profiles%rowtype;
  v_student students%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_profile from profiles where id = auth.uid();

  for v_link in
    select * from parent_student_links where parent_user_id = auth.uid()
  loop
    select * into v_student from students where id = v_link.student_id;
    insert into parent_link_history(
      academy_id, parent_user_id, parent_name, parent_phone,
      student_id, student_name, student_art, joined_at, reason
    ) values (
      v_link.academy_id, auth.uid(),
      coalesce(v_profile.full_name, '학부모'),
      coalesce(v_profile.phone, ''),
      v_link.student_id,
      coalesce(v_student.name, ''),
      coalesce(v_student.art_emoji, '🎨'),
      v_link.joined_at,
      'withdrawn'
    );
  end loop;

  delete from parent_student_links where parent_user_id = auth.uid();
  update profiles set academy_id = null where id = auth.uid();

  return json_build_object('ok', true);
end;
$func$;

create or replace function public.list_linked_parents(p_academy_id uuid)
returns json language plpgsql security definer set search_path = public as $func$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not is_academy_admin(p_academy_id) then
    raise exception '권한이 없습니다.';
  end if;

  return coalesce((
    select json_agg(row_to_json(t) order by t.joined_at desc)
    from (
      select
        psl.id,
        psl.student_id,
        psl.parent_user_id,
        psl.joined_at,
        psl.push_enabled,
        coalesce(p.full_name, '학부모') as parent_name,
        coalesce(nullif(p.phone, ''), s.parent_phone, '') as parent_phone,
        s.name as student_name,
        s.art_emoji as student_art
      from parent_student_links psl
      join students s on s.id = psl.student_id
      left join profiles p on p.id = psl.parent_user_id
      where psl.academy_id = p_academy_id
    ) t
  ), '[]'::json);
end;
$func$;

create or replace function public.bump_art_count()
returns trigger language plpgsql as $func$
begin
  update students set art_count = art_count + 1 where id = new.student_id;
  return new;
end;
$func$;

drop trigger if exists trg_artwork_count on artworks;
create trigger trg_artwork_count after insert on artworks
for each row execute function public.bump_art_count();

alter table academies enable row level security;
alter table profiles enable row level security;
alter table academy_options enable row level security;
alter table students enable row level security;
alter table artworks enable row level security;
alter table feedbacks enable row level security;
alter table notices enable row level security;
alter table schedules enable row level security;
alter table invites enable row level security;
alter table parent_student_links enable row level security;
alter table parent_link_history enable row level security;
alter table attendance enable row level security;

drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select using (id = auth.uid());
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update using (id = auth.uid());
drop policy if exists profiles_admin_parent_read on profiles;
create policy profiles_admin_parent_read on profiles for select
  using (
    exists (
      select 1 from parent_student_links psl
      where psl.parent_user_id = profiles.id
        and is_academy_admin(psl.academy_id)
    )
  );

drop policy if exists academies_admin_all on academies;
create policy academies_admin_all on academies for all
  using (is_academy_admin(id)) with check (is_academy_admin(id));
drop policy if exists academies_parent_read on academies;
create policy academies_parent_read on academies for select
  using (is_linked_parent_academy(id));

drop policy if exists academy_options_admin on academy_options;
create policy academy_options_admin on academy_options for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));
drop policy if exists academy_options_parent_read on academy_options;
create policy academy_options_parent_read on academy_options for select
  using (is_linked_parent_academy(academy_id));

drop policy if exists students_admin on students;
create policy students_admin on students for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));
drop policy if exists students_parent_read on students;
create policy students_parent_read on students for select
  using (is_linked_parent(id));

drop policy if exists artworks_admin on artworks;
create policy artworks_admin on artworks for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));
drop policy if exists artworks_parent_read on artworks;
create policy artworks_parent_read on artworks for select
  using (is_linked_parent(student_id));
drop policy if exists artworks_parent_insert on artworks;
create policy artworks_parent_insert on artworks for insert
  with check (is_linked_parent(student_id) and uploaded_by = 'parent');

drop policy if exists feedbacks_admin on feedbacks;
create policy feedbacks_admin on feedbacks for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));
drop policy if exists feedbacks_parent_read on feedbacks;
create policy feedbacks_parent_read on feedbacks for select
  using (student_id is not null and is_linked_parent(student_id));

drop policy if exists notices_admin on notices;
create policy notices_admin on notices for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));
drop policy if exists notices_parent_read on notices;
create policy notices_parent_read on notices for select
  using (
    is_linked_parent_academy(academy_id)
    and (
      notice_scope = 'general'
      or (notice_scope = 'individual' and student_id is not null and is_linked_parent(student_id))
    )
  );

drop policy if exists schedules_admin on schedules;
create policy schedules_admin on schedules for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));
drop policy if exists schedules_parent_read on schedules;
create policy schedules_parent_read on schedules for select
  using (is_linked_parent_academy(academy_id));

drop policy if exists invites_admin on invites;
create policy invites_admin on invites for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));

drop policy if exists links_admin on parent_student_links;
create policy links_admin on parent_student_links for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));
drop policy if exists links_parent_read on parent_student_links;
create policy links_parent_read on parent_student_links for select
  using (parent_user_id = auth.uid());
drop policy if exists links_parent_update on parent_student_links;
create policy links_parent_update on parent_student_links for update
  using (parent_user_id = auth.uid())
  with check (parent_user_id = auth.uid());

drop policy if exists plh_admin_read on parent_link_history;
create policy plh_admin_read on parent_link_history for select
  using (is_academy_admin(academy_id));

drop policy if exists attendance_admin on attendance;
create policy attendance_admin on attendance for all
  using (is_academy_admin(academy_id)) with check (is_academy_admin(academy_id));
drop policy if exists attendance_parent_read on attendance;
create policy attendance_parent_read on attendance for select
  using (is_linked_parent(student_id));

insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict (id) do nothing;

drop policy if exists storage_artworks_admin on storage.objects;
create policy storage_artworks_admin on storage.objects for all
  using (
    bucket_id = 'artworks'
    and public.is_academy_admin(split_part(name, '/', 1)::uuid)
  )
  with check (
    bucket_id = 'artworks'
    and public.is_academy_admin(split_part(name, '/', 1)::uuid)
  );

drop policy if exists storage_artworks_parent_insert on storage.objects;
create policy storage_artworks_parent_insert on storage.objects for insert
  with check (
    bucket_id = 'artworks'
    and exists (
      select 1 from parent_student_links psl
      where psl.parent_user_id = auth.uid()
        and psl.academy_id::text = split_part(name, '/', 1)
        and psl.student_id::text = split_part(name, '/', 2)
    )
  );

drop policy if exists storage_artworks_public_read on storage.objects;
create policy storage_artworks_public_read on storage.objects for select
  using (bucket_id = 'artworks');

grant execute on function public.bootstrap_admin_academy to authenticated;
grant execute on function public.peek_invite to anon, authenticated;
grant execute on function public.link_parent_with_invite to authenticated;
grant execute on function public.sync_parent_profile_from_links to authenticated;
grant execute on function public.withdraw_parent_account to authenticated;
grant execute on function public.list_linked_parents to authenticated;

do $$ begin
  alter publication supabase_realtime add table students;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table artworks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table feedbacks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table notices;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table schedules;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table invites;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table attendance;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table parent_student_links;
exception when duplicate_object then null; end $$;

-- 기존 DB 마이그레이션: 보강 학생 연결
alter table schedules add column if not exists student_ids uuid[] not null default '{}';

-- 학부모: 연결 자녀 피드백 읽음(is_read) 업데이트
drop policy if exists feedbacks_parent_mark_read on feedbacks;
create policy feedbacks_parent_mark_read on feedbacks for update
  using (student_id is not null and is_linked_parent(student_id))
  with check (student_id is not null and is_linked_parent(student_id));

-- 기존 DB 마이그레이션: 수강료 납부 월·이력
alter table students add column if not exists last_payment_date date;
alter table students add column if not exists last_payment_method text;
alter table students add column if not exists fee_paid_month text;
alter table students add column if not exists fee_payments jsonb not null default '{}'::jsonb;

-- 기존 납부완료 → fee_payments 백필
update students
set fee_payments = jsonb_build_object(
  fee_paid_month,
  jsonb_build_object(
    'date', coalesce(last_payment_date::text, fee_paid_month || '-01'),
    'method', coalesce(last_payment_method, '')
  )
)
where fee_paid_month is not null
  and (fee_payments is null or fee_payments = '{}'::jsonb);

-- 기존 납부완료 → 이번 달 기준 fee_paid_month 보정 (fee_payments 없을 때)
update students
set fee_paid_month = to_char(current_date, 'YYYY-MM')
where fee_status = '납부완료' and fee_paid_month is null;
