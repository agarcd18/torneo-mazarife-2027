import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { MatchCard } from '../components/MatchCard';
import { Empty } from '../components/ui';
import { fmtDateLong } from '../lib/format';

export default function Calendar() {
  const { view, myTeam } = useStore();
  const v = view!;
  const [day, setDay] = useState('');
  const [group, setGroup] = useState('');
  const [team, setTeam] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  const days = useMemo(() => [...new Set(v.matches.map((m) => m.match_date ?? ''))], [v.matches]);
  const list = v.matches.filter((m) => {
    if (day && (m.match_date ?? '') !== day) return false;
    if (group === 'A' || group === 'B') {
      if (m.group_name !== group) return false;
    } else if (group === 'KO' && m.stage === 'group') return false;
    const tf = onlyMine ? myTeam : team;
    if (tf && m.home_team_id !== tf && m.away_team_id !== tf) return false;
    return true;
  });
  const byDay = new Map<string, typeof list>();
  for (const m of list) {
    const k = m.match_date ?? '';
    byDay.set(k, [...(byDay.get(k) ?? []), m]);
  }

  if (!v.matches.length) return <Empty icon="📅" title="Calendario pendiente">Se publicará después del sorteo de grupos.</Empty>;

  return (
    <>
      <h1 className="page-title">Calendario</h1>
      <div className="filters">
        <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Día">
          <option value="">Todos los días</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d ? fmtDateLong(d) : 'Sin fecha'}
            </option>
          ))}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Grupo">
          <option value="">Todas las fases</option>
          <option value="A">Grupo A</option>
          <option value="B">Grupo B</option>
          <option value="KO">Fase final</option>
        </select>
        <select value={team} onChange={(e) => { setTeam(e.target.value); setOnlyMine(false); }} aria-label="Equipo">
          <option value="">Todos los equipos</option>
          {v.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {myTeam && (
          <button className={`chip-btn ${onlyMine ? 'on' : ''}`} onClick={() => setOnlyMine((x) => !x)}>
            ⭐ Mi equipo
          </button>
        )}
      </div>
      {!list.length && <p className="muted">No hay partidos con esos filtros.</p>}
      {[...byDay].map(([d, ms]) => (
        <section key={d} className="section">
          <h3 className="day-title">{d ? fmtDateLong(d) : 'Sin fecha'}</h3>
          <div className="cards">
            {ms.map((m) => (
              <MatchCard key={m.id} m={m} showDate={false} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
