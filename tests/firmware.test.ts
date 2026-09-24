import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareFirmware } from '../src/lib/firmware';
import { sha256 } from '../src/lib/validation';
import type { Manifest } from '../src/lib/types';

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
