import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAddress,
  validateFiles,
  validateManifest,
  sha256,
  projectSchema,
  releaseSchema,
  message,
  safeNext,
  otpCode,
} from '../src/lib/validation';
test('flash address requires complete numeric syntax and sector alignment', () => {
  assert.equal(parseAddress('0x10000'), 65536);
  assert.equal(parseAddress('32768'), 32768);
  for (const v of ['0x10001', '0x10xyz', '-1', '1.5', 'Infinity', '0x2000000', ''])
    assert.throws(() => parseAddress(v));
});
test('rejects overlap including erase-sector overlap, traversal names and excessive files', () => {
  const file = { name: 'firmware.bin', address: 0x10000, size: 4097 };
  validateFiles([file]);
  assert.throws(() => validateFiles([file, { name: 'next.bin', address: 0x11000, size: 1 }]));
  assert.throws(() => validateFiles([{ ...file, name: '../firmware.bin' }]));
  assert.throws(() => validateFiles([{ ...file, size: 0 }]));
  assert.throws(() => validateFiles([{ ...file, size: 16777217 }]));
  assert.throws(() => validateFiles(Array(9).fill(file)));
  assert.throws(() => validateFiles([file, file]));
  validateFiles([
    { ...file, address: 0, size: 4096 },
    { ...file, name: 'next.bin', address: 4096 },
  ]);
});
test('rejects tampered manifest and accepts documented format', () => {
  const manifest = {
    chip: 'ESP32-S3' as const,
    baudRate: 460800,
    files: [
      {
        name: 'app.bin',
        path: 'a/b/c/app.bin',
        address: 65536,
        size: 1024,
        sha256: 'a'.repeat(64),
      },
    ],
  };
  validateManifest(manifest);
  assert.throws(() => validateManifest({ ...manifest, baudRate: 42 }));
  assert.throws(() =>
    validateManifest({ ...manifest, files: [{ ...manifest.files[0], sha256: 'invalid' }] }),
  );
});
test('SHA256 matches known reference digest', async () => {
  assert.equal(
    await sha256(new TextEncoder().encode('abc').buffer),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});
test('project refuses unsafe URLs and malformed slugs', () => {
  const p = {
    name: 'Test',
    slug: 'test-pad',
    summary: 'This is a sample project',
    description: 'A sufficiently long project description',
    chip: 'ESP32-S3',
    device_type: '宏键盘',
    features: ['USB HID'],
    hardware: 'Rev 2',
    license: 'MIT',
    github_url: 'https://github.com/example/test',
    website_url: '',
    status: 'stable',
  };
  assert.equal(projectSchema.safeParse(p).success, true);
  assert.equal(projectSchema.safeParse({ ...p, github_url: 'javascript:alert(1)' }).success, false);
  assert.equal(projectSchema.safeParse({ ...p, slug: '../x' }).success, false);
});

const validProject = {
  name: 'Test Pad',
  slug: 'test-pad',
  summary: 'A small test macro keyboard',
  description: 'A complete description of the test macro keyboard.',
  chip: 'ESP32-S3',
  device_type: '宏键盘',
  features: [],
  hardware: 'Rev 1',
  license: 'MIT',
  github_url: '',
  website_url: '',
  status: 'stable',
};
test('validation errors name the field in Chinese', () => {
  const short = projectSchema.safeParse({ ...validProject, summary: '太短' });
  assert.equal(message(short.error), '一句话简介：至少需要 10 个字符');
  const slug = projectSchema.safeParse({ ...validProject, slug: 'Bad Slug' });
  assert.equal(message(slug.error), '项目标识：使用小写字母、数字和连字符');
  const version = releaseSchema.safeParse({
    version: 'v1',
    channel: 'stable',
    changelog: 'Enough changelog text',
    hardware: 'Rev 1',
    baudRate: 460800,
    online_enabled: true,
  });
  assert.match(message(version.error), /^版本号：请输入语义化版本/);
  assert.equal(projectSchema.parse(validProject).color, 'orange');
  assert.equal(projectSchema.safeParse({ ...validProject, color: 'red' }).success, false);
});
test('backend errors are translated instead of leaking English messages', () => {
  const pg = (code: string, text: string) => ({ code, message: text, details: null, hint: null });
  assert.equal(
    message(pg('23505', 'duplicate key value violates unique constraint "projects_slug_key"')),
    '项目标识已被使用，请换一个',
  );
  assert.equal(
    message(
      pg(
        '23505',
        'duplicate key value violates unique constraint "firmware_versions_project_id_version_key"',
      ),
    ),
    '该版本号已发布过，请使用新的版本号',
  );
  assert.match(
    message(pg('42501', 'new row violates row-level security policy for table "flash_sessions"')),
    /没有权限/,
  );
  assert.equal(
    message(pg('P0001', 'A project with releases cannot change its chip')),
    '已有发布版本的项目不能更换芯片平台',
  );
  assert.equal(
    message({ name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'x' }),
    '邮箱或密码错误',
  );
  assert.equal(
    message({ name: 'AuthApiError', message: 'Invalid login credentials' }),
    '邮箱或密码错误',
  );
  assert.equal(message(new TypeError('Failed to fetch')), '网络连接失败，请检查网络后重试');
  assert.equal(message(new Error('芯片不匹配')), '芯片不匹配');
  assert.equal(message(undefined), '操作失败，请重试');
});
test('post-login redirect only accepts same-site paths', () => {
  assert.equal(safeNext('/project/open-macropad/flash'), '/project/open-macropad/flash');
  assert.equal(safeNext('/history?x=1'), '/history?x=1');
  for (const bad of [
    null,
    '',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    'javascript:alert(1)',
    '/login',
    '/login?next=/x',
    '/a\nb',
  ])
    assert.equal(safeNext(bad), '/dashboard', String(bad));
});
test('email OTP accepts six digits and explains failures in Chinese', () => {
  assert.equal(otpCode.parse('123456'), '123456');
  assert.equal(otpCode.parse(' 123 456 '), '123456', 'pasted spaces are ignored');
  for (const bad of ['12345', '1234567', 'abcdef', ''])
    assert.equal(message(otpCode.safeParse(bad).error), '请输入邮件中的 6 位数字验证码', bad);
  assert.equal(
    message({ name: 'AuthApiError', code: 'otp_expired', status: 403, message: 'x' }),
    '验证码错误或已过期，请重新获取',
  );
  assert.equal(
    message({ name: 'AuthApiError', status: 403, message: 'Token has expired or is invalid' }),
    '验证码错误或已过期，请重新获取',
  );
  assert.match(
    message({ name: 'AuthApiError', status: 422, message: 'Signups not allowed for otp' }),
    /尚未注册/,
  );
});
