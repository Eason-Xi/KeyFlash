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
export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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
  }, []);
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
