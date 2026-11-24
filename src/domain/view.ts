import type { Announcement, Card, DB, DrawSettings, FinanceSettings, Goal, GoalkeeperStint, Lotteries, Match, Player, ScheduleSettings, Score, TascaItem, Team, TournamentPhoto, TournamentSettings } from '../lib/types';
import { groupBy } from '../lib/ids';
import { DEFAULT_DRAW, DEFAULT_FINANCES, DEFAULT_SCHEDULE, DEFAULT_TOURNAMENT, getAnnouncements, getLotteries, getPhotos, getSetting, getTascaItems } from './settings';
import { matchScore, sortMatches } from './match';
import { computeGroupStandings, GroupStandings } from './standings';
import { groupsReady, matchWinner, resolveKnockout } from './bracket';
import { computeSanctions, Sanctions } from './sanctions';
import { byNumber } from './players';

export interface View {
  db: DB;
  tournament: TournamentSettings;
  finances: FinanceSettings;
  announcements: Announcement[];
  tasca: TascaItem[];
  photos: TournamentPhoto[];
  draw: DrawSettings;
  schedule: ScheduleSettings;
  lotteries: Lotteries;
  teams: Team[];
  teamsById: Map<string, Team>;
  playersById: Map<string, Player>;
  playersByTeam: Map<string, Player[]>;
  matches: Match[]; // ordenados y con los cruces de la fase final resueltos
  matchesById: Map<string, Match>;
  goalsByMatch: Map<string, Goal[]>;
  cardsByMatch: Map<string, Card[]>;
  gkByMatch: Map<string, GoalkeeperStint[]>;
  scores: Map<string, Score>;
  standings: { A: GroupStandings; B: GroupStandings };
  groupsReady: boolean;
  champion: string | null;
  finalMatch?: Match;
  sanctions: Sanctions;
}

export function buildView(db: DB): View {
  const rawFinances = getSetting(db, 'finances', DEFAULT_FINANCES);
  const finances: FinanceSettings = {
    ...DEFAULT_FINANCES,
    ...rawFinances,
    incomes: { ...DEFAULT_FINANCES.incomes, ...(rawFinances.incomes ?? {}) },
    expenses: { ...DEFAULT_FINANCES.expenses, ...(rawFinances.expenses ?? {}) },
    movements: Array.isArray(rawFinances.movements) ? rawFinances.movements : [],
  };
  const tournament = getSetting(db, 'tournament', DEFAULT_TOURNAMENT);
  const announcements = getAnnouncements(db);
  const tasca = getTascaItems(db);
  const photos = getPhotos(db);
  const draw = getSetting(db, 'draw', DEFAULT_DRAW);
  const schedule = getSetting(db, 'schedule', DEFAULT_SCHEDULE);
  const lotteries = getLotteries(db);
  const teams = [...db.teams].sort((a, b) => (a.created_at ?? '9999').localeCompare(b.created_at ?? '9999') || a.name.localeCompare(b.name, 'es'));
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const playersById = new Map(db.players.map((p) => [p.id, p]));
  const playersByTeam = groupBy([...db.players].sort(byNumber), (p) => p.team_id);
  const goalsByMatch = groupBy(db.goals, (g) => g.match_id);
  const cardsByMatch = groupBy(db.cards, (c) => c.match_id);
  const gkByMatch = groupBy(db.goalkeepers, (k) => k.match_id);
  const raw = sortMatches(db.matches);
  const scoreOf = (m: Match) => matchScore(m, goalsByMatch.get(m.id) ?? []);
  const standings = {
    A: computeGroupStandings('A', teams, raw, goalsByMatch, cardsByMatch, lotteries),
    B: computeGroupStandings('B', teams, raw, goalsByMatch, cardsByMatch, lotteries),
  };
  const matches = resolveKnockout(raw, standings, scoreOf);
  const scores = new Map(matches.map((m) => [m.id, scoreOf(m)]));
  const matchesById = new Map(matches.map((m) => [m.id, m]));
  const finalMatch = matches.find((m) => m.code === 'F');
  const champion = finalMatch ? matchWinner(finalMatch, scores.get(finalMatch.id)!) : null;
  const sanctions = computeSanctions(matches, db.cards, db.players);
  return {
    db,
    tournament,
    finances,
    announcements,
    tasca,
    photos,
    draw,
    schedule,
    lotteries,
    teams,
    teamsById,
    playersById,
    playersByTeam,
    matches,
    matchesById,
    goalsByMatch,
    cardsByMatch,
    gkByMatch,
    scores,
    standings,
    groupsReady: groupsReady(standings),
    champion,
    finalMatch,
    sanctions,
  };
}
