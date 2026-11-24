import { useStore } from '../../lib/store';
import { Empty } from '../../components/ui';
import type { Team } from '../../lib/types';

function WaiverSheet({ team, dateStr, tournamentName }: { team: Team; dateStr: string; tournamentName: string }) {
  const { view } = useStore();
  const players = view?.playersByTeam.get(team.id) ?? [];

  return (
    <section className="waiver-sheet">
      <div className="waiver-header">
        <div className="waiver-kicker">DOCUMENTO OFICIAL · ORGANIZACIÓN DEL TORNEO</div>
        <h1>HOJA DE INSCRIPCIÓN Y DESCARGO DE RESPONSABILIDAD</h1>
        <h2>{tournamentName.toUpperCase()} · VILLAR DE MAZARIFE</h2>
      </div>

      <div className="waiver-meta-box">
        <div>
          <span>EQUIPO INSCRITO:</span>
          <strong>{team.name}</strong>
        </div>
        <div>
          <span>FECHA:</span>
          <strong>{dateStr}</strong>
        </div>
      </div>

      <div className="waiver-legal-box">
        <p className="waiver-statement">
          &ldquo;Yo, ........................................................................................, con DNI
          ........................................, actuando como capitán del equipo <strong>{team.name}</strong> a fecha
          de <strong>{dateStr}</strong>, declaro que todos los jugadores asumen los riesgos deportivos. La organización
          del Torneo de Villar de Mazarife queda eximida de toda responsabilidad ante lesiones o accidentes.&rdquo;
        </p>
      </div>

      <div className="waiver-roster-section">
        <h3>RELACIÓN DE JUGADORES INSCRITOS EN EL EQUIPO ({players.length})</h3>
        <table className="waiver-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Dorsal</th>
              <th>Nombre y Apellidos del Jugador</th>
              <th style={{ width: 90 }}>Puesto</th>
              <th style={{ width: 150 }}>DNI / Firma</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{p.number ?? '—'}</td>
                <td>{p.name}</td>
                <td style={{ textAlign: 'center' }}>{p.is_goalkeeper ? 'Portero' : 'Jugador'}</td>
                <td></td>
              </tr>
            ))}
            {Array.from({ length: Math.max(2, 10 - players.length) }).map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td style={{ height: 26 }}></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="waiver-signatures">
        <div className="waiver-sign-box">
          <div className="waiver-sign-space" />
          <strong>FIRMA DEL CAPITÁN / RESPONSABLE DEL EQUIPO</strong>
          <small>Equipo: {team.name}</small>
        </div>
        <div className="waiver-sign-box">
          <div className="waiver-sign-space" />
          <strong>SELLO / CONFORME DE LA ORGANIZACIÓN</strong>
          <small>Torneo de Fútbol Sala · Villar de Mazarife</small>
        </div>
      </div>
    </section>
  );
}

export default function WaiverPrintPage({ teamId }: { teamId?: string }) {
  const s = useStore();
  const v = s.view;

  if (!s.isOrganizer) {
    return (
      <div className="card">
        <h2>🔒 Acceso restringido</h2>
        <p className="muted">El generador de hojas de responsabilidad es exclusivo para los organizadores del torneo.</p>
        <a href="#/admin" className="btn btn-gold">
          Ir a Acceso Organizadores
        </a>
      </div>
    );
  }

  if (!v) return <div className="loading">Cargando equipos…</div>;

  const teamsToPrint =
    teamId && teamId !== 'todos'
      ? v.teams.filter((t) => t.id === teamId)
      : v.teams;

  if (!teamsToPrint.length) {
    return <Empty icon="📄" title="No se encontró el equipo para generar la hoja de descargo" />;
  }

  const today = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="waiver-page">
      <div className="waiver-toolbar no-print">
        <a href="#/admin/equipos" className="btn btn-ghost">
          ← Volver a Equipos
        </a>
        <div className="row-gap">
          {teamId !== 'todos' && v.teams.length > 1 && (
            <a href="#/admin/descargo/todos" className="btn btn-ghost">
              📑 Ver todos los equipos ({v.teams.length})
            </a>
          )}
          <button type="button" className="btn btn-gold" onClick={() => window.print()}>
            🖨️ Imprimir / Guardar en PDF
          </button>
        </div>
      </div>

      {teamsToPrint.map((t) => (
        <WaiverSheet key={t.id} team={t} dateStr={today} tournamentName={v.tournament.name} />
      ))}
    </div>
  );
}
