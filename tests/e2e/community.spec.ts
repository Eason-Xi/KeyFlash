import { test, expect } from '@playwright/test';
test('discovery filters compose, reset and handle empty results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'ESP32-S3', exact: true }).click();
  await expect(page.locator('.project-card')).toHaveCount(3);
  await page.getByLabel('搜索固件').fill('Macro');
  await expect(page.locator('.project-card')).toHaveCount(2);
  await page.getByLabel('搜索固件').fill('missing-firmware');
  await expect(page.getByText('没有找到匹配的固件')).toBeVisible();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await page.getByLabel('设备类型').selectOption('旋钮键盘');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.locator('.project-card')).toContainText('Dial One');
  expect(errors).toEqual([]);
});
test('project versions and safe flash gate work without backend', async ({ page }) => {
  await page.goto('/project/open-macropad');
  await expect(page.getByRole('heading', { name: 'Open MacroPad', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '固件版本' }).click();
  await expect(page.getByText('示例版本，未提供真实固件文件。')).toBeVisible();
  await page.locator('.detail-tabs').getByRole('link', { name: '在线烧录' }).click();
  await expect(page.getByRole('button', { name: '连接设备', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '开始烧录', exact: true })).toBeDisabled();
  await expect(
    page.getByText('这是示例项目，没有可用的烧录文件。发布真实固件后即可在线烧录。'),
  ).toBeVisible();
  await page.locator('.detail-tabs').getByRole('link', { name: '兼容性验证' }).click();
  await expect(page.getByText('示例兼容性记录')).toBeVisible();
});
test('private workspace routes require login and demo does not fake auth', async ({ page }) => {
  for (const path of ['/favorites', '/history', '/dashboard', '/dashboard/projects/new']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: '登录后继续' })).toBeVisible();
  }
  await page.locator('#main-content').getByRole('link', { name: '登录 / 注册' }).click();
  // 示例环境展示第三方登录按钮但不可用，也没有邮箱/密码表单
  await expect(page.getByRole('button', { name: '使用 GitHub 登录' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toBeDisabled();
  await expect(page.getByRole('textbox')).toHaveCount(0);
});
test('navigation, guide and viewport have no overflow', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(6);
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '打开导航' }).click();
    await page.getByRole('link', { name: '查看入门指南' }).click();
  } else {
    await page.getByRole('link', { name: '查看入门指南' }).click();
  }
  await expect(page.getByRole('heading', { name: '第一次烧录，从这里开始。' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/project/open-macropad/flash');
  await expect(page.getByRole('heading', { name: 'Open MacroPad', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('unknown paths render a real not-found page', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: '这里还没有内容' })).toBeVisible();
});
test('author page, login return path and page titles', async ({ page }) => {
  await page.goto('/user/BeiYe');
  await expect(page.getByRole('heading', { name: 'BeiYe', exact: true })).toBeVisible();
  await expect(page.locator('.stat-grid')).toContainText('公开项目1');
  await expect(page.locator('.stat-grid')).toContainText('累计烧录12,480');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page).toHaveTitle('BeiYe | KeyFlash');
  await page.goto('/user/%E5%B0%8F%E6%98%8E');
  await expect(page.getByRole('heading', { name: '小明', exact: true })).toBeVisible();
  await page.goto('/user/nobody-here');
  await expect(page.getByRole('heading', { name: '暂无公开项目' })).toBeVisible();

  await page.goto('/project/open-macropad/reviews');
  await expect(page).toHaveTitle('Open MacroPad · 社区评价 | KeyFlash');
  await expect(page.locator('.inline-note').getByRole('link', { name: '登录' })).toHaveAttribute(
    'href',
    '/login?next=%2Fproject%2Fopen-macropad%2Freviews',
  );
  await page.goto('/history');
  await expect(page).toHaveTitle('烧录记录 | KeyFlash');
  await expect(
    page.locator('#main-content').getByRole('link', { name: '登录 / 注册' }),
  ).toHaveAttribute('href', '/login?next=%2Fhistory');
});
test('flash page ignores an unknown version parameter', async ({ page }) => {
  await page.goto('/project/dial-one/flash?version=does-not-exist');
  await expect(page.getByLabel('选择固件版本')).toHaveValue('demo-knob-release');
});
test('privacy policy and terms are public and linked from footer and login', async ({ page }) => {
  await page.goto('/');
  await page.locator('.main-footer').getByRole('link', { name: '隐私政策' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { name: '隐私政策', level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/隐私政策/);
  await page.locator('.legal-body').getByRole('link', { name: '服务条款' }).click();
  await expect(page.getByRole('heading', { name: '服务条款', level: 1 })).toBeVisible();
  await page.goto('/login');
  await expect(page.locator('.auth-terms').getByRole('link', { name: '隐私政策' })).toHaveAttribute(
    'href',
    '/privacy',
  );
});
