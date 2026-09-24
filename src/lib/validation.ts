import { z } from 'zod';
import { chips, features, deviceTypes, type FirmwareFile, type Manifest } from './types';
export const MAX_FILE_SIZE = 16 * 1024 * 1024;
export const MAX_FLASH_SIZE = 32 * 1024 * 1024;
const optionalUrl = z.union([
  z.literal(''),
  z.url().refine((v) => /^https?:\/\//.test(v), '链接必须以 http 或 https 开头'),
]);
export const projectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '使用小写字母、数字和连字符')
    .min(3)
    .max(64),
  summary: z.string().trim().min(10).max(180),
  description: z.string().trim().min(20).max(12000),
  chip: z.enum(chips),
  device_type: z.string().refine((v) => deviceTypes.includes(v)),
  features: z.array(z.string().refine((v) => features.includes(v))).max(12),
  hardware: z.string().trim().min(2).max(200),
  license: z.string().min(2).max(40),
  github_url: optionalUrl,
  website_url: optionalUrl,
  status: z.enum(['stable', 'beta', 'experimental', 'archived']),
});
export const releaseSchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/, '请输入语义化版本，例如 1.0.0 或 1.1.0-beta.1'),
  channel: z.enum(['stable', 'beta', 'experimental']),
  changelog: z.string().trim().min(10).max(12000),
  hardware: z.string().trim().min(2).max(200),
  baudRate: z.coerce.number().refine((v) => [115200, 230400, 460800, 921600].includes(v)),
  online_enabled: z.boolean(),
});
export function parseAddress(value: string): number {
  if (!/^(0x[0-9a-f]+|\d+)$/i.test(value.trim())) throw new Error('烧录地址必须是十六进制或整数');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n >= MAX_FLASH_SIZE || n % 4096 !== 0)
    throw new Error('烧录地址必须按 0x1000 对齐，且小于 32 MB');
  return n;
}
export function validateFiles(files: Pick<FirmwareFile, 'name' | 'address' | 'size'>[]) {
  if (!files.length || files.length > 8) throw new Error('请上传 1–8 个 BIN 文件');
  const names = new Set<string>();
  let end = 0;
  for (const file of [...files].sort((a, b) => a.address - b.address)) {
    if (!/^[a-zA-Z0-9._-]+\.bin$/i.test(file.name) || names.has(file.name))
      throw new Error('仅支持不重名的 .bin 文件，文件名使用英文、数字、点、短横线或下划线');
    names.add(file.name);
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_FILE_SIZE)
      throw new Error('每个固件文件必须为 1 B–16 MB');
    if (
      !Number.isSafeInteger(file.address) ||
      file.address < end ||
      file.address % 4096 !== 0 ||
      file.address + file.size > MAX_FLASH_SIZE
    )
      throw new Error('文件地址重叠、未按 0x1000 对齐或超出 Flash 地址范围');
    end = file.address + Math.ceil(file.size / 4096) * 4096;
  }
}
export function validateManifest(manifest: Manifest) {
  if (
    !chips.includes(manifest.chip) ||
    ![115200, 230400, 460800, 921600].includes(manifest.baudRate)
  )
    throw new Error('不支持的芯片或波特率');
  validateFiles(manifest.files);
  for (const f of manifest.files)
    if (!/^[a-f0-9]{64}$/.test(f.sha256) || !f.path || f.path.includes('..'))
      throw new Error('固件校验信息无效');
}
export async function sha256(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export function formatBytes(n: number) {
  return n >= 1048576
    ? `${(n / 1048576).toFixed(2)} MB`
    : n >= 1024
      ? `${(n / 1024).toFixed(1)} KB`
      : `${n} B`;
}
export function message(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message || '请检查输入';
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return '操作失败，请重试';
}
