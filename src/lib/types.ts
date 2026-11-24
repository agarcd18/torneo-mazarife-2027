export type GroupName = 'A' | 'B';
export type Stage = 'group' | 'QF' | 'SF' | 'F';
export type MatchStatus = 'pending' | 'live' | 'finished';
export type CardType = 'yellow' | 'red';

export type PaymentStatus = 'paid' | 'pending';

export interface Team {
  id: string;
  name: string;
  color: string;
  group_name: GroupName | null;
  group_order: number | null;
  payment_status?: PaymentStatus;
  payment_amount?: number | null;
  paid_at?: string | null;
  created_at?: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  number: number | null;
  is_goalkeeper: boolean;
  created_at?: string;
}

export interface Match {
  id: string;
  stage: Stage;
  group_name: GroupName | null;
  round: number | null;
  code: string | null; // QF1..QF4, SF1, SF2, F
  match_date: string | null; // YYYY-MM-DD
  match_time: string | null; // HH:MM
  court: number | null;
  sort_index: number;
  home_team_id: string | null;
  away_team_id: string | null;
  status: MatchStatus;
  walkover_winner_id: string | null;
  penalty_home: number | null;
  penalty_away: number | null;
  clock_running: boolean;
  clock_base: number; // segundos acumulados en la parte actual
  clock_started_at: string | null;
  period: number; // 1 o 2
  created_at?: string;
}

export interface Goal {
  id: string;
  match_id: string;
  team_id: string; // equipo al que sube el gol al marcador
  player_id: string | null;
  minute: number | null;
  own_goal: boolean;
  created_at?: string;
}

export interface Card {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  minute: number | null;
  card_type: CardType;
  second_yellow: boolean;
  suspension_matches: number;
  created_at?: string;
}

export interface GoalkeeperStint {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  from_minute: number;
  created_at?: string;
}

export interface Setting {
  key: string;
  value: any;
}

export interface DB {
  teams: Team[];
  players: Player[];
  matches: Match[];
  goals: Goal[];
  cards: Card[];
  goalkeepers: GoalkeeperStint[];
  settings: Setting[];
}

export type TableName = keyof DB;
export const TABLES: TableName[] = ['teams', 'players', 'matches', 'goals', 'cards', 'goalkeepers', 'settings'];

export const emptyDB = (): DB => ({
  teams: [],
  players: [],
  matches: [],
  goals: [],
  cards: [],
  goalkeepers: [],
  settings: [],
});

export interface TournamentSettings {
  name: string;
  numTeams: number;
  registrationFee: number;
  groupMinutes: number;
  finalMinutes: number;
}

export interface FinanceMovement {
  id: string;
  kind: 'income' | 'expense';
  category: string;
  concept: string;
  amount: number;
  date: string;
}

export interface FinanceSettings {
  incomes: {
    tasca: number;
    sponsors: number;
    other: number;
  };
  expenses: {
    referees: number;
    trophies: number;
    insurance: number;
    facilities: number;
    other: number;
  };
  notes?: string;
  movements: FinanceMovement[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  tag: string; // ej. "20:00h", "IMPORTANTE", "SORTEO"
  pinned: boolean;
  created_at: string;
}

export interface TascaItem {
  id: string;
  category: 'Comida / Bocadillos' | 'Bebidas' | 'Combos / Otros';
  name: string;
  price: number;
  available: boolean;
}

export interface TournamentPhoto {
  id: string;
  url: string;
  storage_path?: string | null;
  author: string;
  caption: string;
  created_at: string;
}

export interface DrawSettings {
  confirmed: boolean;
  doneAt: string | null;
  confirmedAt: string | null;
}

export interface ScheduleDay {
  date: string;
  start: string;
  end: string;
}

export interface ScheduleSettings {
  days: ScheduleDay[];
  slotMinutes: number;
  courts: number;
  knockoutDate: string;
  knockoutTimes: string[];
}

export type Lotteries = Record<string, string[]>;

export interface AuditEntry {
  id: number | string;
  at: string;
  actor_email: string | null;
  table_name: string;
  action: string;
  row_id: string | null;
  old_data: any;
  new_data: any;
}

export interface Score {
  home: number;
  away: number;
}
