-- KeyFlash MVP. Apply to a fresh Supabase project with `supabase db push`.
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null check (length(username) between 1 and 60),
 created_at timestamptz not null default now()
);
create function private.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,username) values (new.id,left(coalesce(nullif(new.raw_user_meta_data->>'username',''),'maker-'||left(new.id::text,8)),60));
 return new;
end; $$;
create trigger create_profile after insert on auth.users for each row execute function private.on_signup();

create table public.projects (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 64),
 name text not null check (length(name) between 2 and 80),
 summary text not null check (length(summary) between 10 and 180),
 description text not null check (length(description) between 20 and 12000),
 chip text not null check (chip in ('ESP32','ESP32-S3','ESP32-C3')),
 device_type text not null check (device_type in ('宏键盘','普通键盘','旋钮键盘','MIDI 控制器','Stream Deck','游戏控制器','自定义 HID','其他')),
 features text[] not null default '{}' check (cardinality(features)<=12 and features <@ array['USB HID','BLE 蓝牙','Wi-Fi','RGB','OLED','LCD','Encoder','VIA','Vial','Macro','Media Control']),
 hardware text not null check (length(hardware) between 2 and 200), license text not null default 'MIT' check(length(license) between 2 and 40),
 github_url text not null default '' check (github_url='' or github_url ~ '^https?://'),
 website_url text not null default '' check (website_url='' or website_url ~ '^https?://'),
 status text not null default 'stable' check (status in ('stable','beta','experimental','archived')),
 color text not null default 'orange', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects(owner_id);
create table public.firmware_versions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 version text not null check (length(version)<=80 and version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$'),
 channel text not null check (channel in ('stable','beta','experimental')),
 changelog text not null check (length(changelog) between 10 and 12000),
 hardware text not null check (length(hardware) between 2 and 200),
 manifest jsonb not null, online_enabled boolean not null default true,
 created_at timestamptz not null default now(), unique(project_id,version), unique(id,project_id)
);
create table public.favorites (user_id uuid not null references public.profiles(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,project_id));
create index favorites_project_idx on public.favorites(project_id);
create table public.ratings (user_id uuid not null references public.profiles(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade, score integer not null check(score between 1 and 5), primary key(user_id,project_id));
create index ratings_project_idx on public.ratings(project_id);
create table public.comments (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, body text not null check(length(body) between 5 and 2000),
 device text not null default '' check(length(device)<=200), created_at timestamptz not null default now()
);
create index comments_project_idx on public.comments(project_id);
create index comments_user_idx on public.comments(user_id);
create table public.flash_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 project_id uuid not null references public.projects(id), version_id uuid not null,
 chip text not null check (chip in ('ESP32','ESP32-S3','ESP32-C3')),
 status text not null default 'started' check(status in ('started','success','failed')),
 error text not null default '' check(length(error)<=2000), created_at timestamptz not null default now(),
 foreign key(version_id,project_id) references public.firmware_versions(id,project_id)
);
create index flash_sessions_user_idx on public.flash_sessions(user_id);
create index flash_sessions_project_idx on public.flash_sessions(project_id);
create table public.compatibility_reports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 project_id uuid not null references public.projects(id), version_id uuid not null,
 chip text not null check(chip in ('ESP32','ESP32-S3','ESP32-C3')),
 hardware text not null check(length(hardware) between 2 and 200),
 os text not null check(length(os) between 1 and 100), browser text not null check(length(browser) between 1 and 100),
 usb_chip text not null default '' check(length(usb_chip)<=100),
 bluetooth text not null default '未测试' check(bluetooth in ('未测试','正常','异常','不支持')),
 rgb text not null default '未测试' check(rgb in ('未测试','正常','异常','不支持')),
 encoder text not null default '未测试' check(encoder in ('未测试','正常','异常','不支持')),
 success boolean not null, notes text not null default '' check(length(notes)<=2000), created_at timestamptz not null default now(),
 foreign key(version_id,project_id) references public.firmware_versions(id,project_id)
);
create index compatibility_project_idx on public.compatibility_reports(project_id);
create index compatibility_user_idx on public.compatibility_reports(user_id);

-- Only aggregate counts are public; raw favorites and flash history stay private.
create table public.project_stats (project_id uuid primary key references public.projects(id) on delete cascade, flash_count bigint not null default 0, favorite_count bigint not null default 0, success_count bigint not null default 0, failure_count bigint not null default 0);
create function private.update_stats() returns trigger language plpgsql security definer set search_path = '' as $$
declare pid uuid; delta integer; success_delta integer := 0; failure_delta integer := 0;
begin
 pid := case when tg_op='DELETE' then old.project_id else new.project_id end;
 delta := case when tg_op='DELETE' then -1 when tg_op='INSERT' then 1 else 0 end;
 if tg_table_name='favorites' then
  insert into public.project_stats(project_id,favorite_count) values(pid,greatest(delta,0)) on conflict(project_id) do update set favorite_count=greatest(0,public.project_stats.favorite_count+delta);
 else
  if tg_op<>'INSERT' then
   success_delta := success_delta-case when old.status='success' then 1 else 0 end;
   failure_delta := failure_delta-case when old.status='failed' then 1 else 0 end;
  end if;
  if tg_op<>'DELETE' then
   success_delta := success_delta+case when new.status='success' then 1 else 0 end;
   failure_delta := failure_delta+case when new.status='failed' then 1 else 0 end;
  end if;
  insert into public.project_stats(project_id,flash_count,success_count,failure_count) values(pid,greatest(delta,0),greatest(success_delta,0),greatest(failure_delta,0))
  on conflict(project_id) do update set flash_count=greatest(0,public.project_stats.flash_count+delta),success_count=greatest(0,public.project_stats.success_count+success_delta),failure_count=greatest(0,public.project_stats.failure_count+failure_delta);
 end if;
 return null;
