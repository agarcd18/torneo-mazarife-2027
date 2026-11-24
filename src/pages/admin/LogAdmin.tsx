import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { backend } from '../../lib/backend';
import { AuditEntry, TABLES, TableName } from '../../lib/types';
import { download, toCSV, toJSON, toSQL } from '../../domain/export';
import { fmtDateTime } from '../../lib/format';
import { Section } from '../../components/ui';

const TABLE_LABEL: Record<string, string> = {
  teams: 'Equipo',
  players: 'Jugador',
  matches: 'Partido',
  goals: 'Gol',
  cards: 'Tarjeta',
  goalkeepers: 'Portero',
  settings: 'Ajuste',
};
const ACTION_LABEL: Record<string, string> = { INSERT: 'creó', UPDATE: 'modificó', DELETE: 'borró', UPSERT: 'guardó' };

export default function LogAdmin() {
  const s = useStore();
  const v = s.view!;
  const [log, setLog] = useState<AuditEntry[] | null>(null);
  const [err, setErr] = useState('');
  const [table, setTable] = useState<TableName>('matches');

  const load = useCallback(async () => {
    setErr('');
    try {
      setLog(await backend.fetchAudit(300));
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo cargar el historial');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const describe = (e: AuditEntry): string => {
    const d = e.new_data ?? e.old_data ?? {};
    const pl = (id?: string) => (id ? v.playersById.get(id)?.name : undefined);
    const tm = (id?: string) => (id ? v.teamsById.get(id)?.name : undefined);
    switch (e.table_name) {
      case 'teams':
        return d.name ?? '';
      case 'players':
        return d.name ?? '';
      case 'goals':
        return [pl(d.player_id) ?? tm(d.team_id), d.minute != null ? `${d.minute}'` : ''].filter(Boolean).join(' · ');
      case 'cards':
        return [d.card_type === 'yellow' ? '🟨' : '🟥', pl(d.player_id), d.minute != null ? `${d.minute}'` : ''].filter(Boolean).join(' ');
      case 'matches': {
        const m = e.row_id ? v.matchesById.get(e.row_id) : undefined;
        const name = m ? `${tm(m.home_team_id ?? undefined) ?? '?'} - ${tm(m.away_team_id ?? undefined) ?? '?'}` : '';
        const changes = e.old_data && e.new_data ? Object.keys(e.new_data).filter((k) => JSON.stringify(e.new_data[k]) !== JSON.stringify(e.old_data[k]) && !['clock_started_at'].includes(k)) : [];
        return `${name}${changes.length ? ` (${changes.join(', ')})` : ''}`;
      }
      case 'settings':
        return d.key ?? e.row_id ?? '';
      default:
        return e.row_id ?? '';
    }
  };

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return (
    <>
      <Section title="💾 Copia de seguridad">
        <div className="card">
          <p className="muted small">Descarga todos los datos del torneo. Hazlo al terminar cada jornada.</p>
          <div className="row-gap">
            <button className="btn btn-primary" onClick={() => download(`torneo-${stamp}.json`, toJSON(v.db), 'application/json')}>
              JSON
            </button>
            <button className="btn btn-primary" onClick={() => download(`torneo-${stamp}.sql`, toSQL(v.db), 'application/sql')}>
              SQL
            </button>
          </div>
          <div className="row-gap">
            <select value={table} onChange={(e) => setTable(e.target.value as TableName)}>
              {TABLES.map((t) => (
                <option key={t} value={t}>
                  {t} ({(v.db[t] as any[]).length})
                </option>
              ))}
            </select>
            <button className="btn btn-ghost" onClick={() => download(`torneo-${table}-${stamp}.csv`, '\ufeff' + toCSV(v.db[table] as any[]), 'text/csv;charset=utf-8')}>
              CSV
            </button>
          </div>
        </div>
      </Section>
      <Section
        title="🗂️ Historial de cambios"
        action={
          <button className="btn btn-sm btn-ghost" onClick={load}>
            ↻ Actualizar
          </button>
        }
      >
        {err && <p className="error">{err}</p>}
        {!log && !err && <p className="muted">Cargando…</p>}
        {log && !log.length && <p className="muted">Sin cambios registrados.</p>}
        {log && log.length > 0 && (
          <ul className="audit">
            {log.map((e) => (
              <li key={e.id}>
                <span className="audit-time">{fmtDateTime(e.at)}</span>
                <span className="audit-who">{e.actor_email ?? 'sistema'}</span>
                <span>
                  {ACTION_LABEL[e.action] ?? e.action} <b>{TABLE_LABEL[e.table_name] ?? e.table_name}</b> {describe(e)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
