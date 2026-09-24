'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, ArrowRight, Mail, LockKeyhole } from 'lucide-react';
import { db, configured } from '@/lib/supabase';
import { useApp } from './providers';
import { message } from '@/lib/validation';
export function Auth() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'update'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useApp();
  const router = useRouter();
  useEffect(() => {
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
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const email = String(f.get('email'));
      const password = String(f.get('password'));
      if (mode === 'reset') {
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
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;
        if (data.session) router.push('/dashboard');
        else setSuccess('注册请求已提交，请查收邮箱中的确认链接。');
      } else {
        const { error } = await db().auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
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
              <Link className="button primary" href="/dashboard">
                进入工作台 <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
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
            {mode !== 'update' && (
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
            {mode !== 'reset' && (
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
                      : '登录'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        <div className="auth-switch">
          <button
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setError('');
              setSuccess('');
            }}
          >
            {mode === 'signup' ? '已有账号？登录' : '还没有账号？免费注册'}
          </button>
          {mode === 'login' && <button onClick={() => setMode('reset')}>忘记密码</button>}
          {mode === 'reset' && <button onClick={() => setMode('login')}>返回登录</button>}
        </div>
        <Link className="back-link" href="/">
          先逛逛社区 →
        </Link>
      </section>
    </div>
  );
}
