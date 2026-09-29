import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareFirmware, suggestAddress, defaultRelease } from '../src/lib/firmware';
import { sha256 } from '../src/lib/validation';
import type { Manifest, Release } from '../src/lib/types';

test('preflight rejects a tampered final file before returning any writable images', async () => {
  const bytes = new Uint8Array([0xe9, 1, 2, 3]);
  const hash = await sha256(bytes.buffer);
  const manifest: Manifest = {
    chip: 'ESP32-S3',
    baudRate: 460800,
    files: [
      { path: 'a/boot.bin', name: 'boot.bin', address: 0, size: 4, sha256: hash },
      { path: 'a/app.bin', name: 'app.bin', address: 65536, size: 4, sha256: hash },
    ],
  };
  let writes = 0;
  const download = async (path: string) =>
    new Blob([path.endsWith('boot.bin') ? bytes : new Uint8Array([0xe9, 9, 9, 9])]);
  await assert.rejects(async () => {
    await prepareFirmware(manifest, download);
    writes++;
  }, /SHA-256/);
  assert.equal(writes, 0);
  const prepared = await prepareFirmware(manifest, async () => new Blob([bytes]));
  assert.deepEqual(
    prepared.map((f) => f.address),
    [0, 65536],
  );
  assert.deepEqual(prepared[1].data, bytes);
});
test('preflight rejects size mismatches and invalid manifests before flashing', async () => {
  const manifest: Manifest = {
    chip: 'ESP32-C3',
    baudRate: 115200,
    files: [{ path: 'a/app.bin', name: 'app.bin', address: 0, size: 1024, sha256: 'a'.repeat(64) }],
  };
  await assert.rejects(
    () => prepareFirmware(manifest, async () => new Blob(['short'])),
    /大小不匹配/,
  );
  let downloads = 0;
  await assert.rejects(() =>
    prepareFirmware({ ...manifest, files: [] }, async () => {
      downloads++;
      return new Blob();
    }),
  );
  assert.equal(downloads, 0);
});

test('suggested addresses follow the default ESP-IDF layout per chip', () => {
  assert.equal(suggestAddress('bootloader.bin', 'ESP32'), '0x1000');
  assert.equal(suggestAddress('bootloader.bin', 'ESP32-S3'), '0x0');
  assert.equal(suggestAddress('partition-table.bin', 'ESP32-C3'), '0x8000');
  assert.equal(suggestAddress('ota_data_initial.bin', 'ESP32'), '0xd000');
  assert.equal(suggestAddress('firmware.factory.bin', 'ESP32-S3'), '0x0');
  assert.equal(suggestAddress('keyboard-merged.bin', 'ESP32'), '0x0');
  assert.equal(suggestAddress('macropad.bin', 'ESP32-S3'), '0x10000');
});
test('flash page defaults to a release that can actually be flashed', () => {
  const file = { path: 'p', name: 'a.bin', address: 0, size: 1, sha256: 'a'.repeat(64) };
  const release = (id: string, channel: Release['channel'], online: boolean): Release => ({
    id,
    project_id: 'p',
    version: id,
    channel,
    changelog: '',
    hardware: '',
    manifest: { chip: 'ESP32', baudRate: 460800, files: [file] },
    online_enabled: online,
    created_at: '',
  });
  const list = [
    release('beta', 'beta', true),
    release('old-stable', 'stable', false),
    release('stable', 'stable', true),
  ];
  assert.equal(defaultRelease(list, null)?.id, 'stable');
  assert.equal(defaultRelease(list, 'old-stable')?.id, 'old-stable', 'explicit link wins');
  assert.equal(defaultRelease(list, 'missing')?.id, 'stable', 'unknown id falls back');
  assert.equal(defaultRelease([list[1], list[0]], null)?.id, 'beta');
  assert.equal(defaultRelease([list[1]], null)?.id, 'old-stable');
  assert.equal(defaultRelease([], null), undefined);
});
