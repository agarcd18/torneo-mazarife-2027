import { useState } from 'react';
import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { buildMatches, countConsecutiveSlots, reassignMatchTimes } from '../../domain/schedule';
import { KO_PLAN, koSlot, sourceLabel } from '../../domain/bracket';
import { DEFAULT_KO_TIMES } from '../../domain/settings';
import { fmtDateLong, stageLabel } from '../../lib/format';
import { Section, TeamBadge } from '../../components/ui';
import { BracketView } from '../../components/Bracket';
import { StandingsTable } from '../../components/StandingsTable';
import type { GroupName, Match, ScheduleSettings } from '../../lib/types';

function MatchEditRow({ m }: { m: Match }) {
  const s = useStore();
  const v = s.view!;
  const raw = v.db.matches.find((x) => x.id === m.id) ?? m;
  const save = (patch: Partial<Match>, desc: string) => s.commit([op.update('matches', m.id, patch)], `${stageLabel(m)}: ${desc}`);
  const teams = m.stage === 'group' ? v.teams.filter((t) => t.group_name === m.group_name) : v.teams;
  const slot = koSlot(m.code);

  const ht = m.home_team_id ? v.teamsById.get(m.home_team_id) : undefined;
  const at = m.away_team_id ? v.teamsById.get(m.away_team_id) : undefined;
  const homePlaceholder = slot ? sourceLabel(slot.home) : 'Por definir';
  const awayPlaceholder = slot ? sourceLabel(slot.away) : 'Por definir';

  return (
    <div className={`edit-row ${m.status}`}>
      <div className="edit-row-head">
        <div className="row-center">
          <span className="tag">{stageLabel(m)}</span>
          <span className="edit-matchup">
            <TeamBadge team={ht} size={20} label={homePlaceholder} />
            <b>{ht?.name ?? homePlaceholder}</b>
            <span className="muted">vs</span>
            <TeamBadge team={at} size={20} label={awayPlaceholder} />
            <b>{at?.name ?? awayPlaceholder}</b>
          </span>
        </div>
        <a className="btn btn-sm btn-ghost" href={`#/partido/${m.id}`}>
          Acta ›
        </a>
      </div>

      <div className="edit-grid">
        <label className="field-inline">
          <span>📅 Día</span>
          <input
            type="date"
            value={m.match_date ?? ''}
            onChange={(e) => save({ match_date: e.target.value || null }, `día ${e.target.value || 'sin fecha'}`)}
            aria-label="Día del partido"
          />
        </label>
        <label className="field-inline">
          <span>⏰ Hora</span>
          <input
            type="time"
            value={m.match_time ?? ''}
            onChange={(e) => save({ match_time: e.target.value || null }, `hora ${e.target.value || '--:--'}`)}
            aria-label="Hora del partido"
          />
        </label>
        <label className="field-inline">
          <span>🏟️ Pista</span>
          <input
            type="number"
            min={1}
            max={9}
            value={m.court ?? 1}
            onChange={(e) => save({ court: Math.max(1, parseInt(e.target.value, 10) || 1) }, `pista ${e.target.value}`)}
            aria-label="Pista"
          />
        </label>
      </div>

      <details className="edit-teams-details">
        <summary className="muted small">Cambiar equipos del cruce manualmente</summary>
        <div className="edit-teams">
          <select
            value={raw.home_team_id ?? ''}
            onChange={(e) => save({ home_team_id: e.target.value || null }, 'cambiar equipo local')}
          >
            {m.stage !== 'group' ? (
              <option value="">(Automático: {homePlaceholder})</option>
            ) : (
              <option value="">— Local —</option>
            )}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span>vs</span>
          <select
            value={raw.away_team_id ?? ''}
            onChange={(e) => save({ away_team_id: e.target.value || null }, 'cambiar equipo visitante')}
          >
            {m.stage !== 'group' ? (
              <option value="">(Automático: {awayPlaceholder})</option>
            ) : (
              <option value="">— Visitante —</option>
            )}
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </details>
    </div>
  );
}

