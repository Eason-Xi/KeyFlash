import { db, configured } from './supabase';
import { demoProjects, demoReleases, demoComments, demoCompatibility } from './demo';
import type { Project, Release, Comment, Compatibility, FlashSession } from './types';
import { projectSchema, releaseSchema, validateFiles, sha256 } from './validation';
export type ProjectFilter = { ownerId?: string; ids?: string[]; author?: string };
export async function listProjects(filter: ProjectFilter = {}): Promise<Project[]> {
  if (filter.ids && !filter.ids.length) return [];
  if (!configured)
    return demoProjects.filter(
      (p) =>
        (!filter.ownerId || p.owner_id === filter.ownerId) &&
        (!filter.ids || filter.ids.includes(p.id)) &&
        (!filter.author || p.author === filter.author),
    );
  let q = db().from('project_catalog').select('*');
  if (filter.ownerId) q = q.eq('owner_id', filter.ownerId);
  if (filter.ids) q = q.in('id', filter.ids);
  if (filter.author) q = q.eq('author', filter.author);
  const { data, error } = await q.order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function getProject(slug: string) {
  if (!configured) return demoProjects.find((p) => p.slug === slug) || null;
  const { data, error } = await db()
    .from('project_catalog')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data as Project | null;
}
export async function getReleases(p: Project): Promise<Release[]> {
  if (p.demo) return demoReleases(p);
  const { data, error } = await db()
    .from('firmware_versions')
    .select('*')
    .eq('project_id', p.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function getComments(p: Project): Promise<Comment[]> {
  if (p.demo) return demoComments.filter((c) => c.project_id === p.id);
  const { data, error } = await db()
    .from('comment_catalog')
    .select('*')
    .eq('project_id', p.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}
export async function getCompatibility(p: Project): Promise<Compatibility[]> {
  if (p.demo) return demoCompatibility.filter((c) => c.project_id === p.id);
  const { data, error } = await db()
    .from('compatibility_reports')
    .select('*')
    .eq('project_id', p.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}
export async function getFavorites(userId: string): Promise<string[]> {
  const { data, error } = await db().from('favorites').select('project_id').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((x) => x.project_id);
}
export async function toggleFavorite(userId: string, projectId: string, active: boolean) {
  const { error } = active
    ? await db().from('favorites').delete().eq('user_id', userId).eq('project_id', projectId)
    : await db().from('favorites').insert({ user_id: userId, project_id: projectId });
  if (error) throw error;
}
export async function saveProject(input: unknown, userId: string, id?: string) {
  const value = projectSchema.parse(input);
  const q = id
    ? db().from('projects').update(value).eq('id', id).eq('owner_id', userId)
    : db()
        .from('projects')
        .insert({ ...value, owner_id: userId });
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data as Project;
}
export async function publishRelease(
  project: Project,
  userId: string,
  input: unknown,
  files: { file: File; address: number }[],
) {
  const value = releaseSchema.parse(input);
  validateFiles(files.map((x) => ({ name: x.file.name, size: x.file.size, address: x.address })));
  const id = crypto.randomUUID();
  const uploaded: string[] = [];
  try {
    const entries = [];
    for (const { file, address } of files) {
      const hash = await sha256(await file.arrayBuffer());
      const path = `${userId}/${project.id}/${id}/${file.name}`;
      const { error } = await db()
        .storage.from('firmware')
        .upload(path, file, { contentType: 'application/octet-stream', upsert: false });
      if (error) throw error;
      uploaded.push(path);
      entries.push({ path, name: file.name, address, size: file.size, sha256: hash });
    }
    const { error } = await db()
      .from('firmware_versions')
      .insert({
        id,
        project_id: project.id,
        version: value.version,
        channel: value.channel,
        changelog: value.changelog,
        hardware: value.hardware,
        online_enabled: value.online_enabled,
        manifest: { chip: project.chip, baudRate: value.baudRate, files: entries },
      });
    if (error) throw error;
  } catch (error) {
    if (uploaded.length) await db().storage.from('firmware').remove(uploaded);
    throw error;
  }
}
export async function getFile(path: string) {
  const { data, error } = await db().storage.from('firmware').download(path);
  if (error) throw error;
  return data;
}
export async function getHistory(userId: string): Promise<FlashSession[]> {
  const { data, error } = await db()
    .from('flash_sessions')
    .select('*, firmware_versions(version), projects(name, slug)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}
