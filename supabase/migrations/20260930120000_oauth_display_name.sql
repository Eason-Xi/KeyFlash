-- 只保留 GitHub / Google 登录：Google 不提供登录名，改用其显示名（name / full_name）作为昵称。
create or replace function private.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
declare base text; candidate text;
begin
 base := left(coalesce(
  nullif(btrim(new.raw_user_meta_data->>'username'),''),
  nullif(btrim(new.raw_user_meta_data->>'user_name'),''),
  nullif(btrim(new.raw_user_meta_data->>'preferred_username'),''),
  nullif(btrim(new.raw_user_meta_data->>'name'),''),
  nullif(btrim(new.raw_user_meta_data->>'full_name'),''),
  'maker-'||left(new.id::text,8)),55);
 candidate := base;
 -- 昵称已被占用则自动追加短后缀，而不是让注册失败
 while exists(select 1 from public.profiles where lower(username)=lower(candidate)) loop
  candidate := base||'-'||substr(md5(random()::text),1,4);
 end loop;
 insert into public.profiles(id,username) values (new.id,candidate);
 return new;
end; $$;
revoke all on function private.on_signup() from public,anon,authenticated;
