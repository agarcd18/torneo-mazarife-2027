import type { Match, MatchStatus } from './types';

export const PALETTE = [
  '#1f7a4a', '#d4af37', '#c0392b', '#2e86de', '#8e44ad', '#e67e22', '#16a085', '#e84393',
  '#34495e', '#f1c40f', '#00b894', '#6c5ce7', '#d35400', '#0984e3', '#b33771', '#218c74',
];

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0 && !/^(de|del|la|las|los|el|y|fc|cf|cd|ud)$/i.test(w));
  const base = words.length ? words : name.trim().split(/\s+/);
  if (base.length >= 2) return (base[0][0] + base[1][0]).toUpperCase();
  return (base[0] ?? '?').slice(0, 2).toUpperCase();
}

export function textColorFor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0b1a12' : '#ffffff';
}

export function fmtDate(d?: string | null): string {
  if (!d) return 'Sin fecha';
  const dt = new Date(d + 'T12:00:00');
  if (isNaN(+dt)) return d;
  return dt.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtDateLong(d?: string | null): string {
  if (!d) return 'Sin fecha';
  const dt = new Date(d + 'T12:00:00');
  if (isNaN(+dt)) return d;
  const s = dt.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const statusLabel = (s: MatchStatus) => ({ pending: 'Pendiente', live: 'En juego', finished: 'Finalizado' })[s];

export function stageLabel(m: Match): string {
  if (m.stage === 'group') return `Grupo ${m.group_name ?? '?'}${m.round ? ` · J${m.round}` : ''}`;
  if (m.stage === 'QF') return `Cuartos ${m.code?.slice(2) ?? ''}`;
  if (m.stage === 'SF') return `Semifinal ${m.code?.slice(2) ?? ''}`;
  return 'Final';
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtNum(n: number, dec = 2): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
