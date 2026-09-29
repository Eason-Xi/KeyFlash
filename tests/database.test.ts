import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const userA = '11111111-1111-4111-8111-111111111111',
  userB = '22222222-2222-4222-8222-222222222222',
  projectId = '33333333-3333-4333-8333-333333333333',
  versionId = '44444444-4444-4444-8444-444444444444',
  userC = '55555555-5555-4555-8555-555555555555';
test('Postgres migration enforces ownership, immutable firmware and private user data', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 create function storage.extension(text) returns text language sql immutable as $$ select reverse(split_part(reverse($1),'.',1)) $$;
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated; grant select,insert,update,delete on storage.objects to anon,authenticated;
 `);
    for (const file of readdirSync('supabase/migrations').sort())
      await pg.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    await pg.exec(
      `insert into auth.users values('${userA}','{"username":"alice"}'),('${userB}','{"username":"bob"}'),('${userC}','{"username":"ALICE"}');`,
    );
    const names = (
      await pg.query<{ username: string }>(
        'select username from public.profiles order by created_at',
      )
    ).rows.map((r) => r.username);
    assert.equal(names[0], 'alice');
    assert.match(names[2], /^ALICE-[0-9a-f]{4}$/, 'duplicate nicknames get a unique suffix');
    // GitHub 登录只带 user_name，Google 只带 name；都没有时回退到 maker-xxxx
    await pg.exec(
      `insert into auth.users values('66666666-6666-4666-8666-666666666666','{"user_name":"octo-maker","full_name":"Octo"}'),('77777777-7777-4777-8777-777777777777','{"user_name":"Alice"}'),('88888888-8888-4888-8888-888888888888','{}'),('99999999-9999-4999-8999-999999999999','{"name":"张 三","full_name":"张 三","email":"zs@example.test"}');`,
    );
    const oauthNames = (
      await pg.query<{ id: string; username: string }>(
        `select id,username from public.profiles where id in ('66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777','88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999') order by id`,
      )
    ).rows.map((r) => r.username);
    assert.equal(oauthNames[0], 'octo-maker');
    assert.match(oauthNames[1], /^Alice-[0-9a-f]{4}$/, 'GitHub logins also get a unique suffix');
    assert.equal(oauthNames[2], 'maker-88888888');
    assert.equal(oauthNames[3], '张 三', 'Google logins use the display name, never the email');
    const asUser = async (id: string) => {
      await pg.exec(
        `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
      );
    };
    await asUser(userA);
    await pg.exec(
      `insert into public.projects(id,owner_id,slug,name,summary,description,chip,device_type,hardware) values('${projectId}','${userA}','alice-pad','Alice Pad','A test macro keyboard','A full test project description','ESP32-S3','宏键盘','Test PCB Rev 1');`,
    );
    const path = `${userA}/${projectId}/${versionId}/firmware.bin`;
    await pg.query(
      `insert into storage.objects(bucket_id,name,metadata) values('firmware',$1,'{"size":1024}')`,
      [path],
    );
    const manifest = {
      chip: 'ESP32-S3',
      baudRate: 460800,
      files: [{ path, name: 'firmware.bin', size: 1024, address: 65536, sha256: 'a'.repeat(64) }],
    };
    await pg.query(
      `insert into public.firmware_versions(id,project_id,version,channel,changelog,hardware,manifest) values($1,$2,'1.0.0','stable','First firmware release','Test PCB Rev 1',$3)`,
      [versionId, projectId, JSON.stringify(manifest)],
    );
    await pg.exec(
      `insert into public.favorites(user_id,project_id) values('${userA}','${projectId}');insert into public.flash_sessions(user_id,project_id,version_id,chip) values('${userA}','${projectId}','${versionId}','ESP32-S3');`,
    );
    await pg.exec(
      `select public.submit_review('${projectId}','Works well on my device',5,'ESP32-S3 / Chrome');`,
    );
    await assert.rejects(() =>
      pg.exec(`update public.firmware_versions set manifest='{}' where id='${versionId}'`),
    );
    await assert.rejects(() =>
      pg.exec(`update public.projects set chip='ESP32-C3' where id='${projectId}'`),
    );
    await assert.rejects(
      () => pg.exec(`update public.projects set created_at='2000-01-01' where id='${projectId}'`),
      /permission denied/,
      'created_at cannot be forged',
    );
    await assert.rejects(
      () => pg.exec(`update public.projects set owner_id='${userB}' where id='${projectId}'`),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        pg.exec(
          `insert into public.projects(owner_id,slug,name,summary,description,chip,device_type,hardware,created_at) values('${userA}','alice-old','Old Pad','A backdated macro keyboard','A backdated project description','ESP32','宏键盘','Old PCB','2000-01-01')`,
        ),
      /permission denied/,
    );
    await assert.rejects(() =>
      pg.exec(`update public.projects set color='url(evil)' where id='${projectId}'`),
    );
    await pg.exec(
      `update public.projects set color='blue', name='Alice Pad' where id='${projectId}'`,
    );
    await assert.rejects(() =>
      pg.exec(`update public.flash_sessions set project_id=gen_random_uuid()`),
    );
    await pg.exec(`delete from storage.objects where name='${path}'`);
    assert.equal(
      (await pg.query('select * from storage.objects')).rows.length,
      1,
      'published binary cannot be deleted',
    );
    await asUser(userB);
    assert.equal(
      (await pg.query('select * from public.favorites')).rows.length,
      0,
      'favorites are private',
    );
    assert.equal(
      (await pg.query('select * from public.flash_sessions')).rows.length,
      0,
      'flash history is private',
    );
    await pg.exec(`update public.projects set name='Hijacked' where id='${projectId}'`);
    assert.equal(
      (await pg.query<{ name: string }>('select name from public.projects')).rows[0].name,
      'Alice Pad',
    );
    await assert.rejects(() =>
      pg.exec(`insert into public.favorites values('${userA}','${projectId}',now())`),
    );
    await assert.rejects(() => pg.exec(`select public.set_release_online('${versionId}',false)`));
    await assert.rejects(() =>
      pg.query(
        `insert into storage.objects(bucket_id,name,metadata) values('firmware',$1,'{"size":1024}')`,
        [`${userA}/${projectId}/anything/attack.bin`],
      ),
    );
    await assert.rejects(() =>
      pg.exec(
        `insert into public.project_stats(project_id,flash_count) values('${projectId}',9999)`,
      ),
    );
    await asUser(userA);
    await pg.exec(`select public.set_release_online('${versionId}',false)`);
    await assert.rejects(() =>
      pg.exec(
        `insert into public.flash_sessions(user_id,project_id,version_id,chip) values('${userA}','${projectId}','${versionId}','ESP32-S3')`,
      ),
    );
    await pg.exec(`update public.flash_sessions set status='success'`);
    await pg.exec(`update public.flash_sessions set status='failed'`);
    assert.equal(
      (await pg.query<{ status: string }>('select status from public.flash_sessions')).rows[0]
        .status,
      'success',
      'completed sessions cannot be rewritten',
    );
    await pg.exec(`reset role;set role anon;select set_config('request.jwt.claim.sub','',false)`);
    const catalog = await pg.query<{
      flash_count: number;
      favorite_count: number;
      rating: number;
      success_count: number;
      failure_count: number;
    }>('select * from public.project_catalog');
    assert.equal(Number(catalog.rows[0].flash_count), 1);
    assert.equal(Number(catalog.rows[0].favorite_count), 1);
    assert.equal(Number(catalog.rows[0].rating), 5);
    assert.equal(Number(catalog.rows[0].success_count), 1);
    assert.equal(Number(catalog.rows[0].failure_count), 0);
    assert.equal(
      (await pg.query('select * from storage.objects')).rows.length,
      1,
      'published firmware is available to guests',
    );
    await assert.rejects(() =>
      pg.exec(`select public.submit_review('${projectId}','Anonymous review',5,'')`),
    );
    await assert.rejects(() => pg.exec('select * from public.flash_sessions'));
  } finally {
    await pg.close();
  }
});