end; $$;
create trigger favorites_stats after insert or delete on public.favorites for each row execute function private.update_stats();
create trigger flash_stats after insert or update or delete on public.flash_sessions for each row execute function private.update_stats();

create function private.validate_manifest() returns trigger language plpgsql set search_path = '' as $$
declare f jsonb; last_end bigint := 0; addr bigint; sz bigint; owner uuid; chip_name text; names text[] := '{}';
begin
 select owner_id,chip into owner,chip_name from public.projects where id=new.project_id;
 if jsonb_typeof(new.manifest)<>'object' or new.manifest->>'chip' is distinct from chip_name or coalesce((new.manifest->>'baudRate')::integer,0) not in (115200,230400,460800,921600) then raise exception 'Invalid chip or baud rate'; end if;
 if jsonb_typeof(new.manifest->'files') is distinct from 'array' then raise exception 'Files must be an array'; end if;
 if jsonb_array_length(new.manifest->'files') not between 1 and 8 then raise exception 'Expected 1-8 BIN files'; end if;
 for f in select value from jsonb_array_elements(new.manifest->'files') order by (value->>'address')::bigint loop
  if not (f ?& array['path','name','address','size','sha256']) then raise exception 'Missing file metadata'; end if;
  if coalesce(f->>'name','') !~ '^[a-zA-Z0-9._-]+\.[bB][iI][nN]$' or (f->>'name')=any(names) or coalesce(f->>'sha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid file name or SHA256'; end if;
  if coalesce(f->>'address','') !~ '^[0-9]+$' or coalesce(f->>'size','') !~ '^[0-9]+$' then raise exception 'Invalid file address or size'; end if;
  addr:=(f->>'address')::bigint; sz:=(f->>'size')::bigint;
  if addr<last_end or mod(addr,4096)<>0 or sz not between 1 and 16777216 or addr+sz>33554432 then raise exception 'Invalid or overlapping flash range'; end if;
  if (f->>'path') is distinct from owner::text||'/'||new.project_id::text||'/'||new.id::text||'/'||(f->>'name') then raise exception 'File must belong to this release'; end if;
  if not exists(select 1 from storage.objects where bucket_id='firmware' and name=f->>'path' and (metadata->>'size')::bigint=sz) then raise exception 'Firmware not uploaded or size mismatch'; end if;
  names:=array_append(names,f->>'name'); last_end:=addr+((sz+4095)/4096)*4096;
 end loop;
 return new;
end; $$;
create trigger validate_firmware before insert on public.firmware_versions for each row execute function private.validate_manifest();
create function private.guard_project() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.chip<>old.chip and exists(select 1 from public.firmware_versions where project_id=old.id) then raise exception 'A project with releases cannot change its chip'; end if;
 new.updated_at:=now(); return new;
end; $$;
create trigger guard_project before update on public.projects for each row execute function private.guard_project();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.firmware_versions enable row level security;
alter table public.favorites enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.flash_sessions enable row level security;
alter table public.compatibility_reports enable row level security;
alter table public.project_stats enable row level security;

create policy profiles_read on public.profiles for select to anon, authenticated using(true);
create policy projects_read on public.projects for select to anon, authenticated using(true);
create policy projects_create on public.projects for insert to authenticated with check((select auth.uid())=owner_id);
create policy projects_edit on public.projects for update to authenticated using((select auth.uid())=owner_id) with check((select auth.uid())=owner_id);
create policy versions_read on public.firmware_versions for select to anon, authenticated using(true);
create policy versions_create on public.firmware_versions for insert to authenticated with check(exists(select 1 from public.projects where id=project_id and owner_id=(select auth.uid())));
create policy favorites_read on public.favorites for select to authenticated using(user_id=(select auth.uid()));
create policy favorites_create on public.favorites for insert to authenticated with check(user_id=(select auth.uid()));
create policy favorites_remove on public.favorites for delete to authenticated using(user_id=(select auth.uid()));
create policy ratings_read on public.ratings for select to anon, authenticated using(true);
create policy ratings_create on public.ratings for insert to authenticated with check(user_id=(select auth.uid()));
create policy ratings_edit on public.ratings for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy comments_read on public.comments for select to anon, authenticated using(true);
create policy comments_create on public.comments for insert to authenticated with check(user_id=(select auth.uid()));
create policy flash_read on public.flash_sessions for select to authenticated using(user_id=(select auth.uid()));
create policy flash_create on public.flash_sessions for insert to authenticated with check(user_id=(select auth.uid()) and status='started' and exists(select 1 from public.firmware_versions v join public.projects p on p.id=v.project_id where v.id=version_id and v.project_id=flash_sessions.project_id and v.online_enabled and p.status<>'archived' and p.chip=flash_sessions.chip));
create policy flash_edit on public.flash_sessions for update to authenticated using(user_id=(select auth.uid()) and status='started') with check(user_id=(select auth.uid()) and status in ('success','failed'));
create policy reports_read on public.compatibility_reports for select to anon, authenticated using(true);
create policy reports_create on public.compatibility_reports for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.projects where id=project_id and chip=compatibility_reports.chip));
create policy stats_read on public.project_stats for select to anon, authenticated using(true);

