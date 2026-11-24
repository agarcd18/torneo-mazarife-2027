import type {
  Announcement,
  Card,
  DB,
  FinanceSettings,
  Goal,
  GoalkeeperStint,
  Match,
  Player,
  Setting,
  TascaItem,
  Team,
} from '../lib/types';
import { backend } from '../lib/backend';
import { op } from '../lib/ops';
import { buildView, View } from './view';
import { DEFAULT_FINANCES, getAnnouncements, getSetting, getTascaItems } from './settings';
import { stageLabel } from '../lib/format';
import { sideLabels } from '../lib/share';

export const EMERGENCY_SNAPSHOT_KEY = 'torneo_emergency_snapshot';

export interface MasterBackupPayload {
  app: 'torneo-futsal-villar-de-mazarife';
  version: number;
  exportedAt: string;
  teams: Team[];
  players: Player[];
  matches: Match[];
  goals: Goal[];
  cards: Card[];
  goalkeepers: GoalkeeperStint[];
  settings: Setting[];
  finance_entries: any[];
  announcements: Announcement[];
  tasca_items: TascaItem[];
}

export interface BackupSummary {
  exportedAt: string | null;
  teamsCount: number;
  playersCount: number;
  matchesCount: number;
  goalsCount: number;
  cardsCount: number;
}

/** Genera el nombre exacto: backup-torneo-mazarife-YYYY-MM-DD-HHmm.json */
export function backupFilename(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `backup-torneo-mazarife-${yyyy}-${mm}-${dd}-${hh}${min}.json`;
}

/** Construye el JSON Maestro con el estado completo de todas las tablas */
export function createMasterBackup(db: DB): MasterBackupPayload {
  const finances = getSetting(db, 'finances', DEFAULT_FINANCES);
  const announcements = getAnnouncements(db);
  const tasca_items = getTascaItems(db);

  // Asegurar que settings contiene también anuncios, tasca y finanzas sincronizados
  const settingsMap = new Map<string, Setting>(db.settings.map((s) => [s.key, s]));
  if (!settingsMap.has('finances')) settingsMap.set('finances', { key: 'finances', value: finances });
  if (!settingsMap.has('announcements')) settingsMap.set('announcements', { key: 'announcements', value: { items: announcements } });
  if (!settingsMap.has('tasca')) settingsMap.set('tasca', { key: 'tasca', value: { items: tasca_items } });

  return {
    app: 'torneo-futsal-villar-de-mazarife',
    version: 2,
    exportedAt: new Date().toISOString(),
    teams: db.teams ?? [],
    players: db.players ?? [],
    matches: db.matches ?? [],
    goals: db.goals ?? [],
    cards: db.cards ?? [],
    goalkeepers: db.goalkeepers ?? [],
    settings: [...settingsMap.values()],
    finance_entries: finances.movements ?? [],
    announcements,
    tasca_items,
  };
}

/** Valida un archivo JSON y devuelve el payload normalizado y su resumen */
export function validateBackupJSON(
  rawText: string,
): { ok: true; payload: MasterBackupPayload; summary: BackupSummary } | { ok: false; error: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Estructura JSON vacía o inválida.' };
  }

  const hasTournamentTables =
    Array.isArray(parsed.teams) &&
    Array.isArray(parsed.players) &&
    Array.isArray(parsed.matches);

  if (!hasTournamentTables) {
    return {
      ok: false,
      error: 'El archivo JSON no pertenece al Torneo de Villar de Mazarife (faltan las tablas teams, players o matches).',
    };
  }

  const settingsList: Setting[] = Array.isArray(parsed.settings) ? [...parsed.settings] : [];
  const upsertLocalSetting = (key: string, value: any) => {
    const idx = settingsList.findIndex((s) => s && s.key === key);
    if (idx >= 0) settingsList[idx] = { key, value };
    else settingsList.push({ key, value });
  };

  if (Array.isArray(parsed.announcements) && !settingsList.some((s) => s.key === 'announcements')) {
    upsertLocalSetting('announcements', { items: parsed.announcements });
  }
  if (Array.isArray(parsed.tasca_items) && !settingsList.some((s) => s.key === 'tasca')) {
    upsertLocalSetting('tasca', { items: parsed.tasca_items });
  }

  const payload: MasterBackupPayload = {
    app: 'torneo-futsal-villar-de-mazarife',
    version: Number(parsed.version || 2),
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    teams: parsed.teams as Team[],
    players: parsed.players as Player[],
    matches: parsed.matches as Match[],
    goals: Array.isArray(parsed.goals) ? (parsed.goals as Goal[]) : [],
    cards: Array.isArray(parsed.cards) ? (parsed.cards as Card[]) : [],
    goalkeepers: Array.isArray(parsed.goalkeepers) ? (parsed.goalkeepers as GoalkeeperStint[]) : [],
    settings: settingsList,
    finance_entries: Array.isArray(parsed.finance_entries) ? parsed.finance_entries : [],
    announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
    tasca_items: Array.isArray(parsed.tasca_items) ? parsed.tasca_items : [],
  };

  return {
    ok: true,
    payload,
    summary: {
      exportedAt: payload.exportedAt,
      teamsCount: payload.teams.length,
      playersCount: payload.players.length,
      matchesCount: payload.matches.length,
      goalsCount: payload.goals.length,
      cardsCount: payload.cards.length,
    },
  };
}

