import type { Manifest } from './types';
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
