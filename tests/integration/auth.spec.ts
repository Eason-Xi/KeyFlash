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
const session = {
  access_token: token,
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'test-refresh',
  user,
};

// 模拟 Supabase Auth 与登录后 /history 页面需要的接口；未预期的请求记入 unexpected
async function mockSupabase(page: Page, options: { github: boolean }) {
  const calls: { method: string; path: string; url: string; body: unknown }[] = [];
  const unexpected: string[] = [];
  let verifyAttempts = 0;
  await page.route('http://127.0.0.1:54329/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    calls.push({ method, path, url: req.url(), body: req.postDataJSON?.() ?? null });
    if (path === '/auth/v1/settings') return json({ external: { github: options.github } });
    if (path === '/auth/v1/otp') return json({});
    if (path === '/auth/v1/verify') {
      verifyAttempts += 1;
      // 第一次提交模拟输错验证码
      if (verifyAttempts === 1)
        return json(
          { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' },
          403,
        );
      return json(session);
    }
    if (path === '/auth/v1/authorize') {
      // GitHub 授权完成后，Supabase 以隐式流程把会话放在 hash 中重定向回 redirect_to
      const back = new URL(url.searchParams.get('redirect_to')!);
      back.hash = new URLSearchParams({
        access_token: token,
        refresh_token: 'test-refresh',
        expires_in: '3600',
        expires_at: String(Math.floor(Date.now() / 1000) + 3600),
        token_type: 'bearer',
        provider_token: 'github-token',
      }).toString();
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    }
    if (path === '/auth/v1/user') return json(user);
    if (path === '/rest/v1/flash_sessions' && method === 'GET') return json([]);
    unexpected.push(`${method} ${path}`);
    return json({ message: 'Unexpected test request' }, 500);
  });
  return { calls, unexpected };
}

test('existing user can sign in with an email code and return to the requested page', async ({
  page,
}) => {
  const { calls, unexpected } = await mockSupabase(page, { github: false });
  await page.goto('/login?next=%2Fhistory');
  await expect(page.getByRole('button', { name: /GitHub/ })).toHaveCount(0);
  await page.getByRole('button', { name: '用验证码登录' }).click();
  await expect(page.getByRole('heading', { name: '验证码登录' })).toBeVisible();
  await page.getByLabel('邮箱').fill('maker@example.test');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByText('验证码已发送至 maker@example.test')).toBeVisible();
  const otp = calls.find((c) => c.path === '/auth/v1/otp');
  expect(otp?.body).toMatchObject({ email: 'maker@example.test', create_user: false });

  await page.getByLabel('验证码').fill('12345');
  await page.getByRole('button', { name: '验证并登录' }).click();
  await expect(page.locator('.field-error')).toHaveText('请输入邮件中的 6 位数字验证码');
  await page.getByLabel('验证码').fill('000000');
  await page.getByRole('button', { name: '验证并登录' }).click();
  await expect(page.locator('.field-error')).toHaveText('验证码错误或已过期，请重新获取');
  await page.getByLabel('验证码').fill('123 456');
  await page.getByRole('button', { name: '验证并登录' }).click();
  await expect(page).toHaveURL(/\/history$/);
  const verify = calls.filter((c) => c.path === '/auth/v1/verify').at(-1);
  expect(verify?.body).toMatchObject({
    email: 'maker@example.test',
    token: '123456',
    type: 'email',
  });
  await expect(page.getByRole('heading', { name: '还没有烧录记录' })).toBeVisible();
  expect(unexpected).toEqual([]);
});

test('GitHub sign-in round-trips through Supabase and lands on the requested page', async ({
  page,
}) => {
  const { calls, unexpected } = await mockSupabase(page, { github: true });
  await page.goto('/login?next=%2Fhistory');
  await page.getByRole('button', { name: '使用 GitHub 登录' }).click();
  await expect(page).toHaveURL(/\/history$/);
  const authorize = new URL(calls.find((c) => c.path === '/auth/v1/authorize')!.url);
  expect(authorize.searchParams.get('provider')).toBe('github');
  const redirect = new URL(authorize.searchParams.get('redirect_to')!);
  expect(redirect.pathname).toBe('/login');
  expect(redirect.searchParams.get('next')).toBe('/history');
  expect(redirect.searchParams.get('oauth')).toBe('1');
  await expect(page.getByRole('heading', { name: '还没有烧录记录' })).toBeVisible();
  expect(unexpected).toEqual([]);
});

test('a cancelled GitHub authorization shows an error on the login page', async ({ page }) => {
  const { unexpected } = await mockSupabase(page, { github: true });
  await page.goto('/login?next=%2Fhistory&oauth=1&error=access_denied&error_code=access_denied');
  await expect(page.locator('.field-error')).toHaveText('GitHub 登录未完成，请重试');
  await expect(page.getByRole('button', { name: '使用 GitHub 登录' })).toBeEnabled();
  expect(unexpected).toEqual([]);
});
