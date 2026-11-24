import { useState } from 'react';
import { useStore } from '../../lib/store';
import { useNow } from '../../lib/router';
import { op } from '../../lib/ops';
import { uid } from '../../lib/ids';
import { mmss, stageLabel } from '../../lib/format';
import { clockElapsed, currentMinute, matchDuration } from '../../domain/match';
import { decideCard } from '../../domain/sanctions';
import { byNumber } from '../../domain/players';
import { Section, Sheet, TeamBadge } from '../../components/ui';
import type { Card, Goal, Match, MatchStatus, Player } from '../../lib/types';

type SheetKind = 'goal' | 'yellow' | 'red';

function MinuteStepper({
  value,
  onChange,
  label = 'Minuto',
  max,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  label?: string;
  max: number;
}) {
  return (
    <div className="minute-stepper">
      <span>{label}</span>
      <button type="button" onClick={() => onChange(Math.max(1, (value ?? 1) - 1))}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max + 20}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0))}
      />
      <button type="button" onClick={() => onChange((value ?? 0) + 1)}>
        +
      </button>
    </div>
  );
}

function PickPlayerSheet({
  kind,
  match,
  teamId,
  initialMinute,
  duration,
  onClose,
  onPick,
}: {
  kind: SheetKind;
  match: Match;
  teamId: string;
  initialMinute: number | null;
  duration: number;
  onClose: () => void;
  onPick: (playerId: string | null, minute: number | null, ownGoal: boolean) => void;
}) {
  const s = useStore();
  const v = s.view!;
  const [minute, setMinute] = useState<number | null>(initialMinute ?? 1);
  const [own, setOwn] = useState(false);
  const oppId = match.home_team_id === teamId ? match.away_team_id! : match.home_team_id!;
  const listTeam = own ? oppId : teamId;
  const team = v.teamsById.get(teamId);
  const players = [...(v.playersByTeam.get(listTeam) ?? [])].sort(byNumber);
  const cards = v.cardsByMatch.get(match.id) ?? [];
  const title = { goal: '⚽ Registrar Gol', yellow: '🟨 Tarjeta Amarilla', red: '🟥 Tarjeta Roja' }[kind];

  const pick = (p: Player | null) => {
    if (p) {
      const pc = cards.filter((c) => c.player_id === p.id);
      const sentOff = pc.some((c) => c.card_type === 'red');
      if (sentOff) {
        if (kind !== 'goal') {
          s.toast(`⛔ ${p.name} ya ha sido EXPULSADO en este partido y no puede recibir más tarjetas.`, 'error');
          return;
        }
        if (!confirm(`⛔ ATENCIÓN: ${p.name} figura como EXPULSADO (Roja) en este partido. ¿Seguro que quieres asignarle un gol?`)) {
          return;
        }
      }
      if (v.sanctions.isSuspended(p.id, match.id)) {
        if (!confirm(`⚠️ ${p.name} está SANCIONADO para este partido por acumulación/roja previa. ¿Registrar igualmente?`)) {
          return;
        }
      }
    }
    onPick(p?.id ?? null, minute, own);
  };

  return (
    <Sheet
      title={
        <span className="row-center">
          {title} · <TeamBadge team={team} size={24} /> {team?.name}
        </span>
      }
      onClose={onClose}
    >
      <MinuteStepper value={minute} onChange={setMinute} label="Minuto del evento" max={duration} />

      {kind === 'goal' && (
        <label className="toggle">
          <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />
          <span>Gol en propia puerta (lo marca un jugador rival)</span>
        </label>
      )}

      <div className="player-grid">
        {players.map((p) => {
          const susp = v.sanctions.isSuspended(p.id, match.id);
          const pc = cards.filter((c) => c.player_id === p.id);
          const hasYellow = pc.some((c) => c.card_type === 'yellow');
          const hasRed = pc.some((c) => c.card_type === 'red');
          const willBeSecondYellow = kind === 'yellow' && hasYellow && !hasRed;
          const blockedCard = (kind === 'yellow' || kind === 'red') && hasRed;

          return (
            <button
              key={p.id}
              type="button"
              className={`player-btn ${susp ? 'susp' : ''} ${hasRed ? 'sent-off' : ''} ${willBeSecondYellow ? 'warn-second' : ''}`}
              disabled={blockedCard}
              onClick={() => pick(p)}
            >
              <span className="pnum">{p.number ?? '–'}</span>
              <span className="pname">
                <b>{p.name}</b>
                {willBeSecondYellow && <small className="warn-text block">⚠️ 2ª amarilla → se transformará en ROJA</small>}
                {hasRed && <small className="error block">🟥 EXPULSADO en este partido</small>}
              </span>
              <span className="ptags">
                {p.is_goalkeeper && <span className="tag">POR</span>}
                {hasYellow && !hasRed && <span title="Tiene 1 amarilla">🟨</span>}
                {hasRed && <span className="tag red">EXPULSADO</span>}
                {susp && <span className="tag red">SANCIONADO</span>}
              </span>
            </button>
          );
        })}
      </div>

      {!players.length && <p className="muted">Este equipo no tiene jugadores dados de alta. Añádelos en Equipos y Pagos.</p>}
      {kind === 'goal' && (
        <button type="button" className="btn btn-ghost full" style={{ marginTop: 10 }} onClick={() => pick(null)}>
          ⚽ Registrar gol sin asignar jugador
        </button>
      )}
    </Sheet>
  );
}

