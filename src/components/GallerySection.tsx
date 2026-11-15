// The skin gallery: skins people made in the Skin Editor and posted, newest or most liked first,
// each with its own page (/gallery/<id>) where it turns in 3D and can be liked, downloaded or opened
// in the editor to remix. Posting and liking need a Discord sign-in; looking doesn't.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SkinViewer, IdleAnimation } from 'skinview3d';
import { ArrowLeft, Brush, Download, Flag, Heart, Images, Link2, Loader2, LogOut, Trash2, Users } from 'lucide-react';
import { drawFrontBack } from '../utils/skinPreview';
import {
  listSkins, getSkin, likeSkin, reportSkin, deleteSkin, getMe, signInUrl, signOut, sendToEditor, galleryUrl,
} from '../utils/gallery';
import type { GallerySkin, GalleryUser } from '../utils/gallery';

interface GallerySectionProps {
  /** The skin whose page is open, from /gallery/<id>; null for the gallery itself. */
  skinId: string | null;
  onOpen: (id: string | null) => void;
  onNavigate: (tab: string) => void;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** A skin's front and back, flat, drawn from its PNG. */
const SkinThumb: React.FC<{ skin: Pick<GallerySkin, 'png' | 'model' | 'size'>; scale?: number; className?: string }> = ({ skin, scale = 6, className = '' }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (ref.current) drawFrontBack(ref.current, img, skin.model, skin.size, scale);
    };
    img.src = skin.png;
  }, [skin.png, skin.model, skin.size, scale]);
  return <canvas ref={ref} className={className} style={{ imageRendering: 'pixelated' }} />;
};

/** The skin turning slowly in 3D; the flat front and back where WebGL isn't available. */
const Skin3D: React.FC<{ skin: GallerySkin }> = ({ skin }) => {
  const stage = useRef<HTMLDivElement>(null);
  const [flat, setFlat] = useState(false);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    el.appendChild(canvas);
    let viewer: SkinViewer;
    try {
      viewer = new SkinViewer({ canvas, width: el.clientWidth || 300, height: el.clientHeight || 400, skin: skin.png, model: skin.model });
    } catch {
      canvas.remove();
      setFlat(true);
      return;
    }
    viewer.animation = new IdleAnimation();
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.8;
    viewer.zoom = 0.85;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth && el.clientHeight) viewer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      viewer.dispose();
      canvas.remove();
    };
  }, [skin.png, skin.model]);
  return (
    <div ref={stage} className="night relative h-[420px] bg-[var(--stage)] border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] overflow-hidden cursor-grab">
      {flat && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <SkinThumb skin={skin} scale={10} className="max-w-full max-h-full" />
        </div>
      )}
    </div>
  );
};

const Avatar: React.FC<{ src: string | null; name: string; size?: string }> = ({ src, name, size = 'w-6 h-6' }) =>
  src ? (
    <img src={src} alt="" className={`${size} rounded-full border border-[var(--ink)]`} loading="lazy" />
  ) : (
    <span className={`${size} rounded-full bg-[#5865F2] text-white text-[11px] font-bold flex items-center justify-center`}>{name.slice(0, 1).toUpperCase()}</span>
  );

