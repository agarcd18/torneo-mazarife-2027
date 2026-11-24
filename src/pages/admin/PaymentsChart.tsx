import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { DEFAULT_TOURNAMENT } from '../../domain/settings';
import { fmtNum } from '../../lib/format';

export default function PaymentsChart() {
  const s = useStore();
  const v = s.view!;
  const fee = Number(v.tournament.registrationFee ?? 100);
  const target = v.tournament.numTeams || 12;
  const totalTeams = Math.max(target, v.teams.length);

  const paidTeams = v.teams.filter((t) => t.payment_status === 'paid');
  const pendingTeams = v.teams.filter((t) => t.payment_status !== 'paid');
  const paidCount = paidTeams.length;

  const collected = paidTeams.reduce((acc, t) => acc + Number(t.payment_amount ?? fee), 0);
  const expectedTotal = totalTeams * fee;
  const pendingAmount = Math.max(0, expectedTotal - collected);
  const pct = totalTeams > 0 ? Math.min(100, Math.round((paidCount / totalTeams) * 100)) : 0;

  // Parámetros del SVG Donut
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  const setFee = (nextFee: number) => {
    if (!Number.isFinite(nextFee) || nextFee < 0) return;
    const cur = v.db.settings.find((x) => x.key === 'tournament')?.value ?? DEFAULT_TOURNAMENT;
    s.commit(
      [op.upsert('settings', { key: 'tournament', value: { ...DEFAULT_TOURNAMENT, ...cur, registrationFee: nextFee } })],
      `Cuota inscripción: ${nextFee} €`,
    );
  };

  return (
    <div className="card payments-dashboard">
      <div className="payments-head">
        <div>
          <span className="kicker">FASE 1 · CONTROL DE INSCRIPCIONES</span>
          <h3>Estado de Pagos del Torneo</h3>
        </div>
        <label className="fee-box" title="Importe de inscripción por equipo">
          <span>Cuota / equipo</span>
          <div className="fee-input-wrap">
            <input
              type="number"
              min={0}
              step={5}
              defaultValue={fee}
              key={fee}
              onBlur={(e) => setFee(parseFloat(e.target.value) || 0)}
              aria-label="Cuota de inscripción en euros"
            />
            <b>€</b>
          </div>
        </label>
      </div>

      <div className="payments-grid">
        <div className="donut-wrap">
          <svg viewBox="0 0 110 110" className="donut-svg" aria-label={`${paidCount} de ${totalTeams} equipos han pagado`}>
            <circle cx="55" cy="55" r={r} className="donut-bg" />
            <circle
              cx="55"
              cy="55"
              r={r}
              className="donut-fg"
              strokeDasharray={`${dash} ${c}`}
              transform="rotate(-90 55 55)"
            />
          </svg>
          <div className="donut-center">
            <b>
              {paidCount}/{totalTeams}
            </b>
            <small>{pct}%</small>
          </div>
        </div>

        <div className="payments-stats">
          <div className="pay-headline">
            <b>
              {paidCount}/{totalTeams} equipos han pagado
            </b>
            <span className="muted small">
              ({paidCount} pagados · {pendingTeams.length} pendientes
              {v.teams.length < target ? ` · ${target - v.teams.length} plazas libres` : ''})
            </span>
          </div>

          <div className="pay-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="pay-bar-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="pay-kpis">
            <div className="pay-kpi ok">
              <small>Recaudado</small>
              <b>{fmtNum(collected, 0)} €</b>
            </div>
            <div className="pay-kpi warn">
              <small>Pendiente cobro</small>
              <b>{fmtNum(pendingAmount, 0)} €</b>
            </div>
            <div className="pay-kpi">
              <small>Total previsto ({totalTeams} eq.)</small>
              <b>{fmtNum(expectedTotal, 0)} €</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
