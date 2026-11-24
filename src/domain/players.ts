import type { Player } from '../lib/types';

export interface ParsedPlayer {
  name: string;
  number: number | null;
  is_goalkeeper: boolean;
}

const GK_RE = /\s*(\((p|por|portero|gk)\)|\[(p|por|portero|gk)\]|\bportero\b|\bGK\b|\bPOR\b)\s*/i;

/**
 * Convierte una lista pegada en jugadores. Formatos admitidos por línea:
 *   "Juan Pérez"   "10 Juan Pérez"   "10. Juan Pérez"   "Juan Pérez (P)"   "1 - Luis (portero)"
 */
export function parsePlayerList(text: string): ParsedPlayer[] {
  const out: ParsedPlayer[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/^[\s•*\-–]+/, '').trim();
    if (!line) continue;
    let is_goalkeeper = false;
    if (GK_RE.test(line)) {
      is_goalkeeper = true;
      line = line.replace(GK_RE, ' ').trim();
    }
    let number: number | null = null;
    const m = line.match(/^#?(\d{1,3})\s*[.\-)–:]?\s+(.+)$/) || line.match(/^(.+?)\s+#?(\d{1,3})$/);
    if (m) {
      if (/^\d/.test(m[1]) || m[1].startsWith('#')) {
        number = parseInt(m[1].replace('#', ''), 10);
        line = m[2];
      } else {
        number = parseInt(m[2], 10);
        line = m[1];
      }
    }
    line = line.replace(/\s+/g, ' ').trim();
    if (line) out.push({ name: line, number, is_goalkeeper });
  }
  return out;
}

export function duplicateNumbers(players: Player[]): Set<number> {
  const seen = new Map<number, number>();
  for (const p of players) if (p.number != null) seen.set(p.number, (seen.get(p.number) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}

export const byNumber = (a: Player, b: Player) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'es');
