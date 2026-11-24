import type { Goal, GoalkeeperStint, Match, Player, Team, TournamentSettings } from '../lib/types';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/**
 * Función auxiliar de tramos por minutos (conservada para tests de tramos si se usan).
 */
export function keeperMinutes(
  stints: Pick<GoalkeeperStint, 'player_id' | 'from_minute'>[],
  concededMinutes: (number | null)[],
  duration: number,
): Map<string, { minutes: number; conceded: number }> {
  const st = [...stints].sort((a, b) => a.from_minute - b.from_minute);
  const res = new Map<string, { minutes: number; conceded: number }>();
  if (!st.length) return res;
  st.forEach((s, i) => {
    const from = clamp(s.from_minute, 0, duration);
    const to = i + 1 < st.length ? clamp(st[i + 1].from_minute, 0, duration) : duration;
    const cur = res.get(s.player_id) ?? { minutes: 0, conceded: 0 };
    cur.minutes += Math.max(0, to - from);
    res.set(s.player_id, cur);
  });
  for (const min of concededMinutes) {
    let idx = st.length - 1;
    if (min != null) {
      idx = 0;
      for (let i = 0; i < st.length; i++) if (st[i].from_minute < min) idx = i;
    }
    res.get(st[idx].player_id)!.conceded++;
  }
  return res;
}

export const keeperRatio = (conceded: number, matches: number) => (matches > 0 ? conceded / matches : Infinity);

export interface KeeperRow {
  player: Player;
  team?: Team;
  matches: number;
  conceded: number;
  /** Promedio = Goles encajados ÷ Partidos jugados (menor es mejor) */
  avg: number;
  /** Alias de avg para compatibilidad con vistas de trofeo */
  ratio: number;
}

/**
 * FASE 4: Cálculo de Portero Menos Goleado
 * - El admin asigna en el partido quién ha sido el portero principal para la estadística de ese equipo.
 * - Todos los goles en contra del partido (en tiempo reglamentario; NUNCA los de tanda de penaltis)
 *   se asignan a ese portero principal.
 * - Promedio = Goles encajados ÷ Partidos jugados. Menor es mejor.
 */
export function keeperStats(
  matches: Match[],
  goalsByMatch: Map<string, Goal[]>,
  gkByMatch: Map<string, GoalkeeperStint[]>,
  playersById: Map<string, Player>,
  teamsById: Map<string, Team>,
  _t?: TournamentSettings,
): KeeperRow[] {
  const acc = new Map<string, { matches: number; conceded: number }>();

  for (const m of matches) {
    if (m.status !== 'finished' || !m.home_team_id || !m.away_team_id) continue;
    const goals = goalsByMatch.get(m.id) ?? [];
    const stints = gkByMatch.get(m.id) ?? [];

    const sides: [string, string][] = [
      [m.home_team_id, m.away_team_id],
      [m.away_team_id, m.home_team_id],
    ];

    for (const [teamId, oppId] of sides) {
      const teamStints = stints.filter((s) => s.team_id === teamId);
      if (!teamStints.length) continue;
      // El portero principal elegido por el admin para ese partido (último asignado)
      const mainKeeperId = teamStints[teamStints.length - 1].player_id;
      // Solo cuentan los goles del partido (tabla goals); los penaltis de tanda (penalty_home/away) NO cuentan
      const oppGoalsInPlay = m.walkover_winner_id
        ? m.walkover_winner_id === oppId
          ? 3
          : 0
        : goals.filter((g) => g.team_id === oppId).length;

      const cur = acc.get(mainKeeperId) ?? { matches: 0, conceded: 0 };
      cur.matches += 1;
      cur.conceded += oppGoalsInPlay;
      acc.set(mainKeeperId, cur);
    }
  }

  const rows: KeeperRow[] = [];
  for (const [pid, a] of acc) {
    const player = playersById.get(pid);
    if (!player || a.matches <= 0) continue;
    const avg = a.conceded / a.matches;
    rows.push({
      player,
      team: teamsById.get(player.team_id),
      matches: a.matches,
      conceded: a.conceded,
      avg,
      ratio: avg,
    });
  }

  return rows.sort(
    (x, y) =>
      x.avg - y.avg ||
      y.matches - x.matches ||
      x.conceded - y.conceded ||
      x.player.name.localeCompare(y.player.name, 'es'),
  );
}

export interface ScorerRow {
  player: Player;
  team?: Team;
  goals: number;
  teamPlayed: number;
  avg: number;
}

/**
 * FASE 4: Máximo Goleador
 * - Total de goles en juego (tabla goals, sin propia puerta).
 * - Los goles de tanda de penaltis (penalty_home / penalty_away) NUNCA están en la tabla goals y NO suman.
 */
export function topScorers(matches: Match[], goals: Goal[], playersById: Map<string, Player>, teamsById: Map<string, Team>): ScorerRow[] {
  const played = new Map<string, number>();
  const counted = new Set<string>();
  for (const m of matches) {
    if (m.status === 'pending' || !m.home_team_id || !m.away_team_id) continue;
    counted.add(m.id);
    for (const t of [m.home_team_id, m.away_team_id]) played.set(t, (played.get(t) ?? 0) + 1);
  }
  const byPlayer = new Map<string, number>();
  for (const g of goals) {
    if (g.own_goal || !g.player_id || !counted.has(g.match_id)) continue;
    byPlayer.set(g.player_id, (byPlayer.get(g.player_id) ?? 0) + 1);
  }
  const rows: ScorerRow[] = [];
  for (const [pid, n] of byPlayer) {
    const player = playersById.get(pid);
    if (!player) continue;
    const pj = played.get(player.team_id) ?? 0;
    rows.push({ player, team: teamsById.get(player.team_id), goals: n, teamPlayed: pj, avg: pj ? n / pj : 0 });
  }
  return rows.sort((a, b) => b.goals - a.goals || b.avg - a.avg || a.player.name.localeCompare(b.player.name, 'es'));
}