export default function ScheduleAdmin() {
  const s = useStore();
  const v = s.view!;
  const [cfg, setCfg] = useState<ScheduleSettings>(() => ({
    ...v.schedule,
    knockoutTimes: [...(v.schedule.knockoutTimes ?? DEFAULT_KO_TIMES)],
  }));
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'A' | 'B' | 'KO'>('all');
  const [roundFilter, setRoundFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');

  const set = (patch: Partial<ScheduleSettings>) => setCfg((c) => ({ ...c, ...patch }));
  const setDay = (i: number, patch: Partial<ScheduleSettings['days'][number]>) =>
    set({ days: cfg.days.map((d, k) => (k === i ? { ...d, ...patch } : d)) });

  const preview = v.draw.confirmed ? buildMatches(v.teams, cfg) : null;
  const consecutiveNow = countConsecutiveSlots(v.matches);

  const applyAutomaticHours = () => {
    if (!v.db.matches.length) return generate();
    const { updated, overflow } = reassignMatchTimes(v.db.matches, cfg);
    s.commit(
      [op.bulkUpsert('matches', updated), op.upsert('settings', { key: 'schedule', value: cfg })],
      'Reasignar horarios automáticos',
    );
    s.toast('⏰ Horarios y pistas actualizados en todos los partidos', 'ok');
    if (overflow) {
      s.toast('⚠️ Hay más partidos que franjas en el horario indicado. Revisa las últimas horas o añade otro día.', 'warn');
    }
  };

  const generate = () => {
    if (!v.draw.confirmed) return s.toast('Primero confirma y bloquea el sorteo en la pestaña Sorteo', 'warn');
    const existing = v.db.matches;
    if (existing.length) {
      if (!confirm(`Ya hay ${existing.length} partidos creados. ¿Regenerar desde cero todo el calendario?`)) return;
      if (
        (v.db.goals.length || v.db.cards.length) &&
        prompt('Hay goles o tarjetas registrados que se perderán. Escribe BORRAR para confirmar:') !== 'BORRAR'
      )
        return;
    }
    const { matches, overflow } = buildMatches(v.teams, cfg);
    const ops = [];
    if (existing.length) ops.push(op.bulkDelete('matches', existing.map((m) => m.id)));
    ops.push(op.bulkUpsert('matches', matches));
    ops.push(op.upsert('settings', { key: 'schedule', value: cfg }));
    s.commit(ops, 'Generar calendario automático', { undoable: false });
    s.toast(`📅 Calendario generado: ${matches.length} partidos`, 'ok');
    if (overflow) {
      s.toast('⚠️ No caben todos los partidos dentro de la hora límite: amplía el horario o añade otro día.', 'warn');
    }
  };

  const groupMatchesCount = v.matches.filter((m) => m.stage === 'group').length;
  const koMatchesCount = v.matches.filter((m) => m.stage !== 'group').length;
  const rounds = [...new Set(v.matches.filter((m) => m.round != null).map((m) => m.round!))].sort((a, b) => a - b);

  const filteredMatches = v.matches.filter((m) => {
    if (phaseFilter === 'A' && m.group_name !== 'A') return false;
    if (phaseFilter === 'B' && m.group_name !== 'B') return false;
    if (phaseFilter === 'KO' && m.stage === 'group') return false;
    if (roundFilter && String(m.round ?? '') !== roundFilter) return false;
    if (teamFilter && m.home_team_id !== teamFilter && m.away_team_id !== teamFilter) return false;
    return true;
  });

  const byDay = new Map<string, Match[]>();
  for (const m of filteredMatches) {
    const k = m.match_date ?? '';
    byDay.set(k, [...(byDay.get(k) ?? []), m]);
  }

  return (
    <>
      {!v.draw.confirmed ? (
        <div className="card warn">
          <b>⚠️ Sorteo pendiente de bloquear</b>
          <p className="muted small">
            Ve a la pestaña <a href="#/admin/sorteo" className="gold">🎱 Sorteo</a>, realiza el sorteo aleatorio y pulsa{' '}
            <b>"Confirmar y Bloquear Sorteo"</b> para generar automáticamente el calendario.
          </p>
        </div>
      ) : (
        <div className="card schedule-status-card">
          <div className="row-between">
            <div>
              <span className="kicker">FASE 3 · MOTOR DE CALENDARIO Y DESEMPATES</span>
              <h3 style={{ margin: '3px 0 4px', fontFamily: 'var(--font-display)', fontSize: 24 }}>
                {v.matches.length} Partidos Generados ({groupMatchesCount} Grupos + {koMatchesCount} Eliminatorias)
              </h3>
            </div>
            <span className={`fin-badge ${consecutiveNow === 0 ? 'ok' : 'neutral'}`}>
              {consecutiveNow === 0 ? '✅ 0 partidos seguidos sin descanso' : `ℹ️ ${consecutiveNow} descanso(s) ajustado(s)`}
            </span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Algoritmo Round-Robin con intercalado de grupos para evitar que un mismo equipo juegue dos partidos seguidos.
          </p>
        </div>
      )}

      {/* GENERADOR AUTOMÁTICO DE FRANJAS HORARIAS */}
      <details className="card" open={!v.matches.length}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
          ⚙️ Configurador automático de Días, Horas y Pistas
        </summary>
        <div style={{ marginTop: 12 }}>
          <p className="muted small">
            Define los días de juego, hora de inicio y fin, duración por franja y número de pistas para repartir las horas automáticamente:
          </p>
          {cfg.days.map((d, i) => (
            <div key={i} className="day-row">
              <span className="tag">Día {i + 1}</span>
              <input type="date" value={d.date} onChange={(e) => setDay(i, { date: e.target.value })} aria-label="Día" />
              <input type="time" value={d.start} onChange={(e) => setDay(i, { start: e.target.value })} aria-label="Inicio" />
              <span>a</span>
              <input type="time" value={d.end} onChange={(e) => setDay(i, { end: e.target.value })} aria-label="Fin" />
              {cfg.days.length > 1 && (
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => set({ days: cfg.days.filter((_, k) => k !== i) })}
                  aria-label="Quitar día"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ marginBottom: 12 }}
            onClick={() =>
              set({
                days: [
                  ...cfg.days,
                  { date: '', start: cfg.days[cfg.days.length - 1]?.start ?? '17:00', end: cfg.days[cfg.days.length - 1]?.end ?? '22:00' },
                ],
              })
            }
          >
            + Añadir otro día de torneo
          </button>

          <div className="form-grid">
            <label className="field">
              <span>Minutos por turno (partido + descanso)</span>
              <input
                type="number"
                min={10}
                max={120}
                value={cfg.slotMinutes}
                onChange={(e) => set({ slotMinutes: parseInt(e.target.value, 10) || 25 })}
              />
            </label>
            <label className="field">
              <span>Número de pistas simultáneas</span>
              <input
                type="number"
                min={1}
                max={6}
                value={cfg.courts}
                onChange={(e) => set({ courts: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
            </label>
            <label className="field">
              <span>Día de la Fase Final (Eliminatorias)</span>
              <input type="date" value={cfg.knockoutDate} onChange={(e) => set({ knockoutDate: e.target.value })} />
            </label>
          </div>

          <div className="ko-times">
            {KO_PLAN.map((k, i) => (
              <label key={k.code} className="field">
                <span>{k.label}</span>
                <input
                  type="time"
                  value={cfg.knockoutTimes[i] ?? ''}
                  onChange={(e) =>
                    set({ knockoutTimes: KO_PLAN.map((_, j) => (j === i ? e.target.value : cfg.knockoutTimes[j] ?? '')) })
                  }
                />
              </label>
            ))}
          </div>

          {preview && (
            <p className="muted small">
              Con esta configuración se necesitan <b>{preview.slots} franjas horarias</b> para la fase de grupos.
              {preview.overflow && ' ⚠️ Atención: faltan horas en los días configurados.'}
            </p>
          )}

          <div className="row-gap">
            {v.matches.length > 0 && (
              <button type="button" className="btn btn-gold" onClick={applyAutomaticHours}>
                ⏰ Reasignar horas a los partidos actuales
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={generate} disabled={!v.draw.confirmed}>
              {v.matches.length ? '♻️ Regenerar todos los cruces' : '📅 Generar Calendario Automático'}
            </button>
          </div>
        </div>
      </details>

      {/* CUADRO VISUAL DE ELIMINATORIAS */}
      {v.matches.length > 0 && (
        <Section title="🏆 Árbol de Eliminatorias (Cuartos, Semifinales y Final)">
          <BracketView />
        </Section>
      )}

      {/* TABLAS DE CLASIFICACIÓN Y REGLAS DE DESEMPATE */}
      {v.teams.some((t) => t.group_name) && (
        <Section title="📊 Clasificación y Criterios de Desempate">
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>
              <b>Puntuación:</b> 3 pts victoria · 1 pt empate · 0 pts derrota.{' '}
              <b>Desempate automático estricto:</b> 1º Enfrentamiento directo (puntos, DG y GF entre empatados) › 2º Diferencia de goles general (DG) › 3º Goles a favor (GF) › 4º Fair Play (Amarilla=1pt, Roja=3pts, gana el menor) › 5º Sorteo aleatorio guardado en Supabase.
            </p>
            <div className="admin-standings-grid">
              {(['A', 'B'] as GroupName[]).map((g) => (
                <div key={g}>
                  <h4 style={{ margin: '6px 0 8px', color: 'var(--gold)', fontFamily: 'var(--font-display)', fontSize: 20 }}>
                    Grupo {g} ({v.standings[g].played}/{v.standings[g].total} jugados)
                  </h4>
                  <StandingsTable st={v.standings[g]} />
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* EDICIÓN MANUAL DE DÍA, HORA Y PISTA DE CADA PARTIDO */}
      {v.matches.length > 0 && (
        <Section title={`✏️ Editar Día, Hora y Pista (${filteredMatches.length} partidos)`}>
          <div className="filters" style={{ marginBottom: 12 }}>
            <div className="filter-pills">
              {(['all', 'A', 'B', 'KO'] as const).map((ph) => (
                <button
                  key={ph}
                  type="button"
                  className={`chip-btn ${phaseFilter === ph ? 'on' : ''}`}
                  onClick={() => setPhaseFilter(ph)}
                >
                  {{ all: 'Todos', A: 'Grupo A', B: 'Grupo B', KO: '🏆 Eliminatorias' }[ph]}
                </button>
              ))}
            </div>
            <select value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)} aria-label="Filtrar por jornada">
              <option value="">Todas las jornadas</option>
              {rounds.map((r) => (
                <option key={r} value={String(r)}>
                  Jornada {r}
                </option>
              ))}
            </select>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label="Filtrar por equipo">
              <option value="">Todos los equipos</option>
              {v.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {[...byDay].map(([d, ms]) => (
            <div key={d} style={{ marginBottom: 16 }}>
              <h3 className="day-title">{d ? fmtDateLong(d) : '📅 Fecha por asignar'}</h3>
              <div className="edit-list">
                {ms.map((m) => (
                  <MatchEditRow key={m.id} m={m} />
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}