type Ev = { kind: 'goal'; g: Goal } | { kind: 'card'; c: Card };

function EventRow({ e, match }: { e: Ev; match: Match }) {
  const s = useStore();
  const v = s.view!;
  const [open, setOpen] = useState(false);
  const row = e.kind === 'goal' ? e.g : e.c;
  const [minute, setMinute] = useState<number | null>(row.minute);
  const playerTeam =
    e.kind === 'goal' && e.g.own_goal
      ? e.g.team_id === match.home_team_id
        ? match.away_team_id
        : match.home_team_id
      : row.team_id;
  const players = v.playersByTeam.get(playerTeam ?? '') ?? [];
  const [playerId, setPlayerId] = useState<string>(row.player_id ?? '');
  const table = e.kind === 'goal' ? 'goals' : 'cards';
  const pname = row.player_id ? v.playersById.get(row.player_id)?.name ?? 'Jugador' : 'Gol de equipo';
  const icon = e.kind === 'goal' ? '⚽' : e.c.card_type === 'yellow' ? '🟨' : e.c.second_yellow ? '🟨🟥' : '🟥';
  const label = e.kind === 'goal' ? `gol de ${pname}` : `tarjeta de ${pname}`;

  const save = () => {
    const patch: any = { minute };
    if (e.kind === 'goal') patch.player_id = playerId || null;
    else if (playerId) patch.player_id = playerId;
    s.commit([op.update(table, row.id, patch)], `Corregir ${label}`);
    setOpen(false);
  };

  return (
    <li className={`ev-row ${row.team_id === match.home_team_id ? 'home' : 'away'}`}>
      <div className="ev-main">
        <span className="tl-min">{row.minute != null ? `${row.minute}'` : '–'}</span>
        <TeamBadge team={v.teamsById.get(row.team_id)} size={22} />
        <span className="grow">
          <b>
            {icon} {pname}
          </b>
          {e.kind === 'goal' && e.g.own_goal && <span className="tag">p.p.</span>}
          {e.kind === 'card' && e.c.second_yellow && <span className="tag red">2ª Amarilla = Roja</span>}
          {e.kind === 'card' && e.c.card_type === 'red' && !e.c.second_yellow && <span className="tag red">Roja directa</span>}
        </span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen((o) => !o)} title="Editar minuto o jugador">
          ✎
        </button>
        <button
          type="button"
          className="icon-btn danger"
          onClick={() => s.commit([op.del(table, row.id)], `Borrar ${label}`)}
          title={`Borrar ${label}`}
        >
          🗑
        </button>
      </div>
      {open && (
        <div className="ev-edit">
          <MinuteStepper value={minute} onChange={setMinute} max={matchDuration(match, v.tournament)} />
          <select value={playerId} onChange={(ev) => setPlayerId(ev.target.value)}>
            {e.kind === 'goal' && <option value="">Sin jugador</option>}
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number ?? '–'} · {p.name}
              </option>
            ))}
          </select>
          <div className="row-gap">
            <button type="button" className="btn btn-sm btn-primary" onClick={save}>
              Guardar cambios
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function AdminMatchPanel({ m }: { m: Match }) {
  const s = useStore();
  const v = s.view!;
  const now = useNow(1000);
  const [sheet, setSheet] = useState<{ kind: SheetKind; teamId: string } | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const dur = matchDuration(m, v.tournament); // 20 min grupos, 30 min fase final
  const half = dur / 2; // 10 min por parte en grupos, 15 min en eliminatorias
  const halfSeconds = half * 60;
  const home = m.home_team_id;
  const away = m.away_team_id;
  const score = v.scores.get(m.id)!;
  const goals = v.goalsByMatch.get(m.id) ?? [];
  const cards = v.cardsByMatch.get(m.id) ?? [];
  const stints = (v.gkByMatch.get(m.id) ?? []).slice().sort((a, b) => a.from_minute - b.from_minute);

  const clockUsed = m.clock_running || m.clock_base > 0 || m.period > 1;
  const elapsed = clockElapsed(m, now);
  const remaining = Math.max(0, halfSeconds - elapsed);
  const minuteNow = clockUsed ? currentMinute(m, half, now) : 1;
  const timeUp = elapsed >= halfSeconds;

  if (!home || !away) {
    return (
      <div className="card warn">
        <b>Este cruce aún no tiene los dos equipos definidos.</b>
        <p className="muted small">
          Se completará automáticamente en cuanto finalicen los partidos previos. También puedes asignar equipos a mano en Calendario.
        </p>
      </div>
    );
  }

  const teamName = (id: string) => v.teamsById.get(id)?.name ?? '?';
  const isTie = score.home === score.away && !m.walkover_winner_id;
  const showPens = m.stage !== 'group' && (isTie || m.penalty_home != null || m.penalty_away != null);
  const upd = (patch: Partial<Match>, label: string, undoable = true) =>
    s.commit([op.update('matches', m.id, patch)], label, { undoable });

  // porteros principales asignados por equipo
  const getMainKeeperId = (teamId: string): string => {
    const ts = stints.filter((k) => k.team_id === teamId);
    return ts.length ? ts[ts.length - 1].player_id : '';
  };

  const setMainKeeper = (teamId: string, playerId: string) => {
    const existing = stints.filter((k) => k.team_id === teamId);
    const ops = [];
    if (existing.length) ops.push(op.bulkDelete('goalkeepers', existing.map((k) => k.id)));
    if (playerId) {
      ops.push(
        op.upsert('goalkeepers', {
          id: uid(),
          match_id: m.id,
          team_id: teamId,
          player_id: playerId,
          from_minute: 0,
        }),
      );
    }
    const pname = playerId ? v.playersById.get(playerId)?.name : 'Ninguno';
    s.commit(ops, `Portero principal ${teamName(teamId)}: ${pname}`);
    s.toast(`🧤 Portero principal de ${teamName(teamId)}: ${pname}`, 'ok');
  };

  const autoAssignDefaultKeepers = (): { ops: ReturnType<typeof op.upsert>[]; names: string[] } => {
    const ops: ReturnType<typeof op.upsert>[] = [];
    const names: string[] = [];
    for (const tid of [home, away]) {
      if (getMainKeeperId(tid)) continue;
      const gk = (v.playersByTeam.get(tid) ?? []).find((p) => p.is_goalkeeper);
      if (gk) {
        ops.push(
          op.upsert('goalkeepers', {
            id: uid(),
            match_id: m.id,
            team_id: tid,
            player_id: gk.id,
            from_minute: 0,
          }),
        );
        names.push(`${gk.name} (${teamName(tid)})`);
      }
    }
    return { ops, names };
  };

  const setStatus = (st: MatchStatus) => {
    if (st === m.status) return;
    const patch: Partial<Match> = { status: st };
    const extraOps: ReturnType<typeof op.upsert>[] = [];

    if (st === 'live' && m.status === 'pending') {
      // Al poner en juego, pre-asignamos los porteros marcados con check POR si aún no se habían elegido
      const auto = autoAssignDefaultKeepers();
      extraOps.push(...auto.ops);
    }

    if (st === 'finished') {
      if (m.stage !== 'group' && isTie && (m.penalty_home == null || m.penalty_away == null || m.penalty_home === m.penalty_away)) {
        if (!confirm('⚠️ Esta eliminatoria está empatada y aún no hay ganador en la tanda de penaltis. ¿Finalizar igualmente?')) {
          return;
        }
      }
      const auto = autoAssignDefaultKeepers();
      extraOps.push(...auto.ops);
      if (m.clock_running) {
        patch.clock_running = false;
        patch.clock_base = Math.floor(elapsed);
        patch.clock_started_at = null;
      }
    }

    s.commit(
      [...extraOps, op.update('matches', m.id, patch)],
      `Estado ${stageLabel(m)} → ${st === 'live' ? 'En Juego' : st === 'finished' ? 'Finalizado' : 'Pendiente'}`,
    );
    s.toast(
      st === 'live'
        ? '🔴 Partido EN JUEGO'
        : st === 'finished'
        ? '🏁 Partido FINALIZADO · Clasificación y estadísticas actualizadas'
        : '⏳ Partido vuelto a Pendiente',
      'ok',
    );
  };

  /* Cronómetro Inteligente por Timestamp (0 peticiones por segundo a Supabase) */
  const clockStart = () => {
    const auto = m.status === 'pending' ? autoAssignDefaultKeepers().ops : [];
    s.commit(
      [
        ...auto,
        op.update('matches', m.id, {
          clock_running: true,
          clock_started_at: new Date().toISOString(),
          ...(m.status === 'pending' ? { status: 'live' as const } : {}),
        }),
      ],
      'Iniciar cronómetro',
    );
  };

  const clockPause = () =>
    upd(
      {
        clock_running: false,
        clock_base: Math.floor(elapsed),
        clock_started_at: null,
      },
      'Pausar cronómetro',
      false,
    );

  const setPeriod = (p: 1 | 2) => {
    if (p === m.period) return;
    if (!confirm(`¿Cambiar a la ${p}ª parte y poner el cronómetro de la parte a 00:00?`)) return;
    upd({ period: p, clock_running: false, clock_base: 0, clock_started_at: null }, `Cambiar a ${p}ª parte`);
  };

  const clockAdjust = (deltaSec: number) =>
    upd(
      {
        clock_base: Math.max(0, Math.floor(elapsed) + deltaSec),
        clock_started_at: m.clock_running ? new Date().toISOString() : null,
      },
      'Ajustar cronómetro',
      false,
    );

  /* Registro de goles y tarjetas */
  const onPick = (kind: SheetKind, teamId: string) => (playerId: string | null, minute: number | null, own: boolean) => {
    const pname = playerId ? v.playersById.get(playerId)?.name : null;
    if (kind === 'goal') {
      s.commit(
        [
          op.upsert('goals', {
            id: uid(),
            match_id: m.id,
            team_id: teamId,
            player_id: playerId,
            minute,
            own_goal: own,
          }),
        ],
        `Gol de ${pname ?? teamName(teamId)}${minute != null ? ` (${minute}')` : ''}`,
      );
      s.toast(`⚽ ¡GOL de ${pname ?? teamName(teamId)}!${own ? ' (p.p.)' : ''}`, 'ok');
    } else {
      if (!playerId) return;
      const d = decideCard(cards, playerId, kind);
      if ('error' in d) {
        s.toast(`⛔ ${d.error}`, 'error');
        return;
      }
      s.commit(
        [
          op.upsert('cards', {
            id: uid(),
            match_id: m.id,
            team_id: teamId,
            player_id: playerId,
            minute,
            card_type: d.card_type,
            second_yellow: d.second_yellow,
            suspension_matches: 1,
          }),
        ],
        `${d.second_yellow ? '2ª Amarilla (Roja)' : d.card_type === 'yellow' ? 'Amarilla' : 'Roja'} a ${pname}`,
      );
      if (d.second_yellow) {
        s.toast(
          `🟨🟥 ¡2ª AMARILLA a ${pname} → ROJA AUTOMÁTICA! ${teamName(teamId)} juega 2 min con uno menos o hasta encajar gol.`,
          'warn',
        );
      } else {
        s.toast(`${d.card_type === 'yellow' ? '🟨 Amarilla' : '🟥 Roja directa'} a ${pname}`, d.card_type === 'red' ? 'warn' : 'info');
      }
    }
    setSheet(null);
  };

  const events: Ev[] = [
    ...goals.map((g) => ({ kind: 'goal' as const, g })),
    ...cards.map((c) => ({ kind: 'card' as const, c })),
  ].sort((a, b) => {
    const ma = (a.kind === 'goal' ? a.g.minute : a.c.minute) ?? 999;
    const mb = (b.kind === 'goal' ? b.g.minute : b.c.minute) ?? 999;
    return ma - mb;
  });

  const deleteLastEvent = () => {
    if (!events.length) return;
    const last = events[events.length - 1];
    const row = last.kind === 'goal' ? last.g : last.c;
    const pname = row.player_id ? v.playersById.get(row.player_id)?.name ?? 'Jugador' : teamName(row.team_id);
    const label = last.kind === 'goal' ? `último gol (${pname})` : `última tarjeta (${pname})`;
    s.commit([op.del(last.kind === 'goal' ? 'goals' : 'cards', row.id)], `Borrar ${label}`);
    s.toast(`Borrado: ${label}`, 'info');
  };

  const suspendedHere = [home, away].flatMap((t) =>
    (v.playersByTeam.get(t) ?? []).filter((p) => v.sanctions.isSuspended(p.id, m.id)),
  );
  const sentOffHere = cards.filter((c) => c.card_type === 'red');

  const teamActionColumn = (teamId: string) => {
    const t = v.teamsById.get(teamId);
    const teamCards = cards.filter((c) => c.team_id === teamId);
    const yellowsCount = teamCards.filter((c) => c.card_type === 'yellow').length;
    const redsCount = teamCards.filter((c) => c.card_type === 'red').length;

    return (
      <div className="mesa-team-col">
        <div className="mesa-team-head">
          <TeamBadge team={t} size={32} />
          <div className="grow">
            <b>{teamName(teamId)}</b>
            <small className="muted block">
              🟨 {yellowsCount} · 🟥 {redsCount}
            </small>
          </div>
        </div>

        <button type="button" className="big-btn goal" onClick={() => setSheet({ kind: 'goal', teamId })}>
          ⚽ + GOL
        </button>

        <div className="tp-cards">
          <button
            type="button"
            className="big-btn yellow"
            onClick={() => setSheet({ kind: 'yellow', teamId })}
            title="Añadir tarjeta amarilla"
          >
            🟨 Amarilla
          </button>
          <button
            type="button"
            className="big-btn red"
            onClick={() => setSheet({ kind: 'red', teamId })}
            title="Añadir tarjeta roja directa"
          >
            🟥 Roja
          </button>
        </div>
      </div>
    );
  };

  const keeperSelectorCard = (teamId: string, oppId: string) => {
    const players = [...(v.playersByTeam.get(teamId) ?? [])].sort(
      (a, b) => Number(b.is_goalkeeper) - Number(a.is_goalkeeper) || byNumber(a, b),
    );
    const selectedId = getMainKeeperId(teamId);
    const oppGoals = m.walkover_winner_id
      ? m.walkover_winner_id === oppId
        ? 3
        : 0
      : goals.filter((g) => g.team_id === oppId).length;

    return (
      <div className="gk-assign-box">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <span className="row-center">
            <TeamBadge team={v.teamsById.get(teamId)} size={22} />
            <b>{teamName(teamId)}</b>
          </span>
          <span className="tag">{oppGoals} GC en este partido</span>
        </div>
        <select
          className="full"
          value={selectedId}
          onChange={(e) => setMainKeeper(teamId, e.target.value)}
          aria-label={`Portero principal de ${teamName(teamId)}`}
        >
          <option value="">— Seleccionar portero principal —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.is_goalkeeper ? '🧤 ' : ''}#{p.number ?? '–'} {p.name}
              {p.is_goalkeeper ? ' (Portero)' : ''}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="admin-match">
      {/* BARRA SUPERIOR DE MESA DE CONTROL + COLA OFFLINE + DESHACER */}
      <div className="mesa-topbar">
        <div className="row-center">
          <span className="tag gold-tag">🎛️ MESA DE CONTROL</span>
          <span className={`mesa-sync-pill ${s.sync}`}>
            {s.sync === 'synced' && '🟢 Sincronizado'}
            {s.sync === 'saving' && `🟡 Guardando... (${s.queue.length})`}
            {s.sync === 'offline' && `🔴 Desconectado (${s.queue.length} en cola local)`}
            {s.sync === 'error' && '❌ Error de red'}
          </span>
        </div>
        <div className="row-gap">
          {events.length > 0 && (
            <button type="button" className="btn btn-sm btn-danger" onClick={deleteLastEvent}>
              🗑 Borrar último evento
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={s.undo}
            disabled={!s.undoLabel}
            title={s.undoLabel ? `Deshacer: ${s.undoLabel}` : 'Nada que deshacer'}
          >
            ↶ Deshacer{s.undoLabel ? `: ${s.undoLabel.slice(0, 18)}` : ''}
          </button>
        </div>
      </div>

      {/* ESTADO DEL PARTIDO: PENDIENTE -> EN JUEGO -> FINALIZADO */}
      <div className="segmented">
        {(['pending', 'live', 'finished'] as MatchStatus[]).map((st) => (
          <button
            key={st}
            type="button"
            className={m.status === st ? `on ${st}` : ''}
            onClick={() => setStatus(st)}
          >
            {{ pending: '⏳ Pendiente', live: '🔴 En Juego', finished: '🏁 Finalizado' }[st]}
          </button>
        ))}
      </div>

      {/* ALERTAS DE SANCIONADOS O EXPULSADOS */}
      {suspendedHere.length > 0 && (
        <div className="card warn small">
          ⛔ <b>Jugadores sancionados que NO pueden jugar este partido:</b>{' '}
          {suspendedHere.map((p) => `${p.name} (${teamName(p.team_id)})`).join(', ')}
        </div>
      )}
      {sentOffHere.length > 0 && (
        <div className="card warn small">
          🟥 <b>Expulsados en este partido:</b>{' '}
          {sentOffHere
            .map((c) => `${v.playersById.get(c.player_id)?.name ?? 'Jugador'} (${teamName(c.team_id)}${c.second_yellow ? ', doble amarilla' : ''})`)
            .join(', ')}
        </div>
      )}

      {/* CRONÓMETRO INTELIGENTE LOCAL (Timestamp en Supabase, 0 llamadas por segundo) */}
      <div className={`clock-panel ${m.clock_running ? 'is-running' : ''} ${timeUp ? 'time-up' : ''}`}>
        <div className="clock-top-row">
          <div className="period-pills">
            <button
              type="button"
              className={`chip-btn ${m.period === 1 ? 'on' : ''}`}
              onClick={() => setPeriod(1)}
            >
              1ª Parte ({half} min)
            </button>
            <button
              type="button"
              className={`chip-btn ${m.period === 2 ? 'on' : ''}`}
              onClick={() => setPeriod(2)}
            >
              2ª Parte ({half} min)
            </button>
          </div>
          <span className="tag">Minuto {minuteNow}'</span>
        </div>

        <div className="clock-displays">
          <div className="clock-col">
            <small className="muted">TIEMPO JUGADO</small>
            <div className={`clock-time ${m.clock_running ? 'running' : ''}`}>{mmss(elapsed)}</div>
          </div>
          <div className="clock-col">
            <small className="muted">RESTANTE ({half}:00)</small>
            <div className={`clock-time countdown ${timeUp ? 'up' : ''}`}>{mmss(remaining)}</div>
          </div>
        </div>

        {timeUp && (
          <div className="time-up-banner">
            🔔 ¡Tiempo cumplido de la {m.period}ª parte ({half}:00)!
          </div>
        )}

        <div className="clock-btns">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => clockAdjust(-60)}>
            −1 min
          </button>
          {m.clock_running ? (
            <button type="button" className="btn btn-gold clock-main-btn" onClick={clockPause}>
              ⏸ PAUSAR (Tiempo parado)
            </button>
          ) : (
            <button type="button" className="btn btn-primary clock-main-btn" onClick={clockStart}>
              ▶ {clockUsed ? 'REANUDAR RELOJ' : 'INICIAR PARTIDO'}
            </button>
          )}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => clockAdjust(60)}>
            +1 min
          </button>
        </div>
      </div>

      {/* BOTONES GRANDES DE GOLES Y TARJETAS */}
      <div className="team-panels">
        {teamActionColumn(home)}
        {teamActionColumn(away)}
      </div>

      {/* TANDA DE PENALTIS EN ELIMINATORIAS CON EMPATE */}
      {showPens && (
        <Section title="🥅 Tanda de Penaltis (Desempate de Eliminatoria)">
          <div className="card pens-card">
            <p className="muted small" style={{ marginTop: 0 }}>
              ℹ️ <b>Regla oficial:</b> Los goles de la tanda de penaltis deciden qué equipo pasa de ronda, pero{' '}
              <b>NO suman para el Máximo Goleador ni penalizan al Portero Menos Goleado</b>.
            </p>
            <div className="pens">
              {[
                { id: home, field: 'penalty_home' as const },
                { id: away, field: 'penalty_away' as const },
              ].map(({ id, field }) => (
                <div key={field} className="pen-team">
                  <div className="row-center">
                    <TeamBadge team={v.teamsById.get(id)} size={26} />
                    <b>{teamName(id)}</b>
                  </div>
                  <div className="pen-counter">
                    <button
                      type="button"
                      onClick={() =>
                        upd({ [field]: Math.max(0, (m[field] ?? 0) - 1) } as Partial<Match>, 'Ajustar penaltis')
                      }
                    >
                      −
                    </button>
                    <b>{m[field] ?? 0}</b>
                    <button
                      type="button"
                      onClick={() =>
                        upd(
                          {
                            [field]: (m[field] ?? 0) + 1,
                            ...(field === 'penalty_home'
                              ? { penalty_away: m.penalty_away ?? 0 }
                              : { penalty_home: m.penalty_home ?? 0 }),
                          } as Partial<Match>,
                          'Penalti anotado en tanda',
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {m.penalty_home != null && m.penalty_away != null && m.penalty_home !== m.penalty_away && (
              <p className="ok-text" style={{ textAlign: 'center', margin: '10px 0 0', fontWeight: 700 }}>
                🏆 Clasificado por penaltis: {teamName(m.penalty_home > m.penalty_away ? home : away)} ({m.penalty_home} - {m.penalty_away})
              </p>
            )}
          </div>
        </Section>
      )}

      {/* SELECTOR DE PORTERO PRINCIPAL PARA ESTADÍSTICA (PORTERO MENOS GOLEADO) */}
      <Section title="🧤 Portero Principal del Partido (Estadística Zamora)">
        <div className="card">
          <p className="muted small" style={{ marginTop: 0 }}>
            Selecciona qué portero de cada equipo computa este partido y sus goles en contra para el trofeo de{' '}
            <b>Portero Menos Goleado (Goles encajados ÷ Partidos jugados)</b>:
          </p>
          <div className="gk-assign-grid">
            {keeperSelectorCard(home, away)}
            {keeperSelectorCard(away, home)}
          </div>
        </div>
      </Section>

      {/* LISTA DE INCIDENCIAS DEL PARTIDO (EDITAR / BORRAR) */}
      <Section title={`📋 Acta de Incidencias (${events.length})`}>
        {!events.length ? (
          <p className="muted">Sin goles ni tarjetas registrados todavía.</p>
        ) : (
          <ul className="events">
            {events.map((e) => (
              <EventRow
                key={(e.kind === 'goal' ? e.g.id : e.c.id) + JSON.stringify(e.kind === 'goal' ? e.g : e.c)}
                e={e}
                match={m}
              />
            ))}
          </ul>
        )}
      </Section>

      {/* MÁS OPCIONES DEL PARTIDO */}
      <details className="card" open={showEdit} onToggle={(e) => setShowEdit((e.target as HTMLDetailsElement).open)}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>⚙️ Opciones avanzadas (Incomparecencia 3-0 / Horario / Reiniciar reloj)</summary>
        <div style={{ marginTop: 12 }}>
          <label className="field">
            <span>Incomparecencia o retraso superior a 10 min (Victoria 3-0 automática)</span>
            <select
              value={m.walkover_winner_id ?? ''}
              onChange={(e) => {
                const val = e.target.value || null;
                if (val && !confirm(`¿Dar el partido por ganado 3-0 a ${teamName(val)} por incomparecencia/retraso?`)) return;
                upd(
                  {
                    walkover_winner_id: val,
                    ...(val ? { status: 'finished' as const, clock_running: false, clock_started_at: null } : {}),
                  },
                  val ? `3-0 para ${teamName(val)}` : 'Quitar 3-0',
                );
              }}
            >
              <option value="">No (resultado normal del partido)</option>
              <option value={home}>Gana {teamName(home)} por 3-0</option>
              <option value={away}>Gana {teamName(away)} por 3-0</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (confirm('¿Reiniciar el cronómetro a 1ª parte 00:00?')) {
                upd({ clock_running: false, clock_base: 0, clock_started_at: null, period: 1 }, 'Reiniciar cronómetro');
              }
            }}
          >
            ↺ Reiniciar cronómetro a 00:00
          </button>
        </div>
      </details>

      {sheet && (
        <PickPlayerSheet
          kind={sheet.kind}
          match={m}
          teamId={sheet.teamId}
          duration={dur}
          initialMinute={minuteNow}
          onClose={() => setSheet(null)}
          onPick={onPick(sheet.kind, sheet.teamId)}
        />
      )}
    </div>
  );
}
