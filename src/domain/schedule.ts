import type { GroupName, Match, ScheduleDay, ScheduleSettings, Team } from '../lib/types';
import { KO_PLAN } from './bracket';
import { newMatch } from './match';

export interface Fixture {
  group: GroupName;
  round: number;
  home: string;
  away: string;
}

/** Todos contra todos a una vuelta (método del círculo). Con nº impar, un equipo descansa cada jornada. */
export function roundRobin(ids: string[]): [string, string][][] {
  const arr: (string | null)[] = [...ids];
  if (arr.length < 2) return [];
  if (arr.length % 2) arr.push(null);
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) {
        const swap = i === 0 ? r % 2 === 1 : i % 2 === 1;
        pairs.push(swap ? [b, a] : [a, b]);
      }
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

/** Fixtures de ambos grupos intercalados (A, B, A, B...) jornada a jornada. */
export function groupFixtures(A: string[], B: string[]): Fixture[] {
  const ra = roundRobin(A);
  const rb = roundRobin(B);
  const out: Fixture[] = [];
  for (let r = 0; r < Math.max(ra.length, rb.length); r++) {
    const a = ra[r] ?? [];
    const b = rb[r] ?? [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) out.push({ group: 'A', round: r + 1, home: a[i][0], away: a[i][1] });
      if (b[i]) out.push({ group: 'B', round: r + 1, home: b[i][0], away: b[i][1] });
    }
  }
  return out;
}

/**
 * Reparte los partidos en franjas horarias (cada franja tiene `courts` pistas).
 * Nunca pone a un equipo dos veces en la misma franja y evita, siempre que se pueda,
 * que juegue en dos franjas seguidas.
 */
export function orderIntoSlots(fixtures: Fixture[], courts: number): Fixture[][] {
  const c = Math.max(1, Math.floor(courts));
  const remaining = [...fixtures];
  const slots: Fixture[][] = [];
  let prev = new Set<string>();
  while (remaining.length) {
    const slot: Fixture[] = [];
    const busy = new Set<string>();
    const minRound = Math.min(...remaining.map((f) => f.round));
    // pase 0: sin repetir franja seguida y sin adelantarse más de una jornada
    // pase 1: sin repetir franja seguida
    // pase 2: lo que se pueda (sin coincidir en la misma franja)
    for (const pass of [0, 1, 2]) {
      for (let i = 0; i < remaining.length && slot.length < c; ) {
        const f = remaining[i];
        const clash = busy.has(f.home) || busy.has(f.away);
        const back = prev.has(f.home) || prev.has(f.away);
        const ok = !clash && (pass === 2 || !back) && (pass > 0 || f.round <= minRound + 1);
        if (ok) {
          slot.push(f);
          busy.add(f.home);
          busy.add(f.away);
          remaining.splice(i, 1);
        } else i++;
      }
      if (slot.length >= c) break;
    }
    slots.push(slot);
    prev = busy;
  }
  return slots;
}

const toMin = (t: string) => {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmt = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Genera `count` franjas horarias según los días configurados. */
export function generateTimeSlots(days: ScheduleDay[], slotMinutes: number, count: number): { slots: { date: string | null; time: string | null }[]; overflow: boolean } {
  const out: { date: string | null; time: string | null }[] = [];
  const step = Math.max(5, slotMinutes || 25);
  const valid = days.filter((d) => d.start);
  let lastDate: string | null = null;
  let lastT = 0;
  for (const d of valid) {
    let t = toMin(d.start);
    const end = d.end ? toMin(d.end) : 24 * 60;
    while (t + step <= end && out.length < count) {
      out.push({ date: d.date || null, time: fmt(t) });
      t += step;
    }
    lastDate = d.date || null;
    lastT = t;
  }
  const overflow = out.length < count;
  while (out.length < count) {
    out.push({ date: lastDate, time: valid.length ? fmt(lastT) : null });
    lastT += step;
  }
  return { slots: out, overflow };
}

export function groupTeamIds(teams: Team[], g: GroupName): string[] {
  return teams
    .filter((t) => t.group_name === g)
    .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))
    .map((t) => t.id);
}

