import { useState } from 'react';
import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { shuffle } from '../../domain/draw';
import { MatchCard } from '../../components/MatchCard';
import { Section } from '../../components/ui';
import TeamsAdmin from './TeamsAdmin';
import PaymentsChart from './PaymentsChart';
import FinanceAdmin from './FinanceAdmin';
import DrawAdmin from './DrawAdmin';
import ScheduleAdmin from './ScheduleAdmin';
import SocialAdmin from './SocialAdmin';
import LogAdmin from './LogAdmin';
import SettingsAdmin from './SettingsAdmin';

function Login() {
  const s = useStore();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await s.signIn('organizador@mazarife', pw.trim());
      s.toast('🔓 Acceso Organizador activado', 'ok');
    } catch (e: any) {
      setErr(e?.message ?? 'Contraseña incorrecta');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card login-xl" onSubmit={submit}>
      <div className="login-xl-icon">🔑</div>
      <h2>Acceso Organizador</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Introduce la contraseña maestra del Torneo de Villar de Mazarife para gestionar equipos, pagos, horarios y partidos en directo.
      </p>

      <label className="field">
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>Contraseña del Torneo</span>
        <input
          type="password"
          className="login-xl-input"
          autoComplete="current-password"
          placeholder="Escribe la contraseña…"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          required
        />
      </label>

      {err && <div className="dup-alert" style={{ fontSize: 16, fontWeight: 700 }}>{err}</div>}

      <button className="btn btn-gold full login-xl-btn" disabled={busy}>
        {busy ? 'Verificando…' : '🔓 Entrar al Panel de Organizador'}
      </button>
    </form>
  );
}

