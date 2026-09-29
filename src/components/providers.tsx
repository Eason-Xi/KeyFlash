'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, configured } from '@/lib/supabase';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
const Context = createContext<{
  user: User | null;
  authLoading: boolean;
  notify: (text: string, error?: boolean) => void;
}>({ user: null, authLoading: true, notify: () => {} });
// 令牌刷新或切回标签页时 Supabase 会给出新的 user 对象；账号信息未变时沿用旧对象，
// 避免依赖 user 的页面重新加载、清空正在填写的表单
function keepSameUser(prev: User | null, next: User | null) {
  return prev && next && prev.id === next.id && prev.updated_at === next.updated_at ? prev : next;
}
export function Providers({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const setUser = useCallback(
    (next: User | null) => setUserState((prev) => keepSameUser(prev, next)),
    [],
  );
  const [authLoading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let live = true;
    supabase!.auth
      .getUser()
      .then(({ data }) => {
        if (live) {
          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) setLoading(false);
      });
    const { data } = supabase!.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [setUser]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <Context.Provider value={{ user, authLoading, notify }}>
      {children}
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
          <span>{toast.text}</span>
          <button aria-label="关闭提示" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
