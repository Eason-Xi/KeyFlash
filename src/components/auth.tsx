'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, ArrowRight } from 'lucide-react';
import { db, configured, oauthProviders, type OAuthProvider } from '@/lib/supabase';
import { useApp } from './providers';
import { message, safeNext } from '@/lib/validation';
// lucide 不再提供品牌图标，这里内联 GitHub / Google 标志
function GitHubMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
const providerLabels: { id: OAuthProvider; name: string; icon: () => React.ReactElement }[] = [
  { id: 'github', name: 'GitHub', icon: GitHubMark },
  { id: 'google', name: 'Google', icon: GoogleMark },
];
export function Auth() {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState('');
  // null 表示仍在读取服务端已启用的登录方式
  const [enabled, setEnabled] = useState<Record<OAuthProvider, boolean> | null>(null);
  const [fromOAuth, setFromOAuth] = useState(false);
  const { user } = useApp();
  const router = useRouter();
  const [next, setNext] = useState('/dashboard');
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setNext(safeNext(search.get('next')));
    if (search.get('oauth') === '1') {
      setFromOAuth(true);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (search.get('error') || hash.get('error')) setError('登录未完成，请重试');
    }
    oauthProviders().then(setEnabled);
  }, []);
  // 授权回跳后会话由 detectSessionInUrl 自动建立，直接前往原本要去的页面
  useEffect(() => {
    if (user && fromOAuth) router.replace(next);
  }, [user, fromOAuth, next, router]);
  async function signIn(provider: OAuthProvider) {
    setError('');
    setBusy(provider);
    const { error } = await db().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}&oauth=1`,
      },
    });
    // 成功时浏览器会跳转到第三方授权页，保持 busy 防止重复点击
    if (error) {
      setError(message(error));
      setBusy(null);
    }
  }
  // 示例环境仍展示按钮（禁用），让页面结构与正式环境一致
  const visible = providerLabels.filter((p) => !configured || enabled?.[p.id]);
  return (
    <div className="auth-page">
      <div className="auth-story">
        <span className="brand-mark">
          <Zap fill="currentColor" />
        </span>
        <div className="eyebrow">A HOME FOR YOUR HARDWARE</div>
        <h1>
          创造的乐趣，
          <br />
          从一次连接开始。
        </h1>
        <p>
          加入 KeyFlash，发现好固件，分享你的作品，
          <br />
          与社区一起探索硬件的更多可能。
        </p>
        <div className="auth-facts">
          <span>开源固件</span>
          <span>在线烧录</span>
          <span>社区验证</span>
        </div>
      </div>
      <section className="auth-card">
        <h2>欢迎来到 KeyFlash</h2>
        <p>使用 GitHub 或 Google 账号登录，首次登录会自动创建账号。</p>
        {!configured && <div className="notice">当前为示例环境，配置 Supabase 后即可登录。</div>}
        {user ? (
          <div className="success-box">
            <div>
              <strong>你已登录</strong>
              <p>{user.email}</p>
              <Link className="button primary" href={next}>
                {next === '/dashboard' ? '进入工作台' : '继续'} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="auth-providers">
            {visible.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className="button secondary full"
                disabled={!configured || busy !== null}
                onClick={() => signIn(id)}
              >
                <Icon /> {busy === id ? '正在跳转…' : `使用 ${name} 登录`}
              </button>
            ))}
            {configured && enabled && !visible.length && (
              <div className="notice">登录服务暂未开放，请稍后再试。</div>
            )}
            {error && (
              <div className="field-error" role="alert">
                {error}
              </div>
            )}
          </div>
        )}
        <p className="auth-terms">
          登录即表示你同意 <Link href="/terms">服务条款</Link> 和{' '}
          <Link href="/privacy">隐私政策</Link>。
        </p>
        <Link className="back-link" href="/">
          先逛逛社区 →
        </Link>
      </section>
    </div>
  );
}
