import type { Card, Match, Player } from '../lib/types';
import { groupBy } from '../lib/ids';

export interface SanctionReason {
  reason: string;
  matchId: string;
  n: number;
}

export interface PlayerSanction {
  playerId: string;
  reasons: SanctionReason[];
  suspendedMatchIds: string[];
  /** partidos de sanción que aún no tienen partido asignado (p. ej. el cruce no está definido) */
  pending: number;
  active: boolean;
  yellows: number;
  reds: number;
  accumulatedYellows: number;
}

export interface Sanctions {
  byPlayer: Map<string, PlayerSanction>;
  isSuspended(playerId: string, matchId: string): boolean;
}

/**
 * Sanciones automáticas:
 *  - Roja (directa o por doble amarilla): `suspension_matches` partidos (mínimo 1).
 *  - Cada 3 amarillas acumuladas en fase de grupos: 1 partido.
 *    (Las amarillas del partido en que el jugador ve la roja por doble amarilla no cuentan para la acumulación.)
 * La sanción se cumple en los siguientes partidos de su equipo según el calendario.
 */
export function computeSanctions(matches: Match[], cards: Card[], players: Player[]): Sanctions {
  const teamMatches = new Map<string, Match[]>();
  for (const m of matches) {
    for (const t of [m.home_team_id, m.away_team_id]) {
      if (!t) continue;
      const l = teamMatches.get(t);
      if (l) l.push(m);
      else teamMatches.set(t, [m]);
    }
  }
  const cardsByPlayer = groupBy(cards, (c) => c.player_id);
  const byPlayer = new Map<string, PlayerSanction>();
  const suspended = new Set<string>();

  for (const p of players) {
    const pc = cardsByPlayer.get(p.id);
    if (!pc?.length) continue;
    const tm = teamMatches.get(p.team_id) ?? [];
    const idxOf = new Map(tm.map((m, i) => [m.id, i]));
    const list = pc
      .filter((c) => idxOf.has(c.match_id))
      .sort((a, b) => idxOf.get(a.match_id)! - idxOf.get(b.match_id)! || (a.minute ?? 0) - (b.minute ?? 0));
    const doubleYellowMatches = new Set(list.filter((c) => c.card_type === 'red' && c.second_yellow).map((c) => c.match_id));
    const items: (SanctionReason & { after: number })[] = [];
    let acc = 0;
    let yellows = 0;
    let reds = 0;
    for (const c of list) {
      const i = idxOf.get(c.match_id)!;
      if (c.card_type === 'red') {
        reds++;
        items.push({ after: i, n: Math.max(1, c.suspension_matches || 1), reason: c.second_yellow ? 'Roja por doble amarilla' : 'Roja directa', matchId: c.match_id });
      } else {
        yellows++;
        if (tm[i].stage === 'group' && !doubleYellowMatches.has(c.match_id)) {
          acc++;
          if (acc % 3 === 0) items.push({ after: i, n: 1, reason: '3 amarillas acumuladas', matchId: c.match_id });
        }
      }
    }
    let nextFree = 0;
    const susp: string[] = [];
    let pending = 0;
    for (const it of items) {
      const start = Math.max(it.after + 1, nextFree);
      for (let k = 0; k < it.n; k++) {
        const idx = start + k;
        if (idx < tm.length) susp.push(tm[idx].id);
        else pending++;
      }
      nextFree = start + it.n;
    }
    susp.forEach((mid) => suspended.add(`${p.id}|${mid}`));
    const active = pending > 0 || susp.some((mid) => tm[idxOf.get(mid)!]?.status !== 'finished');
    byPlayer.set(p.id, {
      playerId: p.id,
      reasons: items.map(({ after: _a, ...r }) => r),
      suspendedMatchIds: susp,
      pending,
      active,
      yellows,
      reds,
      accumulatedYellows: acc,
    });
  }
  return { byPlayer, isSuspended: (pid, mid) => suspended.has(`${pid}|${mid}`) };
}

/** Decide qué tarjeta se guarda: la 2.ª amarilla en el mismo partido se convierte en roja. */
export function decideCard(matchCards: Card[], playerId: string, requested: 'yellow' | 'red'): { card_type: 'yellow' | 'red'; second_yellow: boolean } | { error: string } {
  const mine = matchCards.filter((c) => c.player_id === playerId);
  if (mine.some((c) => c.card_type === 'red')) return { error: 'Este jugador ya está expulsado en este partido' };
  if (requested === 'yellow' && mine.some((c) => c.card_type === 'yellow')) return { card_type: 'red', second_yellow: true };
  return { card_type: requested, second_yellow: false };
}
