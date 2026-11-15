// The skin gallery's side of /api/gallery and /api/auth (Discord sign-in).
// On the website the sign-in is a cookie; inside the Discord Activity there are no site cookies, so
// the Activity hands over its Discord token with setGalleryToken() and it goes with every request.

export interface GalleryUser {
  id: string;
  name: string;
  avatar: string | null;
}

export interface GallerySkin {
  id: string;
  name: string;
  model: 'slim' | 'default';
  size: 64 | 128;
  png: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  painters: string[];
  likes: number;
  created_at: string;
  liked: boolean;
}

/** Where the Skin Editor keeps its draft; the gallery's "Open in editor" writes a skin here. */
export const EDITOR_DRAFT_KEY = 'kirkahub_skin_editor_draft_v1';

let activityToken: string | null = null;
export const setGalleryToken = (token: string | null) => {
  activityToken = token;
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(activityToken ? { Authorization: `Bearer ${activityToken}` } : {}),
      ...init.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status}).`);
  return data as T;
}

const post = <T,>(body: Record<string, unknown>) => call<T>('/api/gallery', { method: 'POST', body: JSON.stringify(body) });

export const listSkins = (sort: 'new' | 'top', page: number, author?: string) =>
  call<{ skins: GallerySkin[]; more: boolean; user: GalleryUser | null; admin: boolean }>(
    `/api/gallery?sort=${sort}&page=${page}${author ? `&author=${encodeURIComponent(author)}` : ''}`
  );
export const getSkin = (id: string) => call<{ skin: GallerySkin; user: GalleryUser | null; admin: boolean }>(`/api/gallery?id=${encodeURIComponent(id)}`);
export const postSkin = (skin: { name: string; model: string; size: number; png: string; painters?: string[] }) => post<{ id: string }>({ action: 'post', ...skin });
export const likeSkin = (id: string) => post<{ liked: boolean; likes: number }>({ action: 'like', id });
export const reportSkin = (id: string) => post<{ ok: boolean }>({ action: 'report', id });
export const deleteSkin = (id: string) => post<{ ok: boolean }>({ action: 'delete', id });

export const getMe = () => call<{ user: GalleryUser | null }>('/api/auth?action=me').then((r) => r.user).catch(() => null);
export const signInUrl = (next: string) => `/api/auth?action=login&next=${encodeURIComponent(next)}`;
export const signOut = () => call<{ ok: boolean }>('/api/auth?action=logout', { method: 'POST' });

export const galleryUrl = (id: string) => `https://kirkahub.online/gallery/${id}`;

/** Puts a gallery skin where the Skin Editor picks up its draft, so opening the editor loads it. */
export function sendToEditor(skin: Pick<GallerySkin, 'model' | 'png'>) {
  try {
    localStorage.setItem(EDITOR_DRAFT_KEY, JSON.stringify({ model: skin.model, png: skin.png }));
    return true;
  } catch {
    return false;
  }
}
