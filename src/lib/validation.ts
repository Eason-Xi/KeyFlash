import { z } from 'zod';
import {
  chips,
  features,
  deviceTypes,
  projectColors,
  type FirmwareFile,
  type Manifest,
} from './types';
// 未在 schema 中单独指定文案时，使用简洁的中文提示；字段名由 message() 统一补全
z.config({
  customError: (issue) => {
    if (issue.code === 'too_small')
      return issue.origin === 'string'
        ? `至少需要 ${issue.minimum} 个字符`
        : issue.origin === 'array'
          ? `至少选择 ${issue.minimum} 项`
          : `不能小于 ${issue.minimum}`;
    if (issue.code === 'too_big')
      return issue.origin === 'string'
        ? `最多 ${issue.maximum} 个字符`
        : issue.origin === 'array'
          ? `最多选择 ${issue.maximum} 项`
          : `不能大于 ${issue.maximum}`;
    if (issue.code === 'invalid_value') return '请选择有效的选项';
    if (issue.code === 'invalid_type') return '缺少必填内容';
    return '格式不正确';
  },
});
const fieldNames: Record<string, string> = {
  name: '项目名称',
  slug: '项目标识',
  summary: '一句话简介',
  description: '项目介绍',
  chip: '芯片平台',
  device_type: '设备类型',
  features: '支持的功能',
  hardware: '兼容硬件',
  license: '开源协议',
  github_url: 'GitHub 仓库',
  website_url: '项目网站',
  status: '项目状态',
  color: '卡片颜色',
  version: '版本号',
  channel: '版本通道',
  changelog: '更新日志',
  baudRate: '烧录波特率',
};
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
  color: z.enum(projectColors).default('orange'),
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
// 数据库唯一约束 → 面向用户的提示
const uniqueMessages: [RegExp, string][] = [
  [/projects_slug_key/, '项目标识已被使用，请换一个'],
  [/firmware_versions_project_id_version_key/, '该版本号已发布过，请使用新的版本号'],
  [/favorites_pkey/, '已经收藏过这个项目'],
  [/profiles_username/, '该昵称已被使用，请换一个'],
];
// 数据库触发器 / RPC 抛出的英文异常 → 中文
const raisedMessages: Record<string, string> = {
  'A project with releases cannot change its chip': '已有发布版本的项目不能更换芯片平台',
  'Invalid chip or baud rate': '固件芯片或波特率无效',
  'Expected 1-8 BIN files': '请上传 1–8 个 BIN 文件',
  'Invalid or overlapping flash range': '文件地址重叠、未按 0x1000 对齐或超出 Flash 地址范围',
  'Firmware not uploaded or size mismatch': '固件文件未上传完成或大小不一致，请重新发布',
  'File must belong to this release': '固件文件路径与版本不匹配',
  'Release not found or access denied': '版本不存在或你没有管理权限',
  'Login required': '请先登录',
};
// Supabase Auth 错误码 → 中文
const authMessages: Record<string, string> = {
  invalid_credentials: '邮箱或密码错误',
  email_not_confirmed: '邮箱尚未验证，请先点击确认邮件中的链接',
  user_already_exists: '该邮箱已注册，请直接登录',
  email_exists: '该邮箱已注册，请直接登录',
  weak_password: '密码强度不足，请使用更长或更复杂的密码',
  same_password: '新密码不能与旧密码相同',
  over_email_send_rate_limit: '邮件发送过于频繁，请稍后再试',
  over_request_rate_limit: '请求过于频繁，请稍后再试',
  session_not_found: '登录已过期，请重新登录',
  signup_disabled: '当前暂未开放注册',
};
export function message(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    if (!issue) return '请检查输入';
    const field = fieldNames[String(issue.path[0])];
    return field && !issue.message.startsWith(field) ? `${field}：${issue.message}` : issue.message;
  }
  if (!error || typeof error !== 'object') return '操作失败，请重试';
  const e = error as { code?: unknown; message?: unknown; status?: unknown; name?: unknown };
  const text = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  if (code === '23505') {
    const hit = uniqueMessages.find(([pattern]) => pattern.test(text));
    return hit ? hit[1] : '内容已存在，请勿重复提交';
  }
  if (code === '42501' || /row-level security|permission denied/i.test(text))
    return '没有权限执行此操作，请确认登录状态或项目归属';
  if (code === '23514') return '提交的内容不符合长度或格式要求';
  if (code === '23503') return '关联的项目或版本不存在，请刷新后重试';
  if (code === 'PGRST301' || code === 'PGRST303') return '登录已过期，请重新登录';
  if (authMessages[code]) return authMessages[code];
  if (raisedMessages[text]) return raisedMessages[text];
  if (text === 'Invalid login credentials') return authMessages.invalid_credentials;
  if (e.status === 429) return '请求过于频繁，请稍后再试';
  if (e.name === 'TypeError' && /fetch|network|load failed/i.test(text))
    return '网络连接失败，请检查网络后重试';
  return text || '操作失败，请重试';
}
/** 只允许站内相对路径作为登录后的回跳地址，防止开放重定向 */
export function safeNext(value: string | null | undefined, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return fallback;
  if (value === '/login' || value.startsWith('/login?') || /[\u0000-\u001f]/.test(value))
    return fallback;
  return value;
}
