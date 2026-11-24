import type { GroupName, Match, Score, Stage } from '../lib/types';
import type { GroupStandings } from './standings';

export type Source = { kind: 'pos'; group: GroupName; pos: number } | { kind: 'winner'; code: string };

export interface KoSlot {
  code: string;
  stage: Exclude<Stage, 'group'>;
  label: string;
  short: string;
  home: Source;
  away: Source;
}

const P = (group: GroupName, pos: number): Source => ({ kind: 'pos', group, pos });
const W = (code: string): Source => ({ kind: 'winner', code });

export const KO_PLAN: KoSlot[] = [
  { code: 'QF1', stage: 'QF', label: 'Cuartos 1', short: 'C1', home: P('A', 1), away: P('B', 4) },
  { code: 'QF2', stage: 'QF', label: 'Cuartos 2', short: 'C2', home: P('A', 2), away: P('B', 3) },
  { code: 'QF3', stage: 'QF', label: 'Cuartos 3', short: 'C3', home: P('A', 3), away: P('B', 2) },
  { code: 'QF4', stage: 'QF', label: 'Cuartos 4', short: 'C4', home: P('A', 4), away: P('B', 1) },
  { code: 'SF1', stage: 'SF', label: 'Semifinal 1', short: 'SF1', home: W('QF1'), away: W('QF2') },
  { code: 'SF2', stage: 'SF', label: 'Semifinal 2', short: 'SF2', home: W('QF3'), away: W('QF4') },
  { code: 'F', stage: 'F', label: 'Final', short: 'F', home: W('SF1'), away: W('SF2') },
];

export const koSlot = (code: string | null) => KO_PLAN.find((k) => k.code === code);

export function sourceLabel(s: Source): string {
  if (s.kind === 'pos') return `${s.pos}.º ${s.group}`;
  return `Ganador ${koSlot(s.code)?.short ?? s.code}`;
}

/** Ganador de un partido finalizado (marcador, incomparecencia o penaltis en eliminatoria). */
export function matchWinner(m: Match, score: Score): string | null {
  if (m.status !== 'finished' || !m.home_team_id || !m.away_team_id) return null;
  if (m.walkover_winner_id) return m.walkover_winner_id;
  if (score.home > score.away) return m.home_team_id;
  if (score.away > score.home) return m.away_team_id;
  if (m.stage !== 'group' && m.penalty_home != null && m.penalty_away != null && m.penalty_home !== m.penalty_away) {
    return m.penalty_home > m.penalty_away ? m.home_team_id : m.away_team_id;
  }
  return null;
}

export function groupsReady(st: { A: GroupStandings; B: GroupStandings }): boolean {
  return st.A.complete && st.B.complete && !st.A.pendingLotteries.length && !st.B.pendingLotteries.length;
}

/**
 * Rellena los equipos de la fase final a partir de la clasificación y de los ganadores.
 * Es un cálculo (no escribe nada). Si el organizador asignó equipos a mano en el partido, se respetan.
 */
export function resolveKnockout(matches: Match[], st: { A: GroupStandings; B: GroupStandings }, scoreOf: (m: Match) => Score): Match[] {
  const ready = groupsReady(st);
  const byCode = new Map(matches.filter((m) => m.code).map((m) => [m.code!, m]));
  const resolved = new Map<string, Match>();
  const fromSource = (s: Source): string | null => {
    if (s.kind === 'pos') return ready ? st[s.group].rows[s.pos - 1]?.team.id ?? null : null;
    const m = resolved.get(s.code);
    return m ? matchWinner(m, scoreOf(m)) : null;
  };
  for (const slot of KO_PLAN) {
    const m = byCode.get(slot.code);
    if (!m) continue;
    resolved.set(slot.code, {
      ...m,
      home_team_id: m.home_team_id ?? fromSource(slot.home),
      away_team_id: m.away_team_id ?? fromSource(slot.away),
    });
  }
  return matches.map((m) => (m.code && resolved.get(m.code)) || m);
}
