import type { DB, TableName } from '../lib/types';

const ORDER: TableName[] = ['teams', 'players', 'matches', 'goals', 'cards', 'goalkeepers', 'settings'];

export function toJSON(db: DB): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, ...db }, null, 2);
}

export function toCSV(rows: any[]): string {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: any) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function sqlValue(v: any): string {
  if (v == null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function toSQL(db: DB): string {
  const lines = [`-- Copia de seguridad del torneo · ${new Date().toISOString()}`, 'begin;'];
  for (const t of ORDER) {
    const rows = db[t] as any[];
    if (!rows.length) continue;
    lines.push(`\n-- ${t} (${rows.length})`);
    for (const r of rows) {
      const cols = Object.keys(r);
      lines.push(`insert into public.${t} (${cols.join(', ')}) values (${cols.map((c) => sqlValue(r[c])).join(', ')}) on conflict do nothing;`);
    }
  }
  lines.push('commit;');
  return lines.join('\n');
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
