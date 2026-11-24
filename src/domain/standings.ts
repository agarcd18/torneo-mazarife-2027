import type { Card, Goal, GroupName, Lotteries, Match, Team } from '../lib/types';
import { matchScore } from './match';

export interface StandingRow {
  team: Team;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  fp: number;
  pts: number;
  pos: number;
  byLottery?: boolean;
}

export interface PendingLottery {
  key: string;
  group: GroupName;
  teamIds: string[];
}

export interface GroupStandings {
  group: GroupName;
  rows: StandingRow[];
  complete: boolean;
  played: number;
  total: number;
  pendingLotteries: PendingLottery[];
  notes: string[];
}

export const lotteryKey = (ids: string[]) => [...ids].sort().join(',');

export const POINTS = { win: 3, draw: 1, loss: 0 };
export const FAIR_PLAY = { yellow: 1, red: 3 };

function addResult(r: StandingRow, f: number, c: number) {
  r.pj++;
  r.gf += f;
  r.gc += c;
  if (f > c) {
    r.g++;
    r.pts += POINTS.win;
  } else if (f === c) {
    r.e++;
    r.pts += POINTS.draw;
  } else r.p++;
}

/**
 * Clasificación de un grupo.
 * Orden: puntos → enfrentamiento directo (puntos y DG entre empatados) → DG general → GF → fair play → sorteo guardado.
 * El sorteo NO se hace aquí (esto se ejecuta al cargar y nunca debe escribir): si hace falta y no existe,
 * se devuelve en `pendingLotteries` para que el organizador lo realice con un botón.
 */
export function computeGroupStandings(
  group: GroupName,
  teams: Team[],
  matches: Match[],
  goalsByMatch: Map<string, Goal[]>,
  cardsByMatch: Map<string, Card[]>,
  lotteries: Lotteries,
): GroupStandings {
  const gTeams = teams.filter((t) => t.group_name === group);
  const gMatches = matches.filter((m) => m.stage === 'group' && m.group_name === group);
  const finished = gMatches.filter((m) => m.status === 'finished' && m.home_team_id && m.away_team_id);
  const complete = gMatches.length > 0 && gMatches.every((m) => m.status === 'finished');

  const rows = new Map<string, StandingRow>();
  for (const t of gTeams) rows.set(t.id, { team: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, fp: 0, pts: 0, pos: 0 });

  const results: { h: string; a: string; hs: number; as: number }[] = [];
  for (const m of finished) {
    const s = matchScore(m, goalsByMatch.get(m.id) ?? []);
    results.push({ h: m.home_team_id!, a: m.away_team_id!, hs: s.home, as: s.away });
    const h = rows.get(m.home_team_id!);
    const a = rows.get(m.away_team_id!);
    if (h) addResult(h, s.home, s.away);
    if (a) addResult(a, s.away, s.home);
  }
  for (const m of gMatches) {
    for (const c of cardsByMatch.get(m.id) ?? []) {
      const r = rows.get(c.team_id);
      if (r) r.fp += c.card_type === 'yellow' ? FAIR_PLAY.yellow : FAIR_PLAY.red;
    }
  }
  const all = [...rows.values()];
  for (const r of all) r.dg = r.gf - r.gc;

  const pendingLotteries: PendingLottery[] = [];
  const notes: string[] = [];
  const byName = (a: StandingRow, b: StandingRow) => a.team.name.localeCompare(b.team.name, 'es');
  const levels = [...new Set(all.map((r) => r.pts))].sort((a, b) => b - a);
  const ordered: StandingRow[] = [];

  for (const pts of levels) {
    const tied = all.filter((r) => r.pts === pts).sort(byName);
    if (tied.length === 1) {
      ordered.push(tied[0]);
      continue;
    }
    const ids = new Set(tied.map((r) => r.team.id));
    const h2h = new Map<string, { pts: number; gd: number; gf: number }>();
    for (const id of ids) h2h.set(id, { pts: 0, gd: 0, gf: 0 });
    for (const r of results) {
      if (!ids.has(r.h) || !ids.has(r.a)) continue;
      const hh = h2h.get(r.h)!;
      const aa = h2h.get(r.a)!;
      hh.gd += r.hs - r.as;
      aa.gd += r.as - r.hs;
      hh.gf += r.hs;
      aa.gf += r.as;
      if (r.hs > r.as) hh.pts += 3;
      else if (r.hs < r.as) aa.pts += 3;
      else {
        hh.pts += 1;
        aa.pts += 1;
      }
    }
    const crits: { name: string; v: (r: StandingRow) => number }[] = [
      { name: '1º enfrentamiento directo (puntos)', v: (r) => h2h.get(r.team.id)!.pts },
      { name: '1º enfrentamiento directo (diferencia de goles)', v: (r) => h2h.get(r.team.id)!.gd },
      { name: '1º enfrentamiento directo (goles a favor)', v: (r) => h2h.get(r.team.id)!.gf },
      { name: '2º diferencia de goles general (DG)', v: (r) => r.dg },
      { name: '3º goles a favor (GF)', v: (r) => r.gf },
      { name: '4º fair play (FP)', v: (r) => -r.fp },
    ];
    const cmp = (a: StandingRow, b: StandingRow) => {
      for (const c of crits) {
        const d = c.v(b) - c.v(a);
        if (d) return d;
      }
      return 0;
    };
    const sorted = [...tied].sort((a, b) => cmp(a, b) || byName(a, b));
    const out: StandingRow[] = [];
    let usedLottery = false;
    let lotteryPending = false;
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (j < sorted.length && cmp(sorted[i], sorted[j]) === 0) j++;
      const cl = sorted.slice(i, j);
      if (cl.length > 1) {
        const key = lotteryKey(cl.map((r) => r.team.id));
        const saved = lotteries[key];
        if (saved && cl.every((r) => saved.includes(r.team.id))) {
          cl.sort((a, b) => saved.indexOf(a.team.id) - saved.indexOf(b.team.id));
          cl.forEach((r) => (r.byLottery = true));
          usedLottery = true;
        } else if (complete || cl.every((r) => r.pj > 0)) {
          pendingLotteries.push({ key, group, teamIds: cl.map((r) => r.team.id) });
          lotteryPending = true;
        }
      }
      out.push(...cl);
      i = j;
    }
    if (finished.length) {
      const used = new Set<string>();
      for (let k = 0; k < out.length - 1; k++) {
        for (const c of crits) {
          if (c.v(out[k]) !== c.v(out[k + 1])) {
            used.add(c.name);
            break;
          }
        }
      }
      const parts = [...used];
      if (usedLottery) parts.push('sorteo');
      if (lotteryPending) parts.push('PENDIENTE DE SORTEO');
      notes.push(`Empate a ${pts} pts entre ${out.map((r) => r.team.name).join(', ')}: ${parts.join(' · ') || 'sin desempatar'}`);
    }
    ordered.push(...out);
  }
  ordered.forEach((r, idx) => (r.pos = idx + 1));
  return { group, rows: ordered, complete, played: finished.length, total: gMatches.length, pendingLotteries, notes };
}
