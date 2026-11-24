import { secureRandom } from '../lib/ids';

export function shuffle<T>(arr: T[], rng: () => number = secureRandom): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Reparte los equipos al azar en Grupo A y Grupo B (6 y 6 con 12 equipos). */
export function drawGroups(ids: string[], rng: () => number = secureRandom): { A: string[]; B: string[] } {
  const s = shuffle(ids, rng);
  const half = Math.ceil(s.length / 2);
  return { A: s.slice(0, half), B: s.slice(half) };
}
