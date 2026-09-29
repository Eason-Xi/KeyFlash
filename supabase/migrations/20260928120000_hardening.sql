-- KeyFlash 加固：项目列级写权限、卡片颜色校验、昵称唯一、固件读取策略索引。

-- 卡片颜色只允许界面支持的取值
alter table public.projects add constraint projects_color_check
 check (color in ('orange','purple','blue','green','pink','yellow'));

-- 列级授权：客户端不能伪造 created_at（影响“最新发布”排序）或修改 id / owner_id。
-- updated_at 由 guard_project 触发器强制写为 now()，保留其 UPDATE 授权供发布版本时的触发器使用。
revoke insert, update on public.projects from authenticated;
grant insert (id,owner_id,slug,name,summary,description,chip,device_type,features,hardware,license,github_url,website_url,status,color)
 on public.projects to authenticated;
grant update (slug,name,summary,description,chip,device_type,features,hardware,license,github_url,website_url,status,color,updated_at)
 on public.projects to authenticated;

-- 昵称不区分大小写唯一，作者主页 /user/{username} 才能唯一对应一个人。
-- 先为已有的重名账号追加后缀，再建立唯一索引。
update public.profiles p set username = left(p.username,55)||'-'||left(p.id::text,4)
 from (select id, row_number() over (partition by lower(username) order by created_at, id) as n from public.profiles) d
 where d.id = p.id and d.n > 1;
create unique index profiles_username_key on public.profiles(lower(username));
create or replace function private.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
declare base text; candidate text;
begin
 base := left(coalesce(nullif(btrim(new.raw_user_meta_data->>'username'),''),'maker-'||left(new.id::text,8)),55);
 candidate := base;
 -- 注册时昵称已被占用则自动追加短后缀，而不是让注册失败
 while exists(select 1 from public.profiles where lower(username)=lower(candidate)) loop
  candidate := base||'-'||substr(md5(random()::text),1,4);
 end loop;
 insert into public.profiles(id,username) values (new.id,candidate);
 return new;
end; $$;
revoke all on function private.on_signup() from public,anon,authenticated;

-- firmware_read / firmware_cleanup 策略按 manifest->'files' @> [...] 查找所属版本，每次读取固件都会执行
create index firmware_versions_files_idx on public.firmware_versions using gin ((manifest->'files') jsonb_path_ops);
