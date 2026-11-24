import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';

export function SyncIndicator() {
  const s = useStore();
  let cls = 'ok';
  let text = 'En directo';
  if (s.isOrganizer || s.queue.length) {
    if (s.sync === 'error') {
      cls = 'err';
      text = 'Error';
    } else if (s.sync === 'offline') {
      cls = 'off';
      text = s.queue.length ? `Offline (${s.queue.length})` : 'Offline';
    } else if (s.sync === 'saving') {
      cls = 'saving';
      text = `Guardando (${s.queue.length})`;
    } else {
      cls = 'ok';
      text = 'Sincronizado';
    }
  } else if (s.loadError && !s.fresh) {
    cls = 'off';
    text = 'Offline';
  } else if (s.realtime !== 'live') {
    cls = 'saving';
    text = 'Conectando…';
  }
  return (
    <a className={`sync sync-${cls}`} href={s.isOrganizer ? '#/admin/ajustes' : undefined} title={s.flushError ?? text}>
      <i />
      <span>{text}</span>
    </a>
  );
}

const DRAWER_LINKS = [
  { href: '#/', icon: '🏠', label: 'Inicio (Anuncios, Tasca y Partidos)', match: '' },
  { href: '#/clasificacion', icon: '🏆', label: 'Clasificación', match: 'clasificacion' },
  { href: '#/cuadro', icon: '🌳', label: 'Cuadro Final', match: 'cuadro' },
  { href: '#/galeria', icon: '📸', label: 'Galería de Fotos', match: 'galeria' },
  { href: '#/mi-equipo', icon: '⭐', label: 'Mi Equipo', match: 'mi-equipo' },
  { href: '#/normas', icon: '📄', label: 'Normas y Reglamento', match: 'normas' },
  { href: '#/estadisticas', icon: '📈', label: 'Goleadores y Porteros', match: 'estadisticas' },
  { href: '#/calendario', icon: '📅', label: 'Calendario Completo', match: 'calendario' },
];

export function Header({ active = '' }: { active?: string }) {
  const s = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const closeOnHash = () => setMenuOpen(false);
    window.addEventListener('hashchange', closeOnHash);
    return () => window.removeEventListener('hashchange', closeOnHash);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [menuOpen]);

  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-ball">⚽</span>
          <span className="brand-text">
            <b>Villar de Mazarife</b>
            <small>Torneo Fútbol Sala</small>
          </span>
        </a>

        <div className="top-actions">
          <SyncIndicator />
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Abrir menú de navegación"
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 28 28" width="32" height="32" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
              <line x1="4" y1="7" x2="24" y2="7" />
              <line x1="4" y1="14" x2="24" y2="14" />
              <line x1="4" y1="21" x2="24" y2="21" />
            </svg>
            <span>MENÚ</span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Menú principal">
            <div className="drawer-head">
              <div>
                <span className="kicker">MENÚ DEL TORNEO</span>
                <h3>Villar de Mazarife</h3>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                ✕ Cerrar
              </button>
            </div>

            <nav className="drawer-nav">
              {DRAWER_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`drawer-item ${active === item.match ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="drawer-icon">{item.icon}</span>
                  <span className="drawer-label">{item.label}</span>
                  <span className="drawer-chev">›</span>
                </a>
              ))}
            </nav>

            <div className="drawer-footer">
              <a
                href="#/admin"
                className="drawer-admin-btn"
                onClick={() => setMenuOpen(false)}
              >
                <span>{s.isOrganizer ? '🛠️' : '🔑'}</span>
                <span>{s.isOrganizer ? 'Panel Organizador (Activo)' : 'Acceso Organizador'}</span>
              </a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export function BottomNav({ active: _active }: { active: string }) {
  // La navegación principal ahora va por el Menú Hamburguesa XL según el rediseño Outdoor
  return null;
}

export function Banners() {
  const s = useStore();
  return (
    <>
      {s.loadError && s.view && (
        <div className="banner banner-warn">
          Sin conexión con el servidor; mostrando datos guardados. Reintentando…
        </div>
      )}
      {s.flushError && s.isOrganizer && (
        <div className="banner banner-err">
          No se pudo guardar un cambio: {s.flushError}{' '}
          <a href="#/admin/ajustes">Revisar</a>
        </div>
      )}
    </>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
