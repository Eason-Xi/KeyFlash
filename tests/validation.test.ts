import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAddress,
  validateFiles,
  validateManifest,
  sha256,
  projectSchema,
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
