'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Heart,
  Terminal,
  BookOpen,
  Plus,
  ArrowUpRight,
  Zap,
  LayoutGrid,
  Menu,
  X,
  LogOut,
  Keyboard,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from './providers';
import type { User } from '@supabase/supabase-js';
// 与 private.on_signup 取昵称的顺序一致：GitHub 给 user_name，Google 给 name
function displayName(user: User) {
  const m = user.user_metadata ?? {};
  return (
    m.username ||
    m.user_name ||
    m.preferred_username ||
    m.name ||
    m.full_name ||
    user.email?.split('@')[0] ||
    'U'
  );
}
import { supabase } from '@/lib/supabase';
import { useLoginHref } from './ui';
const links = [
  { href: '/explore', name: '发现固件', icon: Compass },
  { href: '/favorites', name: '我的收藏', icon: Heart },
  { href: '/history', name: '烧录记录', icon: Terminal },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, notify } = useApp();
  const [open, setOpen] = useState(false);
  const loginHref = useLoginHref();
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Zap size={23} fill="currentColor" />
          </span>
          KeyFlash<span className="brand-beta">BETA</span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="关闭导航"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="nav-section-label">工作空间</div>
        <nav>
          {links.map(({ href, name, icon: Icon }) => (
            <Link
              onClick={() => setOpen(false)}
              className={`nav-item ${path === href || (href === '/explore' && path === '/') || (href === '/explore' && path.startsWith('/project/')) ? 'active' : ''}`}
              key={href}
              href={href}
            >
              <Icon size={19} />
              {name}
              {href === '/explore' && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="nav-section-label">开发者</div>
        <Link
          onClick={() => setOpen(false)}
          href="/dashboard"
          className={`nav-item ${path.startsWith('/dashboard') ? 'active' : ''}`}
        >
          <LayoutGrid size={19} />
          开发者工作台
        </Link>
        <Link onClick={() => setOpen(false)} href="/dashboard/projects/new" className="nav-item">
          <Plus size={19} />
          发布项目
        </Link>
        <div className="sidebar-bottom">
          <div className="side-guide">
            <span className="tiny-icon">
              <Keyboard size={20} />
            </span>
            <strong>第一次烧录？</strong>
            <p>
              从连接设备到点亮键盘，
              <br />
              只需简单几步。
            </p>
            <Link onClick={() => setOpen(false)} href="/guide">
              查看入门指南 <ArrowUpRight size={16} />
            </Link>
          </div>
          <Link onClick={() => setOpen(false)} href="/guide" className="nav-item">
            <BookOpen size={18} />
            文档与帮助
            <ArrowUpRight size={14} />
          </Link>
          <div className="sidebar-footer">
            <span className="live-dot" />
            为开源硬件而生<span>v0.1</span>
          </div>
        </div>
      </aside>
      {open && (
        <button className="nav-backdrop" aria-label="关闭导航" onClick={() => setOpen(false)} />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="打开导航"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>社区</span>
            <ChevronRight size={14} />
            <strong>
              {path.startsWith('/dashboard')
                ? '开发者工作台'
                : path === '/favorites'
                  ? '我的收藏'
                  : path === '/history'
                    ? '烧录记录'
                    : path === '/guide'
                      ? '烧录指南'
                      : path === '/privacy'
                        ? '隐私政策'
                        : path === '/terms'
                          ? '服务条款'
                          : path === '/login'
                            ? '账号'
                            : path.startsWith('/user/')
                              ? '创作者主页'
                              : '发现固件'}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="open-source">OPEN HARDWARE. OPEN POSSIBILITIES.</span>
            {user ? (
              <>
                <Link className="user-chip" href="/dashboard">
                  <span>{displayName(user)[0].toUpperCase()}</span>
                  {displayName(user)}
                </Link>
                <button
                  className="icon-button"
                  aria-label="退出登录"
                  onClick={async () => {
                    const { error } = await supabase!.auth.signOut();
                    if (error) notify(error.message, true);
                  }}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <Link className="button small secondary" href={loginHref}>
                登录 / 注册 <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="main-footer">
          <span>© {new Date().getFullYear()} KeyFlash</span>
          <span>把创意写进硬件。</span>
          <span className="footer-links">
            <Link href="/privacy">隐私政策</Link>
            <Link href="/terms">服务条款</Link>
            <Link href="/guide">
              使用指南 <ArrowUpRight size={12} />
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
