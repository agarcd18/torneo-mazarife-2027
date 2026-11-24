import type { GroupStandings } from '../domain/standings';
import { useStore } from '../lib/store';
import { go } from '../lib/router';
import { TeamBadge } from './ui';

export function StandingsTable({ st, compact = false, showNotes = true }: { st: GroupStandings; compact?: boolean; showNotes?: boolean }) {
  const { myTeam } = useStore();
  if (!st.rows.length) return <p className="muted">Aún no se ha hecho el sorteo de grupos.</p>;
  return (
    <div className="table-wrap">
      <table className={`standings ${compact ? 'compact' : ''}`}>
        <thead>
          <tr>
            <th className="pos">#</th>
            <th className="team-col">Equipo</th>
            <th>PJ</th>
            {!compact && (
              <>
                <th>G</th>
                <th>E</th>
                <th>P</th>
                <th>GF</th>
                <th>GC</th>
              </>
            )}
            <th>DG</th>
            {!compact && <th title="Fair play: amarilla 1, roja 3">FP</th>}
            <th className="pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {st.rows.map((r) => (
            <tr key={r.team.id} className={`${r.pos <= 4 ? 'zone-q' : 'zone-out'} ${myTeam === r.team.id ? 'mine' : ''}`} onClick={() => go(`/equipo/${r.team.id}`)}>
              <td className="pos">
                <span className="pos-num">{r.pos}</span>
              </td>
              <td className="team-col">
                <span className="team-cell">
                  <TeamBadge team={r.team} size={24} />
                  <span className="tname">{r.team.name}</span>
                  {r.byLottery && <span title="Posición decidida por sorteo">🎲</span>}
                </span>
              </td>
              <td>{r.pj}</td>
              {!compact && (
                <>
                  <td>{r.g}</td>
                  <td>{r.e}</td>
                  <td>{r.p}</td>
                  <td>{r.gf}</td>
                  <td>{r.gc}</td>
                </>
              )}
              <td>{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
              {!compact && <td>{r.fp}</td>}
              <td className="pts">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showNotes && st.notes.length > 0 && (
        <ul className="notes">
          {st.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
