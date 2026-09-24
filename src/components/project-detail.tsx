'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Heart,
  Star,
  Zap,
  Download,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  MessageSquare,
  GitBranch,
  Usb,
} from 'lucide-react';
import {
  getProject,
  getReleases,
  getComments,
  getCompatibility,
  getFavorites,
  toggleFavorite,
  getFile,
} from '@/lib/api';
import { db, configured } from '@/lib/supabase';
import type { Project, Release, Comment, Compatibility, FirmwareFile } from '@/lib/types';
import { message, formatBytes, sha256 } from '@/lib/validation';
import { useApp } from './providers';
import { ProjectIcon, Tag, Loading, Empty, ErrorState, statusNames, DateText } from './ui';
import { FlashPanel } from './flash-panel';
export function ProjectDetail({ slug, section = 'overview' }: { slug: string; section?: string }) {
  const { user, notify } = useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reports, setReports] = useState<Compatibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    getProject(slug)
      .then(async (p) => {
        if (!live) return;
        setProject(p);
        if (p) {
          const [r, c, v] = await Promise.all([
            getReleases(p),
            getComments(p),
            getCompatibility(p),
          ]);
          if (live) {
            setReleases(r);
            setComments(c);
            setReports(v);
          }
        }
      })
      .catch((e) => {
        if (live) setError(message(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [slug]);
  useEffect(() => {
    setFavorite(false);
    if (user && project && !project.demo)
      getFavorites(user.id)
        .then((ids) => setFavorite(ids.includes(project.id)))
        .catch((e) => notify(message(e), true));
  }, [user, project, notify]);
  async function fav() {
    if (!user) {
      notify('请先登录后收藏项目', true);
      return;
    }
    setBusy(true);
    try {
      await toggleFavorite(user.id, project!.id, favorite);
      setFavorite(!favorite);
      setProject((p) => (p ? { ...p, favorite_count: p.favorite_count + (favorite ? -1 : 1) } : p));
    } catch (e) {
      notify(message(e), true);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!project)
    return (
      <Empty
        title="项目不存在"
        action={
          <Link className="button secondary" href="/">
            返回发现
          </Link>
        }
      />
    );
  const p = project;
  const stable = releases.find((r) => r.channel === 'stable') || releases[0];
  return (
    <div className="page">
      <Link className="back-link" href="/explore">
        <ArrowLeft size={15} />
        全部固件
      </Link>
      <div className="project-heading">
        <ProjectIcon project={p} large />
        <div>
          <div className="title-inline">
            <h1>{p.name}</h1>
            <Tag className={`status-${p.status}`}>{statusNames[p.status]}</Tag>
            {p.demo && <Tag>示例项目</Tag>}
          </div>
          <p>
            由 <Link href={`/user/${encodeURIComponent(p.author)}`}>{p.author}</Link> 构建{' '}
            <span>·</span> 更新于 <DateText value={p.updated_at} />
          </p>
        </div>
        <button
          disabled={busy}
          className={`button secondary favorite-button ${favorite ? 'selected' : ''}`}
          onClick={fav}
        >
          <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
          {favorite ? '已收藏' : '收藏项目'}
        </button>
      </div>
      <p className="project-summary">{p.summary}</p>
      <div className="project-metrics">
        <span>
          <Star size={17} />
          <strong>{p.rating ? Number(p.rating).toFixed(1) : '暂无'}</strong>社区评分
        </span>
        <span>
          <Download size={17} />
          <strong>{p.flash_count.toLocaleString()}</strong>次烧录
        </span>
        <span>
          <Heart size={17} />
          <strong>{p.favorite_count.toLocaleString()}</strong>收藏
        </span>
        <span>
          <Usb size={17} />
          {p.chip}
        </span>
      </div>
      <nav className="detail-tabs">
        {[
          ['overview', '项目概览'],
          ['versions', '固件版本'],
          ['compatibility', '兼容性验证'],
          ['reviews', '社区评价'],
          ['flash', '在线烧录'],
        ].map(([s, n]) => (
          <Link
            key={s}
            className={section === s ? 'active' : ''}
            href={`/project/${slug}${s === 'overview' ? '' : `/${s}`}`}
          >
            {n}
            {s === 'versions' && <span>{releases.length}</span>}
          </Link>
        ))}
      </nav>
      <div className="detail-layout">
        <div>
          {section === 'flash' ? (
            <FlashPanel project={p} releases={releases} />
          ) : section === 'versions' ? (
            <ReleaseList project={p} releases={releases} />
          ) : section === 'reviews' ? (
            <Reviews
              project={p}
              comments={comments}
              refresh={async () => {
                await Promise.all([
                  getComments(p).then(setComments),
                  getProject(p.slug).then(setProject),
                ]);
              }}
            />
          ) : section === 'compatibility' ? (
            <CompatibilityPanel
              project={p}
              releases={releases}
              reports={reports}
              refresh={() => getCompatibility(p).then(setReports)}
            />
          ) : (
            <>
              <section className="panel prose">
                <div className="panel-title">
                  <h2>关于项目</h2>
                  <Tag>{p.license}</Tag>
                </div>
                <p className="preserve-lines">{p.description}</p>
                <h3>功能特性</h3>
                <div className="feature-grid">
                  {p.features.map((f) => (
                    <div key={f}>
                      <CheckCircle2 size={17} />
                      {f}
                    </div>
                  ))}
                </div>
                <h3>兼容硬件</h3>
                <div className="hardware-box">
                  <Usb size={22} />
                  <div>
                    <strong>{p.hardware}</strong>
                    <p>{p.chip} · 请核对 PCB 版本与引脚定义</p>
                  </div>
                </div>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h2>最新发布</h2>
                  <Link href={`/project/${slug}/versions`}>
                    所有版本 <ArrowRightIcon />
                  </Link>
                </div>
                {stable ? (
                  <ReleaseItem release={stable} project={p} />
                ) : (
                  <Empty
                    title="还没有发布固件"
                    description="作者发布首个版本后，即可下载与烧录。"
                  />
                )}
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h2>社区评价</h2>
                  <Link href={`/project/${slug}/reviews`}>
                    参与讨论 <ArrowRightIcon />
                  </Link>
                </div>
                {comments.length ? (
                  <CommentItem comment={comments[0]} />
                ) : (
                  <p className="muted">还没有评价，分享你的第一手体验。</p>
                )}
              </section>
            </>
          )}
        </div>
        <aside className="detail-aside">
          <div className="panel flash-callout">
            <div className="eyebrow">READY TO FLASH</div>
            <h3>从这里，点亮你的键盘。</h3>
            <p>使用 Chrome 或 Edge，连接设备后即可在浏览器内完成烧录。</p>
            <Link href={`/project/${slug}/flash`} className="button primary full">
              <Zap size={17} />
              在线烧录
            </Link>
            <Link href={`/project/${slug}/versions`} className="button secondary full">
              <Download size={17} />
              下载固件
            </Link>
            {p.demo && <small>示例项目不包含可烧录文件</small>}
          </div>
          <div className="panel metadata">
            <h3>项目信息</h3>
            <dl>
              <dt>芯片平台</dt>
              <dd>{p.chip}</dd>
              <dt>设备类型</dt>
              <dd>{p.device_type}</dd>
              <dt>最新稳定版</dt>
              <dd>{stable ? `v${stable.version}` : '尚未发布'}</dd>
              <dt>开源协议</dt>
              <dd>{p.license}</dd>
              <dt>作者</dt>
              <dd>{p.author}</dd>
            </dl>
            {p.github_url && (
              <a href={p.github_url} target="_blank" rel="noreferrer">
                源代码 <ExternalLink size={14} />
              </a>
            )}
            {p.website_url && (
              <a href={p.website_url} target="_blank" rel="noreferrer">
                项目网站 <ExternalLink size={14} />
              </a>
            )}
          </div>
          <div className="safety-note">
            <ShieldCheck size={21} />
            <div>
              <strong>了解固件，再开始烧录</strong>
              <p>SHA-256 校验保证文件一致性。社区固件由作者提供，请确认来源及硬件兼容性。</p>
              <Link href="/guide">
                阅读烧录指南 <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={14} />;
}
function ReleaseList({ project, releases }: { project: Project; releases: Release[] }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>固件版本</h2>
        <Tag>{releases.length} 个版本</Tag>
      </div>
      {releases.length ? (
        releases.map((r) => <ReleaseItem key={r.id} release={r} project={project} />)
      ) : (
        <Empty title="暂无固件版本" />
      )}
    </section>
  );
}
function ReleaseItem({ release: r, project: p }: { release: Release; project: Project }) {
  const { notify } = useApp();
  const [downloading, setDownloading] = useState('');
  async function download(f: FirmwareFile) {
    setDownloading(f.path);
    try {
      const blob = await getFile(f.path);
      if (blob.size !== f.size || (await sha256(await blob.arrayBuffer())) !== f.sha256)
        throw new Error('文件校验失败，下载已终止');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notify(message(e), true);
    } finally {
      setDownloading('');
    }
  }
  return (
    <article className="release">
      <div className="release-title">
        <GitBranch size={18} />
        <strong>v{r.version}</strong>
        <Tag className={`status-${r.channel}`}>{statusNames[r.channel]}</Tag>
        <DateText value={r.created_at} />
      </div>
      <p className="preserve-lines">{r.changelog}</p>
      <div className="tags">
        <Tag>{r.hardware}</Tag>
        <Tag>{r.manifest.baudRate.toLocaleString()} baud</Tag>
      </div>
      {r.manifest.files.map((f) => (
        <div className="firmware-file" key={f.path}>
          <div>
            <strong>{f.name}</strong>
            <span>
              {formatBytes(f.size)} · 0x{f.address.toString(16)}
            </span>
            <code title={f.sha256}>SHA256 {f.sha256}</code>
          </div>
          <button
            disabled={Boolean(downloading)}
            className="icon-button"
            aria-label={`下载 ${f.name}`}
            onClick={() => download(f)}
          >
            <Download size={18} />
          </button>
        </div>
      ))}
      {!r.manifest.files.length ? (
        <div className="inline-note">示例版本，未提供真实固件文件。</div>
      ) : (
        <Link
          className="button secondary"
          href={`/project/${p.slug}/flash?version=${encodeURIComponent(r.id)}`}
        >
          <Zap size={15} />
          烧录此版本
        </Link>
      )}
    </article>
  );
}
function CommentItem({ comment: c }: { comment: Comment }) {
  return (
    <article className="comment">
      <div className="avatar">{c.author[0]?.toUpperCase()}</div>
      <div>
        <div className="comment-head">
          <strong>{c.author}</strong>
          <DateText value={c.created_at} />
        </div>
        {c.rating && (
          <div className="stars">
            {'★'.repeat(c.rating)}
            {'☆'.repeat(5 - c.rating)}
          </div>
        )}
        <p>{c.body}</p>
        {c.device && <Tag>{c.device}</Tag>}
      </div>
    </article>
  );
}
function Reviews({
  project: p,
  comments,
  refresh,
}: {
  project: Project;
  comments: Comment[];
  refresh: () => Promise<void>;
}) {
  const { user, notify } = useApp();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [device, setDevice] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await db().rpc('submit_review', {
        p_project_id: p.id,
        p_body: body.trim(),
        p_rating: rating,
        p_device: device.trim(),
      });
      if (error) throw error;
      setBody('');
      await refresh();
      notify('评价已提交，感谢分享！');
    } catch (e) {
      notify(message(e), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>
        社区评价 <span className="count">{comments.length}</span>
      </h2>
      <p className="muted">每一份真实体验，都能帮助下一个使用者。</p>
      {user && configured ? (
        <form className="form review-form" onSubmit={submit}>
          <label>
            你的评分
            <div className="rating-input" role="group" aria-label="评分">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-label={`${n} 星`}
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                >
                  <Star size={24} fill={n <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </label>
          <label>
            设备信息
            <input
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              maxLength={200}
              placeholder="如 ESP32-S3 · Windows 11 · Chrome"
            />
          </label>
          <label>
            使用体验
            <textarea
              required
              minLength={5}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="分享你的使用体验、兼容情况或建议…"
            />
          </label>
          <button disabled={busy} className="button primary">
            {busy ? '提交中…' : '发布评价'}
          </button>
        </form>
      ) : (
        <div className="inline-note">
          <Link href="/login">登录</Link>后可以评分和发表评论。{p.demo && ' 当前评价为示例内容。'}
        </div>
      )}
      {comments.length ? (
        comments.map((c) => <CommentItem key={c.id} comment={c} />)
      ) : (
        <Empty title="还没有人评价" description="成为第一个分享使用体验的人。" />
      )}
    </section>
  );
}
export function CompatibilityPanel({
  project: p,
  releases,
  reports,
  refresh,
}: {
  project: Project;
  releases: Release[];
  reports: Compatibility[];
  refresh: () => Promise<void>;
}) {
  const { user, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const successes = reports.filter((r) => r.success).length;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const values = Object.fromEntries(f);
      const { error } = await db()
        .from('compatibility_reports')
        .insert({
          ...values,
          success: f.get('success') === 'true',
          chip: p.chip,
          project_id: p.id,
          user_id: user.id,
        });
      if (error) throw error;
      await refresh();
      setShow(false);
      notify('兼容性结果已记录');
    } catch (e) {
      notify(message(e), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>兼容性验证</h2>
        <button
          className="button small secondary"
          disabled={!releases.length}
          onClick={() => {
            if (!user) {
              notify('请先登录后提交测试结果', true);
              return;
            }
            setShow(!show);
          }}
        >
          提交测试结果
        </button>
      </div>
      <p className="muted">以下为用户报告的结果，硬件版本不同可能影响兼容性。</p>
      <div className="stat-grid compact">
        <div>
          <span>已展示记录</span>
          <strong>{reports.length}</strong>
        </div>
        <div>
          <span>成功报告</span>
          <strong>{successes}</strong>
        </div>
        <div>
          <span>报告成功率</span>
          <strong>
            {reports.length ? `${((successes / reports.length) * 100).toFixed(1)}%` : '—'}
          </strong>
        </div>
      </div>
      {show && (
        <form className="form inset-form" onSubmit={submit}>
          <div className="form-grid">
            <label>
              固件版本
              <select name="version_id" required>
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    v{r.version}
                  </option>
                ))}
              </select>
            </label>
            <label>
              烧录结果
              <select name="success">
                <option value="true">成功</option>
                <option value="false">失败</option>
              </select>
            </label>
            <label>
              PCB / 键盘型号
              <input name="hardware" required maxLength={200} defaultValue={p.hardware} />
            </label>
            <label>
              操作系统
              <select name="os">
                {['Windows 11', 'Windows 10', 'macOS', 'Linux', '其他'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              浏览器
              <select name="browser">
                <option>Chrome</option>
                <option>Edge</option>
                <option>其他</option>
              </select>
            </label>
            <label>
              USB 芯片
              <input name="usb_chip" maxLength={100} placeholder="原生 USB / CH340 / CP2102" />
            </label>
            {[
              ['bluetooth', '蓝牙'],
              ['rgb', 'RGB'],
              ['encoder', '旋钮'],
            ].map(([n, l]) => (
              <label key={n}>
                {l}
                <select name={n}>
                  <option>未测试</option>
                  <option>正常</option>
                  <option>异常</option>
                  <option>不支持</option>
                </select>
              </label>
            ))}
          </div>
          <label>
            备注
            <textarea name="notes" maxLength={2000} placeholder="描述成功步骤或失败现象…" />
          </label>
          <button disabled={busy} className="button primary">
            {busy ? '保存中…' : '提交兼容性结果'}
          </button>
        </form>
      )}
      {reports.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>设备 / 芯片</th>
                <th>环境 / 版本</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.hardware}</strong>
                    <small>
                      {r.chip} · {r.usb_chip || 'USB 未填写'}
                    </small>
                    <small>
                      蓝牙 {r.bluetooth} · RGB {r.rgb} · 旋钮 {r.encoder}
                    </small>
                    {r.notes && <small>{r.notes}</small>}
                  </td>
                  <td>
                    {r.os} / {r.browser}
                    <small>
                      v{releases.find((v) => v.id === r.version_id)?.version || '未知版本'} ·{' '}
                      <DateText value={r.created_at} />
                    </small>
                  </td>
                  <td>
                    <Tag className={r.success ? 'status-stable' : 'status-experimental'}>
                      {r.success ? '成功' : '失败'}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="等待首份兼容性报告" description="完成烧录后，帮助社区记录你的设备表现。" />
      )}
    </section>
  );
}
