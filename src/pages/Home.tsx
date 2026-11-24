import { useStore } from '../lib/store';
import { MatchCard } from '../components/MatchCard';
import { fmtNum } from '../lib/format';

export default function Home() {
  const s = useStore();
  const v = s.view!;

  // Partidos en Juego y Próximos Partidos (destacando primero los de Mi Equipo si lo tiene marcado)
  const live = v.matches.filter((m) => m.status === 'live');
  const upcoming = [...v.matches.filter((m) => m.status === 'pending')]
    .sort((a, b) => {
      const aMine = s.myTeam && (a.home_team_id === s.myTeam || a.away_team_id === s.myTeam) ? 0 : 1;
      const bMine = s.myTeam && (b.home_team_id === s.myTeam || b.away_team_id === s.myTeam) ? 0 : 1;
      return aMine - bMine;
    })
    .slice(0, 8);

  const availableTasca = v.tasca.filter((i) => i.available);

  return (
    <div className="home-minimal">
      {/* BLOQUE 1: 📢 TABLÓN DE ANUNCIOS (TARJETAS GRANDES ARRIBA DEL TODO) */}
      <section className="home-block">
        <div className="home-block-head">
          <h2>📢 Tablón de Anuncios</h2>
          {s.isOrganizer && (
            <a href="#/admin/social" className="btn btn-sm btn-ghost">
              ✎ Editar
            </a>
          )}
        </div>

        <div className="ann-xl-list">
          {v.announcements.map((a) => (
            <article key={a.id} className={`ann-xl-card ${a.pinned ? 'pinned' : ''}`}>
              <div className="ann-xl-top">
                <span className="ann-xl-tag">{a.tag}</span>
                {a.pinned && <span className="ann-xl-pin">📌 DESTACADO</span>}
              </div>
              <h3 className="ann-xl-title">{a.title}</h3>
              {a.body && <p className="ann-xl-body">{a.body}</p>}
            </article>
          ))}
          {!v.announcements.length && (
            <div className="card">
              <p className="muted">No hay anuncios publicados en este momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* BLOQUE 2: 🍻 LA TASCA (TARJETA GRANDE CON LOS PRECIOS DE LA BARRA) */}
      <section className="home-block">
        <div className="home-block-head">
          <h2>🍻 La Tasca · Precios de Barra</h2>
          {s.isOrganizer && (
            <a href="#/admin/social" className="btn btn-sm btn-ghost">
              ✎ Precios
            </a>
          )}
        </div>

        <div className="tasca-xl-card">
          {availableTasca.map((item) => (
            <div key={item.id} className="tasca-xl-row">
              <div className="tasca-xl-name">
                <span>{item.category === 'Bebidas' ? '🍺' : item.category === 'Comida / Bocadillos' ? '🥖' : '🎟️'}</span>
                <b>{item.name}</b>
              </div>
              <span className="tasca-xl-price">{fmtNum(item.price, 2)} €</span>
            </div>
          ))}
          {!availableTasca.length && <p className="muted">Lista de precios pendiente de publicar.</p>}
        </div>
      </section>

      {/* BLOQUE 3: ⚽ PARTIDOS ("EN JUEGO" CON EL MARCADOR Y "PRÓXIMOS PARTIDOS") */}
      <section className="home-block">
        <div className="home-block-head">
          <h2>⚽ Partidos</h2>
          {v.matches.length > 0 && (
            <a href="#/calendario" className="btn btn-sm btn-ghost">
              Calendario completo ›
            </a>
          )}
        </div>

        {live.length > 0 && (
          <div className="home-matches-sub">
            <div className="sub-banner live-sub-banner">
              <i className="dot" /> EN JUEGO AHORA
            </div>
            <div className="cards">
              {live.map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          </div>
        )}

        <div className="home-matches-sub">
          <div className="sub-banner">📅 PRÓXIMOS PARTIDOS</div>
          {upcoming.length > 0 ? (
            <div className="cards">
              {upcoming.map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          ) : (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                {v.matches.length
                  ? 'No quedan partidos pendientes por disputar.'
                  : 'Los partidos aparecerán aquí en cuanto se realice el sorteo de grupos.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