/** Construye todos los partidos (grupos + fase final vacía). */
export function buildMatches(teams: Team[], cfg: ScheduleSettings): { matches: Match[]; overflow: boolean; slots: number } {
  const fx = groupFixtures(groupTeamIds(teams, 'A'), groupTeamIds(teams, 'B'));
  const slots = orderIntoSlots(fx, cfg.courts);
  const { slots: times, overflow } = generateTimeSlots(cfg.days, cfg.slotMinutes, slots.length);
  const matches: Match[] = [];
  slots.forEach((slot, si) =>
    slot.forEach((f, ci) =>
      matches.push(
        newMatch({
          stage: 'group',
          group_name: f.group,
          round: f.round,
          home_team_id: f.home,
          away_team_id: f.away,
          match_date: times[si].date,
          match_time: times[si].time,
          court: ci + 1,
          sort_index: si * 10 + ci,
        }),
      ),
    ),
  );
  const lastDate = [...cfg.days].reverse().find((d) => d.date)?.date ?? null;
  KO_PLAN.forEach((k, i) =>
    matches.push(
      newMatch({
        stage: k.stage,
        code: k.code,
        match_date: cfg.knockoutDate || lastDate,
        match_time: cfg.knockoutTimes[i] || null,
        court: 1,
        sort_index: 10000 + i,
      }),
    ),
  );
  return { matches, overflow, slots: slots.length };
}

/**
 * Cuenta cuántas veces un mismo equipo juega en dos franjas consecutivas sin descanso.
 */
export function countConsecutiveSlots(matches: Match[]): number {
  const groups = matches.filter((m) => m.stage === 'group' && m.home_team_id && m.away_team_id);
  const bySlot = new Map<string, Set<string>>();
  for (const m of groups) {
    const key = `${m.match_date ?? ''}|${m.match_time ?? ''}|${Math.floor((m.sort_index ?? 0) / 10)}`;
    const set = bySlot.get(key) ?? new Set<string>();
    set.add(m.home_team_id!);
    set.add(m.away_team_id!);
    bySlot.set(key, set);
  }
  const orderedSlots = [...bySlot.values()];
  let consecutive = 0;
  for (let i = 1; i < orderedSlots.length; i++) {
    for (const teamId of orderedSlots[i]) {
      if (orderedSlots[i - 1].has(teamId)) consecutive++;
    }
  }
  return consecutive;
}

/**
 * Reasigna fechas y horas a los partidos ya existentes según `cfg`, sin borrar partidos ni resultados.
 */
export function reassignMatchTimes(existing: Match[], cfg: ScheduleSettings): { updated: Match[]; overflow: boolean } {
  const groupMatches = existing
    .filter((m) => m.stage === 'group')
    .sort((a, b) => a.sort_index - b.sort_index);
  const koMatches = existing
    .filter((m) => m.stage !== 'group')
    .sort((a, b) => a.sort_index - b.sort_index);

  const courts = Math.max(1, Math.floor(cfg.courts));
  const numSlots = Math.ceil(groupMatches.length / courts);
  const { slots: times, overflow } = generateTimeSlots(cfg.days, cfg.slotMinutes, numSlots);

  const updatedGroups = groupMatches.map((m, idx) => {
    const si = Math.floor(idx / courts);
    const ci = idx % courts;
    return {
      ...m,
      match_date: times[si]?.date ?? m.match_date,
      match_time: times[si]?.time ?? m.match_time,
      court: ci + 1,
      sort_index: si * 10 + ci,
    };
  });

  const lastDate = [...cfg.days].reverse().find((d) => d.date)?.date ?? null;
  const updatedKo = koMatches.map((m) => {
    const planIdx = KO_PLAN.findIndex((k) => k.code === m.code);
    return {
      ...m,
      match_date: cfg.knockoutDate || lastDate || m.match_date,
      match_time: (planIdx >= 0 ? cfg.knockoutTimes[planIdx] : null) || m.match_time,
    };
  });

  return { updated: [...updatedGroups, ...updatedKo], overflow };
}
