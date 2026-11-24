import { useStore } from '../lib/store';
import { Empty, TeamBadge } from '../components/ui';
import { topScorers, keeperStats } from '../domain/stats';
import { whatsappUrl, appUrl } from '../lib/share';

export default function Champion() {
  const { view } = useStore();
  const v = view!;
  const champ = v.champion ? v.teamsById.get(v.champion) : undefined;
  if (!champ || !v.finalMatch) return <Empty icon="🏆" title="Aún no hay campeón">Se conocerá al terminar la final.</Empty>;
  const f = v.finalMatch;
  const s = v.scores.get(f.id)!;
  const runner = f.home_team_id === champ.id ? f.away_team_id : f.home_team_id;
  const runnerTeam = runner ? v.teamsById.get(runner) : undefined;
  const top = topScorers(v.matches, v.db.goals, v.playersById, v.teamsById)[0];
  const gk = keeperStats(v.matches, v.goalsByMatch, v.gkByMatch, v.playersById, v.teamsById, v.tournament)[0];
  const pens = s.home === s.away && f.penalty_home != null ? ` (pen. ${f.penalty_home}-${f.penalty_away})` : '';
  const text = `🏆 ¡${champ.name} campeón del ${v.tournament.name}! Final: ${s.home}-${s.away}${pens}\n${appUrl('/campeon')}`;
  return (
    <div className="champion">
      <div className="confetti" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.35}s`, background: i % 3 ? '#d4af37' : champ.color }} />
        ))}
      </div>
      <div className="champ-trophy">🏆</div>
      <div className="champ-kicker">Campeón</div>
      <TeamBadge team={champ} size={110} />
      <h1 className="champ-name">{champ.name}</h1>
      <div className="champ-final">
        Final: {v.teamsById.get(f.home_team_id!)?.name} {s.home} - {s.away} {v.teamsById.get(f.away_team_id!)?.name}
        {pens}
      </div>
      {runnerTeam && <div className="muted">Subcampeón: {runnerTeam.name}</div>}
      <div className="champ-awards">
        {top && (
          <div className="card">
            <small className="muted">Máximo goleador</small>
            <b>{top.player.name}</b>
            <span className="gold">{top.goals} goles</span>
          </div>
        )}
        {gk && (
          <div className="card">
            <small className="muted">Portero menos goleado</small>
            <b>{gk.player.name}</b>
            <span className="gold">{gk.ratio.toFixed(2)}</span>
          </div>
        )}
      </div>
      <a className="btn btn-whatsapp" href={whatsappUrl(text)} target="_blank" rel="noreferrer">
        Compartir en WhatsApp
      </a>
    </div>
  );
}
