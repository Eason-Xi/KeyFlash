'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  Zap,
  SlidersHorizontal,
  X,
  Box,
  Cpu,
  Code2,
} from 'lucide-react';
import { listProjects } from '@/lib/api';
import { configured } from '@/lib/supabase';
import { chips, features, deviceTypes, type Project } from '@/lib/types';
import { message } from '@/lib/validation';
import {
  PageHeading,
  ProjectCard,
  Loading,
  ErrorState,
  Empty,
  Tag,
  DemoNotice,
  statusNames,
} from './ui';
export function Explore() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState('全部芯片');
  const [device, setDevice] = useState('全部设备');
  const [feature, setFeature] = useState('全部功能');
  const [status, setStatus] = useState('全部状态');
  const [sort, setSort] = useState('popular');
  const [advanced, setAdvanced] = useState(false);
  function reload() {
    setLoading(true);
    setError('');
    listProjects()
      .then(setProjects)
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    reload();
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  const filtered = useMemo(
    () =>
      projects
        .filter(
          (p) =>
            (chip === '全部芯片' || p.chip === chip) &&
            (device === '全部设备' || p.device_type === device) &&
            (feature === '全部功能' || p.features.includes(feature)) &&
            (status === '全部状态' || p.status === status) &&
            `${p.name} ${p.author} ${p.summary} ${p.device_type} ${p.hardware} ${p.features.join(' ')}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'rating'
            ? b.rating - a.rating
            : sort === 'favorites'
              ? b.favorite_count - a.favorite_count
              : sort === 'updated'
                ? b.updated_at.localeCompare(a.updated_at)
                : sort === 'newest'
                  ? b.created_at.localeCompare(a.created_at)
                  : b.flash_count - a.flash_count,
        ),
    [projects, chip, device, feature, status, query, sort],
  );
  const active =
    chip !== '全部芯片' ||
    device !== '全部设备' ||
    feature !== '全部功能' ||
    status !== '全部状态' ||
    query;
  return (
    <div className="page explore-page">
      <PageHeading
        eyebrow="THE OPEN FIRMWARE COMMUNITY"
        title="好硬件，值得好固件。"
        description="发现、连接、烧录。让你的下一把键盘，从这里开始。"
        action={
          <Link className="button primary" href="/dashboard/projects/new">
            <PlusIcon />
            发布项目
          </Link>
        }
      />
      {!configured && <DemoNotice />}
      <div className="discovery-banner">
        <div className="banner-main">
          <span className="banner-label">
            <span className="live-dot" /> BUILT FOR MAKERS
          </span>
          <h2>你的键盘，还能做得更多。</h2>
          <p>探索社区固件，直接在浏览器中赋予硬件新的可能。</p>
          <Link href="/guide" className="banner-link">
            了解在线烧录 <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-process">
          <div>
            <span>
              <Box size={24} />
            </span>
            <small>发现固件</small>
          </div>
          <i />
          <div>
            <span>
              <Cpu size={24} />
            </span>
            <small>连接设备</small>
          </div>
          <i />
          <div className="last">
            <span>
              <Zap size={24} />
            </span>
            <small>一键烧录</small>
          </div>
        </div>
        <div className="banner-index">
          01 — 03
          <br />
          <span>IDEA → HARDWARE</span>
        </div>
      </div>
      <section className="catalog">
        <div className="section-title">
          <div>
            <h2>
              探索固件 <span>{projects.length}</span>
            </h2>
            <p>由创造者构建，为每一位玩家开放。</p>
          </div>
          <Link href="/guide">
            支持哪些设备 <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="search-row">
          <div className="search-input">
            <Search size={19} />
            <input
              ref={searchRef}
              aria-label="搜索固件"
              placeholder="搜索项目、作者、设备或功能…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="清除搜索" onClick={() => setQuery('')}>
                <X size={16} />
              </button>
            )}
            <kbd>/</kbd>
          </div>
          <button
            className={`button secondary ${advanced ? 'selected' : ''}`}
            onClick={() => setAdvanced(!advanced)}
            aria-expanded={advanced}
          >
            <SlidersHorizontal size={17} />
            筛选
          </button>
        </div>
        <div className="filter-row">
          <div className="chip-tabs">
            {['全部芯片', ...chips].map((c) => (
              <button className={chip === c ? 'selected' : ''} key={c} onClick={() => setChip(c)}>
                {c === '全部芯片' ? <Cpu size={15} /> : null}
                {c}
              </button>
            ))}
          </div>
          <label className="sort-label">
            排序
            <select aria-label="排序方式" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="popular">最多烧录</option>
              <option value="newest">最新发布</option>
              <option value="updated">最近更新</option>
              <option value="favorites">最多收藏</option>
              <option value="rating">最高评分</option>
            </select>
          </label>
        </div>
        {advanced && (
          <div className="advanced-filters">
            <label>
              设备类型
              <select value={device} onChange={(e) => setDevice(e.target.value)}>
                {['全部设备', ...deviceTypes].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              功能
              <select value={feature} onChange={(e) => setFeature(e.target.value)}>
                {['全部功能', ...features].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              项目状态
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option>全部状态</option>
                {Object.entries(statusNames).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {active && (
          <div className="results-meta">
            找到 {filtered.length} 个项目
            <button
              onClick={() => {
                setQuery('');
                setChip('全部芯片');
                setDevice('全部设备');
                setFeature('全部功能');
                setStatus('全部状态');
              }}
            >
              清除筛选 <X size={12} />
            </button>
          </div>
        )}
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : filtered.length ? (
          <div className="project-grid">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Empty title="没有找到匹配的固件" description="试试其他关键词，或减少筛选条件。" />
        )}
        <div className="catalog-end">
          <span />
          已经看到全部 {filtered.length} 个项目
          <span />
        </div>
      </section>
      <div className="contribute-banner">
        <span className="contribute-icon">
          <Code2 size={25} />
        </span>
        <div>
          <h3>你的下一个作品，也可以在这里。</h3>
          <p>发布固件，分享创意，与社区一起让开源硬件变得更好。</p>
        </div>
        <Link className="button secondary" href="/dashboard/projects/new">
          成为贡献者 <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="support-strip">
        <span>为 ESP32 生态构建</span>
        <Tag>ESP32</Tag>
        <Tag>ESP32-S3</Tag>
        <Tag>ESP32-C3</Tag>
        <span className="support-right">Web Serial 驱动 · Chrome / Edge</span>
      </div>
    </div>
  );
}
function PlusIcon() {
  return <span className="plus-icon">+</span>;
}
