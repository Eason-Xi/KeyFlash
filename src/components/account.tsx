'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listProjects, getFavorites, getHistory } from '@/lib/api';
import type { Project, FlashSession } from '@/lib/types';
import { message } from '@/lib/validation';
import { useApp } from './providers';
import {
  PageHeading,
  ProjectCard,
  Loading,
  LoginGate,
  Empty,
  ErrorState,
  Tag,
  DateText,
} from './ui';
export function Account({ kind }: { kind: 'favorites' | 'history' }) {
  const { user, authLoading } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<FlashSession[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      listProjects(),
      kind === 'favorites' ? getFavorites(user.id) : getHistory(user.id),
    ])
      .then(([all, items]) => {
        if (kind === 'favorites')
          setProjects(all.filter((p) => (items as string[]).includes(p.id)));
        else {
          setProjects(all);
          setHistory(items as FlashSession[]);
        }
      })
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, [user, kind]);
  if (authLoading) return <Loading />;
  if (!user) return <LoginGate />;
  return (
    <div className="page">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title={kind === 'favorites' ? '我的收藏' : '烧录记录'}
        description={
          kind === 'favorites'
            ? '把喜欢的项目留在手边，随时继续探索。'
            : '每一次连接，都是一次新的可能。'
        }
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : kind === 'favorites' ? (
        projects.length ? (
          <div className="project-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Empty
            title="还没有收藏项目"
            action={
              <Link className="button primary" href="/explore">
                去发现固件
              </Link>
            }
          />
        )
      ) : history.length ? (
        <section className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>项目 / 芯片</th>
                <th>烧录结果</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const p = projects.find((p) => p.id === h.project_id);
                return (
                  <tr key={h.id}>
                    <td>
                      {p ? <Link href={`/project/${p.slug}`}>{p.name}</Link> : '项目不可用'}
                      <small>
                        {h.chip} · v{h.firmware_versions?.version || '未知版本'}
                      </small>
                    </td>
                    <td>
                      <Tag
                        className={
                          h.status === 'success'
                            ? 'status-stable'
                            : h.status === 'failed'
                              ? 'status-experimental'
                              : ''
                        }
                      >
                        {h.status === 'success'
                          ? '烧录成功'
                          : h.status === 'failed'
                            ? '烧录失败'
                            : '未完成'}
                      </Tag>
                      {h.error && <small>{h.error}</small>}
                    </td>
                    <td>
                      <DateText value={h.created_at} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <Empty
          title="还没有烧录记录"
          description="完成首次在线烧录后，记录会显示在这里。"
          action={
            <Link className="button primary" href="/explore">
              发现固件
            </Link>
          }
        />
      )}
    </div>
  );
}
export function Author({ username }: { username: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    listProjects()
      .then((p) => setProjects(p.filter((x) => x.author === username)))
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, [username]);
  return (
    <div className="page">
      <PageHeading
        eyebrow="COMMUNITY MAKER"
        title={username}
        description={`${projects.length} 个公开项目 · 与社区分享创造的乐趣`}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : projects.length ? (
        <div className="project-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Empty title="暂无公开项目" />
      )}
    </div>
  );
}
