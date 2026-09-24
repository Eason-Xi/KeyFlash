'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Package,
  Download,
  Heart,
  ArrowUpRight,
  Upload,
  FileCode2,
  X,
  ArrowLeft,
} from 'lucide-react';
import { listProjects, saveProject, publishRelease, getReleases } from '@/lib/api';
import { db } from '@/lib/supabase';
import { chips, features, deviceTypes, type Project, type Release } from '@/lib/types';
import { parseAddress, message, formatBytes } from '@/lib/validation';
import { useApp } from './providers';
import {
  PageHeading,
  Loading,
  LoginGate,
  ErrorState,
  Empty,
  Tag,
  ProjectIcon,
  DateText,
} from './ui';
export function Dashboard({ editId, create = false }: { editId?: string; create?: boolean }) {
  const { user, authLoading } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listProjects()
      .then((p) => setProjects(p.filter((x) => x.owner_id === user.id)))
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, [user, editId, create]);
  if (authLoading) return <Loading />;
  if (!user) return <LoginGate />;
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const completed = projects.reduce((sum, p) => sum + p.success_count + p.failure_count, 0);
  const successes = projects.reduce((sum, p) => sum + p.success_count, 0);
  const edit = projects.find((p) => p.id === editId);
  if (create) return <ProjectForm />;
  if (editId)
    return edit ? <ProjectManager project={edit} /> : <Empty title="项目不存在或你没有管理权限" />;
  return (
    <div className="page">
      <PageHeading
        eyebrow="DEVELOPER WORKSPACE"
        title="开发者工作台"
        description="把好用的固件，交给更多创造者。"
        action={
          <Link className="button primary" href="/dashboard/projects/new">
            <Plus size={17} />
            创建项目
          </Link>
        }
      />
      <div className="stat-grid dashboard-stats">
        <div>
          <Package size={20} />
          <span>我的项目</span>
          <strong>{projects.length}</strong>
        </div>
        <div>
          <Download size={20} />
          <span>累计烧录</span>
          <strong>{projects.reduce((n, p) => n + p.flash_count, 0).toLocaleString()}</strong>
        </div>
        <div>
          <Heart size={20} />
          <span>获得收藏</span>
          <strong>{projects.reduce((n, p) => n + p.favorite_count, 0).toLocaleString()}</strong>
        </div>
        <div>
          <span>已完成烧录成功率</span>
          <strong>{completed ? `${((successes / completed) * 100).toFixed(1)}%` : '—'}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>我的项目</h2>
          <Tag>{projects.length} 个项目</Tag>
        </div>
        {projects.length ? (
          <div className="managed-projects">
            {projects.map((p) => (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
                <ProjectIcon project={p} />
                <div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.chip} · {p.version ? `v${p.version}` : '等待首个版本'}
                  </p>
                </div>
                <span>
                  管理项目 <ArrowUpRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="从你的第一个项目开始"
            description="介绍你的硬件，上传固件，让社区发现你的作品。"
            action={
              <Link href="/dashboard/projects/new" className="button primary">
                <Plus size={16} />
                创建项目
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
function ProjectForm({ project }: { project?: Project }) {
  const { user, notify } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(project?.features || []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const saved = await saveProject(
        { ...Object.fromEntries(f), features: selected },
        user.id,
        project?.id,
      );
      notify(project ? '项目资料已更新' : '项目已创建，现在可以发布首个固件版本。');
      router.push(project ? '/dashboard' : `/dashboard/projects/${saved.id}`);
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={project ? '' : 'page form-page'}>
      {!project && (
        <Link className="back-link" href="/dashboard">
          <ArrowLeft size={15} />
          返回工作台
        </Link>
      )}
      {!project && (
        <PageHeading title="发布你的创意" description="先介绍项目和兼容硬件，再上传固件版本。" />
      )}
      <form className="panel form" onSubmit={submit}>
        <h2>{project ? '项目资料' : '项目基本信息'}</h2>
        <div className="form-grid">
          <label>
            项目名称
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={project?.name}
              placeholder="如 Open MacroPad"
            />
          </label>
          <label>
            项目标识
            <input
              name="slug"
              required
              minLength={3}
              maxLength={64}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              defaultValue={project?.slug}
              placeholder="open-macropad"
            />
            <small>用于项目网址，仅限小写字母、数字和连字符</small>
          </label>
        </div>
        <label>
          一句话简介
          <textarea
            name="summary"
            required
            minLength={10}
            maxLength={180}
            defaultValue={project?.summary}
            placeholder="这个固件解决什么问题？"
            rows={2}
          />
        </label>
        <label>
          项目介绍
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={12000}
            defaultValue={project?.description}
            placeholder="介绍功能、接线要求、引脚定义、使用方式和已知限制…"
            rows={7}
          />
          <small>支持多行纯文本，内容会原样展示。</small>
        </label>
        <div className="form-grid">
          <label>
            芯片平台
            <select name="chip" defaultValue={project?.chip || 'ESP32-S3'}>
              {chips.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            设备类型
            <select name="device_type" defaultValue={project?.device_type || '宏键盘'}>
              {deviceTypes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            兼容硬件 / PCB 版本
            <input
              name="hardware"
              required
              minLength={2}
              maxLength={200}
              defaultValue={project?.hardware}
              placeholder="8 键双旋钮 / PCB Rev 2.0"
            />
          </label>
          <label>
            项目状态
            <select name="status" defaultValue={project?.status || 'stable'}>
              <option value="stable">稳定版</option>
              <option value="beta">Beta</option>
              <option value="experimental">实验版</option>
              <option value="archived">已停止维护</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>支持的功能</legend>
          <div className="feature-options">
            {features.map((f) => (
              <label className={selected.includes(f) ? 'selected' : ''} key={f}>
                <input
                  type="checkbox"
                  checked={selected.includes(f)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, f] : selected.filter((x) => x !== f),
                    )
                  }
                />
                {f}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label>
            开源协议
            <select name="license" defaultValue={project?.license || 'MIT'}>
              {['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'Proprietary', 'Other'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            GitHub 仓库（选填）
            <input
              type="url"
              name="github_url"
              defaultValue={project?.github_url}
              placeholder="https://github.com/…"
            />
          </label>
        </div>
        <label>
          项目网站（选填）
          <input
            type="url"
            name="website_url"
            defaultValue={project?.website_url}
            placeholder="https://…"
          />
        </label>
        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <span>发布内容将对社区公开。</span>
          <button className="button primary" disabled={busy}>
            {busy ? '保存中…' : project ? '保存项目资料' : '创建项目，继续上传'}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
function ProjectManager({ project: p }: { project: Project }) {
  const [tab, setTab] = useState('versions');
  const [releases, setReleases] = useState<Release[]>([]);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const { notify } = useApp();
  const refresh = () =>
    getReleases(p)
      .then(setReleases)
      .catch((e) => setError(message(e)));
  useEffect(() => {
    getReleases(p)
      .then(setReleases)
      .catch((e) => setError(message(e)));
  }, [p]);
  return (
    <div className="page">
      <Link className="back-link" href="/dashboard">
        <ArrowLeft size={15} />
        返回工作台
      </Link>
      <PageHeading
        title={p.name}
        description={`${p.chip} · ${p.hardware}`}
        action={
          <Link className="button secondary" href={`/project/${p.slug}`}>
            查看项目 <ArrowUpRight size={16} />
          </Link>
        }
      />
      <div className="detail-tabs">
        <button className={tab === 'versions' ? 'active' : ''} onClick={() => setTab('versions')}>
          固件与版本
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          项目资料
        </button>
      </div>
      {tab === 'settings' ? (
        <ProjectForm project={p} />
      ) : (
        <>
          <section className="panel">
            <div className="panel-title">
              <h2>版本管理</h2>
              <button className="button primary small" onClick={() => setShow(!show)}>
                <Plus size={16} />
                发布新版本
              </button>
            </div>
            {error && <div className="field-error">{error}</div>}
            {releases.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>版本</th>
                      <th>状态</th>
                      <th>文件</th>
                      <th>发布时间</th>
                      <th>在线烧录</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releases.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>v{r.version}</strong>
                        </td>
                        <td>
                          <Tag className={`status-${r.channel}`}>{r.channel}</Tag>
                        </td>
                        <td>{r.manifest.files.length} 个文件</td>
                        <td>
                          <DateText value={r.created_at} />
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={async () => {
                              const { error } = await db().rpc('set_release_online', {
                                p_release_id: r.id,
                                p_enabled: !r.online_enabled,
                              });
                              if (error) notify(error.message, true);
                              else {
                                await refresh();
                                notify('烧录开关已更新');
                              }
                            }}
                          >
                            {r.online_enabled ? '已开启 · 点击关闭' : '已关闭 · 点击开启'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="还没有固件版本"
                description="上传 BIN 文件并填写烧录地址，发布你的第一个版本。"
              />
            )}
          </section>
          {show && (
            <ReleaseForm
              project={p}
              onPublished={async () => {
                setShow(false);
                await refresh();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
function ReleaseForm({
  project: p,
  onPublished,
}: {
  project: Project;
  onPublished: () => Promise<void>;
}) {
  const { user, notify } = useApp();
  const [files, setFiles] = useState<{ file: File; address: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await publishRelease(
        p,
        user.id,
        { ...Object.fromEntries(f), online_enabled: f.get('online_enabled') === 'on' },
        files.map((x) => ({ file: x.file, address: parseAddress(x.address) })),
      );
      await onPublished();
      notify('固件版本已发布');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <div className="panel-title">
        <h2>发布固件版本</h2>
        <Tag>{p.chip}</Tag>
      </div>
      <div className="form-grid">
        <label>
          版本号
          <input name="version" required placeholder="1.0.0" maxLength={80} />
        </label>
        <label>
          版本通道
          <select name="channel">
            <option value="stable">稳定版</option>
            <option value="beta">Beta</option>
            <option value="experimental">实验版</option>
          </select>
        </label>
        <label>
          适配硬件
          <input name="hardware" required defaultValue={p.hardware} maxLength={200} />
        </label>
        <label>
          烧录波特率
          <select name="baudRate" defaultValue="460800">
            {[115200, 230400, 460800, 921600].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        更新日志
        <textarea
          name="changelog"
          required
          minLength={10}
          maxLength={12000}
          rows={4}
          placeholder="这个版本带来了哪些功能和修复？"
        />
      </label>
      <label className="upload-zone">
        <Upload size={28} />
        <strong>点击选择 BIN 固件文件</strong>
        <span>最多 8 个文件 · 每个文件不超过 16 MB</span>
        <input
          type="file"
          accept=".bin"
          multiple
          disabled={busy}
          onChange={(e) => {
            const added = Array.from(e.target.files || []);
            setFiles((prev) => [
              ...prev,
              ...added.map((file) => ({
                file,
                address: file.name.includes('bootloader')
                  ? p.chip === 'ESP32'
                    ? '0x1000'
                    : '0x0'
                  : file.name.includes('partition')
                    ? '0x8000'
                    : '0x10000',
              })),
            ]);
            e.target.value = '';
          }}
        />
      </label>
      {files.map((f, i) => (
        <div className="upload-file" key={i}>
          <FileCode2 size={19} />
          <div>
            <strong>{f.file.name}</strong>
            <small>{formatBytes(f.file.size)}</small>
          </div>
          <label>
            地址
            <input
              aria-label={`${f.file.name} 烧录地址`}
              value={f.address}
              disabled={busy}
              onChange={(e) =>
                setFiles(files.map((v, j) => (j === i ? { ...v, address: e.target.value } : v)))
              }
            />
          </label>
          <button
            type="button"
            aria-label={`移除 ${f.file.name}`}
            disabled={busy}
            className="icon-button"
            onClick={() => setFiles(files.filter((_, j) => j !== i))}
          >
            <X size={17} />
          </button>
        </div>
      ))}
      <div className="inline-note">
        地址初始值仅供参考，必须按你的构建产物核对。合并固件通常使用
        0x0。文件发布后不可覆盖，变更请发布新版本。
      </div>
      <label className="checkbox-label">
        <input type="checkbox" name="online_enabled" defaultChecked />
        允许用户在线烧录
      </label>
      {error && (
        <div className="field-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <span>自动生成 Manifest 与 SHA-256</span>
        <button className="button primary" disabled={busy || !files.length}>
          {busy ? '上传并校验中…' : '上传并发布版本'}
          <Upload size={16} />
        </button>
      </div>
    </form>
  );
}
