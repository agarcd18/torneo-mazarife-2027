import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { StandingsTable } from '../components/StandingsTable';
import { MatchCard } from '../components/MatchCard';
import { BracketView } from '../components/Bracket';
import { TeamBadge } from '../components/ui';
import { topScorers } from '../domain/stats';

const SCREENS = ['grupos', 'partidos', 'cuadro', 'goleadores'] as const;

export default function TVMode() {
  const { view, loadError } = useStore();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, [paused]);
  if (!view) return <div className="tv"><div className="tv-loading">{loadError ? 'Conectando…' : 'Cargando…'}</div></div>;
  const v = view;
  const screen = SCREENS[i % SCREENS.length];
  const live = v.matches.filter((m) => m.status === 'live');
  const next = v.matches.filter((m) => m.status === 'pending').slice(0, 4);
  const recent = v.matches.filter((m) => m.status === 'finished').slice(-4).reverse();
  const scorers = topScorers(v.matches, v.db.goals, v.playersById, v.teamsById).slice(0, 10);
  const champ = v.champion ? v.teamsById.get(v.champion) : undefined;

  return (
    <div className="tv">
      <header className="tv-head">
        <div className="tv-title">⚽ {v.tournament.name}</div>
        <div className="tv-tabs">
          {SCREENS.map((s, k) => (
            <button key={s} className={screen === s ? 'on' : ''} onClick={() => setI(k)}>
              {s}
            </button>
          ))}
          <button onClick={() => setPaused((p) => !p)}>{paused ? '▶' : '⏸'}</button>
          <button onClick={() => document.documentElement.requestFullscreen?.()}>⛶</button>
          <a href="#/">✕</a>
        </div>
      </header>
      {champ && (
        <div className="tv-champ">
          🏆 CAMPEÓN: <TeamBadge team={champ} size={40} /> {champ.name}
        </div>
      )}
      <main className="tv-body" key={screen}>
        {screen === 'grupos' && (
          <div className="tv-grid2">
            <div>
              <h2>Grupo A</h2>
              <StandingsTable st={v.standings.A} showNotes={false} />
            </div>
            <div>
              <h2>Grupo B</h2>
              <StandingsTable st={v.standings.B} showNotes={false} />
            </div>
          </div>
        )}
        {screen === 'partidos' && (
          <div className="tv-grid3">
            <div>
              <h2>🔴 En juego</h2>
              {live.length ? live.map((m) => <MatchCard key={m.id} m={m} />) : <p className="muted">—</p>}
            </div>
            <div>
              <h2>Próximos</h2>
              {next.length ? next.map((m) => <MatchCard key={m.id} m={m} />) : <p className="muted">—</p>}
            </div>
            <div>
              <h2>Resultados</h2>
              {recent.length ? recent.map((m) => <MatchCard key={m.id} m={m} />) : <p className="muted">—</p>}
            </div>
          </div>
        )}
        {screen === 'cuadro' && <BracketView />}
        {screen === 'goleadores' && (
          <div>
            <h2>Máximos goleadores</h2>
            <ol className="tv-scorers">
              {scorers.map((r) => (
                <li key={r.player.id}>
                  <TeamBadge team={r.team} size={36} />
                  <span className="grow">
                    {r.player.name} <small className="muted">{r.team?.name}</small>
                  </span>
                  <b className="gold">{r.goals}</b>
                </li>
              ))}
              {!scorers.length && <p className="muted">Sin goles todavía.</p>}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
