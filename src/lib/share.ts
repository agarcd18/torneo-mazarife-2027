import type { GroupName, Match } from './types';
import type { View } from '../domain/view';
import { initials, stageLabel, textColorFor, fmtDate } from './format';
import { koSlot, sourceLabel } from '../domain/bracket';

export function sideLabels(v: View, m: Match): [string, string] {
  const slot = koSlot(m.code);
  const h = m.home_team_id ? v.teamsById.get(m.home_team_id)?.name : null;
  const a = m.away_team_id ? v.teamsById.get(m.away_team_id)?.name : null;
  return [h ?? (slot ? sourceLabel(slot.home) : 'Por definir'), a ?? (slot ? sourceLabel(slot.away) : 'Por definir')];
}

export function appUrl(path = ''): string {
  return `${location.origin}${location.pathname}#${path}`;
}

export function matchText(v: View, m: Match): string {
  const [h, a] = sideLabels(v, m);
  const s = v.scores.get(m.id)!;
  const pen = m.penalty_home != null && m.penalty_away != null && s.home === s.away ? ` (${m.penalty_home}-${m.penalty_away} pen.)` : '';
  const head = m.status === 'pending' ? `📅 ${fmtDate(m.match_date)} ${m.match_time ?? ''}` : m.status === 'live' ? '🔴 EN JUEGO' : '✅ FINAL';
  return `⚽ ${v.tournament.name}\n${stageLabel(m)} · ${head}\n${h} ${m.status === 'pending' ? 'vs' : `${s.home} - ${s.away}`} ${a}${pen}\n${appUrl(`/partido/${m.id}`)}`;
}

export function standingsText(v: View, g: GroupName): string {
  const rows = v.standings[g].rows.map((r) => `${r.pos}. ${r.team.name} — ${r.pts} pts (${r.pj} PJ, DG ${r.dg > 0 ? '+' : ''}${r.dg})`);
  return `🏆 ${v.tournament.name}\nClasificación Grupo ${g}\n${rows.join('\n')}\n${appUrl('/clasificacion')}`;
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/* ---------------- Imágenes (canvas) ---------------- */
const W = 1080;
const GOLD = '#d4af37';

function base(h: number, title: string, subtitle: string) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = h;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b2a1c');
  g.addColorStop(1, '#04100a');
  x.fillStyle = g;
  x.fillRect(0, 0, W, h);
  x.fillStyle = GOLD;
  x.fillRect(0, 0, W, 10);
  x.font = '64px "Bebas Neue", Impact, sans-serif';
  x.fillText(title.toUpperCase(), 60, 100);
  x.fillStyle = '#cfe3d6';
  x.font = '600 30px Inter, Arial, sans-serif';
  x.fillText(subtitle, 60, 148);
  return { c, x };
}

function badge(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, name: string) {
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fillStyle = color;
  x.fill();
  x.fillStyle = textColorFor(color);
  x.font = `${Math.round(r * 0.95)}px "Bebas Neue", Impact, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(initials(name), cx, cy + 2);
  x.textAlign = 'left';
  x.textBaseline = 'alphabetic';
}

function footer(x: CanvasRenderingContext2D, h: number) {
  x.fillStyle = 'rgba(212,175,55,.8)';
  x.font = '600 24px Inter, Arial, sans-serif';
  x.fillText('Villar de Mazarife · Fútbol Sala', 60, h - 40);
}

export function standingsCanvas(v: View, g: GroupName): HTMLCanvasElement {
  const rows = v.standings[g].rows;
  const h = 260 + rows.length * 86 + 90;
  const { c, x } = base(h, `Clasificación Grupo ${g}`, v.tournament.name);
  const cols = [
    ['PJ', 640],
    ['DG', 760],
    ['PTS', 900],
  ] as const;
  x.font = '600 26px Inter, Arial, sans-serif';
  x.fillStyle = '#8fa99a';
  cols.forEach(([l, px]) => x.fillText(l, px, 220));
  rows.forEach((r, i) => {
    const y = 250 + i * 86;
    if (r.pos <= 4) {
      x.fillStyle = 'rgba(31,122,74,.28)';
      x.fillRect(40, y, W - 80, 76);
    }
    x.fillStyle = r.pos <= 4 ? GOLD : '#8fa99a';
    x.font = '44px "Bebas Neue", Impact, sans-serif';
    x.fillText(String(r.pos), 60, y + 54);
    badge(x, 140, y + 38, 28, r.team.color, r.team.name);
    x.fillStyle = '#fff';
    x.font = '700 32px Inter, Arial, sans-serif';
    x.fillText(r.team.name.slice(0, 24), 186, y + 50);
    x.font = '700 34px Inter, Arial, sans-serif';
    x.fillText(String(r.pj), 645, y + 50);
    x.fillText(`${r.dg > 0 ? '+' : ''}${r.dg}`, 760, y + 50);
    x.fillStyle = GOLD;
    x.font = '50px "Bebas Neue", Impact, sans-serif';
    x.fillText(String(r.pts), 905, y + 56);
  });
  footer(x, h);
  return c;
}

export function matchCanvas(v: View, m: Match): HTMLCanvasElement {
  const h = 620;
  const { c, x } = base(h, stageLabel(m), `${v.tournament.name} · ${fmtDate(m.match_date)} ${m.match_time ?? ''}`);
  const [hn, an] = sideLabels(v, m);
  const s = v.scores.get(m.id)!;
  const ht = m.home_team_id ? v.teamsById.get(m.home_team_id) : undefined;
  const at = m.away_team_id ? v.teamsById.get(m.away_team_id) : undefined;
  badge(x, 230, 300, 80, ht?.color ?? '#335', hn);
  badge(x, W - 230, 300, 80, at?.color ?? '#335', an);
  x.textAlign = 'center';
  x.fillStyle = '#fff';
  x.font = '700 34px Inter, Arial, sans-serif';
  x.fillText(hn.slice(0, 18), 230, 430);
  x.fillText(an.slice(0, 18), W - 230, 430);
  x.fillStyle = GOLD;
  x.font = '150px "Bebas Neue", Impact, sans-serif';
  x.fillText(m.status === 'pending' ? 'VS' : `${s.home} - ${s.away}`, W / 2, 350);
  x.fillStyle = '#cfe3d6';
  x.font = '600 30px Inter, Arial, sans-serif';
  const sub = m.status === 'live' ? 'EN JUEGO' : m.status === 'finished' ? 'FINAL' : 'PRÓXIMO PARTIDO';
  const pen = m.penalty_home != null && m.penalty_away != null && s.home === s.away && m.stage !== 'group' ? ` · Penaltis ${m.penalty_home}-${m.penalty_away}` : '';
  x.fillText(sub + pen, W / 2, 500);
  x.textAlign = 'left';
  footer(x, h);
  return c;
}

export async function shareCanvas(canvas: HTMLCanvasElement, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancel'> {
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* noop */
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return 'cancel';
  const file = new File([blob], filename, { type: 'image/png' });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch {
      return 'cancel';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