/**
 * Restaura una copia de seguridad en Supabase / Backend respetando el orden relacional estricto:
 * 1º teams y settings (incluyendo anuncios, tasca y finanzas)
 * 2º players y matches
 * 3º goals, cards, goalkeepers y finance_entries
 */
export async function restoreBackupToCloud(
  payload: MasterBackupPayload,
  currentDb: DB | null,
  onProgress: (msg: string) => void,
): Promise<void> {
  // 0) Si hay registros actuales que no están en la copia, los limpiamos primero de hijos a padres
  //    para que la restauración deje exactamente el estado de la copia sin errores de FK.
  if (currentDb) {
    onProgress('Preparando tablas en la nube…');
    const keepGoals = new Set(payload.goals.map((g) => g.id));
    const keepCards = new Set(payload.cards.map((c) => c.id));
    const keepGk = new Set(payload.goalkeepers.map((k) => k.id));
    const keepMatches = new Set(payload.matches.map((m) => m.id));
    const keepPlayers = new Set(payload.players.map((p) => p.id));
    const keepTeams = new Set(payload.teams.map((t) => t.id));

    const delGoals = currentDb.goals.filter((g) => !keepGoals.has(g.id)).map((g) => g.id);
    const delCards = currentDb.cards.filter((c) => !keepCards.has(c.id)).map((c) => c.id);
    const delGk = currentDb.goalkeepers.filter((k) => !keepGk.has(k.id)).map((k) => k.id);
    const delMatches = currentDb.matches.filter((m) => !keepMatches.has(m.id)).map((m) => m.id);
    const delPlayers = currentDb.players.filter((p) => !keepPlayers.has(p.id)).map((p) => p.id);
    const delTeams = currentDb.teams.filter((t) => !keepTeams.has(t.id)).map((t) => t.id);

    if (delGoals.length) await backend.apply(op.bulkDelete('goals', delGoals));
    if (delCards.length) await backend.apply(op.bulkDelete('cards', delCards));
    if (delGk.length) await backend.apply(op.bulkDelete('goalkeepers', delGk));
    if (delMatches.length) await backend.apply(op.bulkDelete('matches', delMatches));
    if (delPlayers.length) await backend.apply(op.bulkDelete('players', delPlayers));
    if (delTeams.length) await backend.apply(op.bulkDelete('teams', delTeams));
  }

  // PASO 1: Primero teams y settings (incluyendo anuncios, tasca y contabilidad)
  onProgress(`Paso 1/3: Subiendo equipos (${payload.teams.length}) y ajustes…`);
  if (payload.teams.length) {
    await backend.apply(op.bulkUpsert('teams', payload.teams));
  }
  if (payload.settings.length) {
    await backend.apply(op.bulkUpsert('settings', payload.settings));
  }

  // PASO 2: Segundo players y matches
  onProgress(`Paso 2/3: Subiendo jugadores (${payload.players.length}) y partidos (${payload.matches.length})…`);
  if (payload.players.length) {
    await backend.apply(op.bulkUpsert('players', payload.players));
  }
  if (payload.matches.length) {
    await backend.apply(op.bulkUpsert('matches', payload.matches));
  }

  // PASO 3: Tercero goals, cards, goalkeepers y finance_entries
  onProgress(
    `Paso 3/3: Subiendo goles (${payload.goals.length}), tarjetas (${payload.cards.length}), porteros (${payload.goalkeepers.length}) y contabilidad…`,
  );
  if (payload.goals.length) {
    await backend.apply(op.bulkUpsert('goals', payload.goals));
  }
  if (payload.cards.length) {
    await backend.apply(op.bulkUpsert('cards', payload.cards));
  }
  if (payload.goalkeepers.length) {
    await backend.apply(op.bulkUpsert('goalkeepers', payload.goalkeepers));
  }

  // Guardar también esta copia como el último snapshot de emergencia del dispositivo
  saveEmergencySnapshotFromPayload(payload);
}

