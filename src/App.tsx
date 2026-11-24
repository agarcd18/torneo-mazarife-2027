import { useEffect } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { go, useRoute } from './lib/router';
import { Banners, Header, Toasts } from './components/Header';
import Home from './pages/Home';
import Standings from './pages/Standings';
import Calendar from './pages/Calendar';
import BracketPage from './pages/BracketPage';
import Stats from './pages/Stats';
import { TeamDetail, TeamsList } from './pages/Teams';
import MatchPage from './pages/MatchPage';
import Rules from './pages/Rules';
import More from './pages/More';
import TVMode from './pages/TVMode';
import Champion from './pages/Champion';
import GalleryPage from './pages/GalleryPage';
import TascaPage from './pages/TascaPage';
import MyTeamPage from './pages/MyTeamPage';
import AdminPage from './pages/admin/AdminPage';
import WaiverPrintPage from './pages/admin/WaiverPrintPage';

function LoadState() {
  const s = useStore();
  if (s.loadError)
    return (
      <div className="empty">
        <div className="empty-icon">📡</div>
        <h3>No se pudo conectar</h3>
        <p className="muted">{s.loadError}</p>
        <p className="muted small">Reintentando automáticamente…</p>
        <button className="btn btn-ghost" onClick={s.reload}>
          Reintentar ahora
        </button>
      </div>
    );
  return (
    <div className="loading">
      <span className="spinner" /> Cargando torneo…
    </div>
  );
}

function Shell() {
  const route = useRoute();
  const s = useStore();
  const [r0 = '', r1, r2] = route;

  // Pantalla de campeón: se abre sola una vez por dispositivo al terminar la final
  useEffect(() => {
    const c = s.view?.champion;
    if (!c || s.isOrganizer) return;
    const k = 'ftorneo.champ.seen';
    if (localStorage.getItem(k) !== c) {
      localStorage.setItem(k, c);
      if (r0 !== 'tv') go('/campeon');
    }
  }, [s.view?.champion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (r0 === 'tv') return <TVMode />;
  if (r0 === 'admin' && r1 === 'descargo') return <WaiverPrintPage teamId={r2} />;

  let page: JSX.Element;
  if (!s.view) page = <LoadState />;
  else
    switch (r0) {
      case '':
        page = <Home />;
        break;
      case 'clasificacion':
        page = <Standings />;
        break;
      case 'calendario':
        page = <Calendar />;
        break;
      case 'cuadro':
        page = <BracketPage />;
        break;
      case 'estadisticas':
        page = <Stats />;
        break;
      case 'equipos':
        page = <TeamsList />;
        break;
      case 'equipo':
        page = <TeamDetail id={r1 ?? ''} />;
        break;
      case 'partido':
        page = <MatchPage id={r1 ?? ''} />;
        break;
      case 'normas':
        page = <Rules />;
        break;
      case 'tasca':
        page = <TascaPage />;
        break;
      case 'galeria':
        page = <GalleryPage />;
        break;
      case 'mi-equipo':
        page = <MyTeamPage />;
        break;
      case 'mas':
        page = <More />;
        break;
      case 'campeon':
        page = <Champion />;
        break;
      case 'admin':
        page = <AdminPage tab={r1} />;
        break;
      default:
        page = <Home />;
    }
  if (r0 === 'admin' && !s.view && !s.user && s.authReady) page = <AdminPage tab={r1} />;

  return (
    <div className="app">
      <Header active={r0} />
      <Banners />
      <main className="page" key={r0 + (r1 ?? '')}>
        {page}
      </main>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
