'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, ArrowRight, Mail, LockKeyhole, KeyRound } from 'lucide-react';
import { db, configured, githubEnabled } from '@/lib/supabase';
import { useApp } from './providers';
import { message, safeNext, otpCode } from '@/lib/validation';
type Mode = 'login' | 'signup' | 'reset' | 'update' | 'otp';
// lucide 不再提供品牌图标，这里内联 GitHub 标志
function GitHubMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
export function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // 验证码登录第二步：已发送验证码的邮箱
  const [otpEmail, setOtpEmail] = useState('');
  const [github, setGithub] = useState(false);
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
      if (search.get('error') || hash.get('error')) setError('GitHub 登录未完成，请重试');
    }
    githubEnabled().then(setGithub);
    if (
      window.location.hash.includes('type=recovery') ||
      new URLSearchParams(window.location.search).get('mode') === 'recovery'
    )
      setMode('update');
    if (!configured) return;
    const { data } = db().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update');
    });
    return () => data.subscription.unsubscribe();
  }, []);
  // GitHub 授权回跳后会话由 detectSessionInUrl 自动建立，直接前往原本要去的页面
  useEffect(() => {
    if (user && fromOAuth) router.replace(next);
  }, [user, fromOAuth, next, router]);
  function switchTo(m: Mode) {
    setMode(m);
    setOtpEmail('');
    setError('');
    setSuccess('');
  }
  async function signInWithGitHub() {
    setError('');
    setBusy(true);
    const { error } = await db().auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}&oauth=1`,
      },
    });
    // 成功时浏览器会跳转到 GitHub，保持 busy 防止重复点击
    if (error) {
      setError(message(error));
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const email = String(f.get('email'));
      const password = String(f.get('password'));
      if (mode === 'otp' && !otpEmail) {
        const { error } = await db().auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setOtpEmail(email);
        setSuccess(`验证码已发送至 ${email}，10 分钟内有效。`);
      } else if (mode === 'otp') {
        const token = otpCode.parse(String(f.get('token')));
        const { error } = await db().auth.verifyOtp({ email: otpEmail, token, type: 'email' });
        if (error) throw error;
        router.push(next);
      } else if (mode === 'reset') {
        const { error } = await db().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?mode=recovery`,
        });
        if (error) throw error;
        setSuccess('如果该邮箱已注册，你将收到重置密码邮件。');
      } else if (mode === 'update') {
        const { error } = await db().auth.updateUser({ password });
        if (error) throw error;
        setSuccess('密码已更新，可以前往工作台。');
      } else if (mode === 'signup') {
        const { error, data } = await db().auth.signUp({
          email,
          password,
          options: {
            data: { username: String(f.get('username')) },
            emailRedirectTo: `${window.location.origin}/login${next === '/dashboard' ? '' : `?next=${encodeURIComponent(next)}`}`,
          },
        });
        if (error) throw error;
        if (data.session) router.push(next);
        else setSuccess('注册请求已提交，请查收邮箱中的确认链接。');
      } else {
        const { error } = await db().auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
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
        <h2>
          {mode === 'signup'
            ? '创建你的账号'
            : mode === 'reset'
              ? '找回密码'
              : mode === 'update'
                ? '设置新密码'
                : mode === 'otp'
                  ? '验证码登录'
                  : '欢迎回来'}
        </h2>
        <p>{mode === 'signup' ? '让你的创意在社区中生长。' : '继续你的下一次硬件探索。'}</p>
        {!configured && (
          <div className="notice">当前为示例环境，配置 Supabase 后即可注册与登录。</div>
        )}
        {user && mode !== 'update' ? (
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
          <>
            {github && (mode === 'login' || mode === 'signup' || mode === 'otp') && (
              <>
                <button
                  type="button"
                  className="button secondary full"
                  disabled={busy}
                  onClick={signInWithGitHub}
                >
                  <GitHubMark /> 使用 GitHub {mode === 'signup' ? '注册' : '登录'}
                </button>
                <div className="auth-divider">或</div>
              </>
            )}
            <form className="form" onSubmit={submit}>
              {mode === 'signup' && (
                <label>
                  昵称
                  <input
                    name="username"
                    required
                    minLength={2}
                    maxLength={40}
                    autoComplete="nickname"
                    placeholder="怎么称呼你？"
                  />
                </label>
              )}
              {mode !== 'update' && !(mode === 'otp' && otpEmail) && (
                <label>
                  邮箱
                  <div className="input-icon">
                    <Mail size={17} />
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </div>
                </label>
              )}
              {mode === 'otp' && otpEmail && (
                <label>
                  验证码
                  <div className="input-icon">
                    <KeyRound size={17} />
                    <input
                      name="token"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      placeholder="6 位数字"
                      autoFocus
                    />
                  </div>
                </label>
              )}
              {mode !== 'reset' && mode !== 'otp' && (
                <label>
                  密码
                  <div className="input-icon">
                    <LockKeyhole size={17} />
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      maxLength={72}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      placeholder="至少 8 位字符"
                    />
                  </div>
                </label>
              )}
              {error && (
                <div className="field-error" role="alert">
                  {error}
                </div>
              )}
              {success && (
                <div className="success-text" role="status">
                  {success}
                </div>
              )}
              <button disabled={busy || !configured} className="button primary full">
                {busy
                  ? '请稍候…'
                  : mode === 'signup'
                    ? '注册账号'
                    : mode === 'reset'
                      ? '发送重置邮件'
                      : mode === 'update'
                        ? '更新密码'
                        : mode === 'otp'
                          ? otpEmail
                            ? '验证并登录'
                            : '发送验证码'
                          : '登录'}
                <ArrowRight size={16} />
              </button>
            </form>
          </>
        )}
        <div className="auth-switch">
          <button onClick={() => switchTo(mode === 'signup' ? 'login' : 'signup')}>
            {mode === 'signup' ? '已有账号？登录' : '还没有账号？免费注册'}
          </button>
          {mode === 'login' && <button onClick={() => switchTo('otp')}>用验证码登录</button>}
          {mode === 'login' && <button onClick={() => switchTo('reset')}>忘记密码</button>}
          {mode === 'otp' && otpEmail && (
            <button onClick={() => switchTo('otp')}>重新发送 / 换个邮箱</button>
          )}
          {mode === 'otp' && <button onClick={() => switchTo('login')}>用密码登录</button>}
          {mode === 'reset' && <button onClick={() => switchTo('login')}>返回登录</button>}
        </div>
        <Link className="back-link" href="/">
          先逛逛社区 →
        </Link>
      </section>
    </div>
  );
}
