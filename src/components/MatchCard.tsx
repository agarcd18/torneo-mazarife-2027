import type { Match } from '../lib/types';
import { useStore } from '../lib/store';
import { useNow } from '../lib/router';
import { fmtDate, mmss, stageLabel } from '../lib/format';
import { sideLabels } from '../lib/share';
import { clockElapsed } from '../domain/match';
import { matchWinner } from '../domain/bracket';
import { StatusChip, TeamBadge } from './ui';

export function LiveClock({ m }: { m: Match }) {
  const now = useNow(1000);
  if (!m.clock_running && !m.clock_base) return null;
  return (
    <span className={`live-clock ${m.clock_running ? 'running' : ''}`}>
      {mmss(clockElapsed(m, now))} · {m.period === 2 ? '2ª' : '1ª'} parte
    </span>
  );
}

export function MatchCard({ m, showDate = true }: { m: Match; showDate?: boolean }) {
  const { view, myTeam } = useStore();
  const v = view!;
  const [hn, an] = sideLabels(v, m);
  const ht = m.home_team_id ? v.teamsById.get(m.home_team_id) : undefined;
  const at = m.away_team_id ? v.teamsById.get(m.away_team_id) : undefined;
  const s = v.scores.get(m.id) ?? { home: 0, away: 0 };
  const showScore = m.status !== 'pending';
  const winner = matchWinner(m, s);
  const mine = !!myTeam && (m.home_team_id === myTeam || m.away_team_id === myTeam);
  const pens = m.stage !== 'group' && m.penalty_home != null && m.penalty_away != null && s.home === s.away && !m.walkover_winner_id;
  return (
    <a className={`match-card ${m.status} ${mine ? 'mine' : ''}`} href={`#/partido/${m.id}`}>
      <div className="mc-meta">
        <span className="mc-stage">{stageLabel(m)}</span>
        <span>
          {showDate && `${fmtDate(m.match_date)} · `}
          {m.match_time ?? '--:--'}
          {m.court && v.schedule.courts > 1 ? ` · Pista ${m.court}` : ''}
        </span>
      </div>
      <div className="mc-body">
        <div className="mc-teams">
          <div className={`mc-team ${winner && winner === m.home_team_id ? 'win' : ''}`}>
            <TeamBadge team={ht} size={28} label={hn} />
            <span className="mc-name">{hn}</span>
            {showScore && <b className="mc-score">{s.home}</b>}
          </div>
          <div className={`mc-team ${winner && winner === m.away_team_id ? 'win' : ''}`}>
            <TeamBadge team={at} size={28} label={an} />
            <span className="mc-name">{an}</span>
            {showScore && <b className="mc-score">{s.away}</b>}
          </div>
        </div>
      </div>
      <div className="mc-foot">
        <StatusChip m={m} />
        {m.status === 'live' && <LiveClock m={m} />}
        {pens && <span className="muted small">Penaltis {m.penalty_home}-{m.penalty_away}</span>}
        {m.walkover_winner_id && <span className="muted small">3-0 por incomparecencia</span>}
      </div>
    </a>
  );
}
