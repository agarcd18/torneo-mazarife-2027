import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuditEntry, DB, TABLES, TableName, TournamentPhoto, emptyDB } from './types';
import { Op, applyOp, pk } from './ops';
import { uid } from './ids';

export type RealtimeStatus = 'connecting' | 'live' | 'down';
export type ChangeHandler = (table: TableName, type: string, newRow: any, oldRow: any) => void;
export interface BackendUser {
  email: string;
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB exactos
export const MASTER_ADMIN_PASS = 'Mazarife25';
const MASTER_SESSION_KEY = 'ftorneo.master.admin';
const MASTER_TOKEN_KEY = 'ftorneo.master.token';

export interface Backend {
  mode: 'supabase' | 'demo';
  fetchAll(): Promise<DB>;
  apply(op: Op): Promise<void>;
  subscribe(onChange: ChangeHandler, onStatus: (s: RealtimeStatus) => void, onResync: () => void): () => void;
  getUser(): Promise<BackendUser | null>;
  onAuthChange(cb: (u: BackendUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  isOrganizer(): Promise<boolean>;
  fetchAudit(limit: number): Promise<AuditEntry[]>;
  fetchPhotos(): Promise<TournamentPhoto[]>;
  uploadPhoto(file: File, author: string, caption: string): Promise<TournamentPhoto>;
  deletePhoto(photo: TournamentPhoto): Promise<void>;
}

export class SyncError extends Error {
  retryable: boolean;
  constructor(msg: string, retryable: boolean) {
    super(msg);
    this.retryable = retryable;
  }
}

const NET_RE = /fetch|network|load failed|timeout|timed out|offline|ECONN/i;

/** Convierte una imagen en un DataURL ligero solo para el modo demo local */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(String(reader.result));
      img.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(String(reader.result));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */
/* Supabase (Producción / Nube en tiempo real)                         */
/* ------------------------------------------------------------------ */
function createSupabaseBackend(url: string, key: string): Backend {
  // Fetch personalizado:
  // 1) Fuerza cache: 'no-store' para que el navegador jamás sirva respuestas viejas de Supabase.
  // 2) Adjunta la cabecera 'x-torneo-key' cuando el organizador ha iniciado sesión con Mazarife25,
  //    para que la función RLS public.is_organizer() en PostgreSQL autorice INSERT/UPDATE/DELETE.
  const customFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers || {});
    if (typeof localStorage !== 'undefined' && localStorage.getItem(MASTER_SESSION_KEY) === '1') {
      const token = localStorage.getItem(MASTER_TOKEN_KEY) || MASTER_ADMIN_PASS;
      headers.set('x-torneo-key', token);
    }
    return fetch(input, {
      ...init,
      headers,
      cache: 'no-store',
    });
  };

  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ftorneo.auth' },
    global: { fetch: customFetch },
    realtime: { params: { eventsPerSecond: 20 } },
  });

  async function fetchTable(t: TableName): Promise<any[]> {
    const size = 1000;
    let from = 0;
    const out: any[] = [];
    for (;;) {
      const { data, error } = await sb.from(t).select('*').order(pk(t), { ascending: true }).range(from, from + size - 1);
      if (error) throw new Error(`No se pudo leer "${t}": ${error.message}`);
      if (!data) throw new Error(`Respuesta vacía al leer "${t}"`);
      out.push(...data);
      if (data.length < size) break;
      from += size;
    }
    return out;
  }

  const toUser = (u: any): BackendUser | null => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(MASTER_SESSION_KEY) === '1') {
      return { email: u?.email ?? 'Organizador (Mazarife25)' };
    }
    return u ? { email: u.email ?? 'organizador' } : null;
  };
  const masterListeners = new Set<(u: BackendUser | null) => void>();

  return {
    mode: 'supabase',
    async fetchAll() {
      // SOLO LECTURA: Jamás escribe ni inicializa datos por defecto en Supabase.
      // Si falla cualquier tabla se lanza error para NO tratar un fallo de red como base de datos vacía.
      const results = await Promise.all(TABLES.map(fetchTable));
      const db = emptyDB() as any;
      TABLES.forEach((t, i) => (db[t] = results[i]));
      return db as DB;
    },
    async apply(o) {
      const key = pk(o.table);
      let res: any;
      try {
        const q = sb.from(o.table);
        switch (o.kind) {
          case 'upsert':
            res = await q.upsert(o.row, { onConflict: key }).select();
            break;
          case 'bulkUpsert':
            res = await q.upsert(o.rows, { onConflict: key }).select();
            break;
          case 'update':
            res = await q.update(o.patch).eq(key, o.id).select();
            break;
          case 'delete':
            res = await q.delete().eq(key, o.id);
            break;
          case 'bulkDelete':
            res = await q.delete().in(key, o.ids);
            break;
        }
      } catch (e: any) {
        throw new SyncError(e?.message ?? 'Error de red', true);
      }
      if (res?.error) {
        const status: number = res.status ?? 0;
        const msg: string = res.error.message ?? 'Error al guardar en Supabase';
        const retryable = status === 0 || status >= 500 || status === 408 || status === 429 || status === 401 || NET_RE.test(msg) || /JWT/i.test(msg);
        if (status === 401 || /JWT/i.test(msg)) await sb.auth.refreshSession().catch(() => undefined);
        throw new SyncError(msg, retryable);
      }
      // Detectar si RLS bloqueó silenciosamente un UPSERT
      if ((o.kind === 'upsert' || o.kind === 'bulkUpsert') && Array.isArray(res?.data) && res.data.length === 0) {
        throw new SyncError(
          `Permiso denegado por RLS en tabla "${o.table}". Ejecuta el script SQL actualizado en Supabase.`,
          false,
        );
      }
    },
    subscribe(onChange, onStatus, onResync) {
      const ch = sb.channel('torneo-db');
      for (const t of TABLES) {
        ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: t }, (p: any) => onChange(t, p.eventType, p.new, p.old));
      }
      ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: 'photos' }, () => onResync());
      onStatus('connecting');
      ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') onStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus('down');
      });
      return () => {
        sb.removeChannel(ch);
      };
    },
    async getUser() {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(MASTER_SESSION_KEY) === '1') {
        return { email: 'Organizador (Mazarife25)' };
      }
      const { data } = await sb.auth.getSession();
      return toUser(data.session?.user);
    },
    onAuthChange(cb) {
      masterListeners.add(cb);
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(toUser(session?.user)));
      return () => {
        masterListeners.delete(cb);
        data.subscription.unsubscribe();
      };
    },
    async signIn(_email, password) {
      if (password !== MASTER_ADMIN_PASS) {
        throw new Error('Contraseña incorrecta. Introduce la clave maestra del torneo.');
      }
      localStorage.setItem(MASTER_SESSION_KEY, '1');
      localStorage.setItem(MASTER_TOKEN_KEY, MASTER_ADMIN_PASS);
      const u: BackendUser = { email: 'Organizador (Mazarife25)' };
      masterListeners.forEach((l) => l(u));
    },
    async signOut() {
      localStorage.removeItem(MASTER_SESSION_KEY);
      localStorage.removeItem(MASTER_TOKEN_KEY);
      await sb.auth.signOut().catch(() => undefined);
      masterListeners.forEach((l) => l(null));
    },
    async isOrganizer() {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(MASTER_SESSION_KEY) === '1') return true;
      const { data, error } = await sb.rpc('is_organizer');
      if (error) throw new Error(error.message);
      return !!data;
    },
    async fetchAudit(limit) {
      const { data, error } = await sb.from('audit_log').select('*').order('id', { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditEntry[];
    },
    async fetchPhotos() {
      const { data, error } = await sb.from('photos').select('*').order('created_at', { ascending: false }).limit(200);
      if (error || !data) return [];
      return data.map((r: any) => ({
        id: r.id,
        url: r.public_url,
        storage_path: r.storage_path,
        author: r.author_name || 'Afición',
        caption: r.caption || '',
        created_at: r.created_at,
      }));
    },
    async uploadPhoto(file, author, caption) {
      if (file.size > MAX_PHOTO_BYTES) {
        throw new Error('La foto supera el límite máximo permitido de 5 MB');
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${new Date().toISOString().slice(0, 10)}/${uid()}.${ext || 'jpg'}`;
      const up = await sb.storage.from('tournament-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });
      if (up.error) {
        throw new Error(`Error al subir a Supabase Storage: ${up.error.message}`);
      }
      const { data: pub } = sb.storage.from('tournament-photos').getPublicUrl(path);
      const id = uid();
      const created_at = new Date().toISOString();
      const { error: insErr } = await sb.from('photos').insert({
        id,
        storage_path: path,
        public_url: pub.publicUrl,
        author_name: author.trim() || 'Afición',
        caption: caption.trim(),
        created_at,
      });
      if (insErr) throw new Error(insErr.message);
      return {
        id,
        url: pub.publicUrl,
        storage_path: path,
        author: author.trim() || 'Afición',
        caption: caption.trim(),
        created_at,
      };
    },
    async deletePhoto(photo) {
      if (photo.storage_path) {
        await sb.storage.from('tournament-photos').remove([photo.storage_path]).catch(() => undefined);
      }
      const { error } = await sb.from('photos').delete().eq('id', photo.id);
      if (error) throw new Error(error.message);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Demo (SOLO si faltan las credenciales de Supabase; avisa con banner)*/
/* ------------------------------------------------------------------ */
function createDemoBackend(): Backend {
  const KEY = 'ftorneo.demo.db';
  const AKEY = 'ftorneo.demo.audit';
  const UKEY = 'ftorneo.demo.user';
  const PKEY = 'ftorneo.demo.photos';
  const bc: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ftorneo-demo') : null;
  const authListeners = new Set<(u: BackendUser | null) => void>();
  const read = (): DB => {
    try {
      return { ...emptyDB(), ...(JSON.parse(localStorage.getItem(KEY) || 'null') ?? {}) };
    } catch {
      return emptyDB();
    }
  };
  const user = (): BackendUser | null => {
    const e = localStorage.getItem(UKEY);
    return e ? { email: e } : null;
  };
  const readPhotos = (): TournamentPhoto[] => {
    try {
      return JSON.parse(localStorage.getItem(PKEY) || '[]') as TournamentPhoto[];
    } catch {
      return [];
    }
  };
  return {
    mode: 'demo',
    async fetchAll() {
      return read();
    },
    async apply(o) {
      if (!user()) throw new SyncError('No has iniciado sesión', true);
      const before = read();
      const after = applyOp(before, o);
      localStorage.setItem(KEY, JSON.stringify(after));
      const audit: AuditEntry[] = JSON.parse(localStorage.getItem(AKEY) || '[]');
      const id = o.kind === 'upsert' ? o.row[pk(o.table)] : o.kind === 'update' || o.kind === 'delete' ? o.id : `${o.kind === 'bulkUpsert' ? o.rows.length : o.ids.length} filas`;
      audit.unshift({
        id: Date.now() + Math.random(),
        at: new Date().toISOString(),
        actor_email: user()?.email ?? 'demo',
        table_name: o.table,
        action: { upsert: 'UPSERT', update: 'UPDATE', delete: 'DELETE', bulkUpsert: 'UPSERT', bulkDelete: 'DELETE' }[o.kind],
        row_id: String(id),
        old_data: null,
        new_data: o.kind === 'upsert' ? o.row : o.kind === 'update' ? o.patch : o.kind === 'bulkUpsert' ? { filas: o.rows.length } : null,
      });
      localStorage.setItem(AKEY, JSON.stringify(audit.slice(0, 500)));
      bc?.postMessage('changed');
    },
    subscribe(_onChange, onStatus, onResync) {
      setTimeout(() => onStatus('live'), 50);
      const h = () => onResync();
      if (bc) bc.onmessage = h;
      const st = (e: StorageEvent) => (e.key === KEY || e.key === PKEY) && onResync();
      window.addEventListener('storage', st);
      return () => {
        if (bc) bc.onmessage = null;
        window.removeEventListener('storage', st);
      };
    },
    async getUser() {
      return user();
    },
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
    async signIn(_email, password) {
      if (password !== MASTER_ADMIN_PASS) {
        throw new Error('Contraseña incorrecta. Introduce la clave maestra del torneo.');
      }
      localStorage.setItem(MASTER_SESSION_KEY, '1');
      localStorage.setItem(UKEY, 'Organizador (Mazarife25)');
      authListeners.forEach((l) => l(user()));
    },
    async signOut() {
      localStorage.removeItem(MASTER_SESSION_KEY);
      localStorage.removeItem(UKEY);
      authListeners.forEach((l) => l(null));
    },
    async isOrganizer() {
      return !!user();
    },
    async fetchAudit(limit) {
      return (JSON.parse(localStorage.getItem(AKEY) || '[]') as AuditEntry[]).slice(0, limit);
    },
    async fetchPhotos() {
      return readPhotos();
    },
    async uploadPhoto(file, author, caption) {
      if (file.size > MAX_PHOTO_BYTES) {
        throw new Error('La foto supera el límite máximo permitido de 5 MB');
      }
      const dataUrl = await fileToCompressedDataUrl(file);
      const photo: TournamentPhoto = {
        id: uid(),
        url: dataUrl,
        storage_path: null,
        author: author.trim() || 'Afición',
        caption: caption.trim(),
        created_at: new Date().toISOString(),
      };
      const list = [photo, ...readPhotos()].slice(0, 100);
      localStorage.setItem(PKEY, JSON.stringify(list));
      bc?.postMessage('changed');
      return photo;
    },
    async deletePhoto(photo) {
      if (!user()) throw new Error('Solo el organizador puede borrar fotos');
      const list = readPhotos().filter((p) => p.id !== photo.id);
      localStorage.setItem(PKEY, JSON.stringify(list));
      bc?.postMessage('changed');
    },
  };
}

const URL_ = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const hasValidCredentials =
  URL_.startsWith('https://') &&
  !URL_.includes('TU-PROYECTO') &&
  KEY_.length > 20 &&
  !KEY_.includes('TU_CLAVE');

export const isSupabaseConfigured = hasValidCredentials;
export const backend: Backend = isSupabaseConfigured ? createSupabaseBackend(URL_, KEY_) : createDemoBackend();
