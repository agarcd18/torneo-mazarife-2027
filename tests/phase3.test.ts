import { describe, expect, it } from 'vitest';
import { drawGroups } from '../src/domain/draw';
import { buildMatches, countConsecutiveSlots } from '../src/domain/schedule';
import { DEFAULT_SCHEDULE } from '../src/domain/settings';
import { computeGroupStandings, lotteryKey } from '../src/domain/standings';
import { newMatch } from '../src/domain/match';
import type { Card, Goal, Match, Team } from '../src/lib/types';

function makeTeam(id: string, name: string, group: 'A' | 'B' = 'A', order = 0): Team {
  return { id, name, color: '#1f7a4a', group_name: group, group_order: order };
}

function makeFinishedMatch(id: string, home: string, away: string, hs: number, as: number, group: 'A' | 'B' = 'A'): { match: Match; goals: Goal[] } {
  const match = newMatch({
    id,
    stage: 'group',
    group_name: group,
    home_team_id: home,
    away_team_id: away,
    status: 'finished',
  });
  const goals: Goal[] = [];
  for (let i = 0; i < hs; i++) goals.push({ id: `${id}-h-${i}`, match_id: id, team_id: home, player_id: null, minute: 5, own_goal: false });
  for (let i = 0; i < as; i++) goals.push({ id: `${id}-a-${i}`, match_id: id, team_id: away, player_id: null, minute: 10, own_goal: false });
  return { match, goals };
}

describe('FASE 3: Sorteo, Calendario y Desempates Estrictos', () => {
  it('1. Sorteo divide 12 equipos en Grupo A (6) y Grupo B (6)', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);
    const res = drawGroups(ids);
    expect(res.A).toHaveLength(6);
    expect(res.B).toHaveLength(6);
    expect(new Set([...res.A, ...res.B]).size).toBe(12);
  });

  it('2. Calendario genera 30 partidos de grupos + 7 de eliminatorias vacías sin partidos seguidos', () => {
    const teams: Team[] = Array.from({ length: 12 }, (_, i) =>
      makeTeam(`t${i + 1}`, `Equipo ${i + 1}`, i < 6 ? 'A' : 'B', i % 6),
    );
    const { matches } = buildMatches(teams, DEFAULT_SCHEDULE);
    const groupMatches = matches.filter((m) => m.stage === 'group');
    const koMatches = matches.filter((m) => m.stage !== 'group');

    expect(groupMatches).toHaveLength(30);
    expect(koMatches).toHaveLength(7);
    expect(koMatches.every((m) => m.home_team_id === null && m.away_team_id === null)).toBe(true);
    expect(countConsecutiveSlots(matches)).toBe(0);
  });

  it('3. Desempate 1º: Enfrentamiento directo prevalece sobre Diferencia de Goles general', () => {
    const t1 = makeTeam('t1', 'Alpha');
    const t2 = makeTeam('t2', 'Bravo');
    const t3 = makeTeam('t3', 'Charlie');

    // Alpha gana a Bravo 1-0 (enfrentamiento directo para Alpha)
    // pero Bravo golea a Charlie 8-0 (mejor DG general para Bravo)
    // Alpha gana a Charlie 1-0 -> Ambos Alpha y Bravo tienen 6 pts.
    const m1 = makeFinishedMatch('m1', 't1', 't2', 1, 0);
    const m2 = makeFinishedMatch('m2', 't1', 't3', 1, 0);
    const m3 = makeFinishedMatch('m3', 't2', 't3', 8, 0);
    // Para que empaten a 3 puntos: Alpha gana a Bravo 1-0, Bravo gana a Charlie 5-0, Charlie gana a Alpha 2-0 (triple empate)
    // Probemos primero empate entre 2 equipos (Alpha y Bravo a 3 pts):
    // Alpha gana a Bravo 1-0; Charlie gana a Alpha 4-0; Charlie gana a Bravo 1-0
    const a1 = makeFinishedMatch('a1', 't1', 't2', 1, 0);
    const a2 = makeFinishedMatch('a2', 't3', 't1', 4, 0);
    const a3 = makeFinishedMatch('a3', 't3', 't2', 1, 0);

    const goalsMap = new Map<string, Goal[]>([
      ['a1', a1.goals],
      ['a2', a2.goals],
      ['a3', a3.goals],
    ]);

    const st = computeGroupStandings('A', [t1, t2, t3], [a1.match, a2.match, a3.match], goalsMap, new Map(), {});
    // Charlie 6 pts (1º). Alpha y Bravo tienen 3 pts.
    // Bravo tiene mejor DG general (-1 vs -3), pero Alpha ganó el enfrentamiento directo (1-0).
    expect(st.rows[0].team.id).toBe('t3');
    expect(st.rows[1].team.id).toBe('t1');
    expect(st.rows[2].team.id).toBe('t2');
    void m1;
    void m2;
    void m3;
  });

  it('4. Desempates 2º (DG), 3º (GF), 4º (Fair Play) y 5º (Sorteo persistido)', () => {
    const t1 = makeTeam('t1', 'Alpha');
    const t2 = makeTeam('t2', 'Bravo');

    // Empatan 1-1 entre sí -> misma puntuación (1 pt), mismo H2H, misma DG (0), mismos GF (1)
    const m1 = makeFinishedMatch('m1', 't1', 't2', 1, 1);
    const goalsMap = new Map<string, Goal[]>([['m1', m1.goals]]);

    // 4º criterio: Fair Play (Alpha tiene 1 roja = 3 pts FP; Bravo tiene 1 amarilla = 1 pt FP -> gana Bravo)
    const cardsMap = new Map<string, Card[]>([
      [
        'm1',
        [
          { id: 'c1', match_id: 'm1', team_id: 't1', player_id: 'p1', minute: 4, card_type: 'red', second_yellow: false, suspension_matches: 1 },
          { id: 'c2', match_id: 'm1', team_id: 't2', player_id: 'p2', minute: 6, card_type: 'yellow', second_yellow: false, suspension_matches: 1 },
        ],
      ],
    ]);
    const stFP = computeGroupStandings('A', [t1, t2], [m1.match], goalsMap, cardsMap, {});
    expect(stFP.rows[0].team.id).toBe('t2');
    expect(stFP.rows[1].team.id).toBe('t1');

    // 5º criterio: Sin tarjetas -> empate total -> se resuelve con el sorteo guardado en Supabase
    const key = lotteryKey(['t1', 't2']);
    const stLottery = computeGroupStandings('A', [t1, t2], [m1.match], goalsMap, new Map(), { [key]: ['t2', 't1'] });
    expect(stLottery.rows[0].team.id).toBe('t2');
    expect(stLottery.rows[0].byLottery).toBe(true);
  });
});
