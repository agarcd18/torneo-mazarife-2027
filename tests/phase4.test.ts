import { describe, expect, it } from 'vitest';
import { clockElapsed, currentMinute, newMatch } from '../src/domain/match';
import { decideCard } from '../src/domain/sanctions';
import { keeperStats, topScorers } from '../src/domain/stats';
import { matchWinner } from '../src/domain/bracket';
import { DEFAULT_TOURNAMENT } from '../src/domain/settings';
import type { Card, Goal, GoalkeeperStint, Player, Team } from '../src/lib/types';

describe('FASE 4: Motor del Partido (Cronómetro Local, Doble Amarilla, Portero y Penaltis)', () => {
  it('1. Cronómetro inteligente local calcula el tiempo por diferencia de timestamp sin polling a BBDD', () => {
    const startedAt = new Date('2026-07-15T18:00:00.000Z').toISOString();
    const m = newMatch({
      stage: 'group',
      status: 'live',
      clock_running: true,
      clock_base: 120, // 2 minutos acumulados antes de la última pausa
      clock_started_at: startedAt,
      period: 1,
    });
    const now = Date.parse('2026-07-15T18:03:30.000Z'); // +3m 30s (210s) desde que se reanudó
    expect(clockElapsed(m, now)).toBe(330); // 120 + 210 = 330s (05:30)
    expect(currentMinute(m, 10, now)).toBe(6); // minuto 6 de la 1ª parte
  });

  it('2. Doble amarilla se transforma automáticamente en Roja e impide nuevas tarjetas al expulsado', () => {
    const cards: Card[] = [];
    // 1ª amarilla
    const first = decideCard(cards, 'p1', 'yellow');
    expect(first).toEqual({ card_type: 'yellow', second_yellow: false });

    cards.push({
      id: 'c1',
      match_id: 'm1',
      team_id: 't1',
      player_id: 'p1',
      minute: 4,
      card_type: 'yellow',
      second_yellow: false,
      suspension_matches: 1,
    });

    // 2ª amarilla -> Roja automática
    const second = decideCard(cards, 'p1', 'yellow');
    expect(second).toEqual({ card_type: 'red', second_yellow: true });

    cards.push({
      id: 'c2',
      match_id: 'm1',
      team_id: 't1',
      player_id: 'p1',
      minute: 9,
      card_type: 'red',
      second_yellow: true,
      suspension_matches: 1,
    });

    // Ya expulsado -> bloquea nuevas tarjetas
    const third = decideCard(cards, 'p1', 'yellow');
    expect('error' in third).toBe(true);
  });

  it('3. REGLA CRÍTICA: Los penaltis de tanda deciden eliminatoria pero NO suman a Goleador ni penalizan al Portero', () => {
    const t1: Team = { id: 't1', name: 'Villar FS', color: '#1f7a4a', group_name: 'A', group_order: 0 };
    const t2: Team = { id: 't2', name: 'Mazarife United', color: '#d4af37', group_name: 'B', group_order: 0 };
    const teamsById = new Map([
      ['t1', t1],
      ['t2', t2],
    ]);

    const pScorer1: Player = { id: 'p1', team_id: 't1', name: 'Goleador Local', number: 9, is_goalkeeper: false };
    const pKeeper1: Player = { id: 'gk1', team_id: 't1', name: 'Portero Local', number: 1, is_goalkeeper: true };
    const pScorer2: Player = { id: 'p2', team_id: 't2', name: 'Goleador Rival', number: 10, is_goalkeeper: false };
    const pKeeper2: Player = { id: 'gk2', team_id: 't2', name: 'Portero Rival', number: 13, is_goalkeeper: true };
    const playersById = new Map([
      ['p1', pScorer1],
      ['gk1', pKeeper1],
      ['p2', pScorer2],
      ['gk2', pKeeper2],
    ]);

    // Partido de Cuartos (QF1) que termina 1-1 en tiempo reglamentario y 5-4 en tanda de penaltis
    const qf = newMatch({
      id: 'qf1',
      stage: 'QF',
      code: 'QF1',
      home_team_id: 't1',
      away_team_id: 't2',
      status: 'finished',
      penalty_home: 5,
      penalty_away: 4,
    });

    // Goles en juego reglamentario: 1 de p1 y 1 de p2
    const goals: Goal[] = [
      { id: 'g1', match_id: 'qf1', team_id: 't1', player_id: 'p1', minute: 12, own_goal: false },
      { id: 'g2', match_id: 'qf1', team_id: 't2', player_id: 'p2', minute: 24, own_goal: false },
    ];
    const goalsByMatch = new Map([['qf1', goals]]);

    // Porteros principales asignados por el admin al final del partido
    const stints: GoalkeeperStint[] = [
      { id: 'k1', match_id: 'qf1', team_id: 't1', player_id: 'gk1', from_minute: 0 },
      { id: 'k2', match_id: 'qf1', team_id: 't2', player_id: 'gk2', from_minute: 0 },
    ];
    const gkByMatch = new Map([['qf1', stints]]);

    // 1) El ganador de la eliminatoria es t1 gracias a los penaltis (5-4)
    expect(matchWinner(qf, { home: 1, away: 1 })).toBe('t1');

    // 2) Los goleadores solo tienen 1 gol cada uno (los 5 y 4 de la tanda NO suman)
    const scorers = topScorers([qf], goals, playersById, teamsById);
    expect(scorers.find((s) => s.player.id === 'p1')?.goals).toBe(1);
    expect(scorers.find((s) => s.player.id === 'p2')?.goals).toBe(1);

    // 3) Los porteros solo tienen 1 gol encajado en 1 partido (Promedio = 1 / 1 = 1.00), sin contar la tanda
    const keepers = keeperStats([qf], goalsByMatch, gkByMatch, playersById, teamsById, DEFAULT_TOURNAMENT);
    const k1 = keepers.find((k) => k.player.id === 'gk1')!;
    const k2 = keepers.find((k) => k.player.id === 'gk2')!;
    expect(k1.conceded).toBe(1);
    expect(k1.matches).toBe(1);
    expect(k1.avg).toBe(1);
    expect(k2.conceded).toBe(1);
    expect(k2.avg).toBe(1);
  });
});
