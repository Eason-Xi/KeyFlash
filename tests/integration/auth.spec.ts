import { test, expect, type Page } from '@playwright/test';

const userId = '11111111-1111-4111-8111-111111111111';
const user = {
  id: userId,
  email: 'maker@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  user_metadata: { user_name: 'octo-maker' },
  app_metadata: { provider: 'github' },
  created_at: new Date().toISOString(),
};
const token = [
  { alg: 'HS256', typ: 'JWT' },
  { sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated' },
  'test',
]
  .map((x, i) => (i === 2 ? x : Buffer.from(JSON.stringify(x)).toString('base64url')))
  .join('.');

// 模拟 Supabase Auth 与登录后 /history 页面需要的接口；未预期的请求记入 unexpected
async function mockSupabase(page: Page, external: { github: boolean; google: boolean }) {
  const authorizeUrls: URL[] = [];
  const unexpected: string[] = [];
  await page.route('http://127.0.0.1:54329/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path === '/auth/v1/settings') return json({ external: { email: false, ...external } });
    if (path === '/auth/v1/authorize') {
      authorizeUrls.push(url);
      // 第三方授权完成后，Supabase 以隐式流程把会话放在 hash 中重定向回 redirect_to
      const back = new URL(url.searchParams.get('redirect_to')!);
      back.hash = new URLSearchParams({
        access_token: token,
        refresh_token: 'test-refresh',
        expires_in: '3600',
        expires_at: String(Math.floor(Date.now() / 1000) + 3600),
        token_type: 'bearer',
      }).toString();
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    }
    if (path === '/auth/v1/user') return json(user);
    if (path === '/rest/v1/flash_sessions' && method === 'GET') return json([]);
    unexpected.push(`${method} ${path}`);
    return json({ message: 'Unexpected test request' }, 500);
  });
  return { authorizeUrls, unexpected };
}

for (const provider of [
  { id: 'github', name: 'GitHub' },
  { id: 'google', name: 'Google' },
]) {
  test(`${provider.name} sign-in round-trips through Supabase and lands on the requested page`, async ({
    page,
  }) => {
    const { authorizeUrls, unexpected } = await mockSupabase(page, {
      github: true,
      google: true,
    });
    await page.goto('/login?next=%2Fhistory');
    // 只提供第三方登录，页面上不再有邮箱或密码输入框
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await page.getByRole('button', { name: `使用 ${provider.name} 登录` }).click();
    await expect(page).toHaveURL(/\/history$/);
    expect(authorizeUrls[0].searchParams.get('provider')).toBe(provider.id);
    const redirect = new URL(authorizeUrls[0].searchParams.get('redirect_to')!);
    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('next')).toBe('/history');
    expect(redirect.searchParams.get('oauth')).toBe('1');
    await expect(page.getByRole('heading', { name: '还没有烧录记录' })).toBeVisible();
    expect(unexpected).toEqual([]);
  });
}

test('only providers enabled in Supabase are offered', async ({ page }) => {
  const { unexpected } = await mockSupabase(page, { github: true, google: false });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: '使用 GitHub 登录' })).toBeVisible();
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test('login page explains when no provider is enabled yet', async ({ page }) => {
  const { unexpected } = await mockSupabase(page, { github: false, google: false });
  await page.goto('/login');
  await expect(page.getByText('登录服务暂未开放，请稍后再试。')).toBeVisible();
  await expect(page.getByRole('button', { name: /使用 .* 登录/ })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test('a cancelled authorization shows an error on the login page', async ({ page }) => {
  const { unexpected } = await mockSupabase(page, { github: true, google: true });
  await page.goto('/login?next=%2Fhistory&oauth=1&error=access_denied&error_code=access_denied');
  await expect(page.locator('.field-error')).toHaveText('登录未完成，请重试');
  await expect(page.getByRole('button', { name: '使用 GitHub 登录' })).toBeEnabled();
  expect(unexpected).toEqual([]);
});
