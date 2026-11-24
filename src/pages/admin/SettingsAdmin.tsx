import { useState } from 'react';
import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { uid } from '../../lib/ids';
import { PALETTE } from '../../lib/format';
import { DEFAULT_TOURNAMENT } from '../../domain/settings';
import { Section } from '../../components/ui';
import type { TournamentSettings } from '../../lib/types';

const SAMPLE_TEAMS = ['Los Galácticos', 'Mazarife FC', 'Bar La Plaza', 'Peña El Chorizo', 'Atlético Páramo', 'Real Órbigo', 'Deportivo Villar', 'Los Tractores', 'Sporting Chopera', 'Unión Bierzo', 'Inter de Mazarife', 'Racing Cañada'];
const SAMPLE_NAMES = ['Álex', 'Bruno', 'Carlos', 'Dani', 'Edu', 'Fran', 'Gonzalo', 'Héctor', 'Iván', 'Javi', 'Kike', 'Luis', 'Mario', 'Nacho', 'Óscar', 'Pablo', 'Rubén', 'Sergio', 'Toni', 'Víctor'];
const SAMPLE_SURN = ['García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Álvarez', 'Díez', 'Robles', 'Prieto'];

export default function SettingsAdmin() {
  const s = useStore();
  const v = s.view!;
  const [t, setT] = useState<TournamentSettings>(v.tournament);
  const save = () => {
    if (!t.name.trim()) return s.toast('El nombre no puede estar vacío', 'warn');
    s.commit([op.upsert('settings', { key: 'tournament', value: { ...DEFAULT_TOURNAMENT, ...t } })], 'Ajustes del torneo');
    s.toast('Ajustes guardados', 'ok');
  };
  const sample = () => {
    if (!confirm('Se crearán 12 equipos de ejemplo con 8 jugadores cada uno. ¿Continuar?')) return;
    const fee = Number(v.tournament.registrationFee ?? 100);
    const teams = SAMPLE_TEAMS.map((name, i) => ({
      id: uid(),
      name,
      color: PALETTE[i % PALETTE.length],
      group_name: null,
      group_order: null,
      payment_status: i < 8 ? ('paid' as const) : ('pending' as const),
      payment_amount: i < 8 ? fee : null,
      paid_at: i < 8 ? new Date().toISOString() : null,
    }));
    const players = teams.flatMap((tm, ti) =>
      Array.from({ length: 8 }, (_, k) => ({
        id: uid(),
        team_id: tm.id,
        name: `${SAMPLE_NAMES[(ti * 3 + k) % SAMPLE_NAMES.length]} ${SAMPLE_SURN[(ti + k * 5) % SAMPLE_SURN.length]}`,
        number: k === 0 ? 1 : k + 3,
        is_goalkeeper: k === 0,
      })),
    );
    s.commit([op.bulkUpsert('teams', teams), op.bulkUpsert('players', players)], 'Datos de ejemplo', { undoable: false });
    s.toast('Equipos de ejemplo creados', 'ok');
  };
  return (
    <>
      <Section title="Torneo">
        <div className="card">
          <label className="field">
            <span>Nombre del torneo</span>
            <input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Nº de equipos</span>
              <input type="number" min={4} max={40} value={t.numTeams} onChange={(e) => setT({ ...t, numTeams: parseInt(e.target.value, 10) || 12 })} />
            </label>
            <label className="field">
              <span>Inscripción por equipo (€)</span>
              <input type="number" min={0} step={5} value={t.registrationFee ?? 100} onChange={(e) => setT({ ...t, registrationFee: parseFloat(e.target.value) || 0 })} />
            </label>
            <label className="field">
              <span>Minutos partido de grupos</span>
              <input type="number" min={4} max={90} value={t.groupMinutes} onChange={(e) => setT({ ...t, groupMinutes: parseInt(e.target.value, 10) || 20 })} />
            </label>
            <label className="field">
              <span>Minutos partido fase final</span>
              <input type="number" min={4} max={90} value={t.finalMinutes} onChange={(e) => setT({ ...t, finalMinutes: parseInt(e.target.value, 10) || 30 })} />
            </label>
          </div>
          <button className="btn btn-gold" onClick={save}>
            Guardar
          </button>
        </div>
      </Section>

      <Section title="Sincronización">
        <div className="card">
          <p>
            Estado:{' '}
            <b>{{ synced: '✅ Todo guardado', saving: '⏳ Guardando…', offline: '📴 Sin conexión', error: '❌ Error' }[s.sync]}</b>
            {s.queue.length > 0 && ` · ${s.queue.length} cambio(s) pendiente(s)`}
          </p>
          <p className="muted small">Los cambios se guardan en este dispositivo y se suben solos al volver la conexión. No cierres sesión con cambios pendientes.</p>
          {s.flushError && (
            <div className="card warn">
              <p>
                <b>Un cambio ha sido rechazado por el servidor:</b> {s.flushError}
              </p>
              <div className="row-gap">
                <button className="btn btn-sm btn-primary" onClick={s.retryFlush}>
                  Reintentar
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    if (confirm('¿Descartar este cambio? Se perderá.')) s.discardFirst();
                  }}
                >
                  Descartar ese cambio
                </button>
              </div>
            </div>
          )}
          {s.queue.length > 0 && (
            <ul className="queue">
              {s.queue.slice(0, 20).map((q) => (
                <li key={q.opId}>{q.label ?? q.kind}</li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {!v.teams.length && (
        <Section title="Probar la web">
          <div className="card">
            <p className="muted small">Crea equipos y jugadores ficticios para probar el sorteo, el calendario y los partidos. Bórralos después.</p>
            <button className="btn btn-ghost" onClick={sample}>
              Crear datos de ejemplo
            </button>
          </div>
        </Section>
      )}

      <Section title="Sesión">
        <div className="card row-between">
          <span className="muted">{s.user?.email}</span>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => {
              if (s.queue.length && !confirm(`Tienes ${s.queue.length} cambios sin subir. Si cierras sesión no se subirán hasta que vuelvas a entrar. ¿Cerrar sesión?`)) return;
              s.signOut();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </Section>
    </>
  );
}
