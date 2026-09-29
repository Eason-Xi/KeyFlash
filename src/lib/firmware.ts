import type { Chip, Manifest, Release } from './types';
import { sha256, validateManifest } from './validation';

/** Verify every file before the caller is allowed to erase or write any Flash. */
export async function prepareFirmware(
  manifest: Manifest,
  download: (path: string) => Promise<Blob>,
  onVerified: (name: string) => void = () => {},
): Promise<{ data: Uint8Array; address: number }[]> {
  validateManifest(manifest);
  const files: { data: Uint8Array; address: number }[] = [];
  for (const file of manifest.files) {
    const blob = await download(file.path);
    if (blob.size !== file.size) throw new Error(`${file.name} 文件大小不匹配，已停止烧录。`);
    const bytes = await blob.arrayBuffer();
    if ((await sha256(bytes)) !== file.sha256) {
      throw new Error(`${file.name} SHA-256 校验失败，已停止烧录。`);
    }
    files.push({ data: new Uint8Array(bytes), address: file.address });
    onVerified(file.name);
  }
  return files.sort((a, b) => a.address - b.address);
}

/** 按 ESP-IDF 默认分区布局推测初始地址，仅作参考，发布者仍需按 flash_args 核对 */
export function suggestAddress(name: string, chip: Chip) {
  const n = name.toLowerCase();
  if (/merged|factory|combined/.test(n)) return '0x0';
  if (n.includes('bootloader')) return chip === 'ESP32' ? '0x1000' : '0x0';
  if (n.includes('partition')) return '0x8000';
  if (n.includes('ota_data')) return '0xd000';
  return '0x10000';
}
/** 优先使用链接指定的版本，其次是可在线烧录的稳定版、任意可烧录版本 */
export function defaultRelease(releases: Release[], requested: string | null) {
  const flashable = (r: Release) => r.online_enabled && r.manifest.files.length > 0;
  return (
    releases.find((r) => r.id === requested) ||
    releases.find((r) => flashable(r) && r.channel === 'stable') ||
    releases.find(flashable) ||
    releases[0]
  );
}
