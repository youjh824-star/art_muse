-- system_notices: 개발자 전용 작성, 모든 사용자 읽기 가능
create table if not exists system_notices (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  content    text not null,
  important  boolean not null default false,
  posted_at  timestamptz not null default now(),
  posted_by  uuid references auth.users(id) on delete set null
);

alter table system_notices enable row level security;

-- 모든 인증 사용자: 읽기 가능
drop policy if exists system_notices_read on system_notices;
create policy system_notices_read on system_notices
  for select to authenticated using (true);

-- 개발자 계정만: 쓰기 가능 (이메일로 식별)
drop policy if exists system_notices_dev_write on system_notices;
create policy system_notices_dev_write on system_notices
  for all to authenticated
  using (
    (select email from auth.users where id = auth.uid()) = 'youps712@gmail.com'
  )
  with check (
    (select email from auth.users where id = auth.uid()) = 'youps712@gmail.com'
  );

-- realtime
alter publication supabase_realtime add table system_notices;