function Alerts() {
  const s = useStore();
  const v = s.view!;
  const pend = [...v.standings.A.pendingLotteries, ...v.standings.B.pendingLotteries];
  const notes = [...v.standings.A.notes.map((n) => `Grupo A · ${n}`), ...v.standings.B.notes.map((n) => `Grupo B · ${n}`)];
  const doLottery = (key: string, ids: string[]) => {
    const names = ids.map((id) => v.teamsById.get(id)?.name).join(', ');
    if (!confirm(`Se hará un sorteo para ordenar a: ${names}. El resultado quedará guardado. ¿Continuar?`)) return;
    const order = shuffle(ids);
    s.commit([op.upsert('settings', { key: 'lotteries', value: { ...v.lotteries, [key]: order } })], 'Sorteo de desempate');
    s.toast(`Sorteo: ${order.map((id) => v.teamsById.get(id)?.name).join(' > ')}`, 'ok');
  };
  if (!pend.length && !notes.length) return null;
  return (
    <div className="alerts">
      {pend.map((p) => (
        <div key={p.key} className="card warn">
          <b>⚠️ Empate total en el Grupo {p.group}</b>
          <p>{p.teamIds.map((id) => v.teamsById.get(id)?.name).join(', ')} siguen empatados tras todos los criterios. Hay que desempatar por sorteo.</p>
          <button className="btn btn-gold" onClick={() => doLottery(p.key, p.teamIds)}>
            🎲 Hacer sorteo de desempate
          </button>
        </div>
      ))}
      {notes.length > 0 && (
        <details className="card">
          <summary>Desempates aplicados ({notes.length})</summary>
          <ul className="notes">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function MatchesAdmin() {
  const v = useStore().view!;
  const [filter, setFilter] = useState<'all' | 'live' | 'pending' | 'finished' | 'KO'>('all');
  if (!v.matches.length)
    return (
      <div className="card">
        <p className="muted">Primero confirma el sorteo y genera el calendario en las pestañas Sorteo / Calendario.</p>
      </div>
    );
  const live = v.matches.filter((m) => m.status === 'live');
  const pending = v.matches.filter((m) => m.status === 'pending');
  const done = v.matches.filter((m) => m.status === 'finished').reverse();

  return (
    <>
      <div className="card row-between">
        <div>
          <span className="kicker">FASE 4 · MODO MESA DE CONTROL</span>
          <h3 style={{ margin: '3px 0 0', fontFamily: 'var(--font-display)', fontSize: 26 }}>
            Toca un partido para abrir el Marcador y Cronómetro XL
          </h3>
        </div>
        <div className="filter-pills">
          <button type="button" className={`chip-btn ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            Todos ({v.matches.length})
          </button>
          <button type="button" className={`chip-btn ${filter === 'live' ? 'on' : ''}`} onClick={() => setFilter('live')}>
            🔴 En juego ({live.length})
          </button>
          <button type="button" className={`chip-btn ${filter === 'pending' ? 'on' : ''}`} onClick={() => setFilter('pending')}>
            ⏳ Pendientes ({pending.length})
          </button>
          <button type="button" className={`chip-btn ${filter === 'finished' ? 'on' : ''}`} onClick={() => setFilter('finished')}>
            🏁 Finalizados ({done.length})
          </button>
          <button type="button" className={`chip-btn ${filter === 'KO' ? 'on' : ''}`} onClick={() => setFilter('KO')}>
            🏆 Eliminatorias
          </button>
        </div>
      </div>

      {filter === 'KO' ? (
        <Section title="🏆 Partidos de Eliminatorias">
          <div className="cards">{v.matches.filter((m) => m.stage !== 'group').map((m) => <MatchCard key={m.id} m={m} />)}</div>
        </Section>
      ) : (
        <>
          {(filter === 'all' || filter === 'live') && live.length > 0 && (
            <Section title="🔴 En Juego ahora">
              <div className="cards">{live.map((m) => <MatchCard key={m.id} m={m} />)}</div>
            </Section>
          )}
          {(filter === 'all' || filter === 'pending') && pending.length > 0 && (
            <Section title="⏳ Próximos / Pendientes">
              <div className="cards">{pending.map((m) => <MatchCard key={m.id} m={m} />)}</div>
            </Section>
          )}
          {(filter === 'all' || filter === 'finished') && done.length > 0 && (
            <Section title="🏁 Finalizados">
              <div className="cards">{done.map((m) => <MatchCard key={m.id} m={m} />)}</div>
            </Section>
          )}
        </>
      )}
    </>
  );
}

const TABS = [
  { key: 'equipos', label: '👕 Equipos y Pagos' },
  { key: 'finanzas', label: '💰 Contabilidad' },
  { key: 'sorteo', label: '🎱 Sorteo' },
  { key: 'calendario', label: '📅 Calendario' },
  { key: 'partidos', label: '⚽ Partidos' },
  { key: 'social', label: '🍻 Tasca y Anuncios' },
  { key: 'historial', label: '🗂️ Historial y copias' },
  { key: 'ajustes', label: '⚙️ Ajustes' },
];

export default function AdminPage({ tab }: { tab?: string }) {
  const s = useStore();
  if (!s.authReady) return <div className="loading">Comprobando sesión…</div>;
  if (!s.user || !s.isOrganizer) return <Login />;
  const v = s.view;
  if (!v) return <div className="loading">Cargando datos…</div>;
  const defaultTab = 'equipos';
  const current = TABS.some((t) => t.key === tab) ? tab! : defaultTab;
  return (
    <>
      <div className="admin-head">
        <h1 className="page-title">Panel del Organizador</h1>
        <div className="row-gap">
          {s.undoLabel && (
            <button className="btn btn-sm btn-ghost" onClick={s.undo} title={`Deshacer: ${s.undoLabel}`}>
              ↶ Deshacer
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => s.signOut()}
          >
            🔒 Salir
          </button>
        </div>
      </div>
      <PaymentsChart />
      <nav className="tabs">
        {TABS.map((t) => (
          <a key={t.key} href={`#/admin/${t.key}`} className={current === t.key ? 'on' : ''}>
            {t.label}
          </a>
        ))}
      </nav>
      <Alerts />
      {current === 'partidos' && <MatchesAdmin />}
      {current === 'equipos' && <TeamsAdmin />}
      {current === 'finanzas' && <FinanceAdmin />}
      {current === 'sorteo' && <DrawAdmin />}
      {current === 'calendario' && <ScheduleAdmin />}
      {current === 'social' && <SocialAdmin />}
      {current === 'historial' && <LogAdmin />}
      {current === 'ajustes' && <SettingsAdmin />}
    </>
  );
}
