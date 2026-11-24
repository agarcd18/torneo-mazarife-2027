import { useStore } from '../lib/store';
import { KO_PLAN, KoSlot, matchWinner, sourceLabel } from '../domain/bracket';
import { TeamBadge } from './ui';
import { fmtDate } from '../lib/format';

function Box({ slot }: { slot: KoSlot }) {
  const { view, myTeam } = useStore();
  const v = view!;
  const m = v.matches.find((x) => x.code === slot.code);
  const s = m ? v.scores.get(m.id)! : { home: 0, away: 0 };
  const win = m ? matchWinner(m, s) : null;
  const side = (id: string | null | undefined, label: string, score: number, pen: number | null | undefined) => {
    const t = id ? v.teamsById.get(id) : undefined;
    return (
      <div className={`bx-team ${win && win === id ? 'win' : ''} ${myTeam && id === myTeam ? 'mine' : ''}`}>
        <TeamBadge team={t} size={22} />
        <span className="bx-name">{t?.name ?? label}</span>
        {m && m.status !== 'pending' && (
          <b>
            {score}
            {pen != null && s.home === s.away && m.stage !== 'group' && <small> ({pen})</small>}
          </b>
        )}
      </div>
    );
  };
  const inner = (
    <>
      <div className="bx-head">
        <span>{slot.label}</span>
        <span>{m ? `${fmtDate(m.match_date)} ${m.match_time ?? ''}` : ''}</span>
      </div>
      {side(m?.home_team_id, sourceLabel(slot.home), s.home, m?.penalty_home)}
      {side(m?.away_team_id, sourceLabel(slot.away), s.away, m?.penalty_away)}
      {m?.status === 'live' && <div className="bx-live">● EN JUEGO</div>}
    </>
  );
  return m ? (
    <a className={`bx ${slot.stage === 'F' ? 'bx-final' : ''}`} href={`#/partido/${m.id}`}>
      {inner}
    </a>
  ) : (
    <div className={`bx ${slot.stage === 'F' ? 'bx-final' : ''}`}>{inner}</div>
  );
}

export function BracketView() {
  const { view } = useStore();
  const v = view!;
  const champ = v.champion ? v.teamsById.get(v.champion) : undefined;
  const col = (stage: string) => KO_PLAN.filter((k) => k.stage === stage).map((k) => <Box key={k.code} slot={k} />);
  return (
    <div className="bracket-scroll">
      <div className="bracket">
        <div className="b-col">
          <h4>Cuartos</h4>
          {col('QF')}
        </div>
        <div className="b-col">
          <h4>Semifinales</h4>
          {col('SF')}
        </div>
        <div className="b-col">
          <h4>Final</h4>
          {col('F')}
          <a className={`b-champ ${champ ? 'on' : ''}`} href={champ ? '#/campeon' : undefined}>
            <span className="trophy">🏆</span>
            <span>{champ ? champ.name : 'Campeón'}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
