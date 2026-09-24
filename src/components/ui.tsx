'use client';
import Link from 'next/link';
import {
  ArrowUpRight,
  Star,
  Download,
  Keyboard,
  SlidersHorizontal,
  Disc3,
  Music2,
  Columns3,
  Grid2X2,
  Search,
  LoaderCircle,
  Heart,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import type { Project } from '@/lib/types';
import type { ReactNode } from 'react';
export const statusNames = {
  stable: '稳定版',
  beta: 'Beta',
  experimental: '实验版',
  archived: '已归档',
};
export function ProjectIcon({ project, large = false }: { project: Project; large?: boolean }) {
  const Icon =
    project.device_type === '旋钮键盘'
      ? Disc3
      : project.device_type === 'MIDI 控制器'
        ? Music2
        : project.device_type === 'Stream Deck'
          ? Grid2X2
          : project.device_type === '普通键盘'
            ? Columns3
            : Keyboard;
  return (
    <span className={`project-icon ${project.color || 'orange'} ${large ? 'large' : ''}`}>
      <Icon size={large ? 40 : 27} strokeWidth={1.6} />
    </span>
  );
}
export function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`tag ${className}`}>{children}</span>;
}
export function ProjectCard({ project: p }: { project: Project }) {
  return (
    <Link className="project-card" href={`/project/${p.slug}`}>
      <div className="card-top">
        <ProjectIcon project={p} />
        <Tag className={`status-${p.status}`}>{statusNames[p.status]}</Tag>
      </div>
      <div className="card-title">
        <h3>{p.name}</h3>
        <ArrowUpRight size={17} />
      </div>
      <div className="byline">
        by {p.author} <span>·</span> v{p.version || '尚未发布'}
      </div>
      <p>{p.summary}</p>
      <div className="tags">
        <Tag className="chip">{p.chip}</Tag>
        {p.features.slice(0, 2).map((f) => (
          <Tag key={f}>{f}</Tag>
        ))}
      </div>
      <div className="card-bottom">
        <span>
          <Star size={14} />
          {p.rating ? Number(p.rating).toFixed(1) : '暂无'}
        </span>
        <span>
          <Download size={14} />
          {Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
            p.flash_count,
          )}
        </span>
        <span>
          <Heart size={14} />
          {Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
            p.favorite_count,
          )}
        </span>
        <span className="card-device">{p.device_type}</span>
      </div>
    </Link>
  );
}
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" />
      <p>正在加载…</p>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Search size={30} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="empty">
      <AlertCircle size={30} />
      <h3>暂时无法加载</h3>
      <p>{error}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          重新加载
        </button>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function LoginGate() {
  return (
    <Empty
      title="登录后继续"
      description="登录账号，管理你的项目、收藏和烧录记录。"
      action={
        <Link className="button primary" href="/login">
          登录 / 注册 <ArrowRight size={16} />
        </Link>
      }
    />
  );
}
export function DemoNotice() {
  return (
    <div className="notice">
      <SlidersHorizontal size={17} />
      <span>示例环境 · 当前内容用于预览，连接 Supabase 后即可启用账号、发布与社区功能。</span>
    </div>
  );
}
export function DateText({ value }: { value: string }) {
  return <time dateTime={value}>{value.slice(0, 10).replaceAll('-', '.')}</time>;
}
