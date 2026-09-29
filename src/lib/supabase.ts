import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
// 服务端仅用于读取公开数据（如页面标题），不保存会话
const browser = typeof window !== 'undefined';
export const supabase = configured
  ? createClient(url!, key!, {
      auth: { persistSession: browser, autoRefreshToken: browser, detectSessionInUrl: browser },
    })
  : null;
export function db() {
  if (!supabase) throw new Error('当前为示例环境，请先配置 Supabase 后使用此功能。');
  return supabase;
}
export type OAuthProvider = 'github' | 'google';
/** 读取 Supabase Auth 公开设置，判断哪些第三方登录已在服务端启用 */
export async function oauthProviders(): Promise<Record<OAuthProvider, boolean>> {
  const none = { github: false, google: false };
  if (!configured) return none;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } });
    if (!res.ok) return none;
    const { external } = (await res.json()) as { external?: Record<string, boolean> };
    return { github: external?.github === true, google: external?.google === true };
  } catch {
    return none;
  }
}