/* ------------------------------------------------------------------ */
/* Auto-Backup Local de Emergencia (torneo_emergency_snapshot)         */
/* ------------------------------------------------------------------ */
export function saveEmergencySnapshot(db: DB): void {
  try {
    const payload = createMasterBackup(db);
    localStorage.setItem(EMERGENCY_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

export function saveEmergencySnapshotFromPayload(payload: MasterBackupPayload): void {
  try {
    localStorage.setItem(EMERGENCY_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadEmergencySnapshot(): { payload: MasterBackupPayload; summary: BackupSummary } | null {
  try {
    const raw = localStorage.getItem(EMERGENCY_SNAPSHOT_KEY);
    if (!raw) return null;
    const res = validateBackupJSON(raw);
    return res.ok ? { payload: res.payload, summary: res.summary } : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Exportación rápida para Excel / Archivo Histórico (CSV)             */
/* ------------------------------------------------------------------ */
function escCSV(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sectionCSV(title: string, headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [
    title,
    headers.map(escCSV).join(';'),
    ...rows.map((r) => r.map(escCSV).join(';')),
  ];
  return lines.join('\r\n');
}

export function buildTournamentExcelCSV(v: View): string {
  const fee = Number(v.tournament.registrationFee ?? 100);

  // 1. Equipos y Pagos
  const teamsSec = sectionCSV(
    '=== 1. EQUIPOS E INSCRIPCIONES ===',
    ['Equipo', 'Grupo', 'Jugadores', 'Estado Pago', 'Importe (€)'],
    v.teams.map((t) => [
      t.name,
      t.group_name ?? 'Sin grupo',
      (v.playersByTeam.get(t.id) ?? []).length,
      t.payment_status === 'paid' ? 'PAGADO' : 'PENDIENTE',
      t.payment_status === 'paid' ? Number(t.payment_amount ?? fee) : 0,
    ]),
  );

  // 2. Clasificación Grupos A y B
  const standingsRows: (string | number)[][] = [];
  for (const g of ['A', 'B'] as const) {
    for (const r of v.standings[g].rows) {
      standingsRows.push([
        `Grupo ${g}`,
        r.pos,
        r.team.name,
        r.pts,
        r.pj,
        r.g,
        r.e,
        r.p,
        r.gf,
        r.gc,
        r.dg,
        r.fp,
        r.pos <= 4 ? 'Clasificado Cuartos' : 'Eliminado',
      ]);
    }
  }
  const standingsSec = sectionCSV(
    '=== 2. CLASIFICACIÓN DE GRUPOS ===',
    ['Grupo', 'Puesto', 'Equipo', 'Puntos', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'DG', 'Fair Play', 'Zona'],
    standingsRows,
  );

  // 3. Resultados de Partidos
  const matchesSec = sectionCSV(
    '=== 3. CALENDARIO Y RESULTADOS DE PARTIDOS ===',
    ['Fase', 'Fecha', 'Hora', 'Pista', 'Equipo Local', 'Goles Local', 'Goles Visitante', 'Equipo Visitante', 'Penaltis', 'Estado'],
    v.matches.map((m) => {
      const [hn, an] = sideLabels(v, m);
      const sc = v.scores.get(m.id) ?? { home: 0, away: 0 };
      const pens =
        m.stage !== 'group' && m.penalty_home != null && m.penalty_away != null
          ? `${m.penalty_home}-${m.penalty_away}`
          : '';
      return [
        stageLabel(m),
        m.match_date ?? '',
        m.match_time ?? '',
        m.court ?? 1,
        hn,
        m.status === 'pending' ? '' : sc.home,
        m.status === 'pending' ? '' : sc.away,
        an,
        pens,
        m.status === 'finished' ? 'Finalizado' : m.status === 'live' ? 'En Juego' : 'Pendiente',
      ];
    }),
  );

  // 4. Contabilidad y Balance
  const fin: FinanceSettings = v.finances;
  const paidTeams = v.teams.filter((t) => t.payment_status === 'paid');
  const regInc = paidTeams.reduce((a, t) => a + Number(t.payment_amount ?? fee), 0);
  const totInc = regInc + Number(fin.incomes.tasca || 0) + Number(fin.incomes.sponsors || 0) + Number(fin.incomes.other || 0);
  const totExp =
    Number(fin.expenses.referees || 0) +
    Number(fin.expenses.trophies || 0) +
    Number(fin.expenses.insurance || 0) +
    Number(fin.expenses.facilities || 0) +
    Number(fin.expenses.other || 0);

  const financeSec = sectionCSV(
    '=== 4. CONTABILIDAD Y BALANCE DEL TORNEO ===',
    ['Tipo', 'Partida', 'Importe (€)'],
    [
      ['INGRESO', `Inscripciones (${paidTeams.length} equipos pagados)`, regInc],
      ['INGRESO', 'Barra / Tasca', Number(fin.incomes.tasca || 0)],
      ['INGRESO', 'Patrocinadores', Number(fin.incomes.sponsors || 0)],
      ['INGRESO', 'Otros ingresos', Number(fin.incomes.other || 0)],
      ['TOTAL INGRESOS', '', totInc],
      ['GASTO', 'Árbitros', Number(fin.expenses.referees || 0)],
      ['GASTO', 'Trofeos y premios', Number(fin.expenses.trophies || 0)],
      ['GASTO', 'Seguros', Number(fin.expenses.insurance || 0)],
      ['GASTO', 'Instalaciones', Number(fin.expenses.facilities || 0)],
      ['GASTO', 'Otros gastos', Number(fin.expenses.other || 0)],
      ['TOTAL GASTOS', '', totExp],
      ['BALANCE FINAL (BENEFICIO / PÉRDIDA)', '', totInc - totExp],
    ],
  );

  return '\ufeff' + [teamsSec, standingsSec, matchesSec, financeSec].join('\r\n\r\n');
}

export { buildView };
