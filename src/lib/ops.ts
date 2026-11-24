import type { DB, TableName } from './types';
import { uid } from './ids';

/**
 * Una operación es la unidad mínima de escritura. Se aplica primero en local (optimista),
 * se guarda en una cola persistente y se sube a la base de datos en orden.
 * Todas son idempotentes (upsert por id / update por id / delete por id),
 * así que reintentarlas tras un corte de conexión es seguro.
 */
export type Op = (
  | { kind: 'upsert'; row: any }
  | { kind: 'update'; id: string; patch: any }
  | { kind: 'delete'; id: string }
  | { kind: 'bulkUpsert'; rows: any[] }
  | { kind: 'bulkDelete'; ids: string[] }
) & { opId: string; table: TableName; label?: string; ts?: number };

export const pk = (t: TableName | string) => (t === 'settings' ? 'key' : 'id');

export const op = {
  upsert: (table: TableName, row: any): Op => ({ opId: uid(), table, kind: 'upsert', row }),
  update: (table: TableName, id: string, patch: any): Op => ({ opId: uid(), table, kind: 'update', id, patch }),
  del: (table: TableName, id: string): Op => ({ opId: uid(), table, kind: 'delete', id }),
  bulkUpsert: (table: TableName, rows: any[]): Op => ({ opId: uid(), table, kind: 'bulkUpsert', rows }),
  bulkDelete: (table: TableName, ids: string[]): Op => ({ opId: uid(), table, kind: 'bulkDelete', ids }),
};

function upsertRows(list: any[], rows: any[], key: string): any[] {
  const map = new Map(rows.map((r) => [r[key], r]));
  const existing = new Set(list.map((r) => r[key]));
  const out = list.map((r) => (map.has(r[key]) ? { ...r, ...map.get(r[key]) } : r));
  for (const r of rows) if (!existing.has(r[key])) out.push(r);
  return out;
}

/** Borra filas y replica en local las cascadas que hace Postgres. */
export function cascadeDelete(db: DB, table: TableName, ids: string[]): DB {
  const set = new Set(ids);
  const key = pk(table);
  let next: DB = { ...db, [table]: (db[table] as any[]).filter((r) => !set.has(r[key])) } as DB;
  if (table === 'teams') {
    const removedPlayers = new Set(next.players.filter((p) => set.has(p.team_id)).map((p) => p.id));
    next = {
      ...next,
      players: next.players.filter((p) => !set.has(p.team_id)),
      goals: next.goals.filter((g) => !set.has(g.team_id)).map((g) => (g.player_id && removedPlayers.has(g.player_id) ? { ...g, player_id: null } : g)),
      cards: next.cards.filter((c) => !set.has(c.team_id) && !removedPlayers.has(c.player_id)),
      goalkeepers: next.goalkeepers.filter((k) => !set.has(k.team_id) && !removedPlayers.has(k.player_id)),
      matches: next.matches.map((m) => ({
        ...m,
        home_team_id: m.home_team_id && set.has(m.home_team_id) ? null : m.home_team_id,
        away_team_id: m.away_team_id && set.has(m.away_team_id) ? null : m.away_team_id,
        walkover_winner_id: m.walkover_winner_id && set.has(m.walkover_winner_id) ? null : m.walkover_winner_id,
      })),
    };
  }
  if (table === 'players') {
    next = {
      ...next,
      goals: next.goals.map((g) => (g.player_id && set.has(g.player_id) ? { ...g, player_id: null } : g)),
      cards: next.cards.filter((c) => !set.has(c.player_id)),
      goalkeepers: next.goalkeepers.filter((k) => !set.has(k.player_id)),
    };
  }
  if (table === 'matches') {
    next = {
      ...next,
      goals: next.goals.filter((g) => !set.has(g.match_id)),
      cards: next.cards.filter((c) => !set.has(c.match_id)),
      goalkeepers: next.goalkeepers.filter((k) => !set.has(k.match_id)),
    };
  }
  return next;
}

export function applyOp(db: DB, o: Op): DB {
  const key = pk(o.table);
  const list = db[o.table] as any[];
  switch (o.kind) {
    case 'upsert':
      return { ...db, [o.table]: upsertRows(list, [o.row], key) };
    case 'bulkUpsert':
      return { ...db, [o.table]: upsertRows(list, o.rows, key) };
    case 'update':
      return { ...db, [o.table]: list.map((r) => (r[key] === o.id ? { ...r, ...o.patch } : r)) };
    case 'delete':
      return cascadeDelete(db, o.table, [o.id]);
    case 'bulkDelete':
      return cascadeDelete(db, o.table, o.ids);
  }
}

export function applyOps(db: DB, ops: Op[]): DB {
  return ops.reduce(applyOp, db);
}

function invertOne(db: DB, o: Op): Op[] {
  const key = pk(o.table);
  const list = db[o.table] as any[];
  const find = (id: string) => list.find((r) => r[key] === id);
  switch (o.kind) {
    case 'upsert': {
      const ex = find(o.row[key]);
      return [ex ? op.upsert(o.table, ex) : op.del(o.table, o.row[key])];
    }
    case 'bulkUpsert': {
      const exRows: any[] = [];
      const newIds: string[] = [];
      for (const r of o.rows) {
        const ex = find(r[key]);
        if (ex) exRows.push(ex);
        else newIds.push(r[key]);
      }
      const res: Op[] = [];
      if (exRows.length) res.push(op.bulkUpsert(o.table, exRows));
      if (newIds.length) res.push(op.bulkDelete(o.table, newIds));
      return res;
    }
    case 'update': {
      const ex = find(o.id);
      if (!ex) return [];
      const back: any = {};
      for (const k of Object.keys(o.patch)) back[k] = ex[k] ?? null;
      return [op.update(o.table, o.id, back)];
    }
    case 'delete': {
      const ex = find(o.id);
      return ex ? [op.upsert(o.table, ex)] : [];
    }
    case 'bulkDelete': {
      const rows = o.ids.map(find).filter(Boolean);
      return rows.length ? [op.bulkUpsert(o.table, rows)] : [];
    }
  }
}

/** Calcula las operaciones que deshacen `ops` partiendo del estado `db`. */
export function invertOps(db: DB, ops: Op[]): Op[] {
  const inv: Op[] = [];
  let state = db;
  for (const o of ops) {
    inv.push(...invertOne(state, o));
    state = applyOp(state, o);
  }
  return inv.reverse();
}

/** Aplica un evento de Supabase Realtime. */
export function applyChange(db: DB, table: TableName, type: string, newRow: any, oldRow: any): DB {
  const key = pk(table);
  if (type === 'DELETE') {
    const id = oldRow?.[key];
    return id == null ? db : cascadeDelete(db, table, [id]);
  }
  if (!newRow || newRow[key] == null) return db;
  const list = db[table] as any[];
  const idx = list.findIndex((r) => r[key] === newRow[key]);
  return { ...db, [table]: idx >= 0 ? list.map((r, i) => (i === idx ? newRow : r)) : [...list, newRow] };
}