export const GallerySection: React.FC<GallerySectionProps> = ({ skinId, onOpen, onNavigate }) => {
  const [user, setUser] = useState<GalleryUser | null>(null);
  const [admin, setAdmin] = useState(false);
  const [sort, setSort] = useState<'new' | 'top'>('new');
  const [skins, setSkins] = useState<GallerySkin[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<GallerySkin | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void getMe().then(setUser);
    const params = new URLSearchParams(window.location.search);
    if (params.get('signin') === 'failed') setNotice("Discord sign-in didn't finish. Try again.");
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // the list
  const load = useCallback(async (nextPage: number, nextSort: 'new' | 'top') => {
    setLoading(true);
    setError('');
    try {
      const r = await listSkins(nextSort, nextPage);
      setSkins((s) => (nextPage === 0 ? r.skins : [...s, ...r.skins]));
      setMore(r.more);
      setPage(nextPage);
      setAdmin(r.admin);
      if (r.user) setUser(r.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!skinId) void load(0, sort);
  }, [skinId, sort, load]);

  // one skin's page
  useEffect(() => {
    if (!skinId) {
      setOpen(null);
      document.title = 'Skin Gallery: Kirka Skins Made by Players | Kirka Hub';
      return;
    }
    const known = skins.find((s) => s.id === skinId);
    if (known) setOpen(known);
    let cancelled = false;
    getSkin(skinId)
      .then((r) => {
        if (cancelled) return;
        setOpen(r.skin);
        setAdmin(r.admin);
        document.title = `${r.skin.name} by ${r.skin.author_name}: Kirka Skin | Kirka Hub`;
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
    // the list only seeds the page while it loads; the page is fetched fresh either way
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skinId]);

  const signIn = () => {
    window.location.href = signInUrl(window.location.pathname);
  };

  const updateSkin = (id: string, patch: Partial<GallerySkin>) => {
    setSkins((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setOpen((s) => (s && s.id === id ? { ...s, ...patch } : s));
  };

  const like = async (skin: GallerySkin) => {
    if (!user) return signIn();
    // show it at once, then take the server's count
    updateSkin(skin.id, { liked: !skin.liked, likes: skin.likes + (skin.liked ? -1 : 1) });
    try {
      const r = await likeSkin(skin.id);
      updateSkin(skin.id, { liked: r.liked, likes: r.likes });
    } catch (err) {
      updateSkin(skin.id, { liked: skin.liked, likes: skin.likes });
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const remix = (skin: GallerySkin) => {
    if (!sendToEditor(skin)) return setNotice("Your browser won't let the editor save, so the skin can't be opened there. Download it and use Open PNG instead.");
    onNavigate('skineditor');
  };

  const download = (skin: GallerySkin) => {
    const a = document.createElement('a');
    a.href = skin.png;
    a.download = `${skin.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'skin'}-kirkahub.png`;
    a.click();
  };

  const report = async (skin: GallerySkin) => {
    if (!user) return signIn();
    if (!window.confirm(`Report "${skin.name}" as rude or stolen? After a few reports it's hidden until it's checked.`)) return;
    try {
      await reportSkin(skin.id);
      setNotice('Thanks. The skin has been reported.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (skin: GallerySkin) => {
    if (!window.confirm(`Delete "${skin.name}" from the gallery? This can't be undone.`)) return;
    try {
      await deleteSkin(skin.id);
      setSkins((list) => list.filter((s) => s.id !== skin.id));
      onOpen(null);
      setNotice('Deleted.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    }
  };

  const chip = (on: boolean) =>
    `px-3 py-1.5 border-2 border-[var(--ink)] text-[14px] font-bold cursor-pointer ${on ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-[2px_2px_0_var(--ink)]' : 'bg-obsidian-dark text-slate-300 hover:bg-obsidian-hover'}`;
  const action = 'btn-interactive flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-[var(--ink)] bg-obsidian-dark text-[14px] font-bold text-slate-200 cursor-pointer';

  const account = user ? (
    <div className="flex items-center gap-2 text-[14px] font-bold text-slate-200">
      <Avatar src={user.avatar} name={user.name} size="w-7 h-7" />
      {user.name}
      <button
        type="button"
        title="Sign out"
        onClick={() => void signOut().then(() => setUser(null))}
        className="p-1.5 text-slate-400 hover:text-slate-100 cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  ) : (
    <button type="button" onClick={signIn} className="flex items-center gap-2 px-3 py-2 border-2 border-[var(--ink)] bg-[#5865F2] text-white text-[14px] font-bold cursor-pointer shadow-[2px_2px_0_var(--ink)]">
      Sign in with Discord
    </button>
  );

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-obsidian-border pb-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl text-slate-100 flex items-center gap-3">
            <Images className="w-8 h-8 text-gold-bright" />
            <span>Skin <span className="mark">Gallery</span></span>
          </h1>
          <p className="text-[15px] text-slate-400 mt-1.5 max-w-[70ch]">
            Kirka skins made by players in the Kirka Hub Skin Editor. Like the ones you love, download them, or open one in the editor and make it your own.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => onNavigate('skineditor')} className="display flex items-center gap-1.5 h-10 px-4 bg-gold-primary text-[18px] cursor-pointer">
            <Brush className="w-4 h-4" /> Make a skin
          </button>
          {account}
        </div>
      </header>

      {notice && (
        <p role="status" className="fixed bottom-5 right-5 z-40 max-w-sm text-[14px] font-bold px-3 py-2 border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] bg-obsidian-hover text-slate-100">
          {notice}
        </p>
      )}

      {skinId ? (
        // ---------------------------------------------------------------- one skin
        <div className="space-y-4">
          <button type="button" onClick={() => onOpen(null)} className="flex items-center gap-1.5 text-[14px] font-bold text-slate-300 hover:text-slate-100 cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> All skins
          </button>
          {!open ? (
            error ? <p className="text-red-300 font-bold">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Skin3D skin={open} />
              <div className="space-y-4">
                <div>
                  <h2 className="display text-4xl text-slate-100 break-words">{open.name}</h2>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-slate-300">
                    <Avatar src={open.author_avatar} name={open.author_name} />
                    <b>{open.author_name}</b>
                    <span className="text-slate-500">· {when(open.created_at)} · {open.model === 'slim' ? 'Slim 3px' : 'Classic 4px'}, {open.size}x{open.size}</span>
                  </p>
                  {open.painters.length > 0 && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-slate-400">
                      <Users className="w-4 h-4" /> Painted live with {open.painters.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void like(open)} className={`${action} ${open.liked ? '!bg-[#3D1A20] !text-red-200' : ''}`}>
                    <Heart className={`w-4 h-4 ${open.liked ? 'fill-red-400 text-red-400' : ''}`} /> {open.likes}
                  </button>
                  <button type="button" onClick={() => remix(open)} className={action}><Brush className="w-4 h-4" /> Open in editor</button>
                  <button type="button" onClick={() => download(open)} className={action}><Download className="w-4 h-4" /> Download PNG</button>
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard?.writeText(galleryUrl(open.id)); setNotice('Link copied.'); }}
                    className={action}
                  >
                    <Link2 className="w-4 h-4" /> Copy link
                  </button>
                </div>
                <div className="rounded-none border border-obsidian-border bg-obsidian-card p-3 flex items-center justify-center">
                  <SkinThumb skin={open} scale={8} className="max-w-full" />
                </div>
                <div className="flex flex-wrap gap-4 text-[13px] font-bold">
                  {user && (user.id === open.author_id || admin) ? (
                    <button type="button" onClick={() => void remove(open)} className="flex items-center gap-1.5 text-red-300 hover:underline cursor-pointer">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  ) : (
                    <button type="button" onClick={() => void report(open)} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 cursor-pointer">
                      <Flag className="w-4 h-4" /> Report
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ---------------------------------------------------------------- the gallery
        <div className="space-y-4">
          <div className="flex gap-1.5" role="group" aria-label="Sort">
            <button type="button" onClick={() => setSort('new')} aria-pressed={sort === 'new'} className={chip(sort === 'new')}>Newest</button>
            <button type="button" onClick={() => setSort('top')} aria-pressed={sort === 'top'} className={chip(sort === 'top')}>Most liked</button>
          </div>

          {error && <p className="text-red-300 font-bold">{error}</p>}

          {!loading && !error && skins.length === 0 && (
            <div className="border-2 border-dashed border-obsidian-border p-8 text-center space-y-3">
              <p className="text-[16px] font-bold text-slate-200">No skins here yet.</p>
              <p className="text-[14px] text-slate-400">Be the first: paint one in the Skin Editor and press <b>Post to gallery</b>.</p>
              <button type="button" onClick={() => onNavigate('skineditor')} className={`${action} mx-auto`}><Brush className="w-4 h-4" /> Open the Skin Editor</button>
            </div>
          )}

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {skins.map((s) => (
              <article key={s.id} className="group bg-obsidian-card border-2 border-[var(--ink)] shadow-[3px_3px_0_var(--ink)] flex flex-col">
                <a
                  href={`/gallery/${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpen(s.id);
                  }}
                  className="block night bg-[var(--stage)] p-3 border-b-2 border-[var(--ink)]"
                  aria-label={`${s.name} by ${s.author_name}`}
                >
                  <SkinThumb skin={s} className="w-full transition-transform group-hover:scale-[1.04]" />
                </a>
                <div className="p-2.5 flex-1 flex flex-col gap-1.5">
                  <p className="font-bold text-slate-100 text-[15px] leading-tight truncate" title={s.name}>{s.name}</p>
                  <p className="flex items-center gap-1.5 text-[13px] text-slate-400 min-w-0">
                    <Avatar src={s.author_avatar} name={s.author_name} size="w-5 h-5" />
                    <span className="truncate">{s.author_name}{s.painters.length ? ` +${s.painters.length}` : ''}</span>
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-[12px] text-slate-500">{when(s.created_at)}</span>
                    <button
                      type="button"
                      onClick={() => void like(s)}
                      aria-pressed={s.liked}
                      title={user ? (s.liked ? 'Unlike' : 'Like') : 'Sign in with Discord to like'}
                      className="flex items-center gap-1 text-[13px] font-bold text-slate-300 hover:text-red-300 cursor-pointer"
                    >
                      <Heart className={`w-4 h-4 ${s.liked ? 'fill-red-400 text-red-400' : ''}`} /> {s.likes}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {loading && <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />}
          {more && !loading && (
            <button type="button" onClick={() => void load(page + 1, sort)} className={`${action} mx-auto`}>Load more</button>
          )}
        </div>
      )}
    </div>
  );
};
