import { useState } from 'react';
import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { uid } from '../../lib/ids';
import { PALETTE } from '../../lib/format';
import { TeamBadge } from '../../components/ui';
import { duplicateNumbers, parsePlayerList } from '../../domain/players';
import { DEFAULT_TOURNAMENT } from '../../domain/settings';
import type { PaymentStatus, Player, Team } from '../../lib/types';

function PlayerRow({ p, dup }: { p: Player; dup: boolean }) {
  const s = useStore();
  const [name, setName] = useState(p.name);
  const [num, setNum] = useState(p.number?.toString() ?? '');
  const save = (patch: Partial<Player>, label: string) => s.commit([op.update('players', p.id, patch)], label);
  return (
    <div className={`player-row ${dup ? 'dup' : ''}`}>
      <input
        className="num-input"
        inputMode="numeric"
        placeholder="#"
        value={num}
        onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={() => {
          const n = num === '' ? null : parseInt(num, 10);
          if (n !== p.number) save({ number: n }, `Dorsal de ${p.name}`);
        }}
        aria-label="Dorsal"
      />
      <input
        className="grow"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const n = name.trim();
          if (n && n !== p.name) save({ name: n }, `Renombrar jugador ${p.name}`);
          else setName(p.name);
        }}
        aria-label="Nombre"
      />
      <label className="gk-check" title="Marcar como portero">
        <input type="checkbox" checked={p.is_goalkeeper} onChange={(e) => save({ is_goalkeeper: e.target.checked }, `Portero ${p.name}`)} />
        <span>🧤 POR</span>
      </label>
      <button
        className="icon-btn danger"
        aria-label="Borrar jugador"
        onClick={() => {
          if (confirm(`¿Borrar a ${p.name}? También se borrarán sus tarjetas.`)) s.commit([op.del('players', p.id)], `Borrar jugador ${p.name}`);
        }}
      >
        🗑
      </button>
    </div>
  );
}

