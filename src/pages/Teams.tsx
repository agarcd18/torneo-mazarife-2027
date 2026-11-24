import { useStore } from '../lib/store';
import { Empty, Section, TeamBadge } from '../components/ui';
import { MatchCard } from '../components/MatchCard';
import { topScorers } from '../domain/stats';
import type { Team } from '../lib/types';

export function TeamsList() {
  const { view, myTeam } = useStore();
  const v = view!;
  if (!v.teams.length) return <Empty icon="👕" title="Aún no hay equipos" />;
  const groups: { title: string; teams: Team[] }[] = v.teams.some((t) => t.group_name)
    ? [
        { title: 'Grupo A', teams: v.teams.filter((t) => t.group_name === 'A').sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0)) },
        { title: 'Grupo B', teams: v.teams.filter((t) => t.group_name === 'B').sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0)) },
        { title: 'Sin grupo', teams: v.teams.filter((t) => !t.group_name) },
      ]
    : [{ title: 'Equipos', teams: v.teams }];
  return (
    <>
      <h1 className="page-title">Equipos</h1>
      {groups
        .filter((g) => g.teams.length)
        .map((g) => (
          <Section key={g.title} title={g.title}>
            <div className="team-grid">
              {g.teams.map((t) => (
                <a key={t.id} href={`#/equipo/${t.id}`} className={`team-tile ${myTeam === t.id ? 'mine' : ''}`} style={{ ['--tc' as any]: t.color }}>
                  <TeamBadge team={t} size={44} />
                  <b>{t.name}</b>
                  <small className="muted">{v.playersByTeam.get(t.id)?.length ?? 0} jugadores</small>
                </a>
              ))}
            </div>
          </Section>
        ))}
    </>
  );
}

export function TeamDetail({ id }: { id: string }) {
  const { view, myTeam, setMyTeam, toast } = useStore();
  const v = view!;
  const t = v.teamsById.get(id);
  if (!t) return <Empty icon="❓" title="Equipo no encontrado" />;
  const players = v.playersByTeam.get(t.id) ?? [];
  const row = t.group_name ? v.standings[t.group_name].rows.find((r) => r.team.id === t.id) : undefined;
  const matches = v.matches.filter((m) => m.home_team_id === t.id || m.away_team_id === t.id);
  const scorers = topScorers(v.matches, v.db.goals, v.playersById, v.teamsById).filter((r) => r.player.team_id === t.id);
  const goalsOf = new Map(scorers.map((s) => [s.player.id, s.goals]));
  const sanctioned = players.map((p) => ({ p, s: v.sanctions.byPlayer.get(p.id) })).filter((x) => x.s && (x.s.reasons.length > 0));
  const isMine = myTeam === t.id;

  return (
    <>
      <div className="team-hero" style={{ ['--tc' as any]: t.color }}>
        <TeamBadge team={t} size={72} />
        <div>
          <h1>{t.name}</h1>
          <div className="muted">
            {t.group_name ? `Grupo ${t.group_name}` : 'Sin grupo'}
            {row && (
              <>
                {' '}· <b className="gold">{row.pos}.º</b> · {row.pts} pts
              </>
            )}
          </div>
        </div>
      </div>
      <button
        className={`btn ${isMine ? 'btn-gold' : 'btn-ghost'} full`}
        onClick={() => {
          setMyTeam(isMine ? null : t.id);
          toast(isMine ? 'Ya no sigues a este equipo' : `${t.name} es ahora tu equipo ⭐`, 'ok');
        }}
      >
        {isMine ? '⭐ Mi equipo' : '☆ Marcar como mi equipo'}
      </button>

      {row && (
        <div className="stat-strip">
          <div><b>{row.pj}</b><span>PJ</span></div>
          <div><b>{row.g}</b><span>G</span></div>
          <div><b>{row.e}</b><span>E</span></div>
          <div><b>{row.p}</b><span>P</span></div>
          <div><b>{row.gf}:{row.gc}</b><span>Goles</span></div>
          <div><b>{row.fp}</b><span>FP</span></div>
        </div>
      )}

      <Section title="Plantilla">
        {!players.length ? (
          <p className="muted">Sin jugadores registrados.</p>
        ) : (
          <ul className="roster">
            {players.map((p) => {
              const s = v.sanctions.byPlayer.get(p.id);
              return (
                <li key={p.id}>
                  <span className="dorsal">{p.number ?? '–'}</span>
                  <span className="grow">
                    {p.name} {p.is_goalkeeper && <span className="tag">POR</span>}
                    {s?.active && <span className="tag red">SANCIONADO</span>}
                  </span>
                  {goalsOf.get(p.id) ? <span className="mini">⚽ {goalsOf.get(p.id)}</span> : null}
                  {s?.yellows ? <span className="mini">🟨 {s.yellows}</span> : null}
                  {s?.reds ? <span className="mini">🟥 {s.reds}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Partidos">
        {!matches.length ? <p className="muted">Sin partidos todavía.</p> : <div className="cards">{matches.map((m) => <MatchCard key={m.id} m={m} />)}</div>}
      </Section>

      <Section title="Goleadores">
        {!scorers.length ? (
          <p className="muted">Sin goles todavía.</p>
        ) : (
          <ul className="roster">
            {scorers.map((s) => (
              <li key={s.player.id}>
                <span className="dorsal">{s.player.number ?? '–'}</span>
                <span className="grow">{s.player.name}</span>
                <b className="gold">{s.goals}</b>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Sancionados">
        {!sanctioned.length ? (
          <p className="muted">Ningún jugador sancionado.</p>
        ) : (
          <ul className="roster">
            {sanctioned.map(({ p, s }) => (
              <li key={p.id}>
                <span className="dorsal">{p.number ?? '–'}</span>
                <span className="grow">
                  {p.name}
                  <small className="muted block">{s!.reasons.map((r) => `${r.reason} (${r.n} partido${r.n > 1 ? 's' : ''})`).join(' · ')}</small>
                </span>
                {s!.active ? <span className="tag red">SANCIONADO</span> : <span className="tag">Cumplida</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
