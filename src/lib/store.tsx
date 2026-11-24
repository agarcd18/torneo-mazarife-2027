import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { backend, BackendUser, RealtimeStatus, SyncError } from './backend';
import type { DB, TournamentPhoto } from './types';
import { Op, applyChange, applyOp, applyOps, invertOps } from './ops';
import { buildView, View } from '../domain/view';
import { saveEmergencySnapshot } from '../domain/backup';

export type SyncState = 'synced' | 'saving' | 'offline' | 'error';
export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'ok' | 'warn' | 'error';
}
interface UndoEntry {
  label: string;
  ops: Op[];
}

export interface Store {
  mode: 'supabase' | 'demo';
  db: DB | null;
  view: View | null;
  loading: boolean;
  loadError: string | null;
  fresh: boolean;
  reload(): void;
  realtime: RealtimeStatus;
  queue: Op[];
  sync: SyncState;
  flushError: string | null;
  retryFlush(): void;
  discardFirst(): void;
  user: BackendUser | null;
  isOrganizer: boolean;
  authReady: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  commit(ops: Op[], label: string, opts?: { undoable?: boolean }): void;
  undo(): void;
  undoLabel: string | null;
  toasts: Toast[];
  toast(text: string, kind?: Toast['kind']): void;
  myTeam: string | null;
  setMyTeam(id: string | null): void;
  photos: TournamentPhoto[];
  uploadPhoto(file: File, author: string, caption: string): Promise<void>;
  deletePhoto(photo: TournamentPhoto): Promise<void>;
  theme: 'dark' | 'light';
  toggleTheme(): void;
}

const QKEY = 'ftorneo.queue.v1';
const CKEY = 'ftorneo.cache.v1';
const MYKEY = 'ftorneo.myteam';
const THEMEKEY = 'ftorneo.theme';
const ORGKEY = 'ftorneo.organizer';