function PlayersEditor({ team }: { team: Team }) {
  const s = useStore();
  const v = s.view!;
  const players = v.playersByTeam.get(team.id) ?? [];
  const dups = duplicateNumbers(players);
  const [name, setName] = useState('');
  const [num, setNum] = useState('');
  const [gk, setGk] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const number = num === '' ? null : parseInt(num, 10);
    if (number != null && players.some((p) => p.number === number)) s.toast(`⚠️ Ojo: el dorsal ${number} está repetido en ${team.name}`, 'warn');
    s.commit([op.upsert('players', { id: uid(), team_id: team.id, name: n, number, is_goalkeeper: gk })], `Añadir jugador ${n}`);
    setName('');
    setNum('');
    setGk(false);
  };
  const importList = () => {
    const list = parsePlayerList(paste ?? '');
    if (!list.length) return s.toast('No se ha encontrado ningún nombre', 'warn');
    s.commit([op.bulkUpsert('players', list.map((p) => ({ id: uid(), team_id: team.id, ...p })))], `Añadir ${list.length} jugadores a ${team.name}`);
    s.toast(`${list.length} jugadores añadidos`, 'ok');
    setPaste(null);
  };
  return (
    <div className="players-editor">
      {dups.size > 0 && (
        <div className="dup-alert">
          ⚠️ <b>Dorsales repetidos en {team.name}:</b> {[...dups].map((d) => `#${d}`).join(', ')}
        </div>
      )}
      {players.map((p) => (
        <PlayerRow key={p.id + (p.number ?? '') + p.name} p={p} dup={p.number != null && dups.has(p.number)} />
      ))}
      {!players.length && <p className="muted small">Sin jugadores todavía. Añade uno abajo o pega la lista completa.</p>}
      <form className="player-row add" onSubmit={add}>
        <input className="num-input" inputMode="numeric" placeholder="Nº" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-label="Dorsal" />
        <input className="grow" placeholder="Nombre del jugador" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" />
        <label className="gk-check" title="Portero">
          <input type="checkbox" checked={gk} onChange={(e) => setGk(e.target.checked)} />
          <span>🧤 POR</span>
        </label>
        <button className="btn btn-sm btn-primary">+ Jugador</button>
      </form>
      {paste === null ? (
        <button className="btn btn-sm btn-ghost" onClick={() => setPaste('')}>
          📋 Pegar lista de jugadores de golpe
        </button>
      ) : (
        <div className="paste-box">
          <textarea
            rows={5}
            placeholder={'Un jugador por línea. Ejemplos:\n1 Luis García (P)\n7 Juan Pérez\n10 Carlos Martín'}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="row-gap">
            <button className="btn btn-sm btn-primary" onClick={importList}>
              Añadir {parsePlayerList(paste).length} jugadores
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setPaste(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamRow({ t, open, onToggle }: { t: Team; open: boolean; onToggle: () => void }) {
  const s = useStore();
  const v = s.view!;
  const [name, setName] = useState(t.name);
  const players = v.playersByTeam.get(t.id) ?? [];
  const count = players.length;
  const dups = duplicateNumbers(players);
  const isPaid = t.payment_status === 'paid';
  const fee = Number(v.tournament.registrationFee ?? 100);

  const togglePayment = () => {
    const next: PaymentStatus = isPaid ? 'pending' : 'paid';
    s.commit(
      [
        op.update('teams', t.id, {
          payment_status: next,
          payment_amount: next === 'paid' ? Number(t.payment_amount ?? fee) : null,
          paid_at: next === 'paid' ? new Date().toISOString() : null,
        }),
      ],
      `${t.name}: ${next === 'paid' ? 'Pagado' : 'Pendiente'}`,
    );
    s.toast(next === 'paid' ? `✅ ${t.name} marcado como PAGADO (${fee} €)` : `⏳ ${t.name} marcado como PENDIENTE`, next === 'paid' ? 'ok' : 'info');
  };

  const remove = () => {
    const extra = v.draw.confirmed ? '\n\nATENCIÓN: el sorteo ya está confirmado; borrar un equipo dejará huecos en el calendario.' : '';
    if (!confirm(`¿Borrar el equipo "${t.name}" y sus ${count} jugadores?${extra}`)) return;
    if (v.matches.some((m) => m.home_team_id === t.id || m.away_team_id === t.id) && prompt('Este equipo tiene partidos. Escribe BORRAR para confirmar') !== 'BORRAR') return;
    s.commit([op.del('teams', t.id)], `Borrar equipo ${t.name}`, { undoable: false });
  };

  return (
    <div className={`team-admin ${open ? 'open' : ''} ${isPaid ? 'is-paid' : 'is-pending'}`}>
      <div className="team-admin-head">
        <label className="color-pick" title="Cambiar color del equipo">
          <TeamBadge team={t} size={36} />
          <input type="color" value={t.color} onChange={(e) => s.commit([op.update('teams', t.id, { color: e.target.value })], `Color de ${t.name}`)} />
        </label>
        <input
          className="grow team-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const n = name.trim();
            if (n && n !== t.name) s.commit([op.update('teams', t.id, { name: n })], `Renombrar ${t.name} → ${n}`);
            else setName(t.name);
          }}
          aria-label="Nombre del equipo"
        />
        <button
          type="button"
          className={`pay-pill ${isPaid ? 'paid' : 'pending'}`}
          onClick={togglePayment}
          title={isPaid ? 'Inscripción pagada (pulsa para cambiar a Pendiente)' : 'Inscripción pendiente (pulsa para marcar como Pagado)'}
        >
          {isPaid ? '✅ Pagado' : '⏳ Pendiente'}
        </button>
        <a
          href={`#/admin/descargo/${t.id}`}
          className="btn btn-sm btn-ghost"
          title="Imprimir Hoja de Descargo de Responsabilidad del equipo"
        >
          🖨️ Imprimir Hoja de Descargo
        </a>
        <button className={`btn btn-sm btn-ghost ${dups.size ? 'warn-border' : ''}`} onClick={onToggle} title="Ver / editar jugadores">
          {dups.size > 0 && '⚠️ '}
          {count} 👤 {open ? '▴' : '▾'}
        </button>
        <button className="icon-btn danger" onClick={remove} aria-label="Borrar equipo">
          🗑
        </button>
      </div>
      {open && <PlayersEditor team={t} />}
    </div>
  );
}

export default function TeamsAdmin() {
  const s = useStore();
  const v = s.view!;
  const [name, setName] = useState('');
  const [paidOnCreate, setPaidOnCreate] = useState(false);
  const [filterPay, setFilterPay] = useState<'all' | 'paid' | 'pending'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const target = v.tournament.numTeams;
  const fee = Number(v.tournament.registrationFee ?? 100);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (v.teams.some((t) => t.name.toLowerCase() === n.toLowerCase())) return s.toast('Ya existe un equipo con ese nombre', 'warn');
    const used = new Set(v.teams.map((t) => t.color));
    const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[v.teams.length % PALETTE.length];
    const id = uid();
    s.commit(
      [
        op.upsert('teams', {
          id,
          name: n,
          color,
          group_name: null,
          group_order: null,
          payment_status: paidOnCreate ? 'paid' : 'pending',
          payment_amount: paidOnCreate ? fee : null,
          paid_at: paidOnCreate ? new Date().toISOString() : null,
        }),
      ],
      `Crear equipo ${n}`,
    );
    setName('');
    setPaidOnCreate(false);
    setOpen(id);
  };

  const setTarget = (n: number) => {
    if (!Number.isFinite(n) || n < 4 || n > 40) return;
    const cur = v.db.settings.find((x) => x.key === 'tournament')?.value ?? DEFAULT_TOURNAMENT;
    s.commit([op.upsert('settings', { key: 'tournament', value: { ...DEFAULT_TOURNAMENT, ...cur, numTeams: n } })], 'Número de equipos');
  };

  const filteredTeams = v.teams.filter((t) => {
    if (filterPay === 'paid') return t.payment_status === 'paid';
    if (filterPay === 'pending') return t.payment_status !== 'paid';
    return true;
  });

  return (
    <>
      <div className="card row-between">
        <span>
          Inscritos: <b className={v.teams.length === target ? 'gold' : ''}>{v.teams.length}</b> de{' '}
          <input
            className="num-input inline"
            type="number"
            min={4}
            max={40}
            defaultValue={target}
            key={target}
            onBlur={(e) => setTarget(parseInt(e.target.value, 10))}
            aria-label="Número de equipos"
          />{' '}
          equipos
        </span>
        <div className="filter-pills">
          <button type="button" className={`chip-btn ${filterPay === 'all' ? 'on' : ''}`} onClick={() => setFilterPay('all')}>
            Todos ({v.teams.length})
          </button>
          <button type="button" className={`chip-btn ${filterPay === 'paid' ? 'on' : ''}`} onClick={() => setFilterPay('paid')}>
            ✅ Pagados ({v.teams.filter((t) => t.payment_status === 'paid').length})
          </button>
          <button type="button" className={`chip-btn ${filterPay === 'pending' ? 'on' : ''}`} onClick={() => setFilterPay('pending')}>
            ⏳ Pendientes ({v.teams.filter((t) => t.payment_status !== 'paid').length})
          </button>
          {v.teams.length > 0 && (
            <a href="#/admin/descargo/todos" className="btn btn-sm btn-ghost" title="Imprimir todas las hojas de descargo juntas">
              🖨️ Imprimir todas las hojas
            </a>
          )}
        </div>
      </div>

      <form className="add-team" onSubmit={add}>
        <input placeholder="Nombre del nuevo equipo (ej. Villar Futsal)" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="gk-check" title="Marcar inscripción como pagada al crear">
          <input type="checkbox" checked={paidOnCreate} onChange={(e) => setPaidOnCreate(e.target.checked)} />
          <span>Pagado</span>
        </label>
        <button className="btn btn-gold">+ Crear equipo</button>
      </form>

      <div className="team-admin-list">
        {filteredTeams.map((t) => (
          <TeamRow key={t.id} t={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
        ))}
        {!filteredTeams.length && (
          <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
            {v.teams.length ? 'No hay equipos en este filtro.' : 'Aún no has creado ningún equipo. Escribe el nombre arriba para empezar.'}
          </p>
        )}
      </div>
    </>
  );
}
