import { useStore } from '../lib/store';
import { Empty, Section, StatusChip, TeamBadge } from '../components/ui';
import { LiveClock } from '../components/MatchCard';
import { fmtDateLong, stageLabel } from '../lib/format';
import { matchCanvas, matchText, shareCanvas, sideLabels } from '../lib/share';
import { matchWinner } from '../domain/bracket';
import { ShareBar } from './Standings';
import AdminMatchPanel from './admin/AdminMatchPanel';
import type { Match } from '../lib/types';

export function Timeline({ m }: { m: Match }) {
  const { view } = useStore();
  const v = view!;
  const goals = v.goalsByMatch.get(m.id) ?? [];
  const cards = v.cardsByMatch.get(m.id) ?? [];
  const events = [
    ...goals.map((g) => ({ id: g.id, minute: g.minute, team: g.team_id, icon: '⚽', text: `${g.player_id ? v.playersById.get(g.player_id)?.name ?? 'Jugador' : 'Gol'}${g.own_goal ? ' (p.p.)' : ''}` })),
    ...cards.map((c) => ({ id: c.id, minute: c.minute, team: c.team_id, icon: c.card_type === 'yellow' ? '🟨' : c.second_yellow ? '🟨🟥' : '🟥', text: v.playersById.get(c.player_id)?.name ?? 'Jugador' })),
  ].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
  if (!events.length) return <p className="muted">Sin incidencias.</p>;
  return (
    <ul className="timeline">
      {events.map((e) => (
        <li key={e.id} className={e.team === m.home_team_id ? 'home' : 'away'}>
          <span className="tl-min">{e.minute != null ? `${e.minute}'` : '–'}</span>
          <span className="tl-ev">
            {e.icon} {e.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Scoreboard({ m }: { m: Match }) {
  const { view } = useStore();
  const v = view!;
  const [hn, an] = sideLabels(v, m);
  const ht = m.home_team_id ? v.teamsById.get(m.home_team_id) : undefined;
  const at = m.away_team_id ? v.teamsById.get(m.away_team_id) : undefined;
  const s = v.scores.get(m.id)!;
  const win = matchWinner(m, s);
  const pens = m.stage !== 'group' && m.penalty_home != null && m.penalty_away != null && s.home === s.away && !m.walkover_winner_id;
  return (
    <div className={`scoreboard ${m.status}`}>
      <div className="sb-meta">
        <span>{stageLabel(m)}</span>
        <StatusChip m={m} />
      </div>
      <div className="sb-main">
        <a className={`sb-team ${win === m.home_team_id && win ? 'win' : ''}`} href={ht ? `#/equipo/${ht.id}` : undefined}>
          <TeamBadge team={ht} size={64} label={hn} />
          <span>{hn}</span>
        </a>
        <div className="sb-score">
          {m.status === 'pending' ? <span className="sb-vs">{m.match_time ?? 'VS'}</span> : <span>{s.home}<i>-</i>{s.away}</span>}
          {pens && <small>Penaltis {m.penalty_home}-{m.penalty_away}</small>}
          {m.status === 'live' && <LiveClock m={m} />}
        </div>
        <a className={`sb-team ${win === m.away_team_id && win ? 'win' : ''}`} href={at ? `#/equipo/${at.id}` : undefined}>
          <TeamBadge team={at} size={64} label={an} />
          <span>{an}</span>
        </a>
      </div>
      <div className="sb-foot">
        {fmtDateLong(m.match_date)} · {m.match_time ?? '--:--'}
        {m.court ? ` · Pista ${m.court}` : ''}
        {m.walkover_winner_id && ' · 3-0 por incomparecencia/retraso'}
      </div>
    </div>
  );
}

export default function MatchPage({ id }: { id: string }) {
  const { view, isOrganizer, toast } = useStore();
  const v = view!;
  const m = v.matchesById.get(id);
  if (!m) return <Empty icon="❓" title="Partido no encontrado" />;
  const keepers = (v.gkByMatch.get(m.id) ?? []).slice().sort((a, b) => a.from_minute - b.from_minute);
  const share = async () => {
    const r = await shareCanvas(matchCanvas(v, m), 'resultado.png', matchText(v, m));
    if (r === 'downloaded') toast('Imagen descargada', 'ok');
  };
  return (
    <>
      <Scoreboard m={m} />
      <ShareBar onImage={share} text={matchText(v, m)} />
      {isOrganizer && <AdminMatchPanel m={m} />}
      {!isOrganizer && (
        <>
          <Section title="Incidencias">
            <Timeline m={m} />
          </Section>
          {keepers.length > 0 && (
            <Section title="Porteros">
              <ul className="roster">
                {keepers.map((k) => (
                  <li key={k.id}>
                    <TeamBadge team={v.teamsById.get(k.team_id)} size={22} />
                    <span className="grow">{v.playersById.get(k.player_id)?.name ?? 'Portero'}</span>
                    <span className="muted small">{k.from_minute ? `desde el ${k.from_minute}'` : 'titular'}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </>
  );
}
