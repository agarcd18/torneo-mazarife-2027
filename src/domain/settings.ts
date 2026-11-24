import type { Announcement, DB, DrawSettings, FinanceSettings, Lotteries, ScheduleSettings, TascaItem, TournamentPhoto, TournamentSettings } from '../lib/types';

export const DEFAULT_TOURNAMENT: TournamentSettings = {
  name: 'Torneo de Verano de Fútbol Sala',
  numTeams: 12,
  registrationFee: 100,
  groupMinutes: 20,
  finalMinutes: 30,
};

export const DEFAULT_FINANCES: FinanceSettings = {
  incomes: {
    tasca: 0,
    sponsors: 0,
    other: 0,
  },
  expenses: {
    referees: 0,
    trophies: 0,
    insurance: 0,
    facilities: 0,
    other: 0,
  },
  notes: '',
  movements: [],
};

export const DEFAULT_DRAW: DrawSettings = { confirmed: false, doneAt: null, confirmedAt: null };

export const DEFAULT_KO_TIMES = ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  days: [{ date: '', start: '17:00', end: '22:00' }],
  slotMinutes: 25,
  courts: 1,
  knockoutDate: '',
  knockoutTimes: DEFAULT_KO_TIMES,
};

export function getSetting<T extends object>(db: DB, key: string, def: T): T {
  const s = db.settings.find((x) => x.key === key);
  if (!s || s.value == null || typeof s.value !== 'object') return def;
  return { ...def, ...s.value };
}

export function getLotteries(db: DB): Lotteries {
  const s = db.settings.find((x) => x.key === 'lotteries');
  return s && s.value && typeof s.value === 'object' ? (s.value as Lotteries) : {};
}

export const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: '🍖 Gran Sorteo de Jamón Ibérico',
    body: 'Durante el descanso de las semifinales sortearemos un jamón ibérico en la pista. ¡Pide tus papeletas en La Tasca!',
    tag: '20:00h',
    pinned: true,
    created_at: '2026-07-15T10:00:00Z',
  },
  {
    id: 'ann-2',
    title: '🎯 Reto del Larguero y Concurso de Triples',
    body: 'Inscripción abierta en la mesa de control (2 €). Premio especial para el ganador antes de la gran final.',
    tag: 'EVENTO',
    pinned: false,
    created_at: '2026-07-15T11:00:00Z',
  },
];

export const DEFAULT_TASCA: TascaItem[] = [
  { id: 't-1', category: 'Comida / Bocadillos', name: 'Bocadillo de Panceta a la plancha', price: 4.5, available: true },
  { id: 't-2', category: 'Comida / Bocadillos', name: 'Bocadillo de Chorizo criollo / Lomo y queso', price: 4.5, available: true },
  { id: 't-3', category: 'Comida / Bocadillos', name: 'Hamburguesa completa Villar de Mazarife', price: 5.5, available: true },
  { id: 't-4', category: 'Comida / Bocadillos', name: 'Perrito caliente', price: 3.0, available: true },
  { id: 't-5', category: 'Bebidas', name: 'Caña / Botellín bien frío', price: 2.0, available: true },
  { id: 't-6', category: 'Bebidas', name: 'Katxi / Mini de Cerveza o Kalimotxo', price: 5.0, available: true },
  { id: 't-7', category: 'Bebidas', name: 'Refrescos (Coca-Cola, Kas, Aquarius)', price: 2.0, available: true },
  { id: 't-8', category: 'Bebidas', name: 'Botella de Agua fría', price: 1.0, available: true },
  { id: 't-9', category: 'Combos / Otros', name: 'Papeleta Sorteo del Jamón', price: 2.0, available: true },
];

export function getAnnouncements(db: DB): Announcement[] {
  const s = db.settings.find((x) => x.key === 'announcements');
  if (!s || !Array.isArray(s.value?.items)) return DEFAULT_ANNOUNCEMENTS;
  return s.value.items as Announcement[];
}

export function getTascaItems(db: DB): TascaItem[] {
  const s = db.settings.find((x) => x.key === 'tasca');
  if (!s || !Array.isArray(s.value?.items)) return DEFAULT_TASCA;
  return s.value.items as TascaItem[];
}

export function getPhotos(db: DB): TournamentPhoto[] {
  const s = db.settings.find((x) => x.key === 'photos');
  if (!s || !Array.isArray(s.value?.items)) return [];
  return s.value.items as TournamentPhoto[];
}
