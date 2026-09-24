import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Explore } from '@/components/explore';
import { ProjectDetail } from '@/components/project-detail';
import { Auth } from '@/components/auth';
import { Dashboard } from '@/components/dashboard';
import { Account, Author } from '@/components/account';
import { Guide } from '@/components/guide';
import { Loading } from '@/components/ui';
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
  else if (root === 'user' && id && route.length === 2) view = <Author username={id} />;
  else notFound();
  return <Suspense fallback={<Loading />}>{view}</Suspense>;
}