create view public.project_catalog with(security_invoker=true) as
select p.*, pr.username as author, coalesce(s.flash_count,0) as flash_count, coalesce(s.favorite_count,0) as favorite_count, coalesce(s.success_count,0) as success_count, coalesce(s.failure_count,0) as failure_count,
 coalesce((select round(avg(score),1) from public.ratings r where r.project_id=p.id),0) as rating,
 coalesce((select version from public.firmware_versions v where v.project_id=p.id order by (channel='stable') desc,created_at desc limit 1),'') as version
from public.projects p join public.profiles pr on pr.id=p.owner_id left join public.project_stats s on s.project_id=p.id;
create view public.comment_catalog with(security_invoker=true) as
select c.*,p.username as author,r.score as rating from public.comments c join public.profiles p on p.id=c.user_id left join public.ratings r on r.project_id=c.project_id and r.user_id=c.user_id;

create function public.submit_review(p_project_id uuid,p_body text,p_rating integer,p_device text) returns void language plpgsql security invoker set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 insert into public.ratings(user_id,project_id,score) values(auth.uid(),p_project_id,p_rating) on conflict(user_id,project_id) do update set score=excluded.score;
 insert into public.comments(user_id,project_id,body,device) values(auth.uid(),p_project_id,p_body,p_device);
end; $$;
revoke all on function public.submit_review(uuid,text,integer,text) from public,anon;
grant execute on function public.submit_review(uuid,text,integer,text) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;

revoke all on all tables in schema public from public,anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.profiles,public.projects,public.firmware_versions,public.ratings,public.comments,public.compatibility_reports,public.project_stats,public.project_catalog,public.comment_catalog to anon,authenticated;
grant select,insert,delete on public.favorites to authenticated;
grant select,insert on public.flash_sessions to authenticated;
grant update(status,error) on public.flash_sessions to authenticated;
grant insert,update on public.projects to authenticated;
grant insert on public.firmware_versions,public.comments,public.compatibility_reports to authenticated;
grant insert,update on public.ratings to authenticated;

-- Private bucket; RLS grants public reads only for files of published releases.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('firmware','firmware',false,16777216,array['application/octet-stream']);
create policy firmware_read on storage.objects for select to anon,authenticated using(bucket_id='firmware' and (split_part(storage.objects.name,'/',1)=(select auth.uid())::text or exists(select 1 from public.firmware_versions v where v.manifest->'files' @> jsonb_build_array(jsonb_build_object('path',storage.objects.name)))));
create policy firmware_upload on storage.objects for insert to authenticated with check(bucket_id='firmware' and split_part(storage.objects.name,'/',1)=(select auth.uid())::text and lower(storage.extension(storage.objects.name))='bin' and exists(select 1 from public.projects p where p.id::text=split_part(storage.objects.name,'/',2) and p.owner_id=(select auth.uid())));
create policy firmware_cleanup on storage.objects for delete to authenticated using(bucket_id='firmware' and split_part(storage.objects.name,'/',1)=(select auth.uid())::text and not exists(select 1 from public.firmware_versions v where v.manifest->'files' @> jsonb_build_array(jsonb_build_object('path',storage.objects.name))));

-- Release artifacts are immutable; only online availability can be changed by the owner.
grant update(online_enabled) on public.firmware_versions to authenticated;
create policy versions_toggle on public.firmware_versions for update to authenticated using(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid()))) with check(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create function public.set_release_online(p_release_id uuid,p_enabled boolean) returns void language plpgsql security invoker set search_path = '' as $$
begin
 update public.firmware_versions set online_enabled=p_enabled where id=p_release_id and exists(select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid());
 if not found then raise exception 'Release not found or access denied'; end if;
end; $$;
revoke all on function public.set_release_online(uuid,boolean) from public,anon;
grant execute on function public.set_release_online(uuid,boolean) to authenticated;

create function private.touch_project_on_release() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 update public.projects set updated_at=now() where id=new.project_id;
 return new;
end; $$;
revoke all on function private.touch_project_on_release() from public,anon,authenticated;
create trigger release_updates_project after insert on public.firmware_versions for each row execute function private.touch_project_on_release();
