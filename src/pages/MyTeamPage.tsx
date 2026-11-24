import { useStore } from '../lib/store';
import { Section, TeamBadge, Empty } from '../components/ui';
import { TeamDetail } from './Teams';

export default function MyTeamPage() {
  const s = useStore();
  const v = s.view!;
  const myTeamObj = s.myTeam ? v.teamsById.get(s.myTeam) : undefined;

  return (
    <>
      <h1 className="page-title">⭐ Mi Equipo</h1>

      <div className="card">
        <label className="field" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>
            Selecciona tu equipo favorito para destacarlo en toda la app:
          </span>
          <select
            value={s.myTeam ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              s.setMyTeam(id);
              if (id) s.toast(`⭐ ${v.teamsById.get(id)?.name} guardado como tu equipo`, 'ok');
            }}
          >
            <option value="">— Selecciona un equipo de la lista —</option>
            {v.teams.map((t) => (
              <option key={t.id} value={t.id}>
                ⭐ {t.name} {t.group_name ? `(Grupo ${t.group_name})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {myTeamObj ? (
        <TeamDetail id={myTeamObj.id} />
      ) : v.teams.length > 0 ? (
        <Section title="O toca directamente tu equipo:">
          <div className="team-grid">
            {v.teams.map((t) => (
              <button
                key={t.id}
                type="button"
                className="team-tile"
                style={{ ['--tc' as any]: t.color, cursor: 'pointer' }}
                onClick={() => {
                  s.setMyTeam(t.id);
                  s.toast(`⭐ ${t.name} es ahora tu equipo favorito`, 'ok');
                }}
              >
                <TeamBadge team={t} size={52} />
                <b style={{ fontSize: 17 }}>{t.name}</b>
                <small className="muted">Elegir como favorito ⭐</small>
              </button>
            ))}
          </div>
        </Section>
      ) : (
        <Empty icon="👕" title="Aún no hay equipos inscritos en el torneo" />
      )}
    </>
  );
}