function loadJSON<T>(k: string, def: T): T {
  try {
    const s = localStorage.getItem(k);
    return s ? (JSON.parse(s) as T) : def;
  } catch {
    return def;
  }
}
function saveJSON(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* almacenamiento lleno: ignoramos la caché, la cola es pequeña */
  }
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider no encontrado');
  return s;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Copia local de la base de datos (último estado bueno conocido). Solo se usa para mostrar.
  const [remote, setRemote] = useState<DB | null>(() => loadJSON<DB | null>(CKEY, null));
  const [fresh, setFresh] = useState(false);
  const freshRef = useRef(false);
  freshRef.current = fresh;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [realtime, setRealtime] = useState<RealtimeStatus>('connecting');

  // Cola persistente de cambios pendientes de subir
  const queueRef = useRef<Op[]>(loadJSON<Op[]>(QKEY, []));
  const [queue, setQueueState] = useState<Op[]>(queueRef.current);
  const setQueue = useCallback((q: Op[]) => {
    queueRef.current = q;
    saveJSON(QKEY, q);
    setQueueState(q);
  }, []);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [netDown, setNetDown] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushError, setFlushError] = useState<string | null>(null);

  const [user, setUser] = useState<BackendUser | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const undoRef = useRef<UndoEntry[]>([]);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [myTeam, setMyTeamState] = useState<string | null>(() => localStorage.getItem(MYKEY));
  const [publicPhotos, setPublicPhotos] = useState<TournamentPhoto[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(THEMEKEY) as 'dark' | 'light') || 'dark');

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEMEKEY, theme);
  }, [theme]);

  // Guardar caché solo cuando el dato viene del servidor
  useEffect(() => {
    if (remote && fresh) saveJSON(CKEY, remote);
  }, [remote, fresh]);

  /* ---------------- Lectura (nunca escribe) ---------------- */
  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [db, ph] = await Promise.all([backend.fetchAll(), backend.fetchPhotos().catch(() => [] as TournamentPhoto[])]);
      setRemote(db);
      setPublicPhotos(ph);
      setFresh(true);
      setLoadError(null);
    } catch (e: any) {
      // Un fallo de lectura NO es una base de datos vacía: mantenemos lo que teníamos y reintentamos.
      setLoadError(e?.message || 'No se pudo conectar con la base de datos');
      setAttempt((a) => a + 1);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!attempt) return;
    const t = setTimeout(load, Math.min(30000, 4000 * attempt));
    return () => clearTimeout(t);
  }, [attempt, load]);

  useEffect(() => {
    const unsub = backend.subscribe(
      (table, type, n, o) => setRemote((prev) => (prev ? applyChange(prev, table, type, n, o) : prev)),
      (st) => {
        setRealtime(st);
        if (st === 'live') load(); // al (re)conectar, recargamos para no perder eventos
      },
      () => load(),
    );
    load();
    return unsub;
  }, [load]);

  /* ---------------- Escritura: cola + subida ---------------- */
  const flushingRef = useRef(false);
  const flush = useCallback(async () => {
    if (flushingRef.current || !queueRef.current.length) return;
    flushingRef.current = true;
    setFlushing(true);
    try {
      while (queueRef.current.length) {
        const o = queueRef.current[0];
        try {
          await backend.apply(o);
        } catch (e: any) {
          const retry = e instanceof SyncError ? e.retryable : true;
          if (retry) setNetDown(true);
          else setFlushError(`${o.label ?? 'Cambio'}: ${e?.message ?? 'error'}`);
          break;
        }
        setNetDown(false);
        setRemote((prev) => {
          if (!prev) return prev;
          const updated = applyOp(prev, o);
          saveEmergencySnapshot(updated);
          return updated;
        });
        setQueue(queueRef.current.filter((x) => x.opId !== o.opId));
      }
    } finally {
      flushingRef.current = false;
      setFlushing(false);
    }
  }, [setQueue]);

  useEffect(() => {
    if (queue.length && !flushError && user) flush();
  }, [queue, flushError, user, flush]);

  useEffect(() => {
    if (!queue.length || flushError) return;
    const t = setInterval(() => flush(), 6000);
    return () => clearInterval(t);
  }, [queue.length, flushError, flush]);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      setNetDown(false);
      load();
      flush();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [load, flush]);

  /* ---------------- Autenticación ---------------- */
  useEffect(() => {
    let alive = true;
    const check = async (u: BackendUser | null) => {
      if (!alive) return;
      setUser(u);
      if (u) {
        try {
          const ok = await backend.isOrganizer();
          if (!alive) return;
          setIsOrganizer(ok);
          if (ok) localStorage.setItem(ORGKEY, u.email);
          else localStorage.removeItem(ORGKEY);
        } catch {
          // sin conexión: confiamos en la última comprobación de este mismo usuario
          setIsOrganizer(localStorage.getItem(ORGKEY) === u.email);
        }
      } else setIsOrganizer(false);
      setAuthReady(true);
    };
    backend.getUser().then(check, () => setAuthReady(true));
    const unsub = backend.onAuthChange((u) => check(u));
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  /* ---------------- Estado derivado ---------------- */
  const db = useMemo(() => (remote ? applyOps(remote, queue) : null), [remote, queue]);
  const dbRef = useRef<DB | null>(db);
  dbRef.current = db;
  const view = useMemo(() => (db ? buildView(db) : null), [db]);

  // Combinar fotos de tabla/storage con posibles fotos de settings
  const allPhotos = useMemo(() => {
    const map = new Map<string, TournamentPhoto>();
    for (const p of publicPhotos) map.set(p.id, p);
    for (const p of view?.photos ?? []) if (!map.has(p.id)) map.set(p.id, p);
    return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [publicPhotos, view?.photos]);

  // Notificaciones Push / Service Worker para Mi Equipo Favorito cuando un partido suyo cambia o finaliza
  const prevMatchSnapRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!view || !myTeam) return;
    const prev = prevMatchSnapRef.current;
    const next = new Map<string, string>();
    const hadPrev = prev.size > 0;

    for (const m of view.matches) {
      if (m.home_team_id !== myTeam && m.away_team_id !== myTeam) continue;
      const sc = view.scores.get(m.id) ?? { home: 0, away: 0 };
      const snap = `${m.status}|${sc.home}-${sc.away}`;
      next.set(m.id, snap);

      if (hadPrev && prev.has(m.id) && prev.get(m.id) !== snap) {
        const hn = (m.home_team_id && view.teamsById.get(m.home_team_id)?.name) || 'Local';
        const an = (m.away_team_id && view.teamsById.get(m.away_team_id)?.name) || 'Visitante';
        const title = m.status === 'finished' ? `🏁 Finalizado · ${hn} ${sc.home} - ${sc.away} ${an}` : `⚽ ¡Marcador! ${hn} ${sc.home} - ${sc.away} ${an}`;
        const body = `Actualización en directo de tu equipo favorito en el ${view.tournament.name}`;
        toast(title, 'ok');

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
              .then((reg) =>
                reg.showNotification(title, {
                  body,
                  icon: './icons/icon.svg',
                  badge: './icons/icon.svg',
                  data: { url: `./#/partido/${m.id}` },
                }),
              )
              .catch(() => {
                try {
                  new Notification(title, { body, icon: './icons/icon.svg' });
                } catch {
                  /* ignore */
                }
              });
          }
        }
      }
    }
    prevMatchSnapRef.current = next;
  }, [view, myTeam, toast]);

  const commit = useCallback(
    (ops: Op[], label: string, opts?: { undoable?: boolean }) => {
      const cur = dbRef.current;
      if (!cur || !ops.length) return;
      // Garantía anti-sobrescritura al arrancar:
      // Si estamos conectados a Supabase pero aún no ha respondido la primera lectura real del servidor,
      // bloqueamos cualquier escritura para no pisar datos de la nube con un estado inicial o caché antigua.
      if (backend.mode === 'supabase' && !freshRef.current) {
        toast('⏳ Esperando a recibir los datos actuales de Supabase antes de guardar…', 'warn');
        load();
        return;
      }
      if (opts?.undoable !== false) {
        const inv = invertOps(cur, ops);
        undoRef.current = [...undoRef.current.slice(-49), { label, ops: inv }];
        setUndoLabel(label);
      }
      const ts = Date.now();
      setQueue([...queueRef.current, ...ops.map((o) => ({ ...o, label, ts }))]);
    },
    [setQueue, toast, load],
  );

  const undo = useCallback(() => {
    const last = undoRef.current[undoRef.current.length - 1];
    if (!last) return;
    undoRef.current = undoRef.current.slice(0, -1);
    setUndoLabel(undoRef.current[undoRef.current.length - 1]?.label ?? null);
    const ts = Date.now();
    setQueue([...queueRef.current, ...last.ops.map((o) => ({ ...o, label: `Deshacer: ${last.label}`, ts }))]);
    toast(`Deshecho: ${last.label}`, 'ok');
  }, [setQueue, toast]);

  const sync: SyncState = flushError ? 'error' : !online || netDown ? 'offline' : queue.length || flushing ? 'saving' : 'synced';

  const value: Store = {
    mode: backend.mode,
    db,
    view,
    loading,
    loadError,
    fresh,
    reload: load,
    realtime,
    queue,
    sync,
    flushError,
    retryFlush: () => {
      setFlushError(null);
      setTimeout(flush, 0);
    },
    discardFirst: () => {
      setQueue(queueRef.current.slice(1));
      setFlushError(null);
      load();
    },
    user,
    isOrganizer,
    authReady,
    signIn: async (e, p) => {
      await backend.signIn(e, p);
    },
    signOut: async () => {
      await backend.signOut();
      localStorage.removeItem(ORGKEY);
      undoRef.current = [];
      setUndoLabel(null);
    },
    commit,
    undo,
    undoLabel,
    toasts,
    toast,
    myTeam,
    setMyTeam: (id) => {
      if (id) localStorage.setItem(MYKEY, id);
      else localStorage.removeItem(MYKEY);
      setMyTeamState(id);
    },
    photos: allPhotos,
    uploadPhoto: async (file, author, caption) => {
      const p = await backend.uploadPhoto(file, author, caption);
      setPublicPhotos((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
    },
    deletePhoto: async (photo) => {
      await backend.deletePhoto(photo);
      setPublicPhotos((prev) => prev.filter((x) => x.id !== photo.id));
    },
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
