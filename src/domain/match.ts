import type { Goal, Match, Score, TournamentSettings } from '../lib/types';
import { uid } from '../lib/ids';

/** Marcador de un partido. Incomparecencia/retraso = 3-0. */
export function matchScore(m: Match, goals: Goal[]): Score {
  if (m.walkover_winner_id) {
    return {
      home: m.walkover_winner_id === m.home_team_id ? 3 : 0,
      away: m.walkover_winner_id === m.away_team_id ? 3 : 0,
    };
  }
  let home = 0;
  let away = 0;
  for (const g of goals) {
    if (g.match_id !== m.id) continue;
    if (g.team_id === m.home_team_id) home++;
    else if (g.team_id === m.away_team_id) away++;
  }
  return { home, away };
}

export function sortMatches(ms: Match[]): Match[] {
  return [...ms].sort(
    (a, b) =>
      (a.match_date ?? '9999').localeCompare(b.match_date ?? '9999') ||
      (a.match_time ?? '99').localeCompare(b.match_time ?? '99') ||
      a.sort_index - b.sort_index ||
      (a.court ?? 0) - (b.court ?? 0),
  );
}

export function matchDuration(m: Pick<Match, 'stage'>, t: TournamentSettings): number {
  return m.stage === 'group' ? t.groupMinutes : t.finalMinutes;
}

/** Segundos transcurridos en la parte actual. */
export function clockElapsed(m: Match, now: number): number {
  let e = m.clock_base || 0;
  if (m.clock_running && m.clock_started_at) e += Math.max(0, (now - Date.parse(m.clock_started_at)) / 1000);
  return e;
}

/** Minuto de juego (1..duración) según el cronómetro. */
export function currentMinute(m: Match, halfMinutes: number, now: number): number {
  const e = clockElapsed(m, now);
  const inHalf = Math.min(halfMinutes, Math.floor(e / 60) + 1);
  return (Math.max(1, m.period) - 1) * halfMinutes + inHalf;
}

export function newMatch(p: Partial<Match> & Pick<Match, 'stage'>): Match {
  return {
    id: uid(),
    group_name: null,
    round: null,
    code: null,
    match_date: null,
    match_time: null,
    court: 1,
    sort_index: 0,
    home_team_id: null,
    away_team_id: null,
    status: 'pending',
    walkover_winner_id: null,
    penalty_home: null,
    penalty_away: null,
    clock_running: false,
    clock_base: 0,
    clock_started_at: null,
    period: 1,
    ...p,
  };
}
