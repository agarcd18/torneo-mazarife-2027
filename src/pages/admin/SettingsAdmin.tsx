import { useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { uid } from '../../lib/ids';
import { fmtDateTime, PALETTE } from '../../lib/format';
import { DEFAULT_TOURNAMENT } from '../../domain/settings';
import { download } from '../../domain/export';
import {
  backupFilename,
  BackupSummary,
  buildTournamentExcelCSV,
  createMasterBackup,
  loadEmergencySnapshot,
  MasterBackupPayload,
  restoreBackupToCloud,
  saveEmergencySnapshot,
  validateBackupJSON,
} from '../../domain/backup';
import { Section } from '../../components/ui';
import type { TournamentSettings } from '../../lib/types';

const SAMPLE_TEAMS = ['Los Galácticos', 'Mazarife FC', 'Bar La Plaza', 'Peña El Chorizo', 'Atlético Páramo', 'Real Órbigo', 'Deportivo Villar', 'Los Tractores', 'Sporting Chopera', 'Unión Bierzo', 'Inter de Mazarife', 'Racing Cañada'];
const SAMPLE_NAMES = ['Álex', 'Bruno', 'Carlos', 'Dani', 'Edu', 'Fran', 'Gonzalo', 'Héctor', 'Iván', 'Javi', 'Kike', 'Luis', 'Mario', 'Nacho', 'Óscar', 'Pablo', 'Rubén', 'Sergio', 'Toni', 'Víctor'];
const SAMPLE_SURN = ['García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Álvarez', 'Díez', 'Robles', 'Prieto'];

function BackupAndRestoreCard() {
  const s = useStore();
  const v = s.view!;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [pendingRestore, setPendingRestore] = useState<{
    sourceLabel: string;
    payload: MasterBackupPayload;
    summary: BackupSummary;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [restoreDoneMsg, setRestoreDoneMsg] = useState<string | null>(null);

  const emergencySnap = loadEmergencySnapshot();

  // 1. Descarga de Copia de Seguridad Completa (JSON Maestro)
  const handleDownloadMasterJSON = () => {
    const payload = createMasterBackup(v.db);
    saveEmergencySnapshot(v.db);
    const fname = backupFilename(new Date());
    download(fname, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    s.toast(`💾 Copia descargada: ${fname}`, 'ok');
  };

  // 2. Selección y validación de archivo .json para restaurar
  const handleFileChange = async (file: File | null) => {
    setRestoreError(null);
    setRestoreDoneMsg(null);
    if (!file) return;
    try {
      const text = await file.text();
      const res = validateBackupJSON(text);
      if (!res.ok) {
        setRestoreError(res.error);
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setPendingRestore({
        sourceLabel: `Archivo: ${file.name}`,
        payload: res.payload,
        summary: res.summary,
      });
    } catch (e: any) {
      setRestoreError(e?.message || 'No se pudo leer el archivo JSON seleccionado.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // 3. Preparar restauración desde Auto-Backup Local de Emergencia
  const handlePrepareEmergencyRestore = () => {
    setRestoreError(null);
    setRestoreDoneMsg(null);
    const snap = loadEmergencySnapshot();
    if (!snap) {
      s.toast('Aún no hay ninguna copia automática guardada en este dispositivo', 'warn');
      return;
    }
    setPendingRestore({
      sourceLabel: `Auto-Backup Local (${snap.summary.exportedAt ? fmtDateTime(snap.summary.exportedAt) : 'dispositivo'})`,
      payload: snap.payload,
      summary: snap.summary,
    });
  };

  // Confirmar y ejecutar restauración en la nube en orden relacional estricto
  const handleConfirmRestore = async () => {
    if (!pendingRestore || restoring) return;
    setRestoring(true);
    setRestoreError(null);
    setRestoreDoneMsg(null);
    setProgressMsg('Iniciando restauración en la nube…');
    try {
      await restoreBackupToCloud(pendingRestore.payload, v.db, (msg) => setProgressMsg(msg));
      s.reload();
      const sum = pendingRestore.summary;
      setRestoreDoneMsg(
        `✅ Restauración completada con éxito en la nube: ${sum.teamsCount} equipos, ${sum.playersCount} jugadores y ${sum.matchesCount} partidos restaurados.`,
      );
      setPendingRestore(null);
      s.toast('✅ Copia de seguridad restaurada en la nube', 'ok');
    } catch (e: any) {
      setRestoreError(`Error durante la restauración: ${e?.message ?? 'Fallo de red o permisos'}`);
    } finally {
      setRestoring(false);
      setProgressMsg(null);
    }
  };

  // 4. Exportación rápida para Excel / Archivo Histórico (CSV)
  const handleDownloadExcelCSV = () => {
    const csv = buildTournamentExcelCSV(v);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const fname = `historico-torneo-mazarife-${stamp}.csv`;
    download(fname, csv, 'text/csv;charset=utf-8');
    s.toast(`📊 Tablas exportadas para Excel: ${fname}`, 'ok');
  };

  return (
    <Section title="💾 Copias de Seguridad y Datos">
      <div className="card backup-master-card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div>
            <span className="kicker">RED DE SEGURIDAD TOTAL · BACKUP & RESTORE</span>
            <h3 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 28 }}>
              Protección y Restauración del Torneo
            </h3>
          </div>
          <span className="fin-badge ok">
            {v.teams.length} eq · {v.db.players.length} jug · {v.matches.length} part
          </span>
        </div>

        <p className="muted small" style={{ marginTop: 0, marginBottom: 14 }}>
          Descarga una copia maestra en 1 clic al terminar cada jornada o restaura todos los datos en la nube si alguna vez lo necesitas.
        </p>

        {/* BOTONES PRINCIPALES XL: DESCARGAR JSON Y RESTAURAR JSON */}
        <div className="backup-actions-grid">
          <button type="button" className="btn btn-gold backup-xl-btn" onClick={handleDownloadMasterJSON}>
            ⬇️ Descargar Copia de Seguridad (.json)
          </button>

          <label className="btn btn-primary backup-xl-btn" style={{ cursor: 'pointer' }}>
            ⬆️ Restaurar Copia desde Archivo (.json)
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* VISTA PREVIA Y CONFIRMACIÓN ANTES DE RESTAURAR EN SUPABASE */}
        {pendingRestore && (
          <div className="backup-preview-box">
            <div className="row-between">
              <span className="tag gold-tag">{pendingRestore.sourceLabel}</span>
              {pendingRestore.summary.exportedAt && (
                <small className="muted">Fecha copia: {fmtDateTime(pendingRestore.summary.exportedAt)}</small>
              )}
            </div>

            <p className="backup-confirm-text">
              Archivo válido: <b>{pendingRestore.summary.teamsCount} equipos</b>,{' '}
              <b>{pendingRestore.summary.playersCount} jugadores</b>,{' '}
              <b>{pendingRestore.summary.matchesCount} partidos</b>
              {pendingRestore.summary.goalsCount > 0 ? ` (${pendingRestore.summary.goalsCount} goles)` : ''}. ¿Confirmas
              sobrescribir/restaurar estos datos en la nube?
            </p>

            <small className="muted block" style={{ marginBottom: 12 }}>
              Orden relacional garantizado: 1º Equipos y Ajustes (Anuncios/Tasca) → 2º Jugadores y Partidos → 3º Goles, Tarjetas, Porteros y Contabilidad.
            </small>

            {restoring && progressMsg && (
              <div className="backup-progress-bar">
                <span>⏳ {progressMsg}</span>
              </div>
            )}

            <div className="row-gap">
              <button
                type="button"
                className="btn btn-gold"
                onClick={handleConfirmRestore}
                disabled={restoring}
              >
                {restoring ? '⏳ Restaurando en la nube…' : '✅ Sí, Confirmar y Restaurar en la Nube'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingRestore(null)}
                disabled={restoring}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* MENSAJES DE ÉXITO O ERROR */}
        {restoreDoneMsg && <div className="backup-success-banner">{restoreDoneMsg}</div>}
        {restoreError && <div className="dup-alert" style={{ marginTop: 12 }}>{restoreError}</div>}

        {/* SALVAVIDAS LOCAL (AUTO-BACKUP) + EXPORTACIÓN EXCEL CSV */}
        <div className="backup-secondary-grid">
          <div className="backup-sub-box">
            <div>
              <b>🛟 Salvavidas Automático Local</b>
              <small className="muted block">
                {emergencySnap
                  ? `Última copia automática: ${
                      emergencySnap.summary.exportedAt ? fmtDateTime(emergencySnap.summary.exportedAt) : 'guardada'
                    } (${emergencySnap.summary.teamsCount} equipos, ${emergencySnap.summary.matchesCount} partidos)`
                  : 'Se guarda automáticamente en este navegador cada vez que haces un cambio.'}
              </small>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handlePrepareEmergencyRestore}
              disabled={restoring}
            >
              🛟 Restaurar última copia automática del dispositivo
            </button>
          </div>

          <div className="backup-sub-box">
            <div>
              <b>📊 Histórico para Excel (CSV)</b>
              <small className="muted block">
                Descarga Equipos, Clasificación, Resultados y Contabilidad listos para abrir en Excel.
              </small>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={handleDownloadExcelCSV}>
              📊 Descargar Tablas en CSV (Excel)
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

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
      <BackupAndRestoreCard />

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
