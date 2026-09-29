import { test, expect } from '@playwright/test';
import type { Project, Release, Comment, Compatibility } from '../../src/lib/types';

test('authenticated author can create, publish, download, favorite and review through Supabase contracts', async ({
  page,
}) => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const projectId = '33333333-3333-4333-8333-333333333333';
  const user = {
    id: userId,
    email: 'maker@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: { username: 'test-maker' },
    app_metadata: { provider: 'email' },
    created_at: new Date().toISOString(),
  };
  const token = [
    { alg: 'HS256', typ: 'JWT' },
    { sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated' },
    'test',
  ]
    .map((x, i) => (i === 2 ? x : Buffer.from(JSON.stringify(x)).toString('base64url')))
    .join('.');
  const projects: Project[] = [];
  const releases: Release[] = [];
  const comments: Comment[] = [];
  const reports: Compatibility[] = [];
  let favorites: string[] = [];
  const binaries = new Map<string, Buffer>();
  const unexpected: string[] = [];
  await page.route('http://127.0.0.1:54329/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path === '/auth/v1/token')
      return json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh',
        user,
      });
    if (path === '/auth/v1/user') return json(user);
    if (path === '/auth/v1/settings') return json({ external: { github: false } });
    if (path === '/auth/v1/logout') return json({});
    if (path.includes('/storage/v1/object/')) {
      const name = decodeURIComponent(
        path.replace(/^\/storage\/v1\/object\/(?:authenticated\/)?firmware\//, ''),
      );
      if (method === 'POST') {
        binaries.set(name, Buffer.from([0xe9, 1, 2, 3]));
        return json({ Key: `firmware/${name}`, Id: 'test-object' });
      }
      if (method === 'DELETE') return json([]);
      if (method === 'GET')
        return route.fulfill({
          contentType: 'application/octet-stream',
          body: binaries.get(name) || Buffer.alloc(0),
        });
    }
    if (path === '/rest/v1/projects' && method === 'POST') {
      const values = req.postDataJSON();
      const p = {
        ...values,
        id: projectId,
        author: 'test-maker',
        color: 'orange',
        flash_count: 0,
        success_count: 0,
        failure_count: 0,
        favorite_count: 0,
        rating: 0,
        version: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      projects.push(p);
      return json(p, 201);
    }
    if (path === '/rest/v1/project_catalog') return json(projects);
    if (path === '/rest/v1/firmware_versions') {
      if (method === 'POST') {
        const r = { ...req.postDataJSON(), created_at: new Date().toISOString() };
        if (releases.some((x) => x.version === r.version))
          return json(
            {
              code: '23505',
              message:
                'duplicate key value violates unique constraint "firmware_versions_project_id_version_key"',
            },
            409,
          );
        releases.push(r);
        projects[0].version = r.version;
        return json(null, 201);
      }
      return json(releases);
    }
    if (path === '/rest/v1/comment_catalog') return json(comments);
    if (path === '/rest/v1/flash_sessions' && method === 'GET') return json([]);
    if (path === '/rest/v1/compatibility_reports') {
      if (method === 'POST') {
        reports.push({
          ...req.postDataJSON(),
          id: 'report-1',
          created_at: new Date().toISOString(),
        });
        return json(null, 201);
      }
      return json(reports);
    }
    if (path === '/rest/v1/favorites') {
      if (method === 'POST') {
        favorites.push(req.postDataJSON().project_id);
        return json(null, 201);
      }
      if (method === 'DELETE') {
        favorites = [];
        return json(null);
      }
      return json(favorites.map((project_id) => ({ project_id })));
    }
    if (path === '/rest/v1/rpc/submit_review') {
      const v = req.postDataJSON();
      projects[0].rating = v.p_rating;
      comments.push({
        id: 'comment-1',
        user_id: userId,
        project_id: projectId,
        body: v.p_body,
        rating: v.p_rating,
        device: v.p_device,
        author: 'test-maker',
        created_at: new Date().toISOString(),
      });
      return json(null);
    }
    unexpected.push(`${method} ${path}`);
    return json({ message: 'Unexpected test request' }, 500);
  });
  // 从受保护页面进入登录，登录后应回到原页面
  await page.goto('/history');
  await page.locator('#main-content').getByRole('link', { name: '登录 / 注册' }).click();
  await page.getByLabel('邮箱').fill('maker@example.test');
  await page.getByLabel('密码', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('heading', { name: '还没有烧录记录' })).toBeVisible();
  await page.getByRole('link', { name: '开发者工作台' }).first().click();
  await expect(page.getByRole('heading', { name: '开发者工作台' })).toBeVisible();
  await page.getByRole('link', { name: '创建项目' }).first().click();
  await page.getByLabel('项目名称').fill('Test MacroPad');
  await page.getByLabel('项目标识').fill('test-macropad');
  await page.getByLabel('一句话简介').fill('A fully testable keyboard firmware project');
  await page
    .getByLabel('项目介绍')
    .fill('A test project for checking authenticated publishing and version management.');
  await page.getByLabel('兼容硬件 / PCB 版本').fill('Test PCB Rev 1.0');
  await page.getByRole('button', { name: '创建项目，继续上传' }).click();
  await expect(page.getByRole('heading', { name: 'Test MacroPad' })).toBeVisible();
  await page.getByRole('button', { name: '发布新版本' }).click();
  await page.getByLabel('版本号').fill('1.0.0');
  await page.getByLabel('更新日志').fill('First test release with keyboard support');
  await page.locator('input[type=file]').setInputFiles({
    name: 'firmware.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([0xe9, 1, 2, 3]),
  });
  await page.getByRole('button', { name: '上传并发布版本' }).click();
  await expect(page.getByText('固件版本已发布', { exact: true })).toBeVisible();
  expect(releases).toHaveLength(1);
  expect(releases[0].manifest.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(releases[0].manifest.files[0].address).toBe(65536);
  // 重复版本号：数据库唯一约束的英文错误应转为中文提示，且清理已上传文件
  await page.getByRole('button', { name: '发布新版本' }).click();
  await page.getByLabel('版本号').fill('1.0.0');
  await page.getByLabel('更新日志').fill('Accidentally reusing the same version');
  await page.locator('input[type=file]').setInputFiles({
    name: 'firmware.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([0xe9, 1, 2, 3]),
  });
  await page.getByRole('button', { name: '上传并发布版本' }).click();
  await expect(page.locator('.field-error')).toHaveText('该版本号已发布过，请使用新的版本号');
  expect(releases).toHaveLength(1);
  // 已有版本后芯片平台锁定
  await page.getByRole('button', { name: '项目资料' }).click();
  await expect(page.getByLabel('芯片平台')).toBeDisabled();
  await expect(page.getByText('已有发布版本，芯片平台不可更改')).toBeVisible();
  await page.getByRole('link', { name: '查看项目', exact: true }).click();
  await page.getByRole('button', { name: '收藏项目' }).click();
  await expect(page.getByRole('button', { name: '已收藏' })).toBeVisible();
  expect(favorites).toEqual([projectId]);
  await page.locator('.detail-tabs').getByRole('link', { name: '固件版本' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 firmware.bin' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('firmware.bin');
  await page.locator('.detail-tabs').getByRole('link', { name: '社区评价' }).click();
  await page.getByLabel('使用体验').fill('The keyboard works as expected in the test.');
  await page.getByRole('button', { name: '发布评价' }).click();
  await expect(page.getByText('The keyboard works as expected in the test.')).toBeVisible();
  expect(comments[0].rating).toBe(5);
  await page.locator('.detail-tabs').getByRole('link', { name: '兼容性验证' }).click();
  await page.getByRole('button', { name: '提交测试结果' }).click();
  await page.getByRole('button', { name: '提交兼容性结果' }).click();
  await expect(page.getByText('兼容性结果已记录', { exact: true })).toBeVisible();
  expect(reports[0].version_id).toBe(releases[0].id);
  expect(reports[0].success).toBe(true);
  expect(unexpected).toEqual([]);
});
