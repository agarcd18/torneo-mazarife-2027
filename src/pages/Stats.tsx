import { useStore } from '../lib/store';
import { Section, TeamBadge } from '../components/ui';
import { keeperStats, topScorers } from '../domain/stats';
import { fmtNum } from '../lib/format';

export default function Stats() {
  const { view, myTeam } = useStore();
  const v = view!;
  const scorers = topScorers(v.matches, v.db.goals, v.playersById, v.teamsById);
  const keepers = keeperStats(v.matches, v.goalsByMatch, v.gkByMatch, v.playersById, v.teamsById, v.tournament);
  return (
    <>
      <h1 className="page-title">Estadísticas</h1>
      <Section title="⚽ Máximos goleadores">
        {!scorers.length ? (
          <p className="muted">Aún no hay goles registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="team-col">Jugador</th>
                  <th>Goles</th>
                  <th title="Partidos jugados por su equipo">PJ</th>
                  <th title="Goles ÷ partidos jugados por su equipo">Prom.</th>
                </tr>
              </thead>
              <tbody>
                {scorers.map((r, i) => (
                  <tr key={r.player.id} className={myTeam === r.player.team_id ? 'mine' : ''}>
                    <td className={i < 3 ? 'gold' : ''}>{i + 1}</td>
                    <td className="team-col">
                      <a className="team-cell" href={`#/equipo/${r.player.team_id}`}>
                        <TeamBadge team={r.team} size={22} />
                        <span>
                          <b>{r.player.name}</b>
                          <small className="muted block">{r.team?.name}</small>
                        </span>
                      </a>
                    </td>
                    <td className="pts">{r.goals}</td>
                    <td>{r.teamPlayed}</td>
                    <td>{fmtNum(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          * Los goles de tanda de penaltis de las eliminatorias no suman para el trofeo de Máximo Goleador.
        </p>
      </Section>

      <Section title="🧤 Portero menos goleado">
        {!keepers.length ? (
          <p className="muted">Aparecerá cuando finalicen partidos con el portero principal asignado en el acta.</p>
        ) : (
          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="team-col">Portero</th>
                  <th title="Partidos computados como portero principal">PJ</th>
                  <th title="Goles encajados en juego">GC</th>
                  <th title="Goles encajados ÷ Partidos jugados (menor es mejor)">Prom.</th>
                </tr>
              </thead>
              <tbody>
                {keepers.map((r, i) => (
                  <tr key={r.player.id} className={myTeam === r.player.team_id ? 'mine' : ''}>
                    <td className={i < 3 ? 'gold' : ''}>{i + 1}</td>
                    <td className="team-col">
                      <a className="team-cell" href={`#/equipo/${r.player.team_id}`}>
                        <TeamBadge team={r.team} size={22} />
                        <span>
                          <b>{r.player.name}</b>
                          <small className="muted block">{r.team?.name}</small>
                        </span>
                      </a>
                    </td>
                    <td>{r.matches}</td>
                    <td>{r.conceded}</td>
                    <td className="pts">{fmtNum(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          Promedio = Goles encajados ÷ Partidos jugados (menor es mejor). Los goles de tanda de penaltis no penalizan al portero.
        </p>
      </Section>
    </>
  );
}
