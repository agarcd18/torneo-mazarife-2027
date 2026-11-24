import { useStore } from '../lib/store';
import { TeamBadge } from '../components/ui';

export default function More() {
  const s = useStore();
  const v = s.view!;
  const my = s.myTeam ? v.teamsById.get(s.myTeam) : undefined;
  const items = [
    { href: '#/tasca', icon: '🍻', label: 'La Tasca / Barra', sub: 'Lista de precios de bocadillos y bebidas' },
    { href: '#/galeria', icon: '📸', label: 'Galería de Fotos', sub: `Sube tus fotos del torneo (${s.photos.length} publicadas)` },
    { href: '#/estadisticas', icon: '📈', label: 'Estadísticas', sub: 'Máximo Goleador y Portero Menos Goleado' },
    { href: '#/equipos', icon: '👕', label: 'Equipos y Plantillas', sub: 'Jugadores, partidos y sancionados' },
    { href: '#/normas', icon: '📜', label: 'Normas y Reglamento (PDF)', sub: 'Reglamento oficial descargable y desempates' },
    { href: '#/tv', icon: '📺', label: 'Modo Pantalla / TV', sub: 'Para proyectar clasificación y resultados' },
    { href: '#/admin', icon: s.isOrganizer ? '🛠️' : '🔒', label: 'Panel de Organizadores', sub: s.isOrganizer ? `Conectado como ${s.user?.email}` : 'Acceso con usuario y contraseña' },
  ];
  return (
    <>
      <h1 className="page-title">Más Opciones</h1>
      <div className="menu">
        {items.map((i) => (
          <a key={i.href} href={i.href} className="menu-item">
            <span className="menu-icon">{i.icon}</span>
            <span className="grow">
              <b>{i.label}</b>
              <small className="muted block">{i.sub}</small>
            </span>
            <span className="chev">›</span>
          </a>
        ))}
      </div>
      <div className="card">
        <label className="field">
          <span>⭐ Mi Equipo Favorito</span>
          <select value={s.myTeam ?? ''} onChange={(e) => s.setMyTeam(e.target.value || null)}>
            <option value="">— Ninguno —</option>
            {v.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {my && (
          <p className="muted small row-center" style={{ margin: 0 }}>
            <TeamBadge team={my} size={20} /> Sus partidos salen destacados los primeros al entrar a la web.
          </p>
        )}
      </div>
      <div className="card row-between">
        <span>Modo visual ({s.theme === 'dark' ? 'Verde Oscuro y Dorado' : 'Claro'})</span>
        <button className="btn btn-sm btn-ghost" onClick={s.toggleTheme}>
          {s.theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
        </button>
      </div>
    </>
  );
}
