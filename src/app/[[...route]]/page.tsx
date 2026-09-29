import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/api';
import { Explore } from '@/components/explore';
import { ProjectDetail } from '@/components/project-detail';
import { Auth } from '@/components/auth';
import { Dashboard } from '@/components/dashboard';
import { Account, Author } from '@/components/account';
import { Guide } from '@/components/guide';
import { Privacy, Terms } from '@/components/legal';
import { Loading } from '@/components/ui';
type Props = { params: Promise<{ route?: string[] }> };
const titles: Record<string, string> = {
  explore: '发现固件',
  projects: '发现固件',
  login: '登录 / 注册',
  guide: '烧录指南',
  privacy: '隐私政策',
  terms: '服务条款',
  dashboard: '开发者工作台',
  favorites: '我的收藏',
  history: '烧录记录',
};
const sectionTitles: Record<string, string> = {
  versions: '固件版本',
  flash: '在线烧录',
  reviews: '社区评价',
  compatibility: '兼容性验证',
};
// 动态路由参数保持 URL 编码，中文昵称需要解码；非法编码按原样处理
function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { route = [] } = await params;
  const [root, id, section] = route;
  if (!root) return {};
  if (root === 'user' && id) return { title: decode(id) };
  if (root === 'project' && id) {
    // 标题获取失败不影响页面本身，页面组件会自行展示错误或不存在状态
    const project = await getProject(id).catch(() => null);
    if (!project) return { title: '项目' };
    const suffix = section && sectionTitles[section];
    return {
      title: suffix ? `${project.name} · ${suffix}` : project.name,
      description: project.summary,
    };
  }
  return titles[root] ? { title: titles[root] } : {};
}
export default async function Page({ params }: { params: Promise<{ route?: string[] }> }) {
  const { route = [] } = await params;
  const [root, id, section, fourth] = route;
  let view;
  if (!root || (['explore', 'projects'].includes(root) && route.length === 1)) view = <Explore />;
  else if (
    root === 'project' &&
    id &&
    route.length <= 3 &&
    (!section || ['versions', 'flash', 'reviews', 'compatibility'].includes(section))
  )
    view = <ProjectDetail slug={id} section={section} />;
  else if (root === 'login' && route.length === 1) view = <Auth />;
  else if (root === 'guide' && route.length === 1) view = <Guide />;
  else if (root === 'privacy' && route.length === 1) view = <Privacy />;
  else if (root === 'terms' && route.length === 1) view = <Terms />;
  else if (root === 'dashboard' && route.length === 1) view = <Dashboard />;
  else if (
    root === 'dashboard' &&
    id === 'projects' &&
    (!fourth || fourth === 'versions') &&
    route.length <= 4
  )
    view = (
      <Dashboard editId={section !== 'new' ? section : undefined} create={section === 'new'} />
    );
  else if ((root === 'favorites' || root === 'history') && route.length === 1)
    view = <Account kind={root} />;
  else if (root === 'user' && id && route.length === 2) view = <Author username={decode(id)} />;
  else notFound();
  return <Suspense fallback={<Loading />}>{view}</Suspense>;
}
