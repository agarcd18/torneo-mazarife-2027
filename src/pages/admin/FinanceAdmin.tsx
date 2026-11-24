import { useState } from 'react';
import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { uid } from '../../lib/ids';
import { fmtNum } from '../../lib/format';
import { Section } from '../../components/ui';
import type { FinanceMovement, FinanceSettings } from '../../lib/types';

type IncomeKey = keyof FinanceSettings['incomes'];
type ExpenseKey = keyof FinanceSettings['expenses'];

const INCOME_CATEGORIES: { key: IncomeKey; icon: string; label: string; hint: string }[] = [
  { key: 'tasca', icon: '🍻', label: 'Barra / Tasca', hint: 'Recaudación de bebida y comida' },
  { key: 'sponsors', icon: '🤝', label: 'Patrocinadores', hint: 'Aportaciones de comercios y cartelería' },
  { key: 'other', icon: '🎟️', label: 'Otros ingresos', hint: 'Rifas, sorteos, subvenciones, etc.' },
];

const EXPENSE_CATEGORIES: { key: ExpenseKey; icon: string; label: string; hint: string }[] = [
  { key: 'referees', icon: '🏁', label: 'Árbitros', hint: 'Arbitrajes y mesa de control' },
  { key: 'trophies', icon: '🏆', label: 'Trofeos y premios', hint: 'Copas, medallas y premios en metálico' },
  { key: 'insurance', icon: '🛡️', label: 'Seguros', hint: 'Seguro de responsabilidad civil / accidentes' },
  { key: 'facilities', icon: '🏟️', label: 'Instalaciones', hint: 'Pista, luz, limpieza, megafonía' },
  { key: 'other', icon: '📦', label: 'Otros gastos', hint: 'Balones, petos, carteles, imprevistos' },
];

function AmountLine({
  icon,
  label,
  hint,
  amount,
  kind,
  onSave,
}: {
  icon: string;
  label: string;
  hint: string;
  amount: number;
  kind: 'income' | 'expense';
  onSave: (val: number) => void;
}) {
  const [val, setVal] = useState(amount.toString());

  const commitValue = (raw: string) => {
    const clean = raw.replace(',', '.');
    const parsed = Math.max(0, Math.round((parseFloat(clean) || 0) * 100) / 100);
    setVal(parsed.toString());
    if (parsed !== amount) onSave(parsed);
  };

  const bump = (delta: number) => {
    const next = Math.max(0, Math.round((amount + delta) * 100) / 100);
    setVal(next.toString());
    onSave(next);
  };

  return (
    <div className={`fin-line fin-${kind}`}>
      <div className="fin-line-info">
        <span className="fin-icon">{icon}</span>
        <div>
          <b>{label}</b>
          <small className="muted block">{hint}</small>
        </div>
      </div>

      <div className="fin-line-controls">
        <div className="fin-quick-btns">
          <button type="button" className="chip-btn" onClick={() => bump(50)} title="Sumar 50 €">
            +50€
          </button>
          <button type="button" className="chip-btn" onClick={() => bump(100)} title="Sumar 100 €">
            +100€
          </button>
        </div>
        <div className="fin-input-box">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={(e) => commitValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            aria-label={label}
          />
          <span>€</span>
        </div>
      </div>
    </div>
  );
}

export default function FinanceAdmin() {
  const s = useStore();
  const v = s.view!;
  const fin = v.finances;
  const fee = Number(v.tournament.registrationFee ?? 100);

  // 1. Inscripciones: suma automática SOLO de los equipos marcados como Pagados en Fase 1
  const paidTeams = v.teams.filter((t) => t.payment_status === 'paid');
  const pendingTeams = v.teams.filter((t) => t.payment_status !== 'paid');
  const registrationsIncome = paidTeams.reduce((acc, t) => acc + Number(t.payment_amount ?? fee), 0);

  // 2. Totales en tiempo real
  const manualIncomes =
    Number(fin.incomes.tasca || 0) +
    Number(fin.incomes.sponsors || 0) +
    Number(fin.incomes.other || 0);
  const totalIncomes = registrationsIncome + manualIncomes;

  const totalExpenses =
    Number(fin.expenses.referees || 0) +
    Number(fin.expenses.trophies || 0) +
    Number(fin.expenses.insurance || 0) +
    Number(fin.expenses.facilities || 0) +
    Number(fin.expenses.other || 0);

  const balance = totalIncomes - totalExpenses;
  const maxSide = Math.max(totalIncomes, totalExpenses, 1);
  const incBarPct = Math.round((totalIncomes / maxSide) * 100);
  const expBarPct = Math.round((totalExpenses / maxSide) * 100);

  // Guardado en tiempo real en Supabase (tabla settings, key 'finances')
  const saveFinances = (next: FinanceSettings, label: string) => {
    s.commit([op.upsert('settings', { key: 'finances', value: next })], label);
  };

  const setIncome = (key: IncomeKey, label: string, amount: number) => {
    saveFinances(
      {
        ...fin,
        incomes: { ...fin.incomes, [key]: amount },
      },
      `Ingreso ${label}: ${fmtNum(amount, 2)} €`,
    );
    s.toast(`Ingreso actualizado · ${label}: ${fmtNum(amount, 2)} €`, 'ok');
  };

  const setExpense = (key: ExpenseKey, label: string, amount: number) => {
    saveFinances(
      {
        ...fin,
        expenses: { ...fin.expenses, [key]: amount },
      },
      `Gasto ${label}: ${fmtNum(amount, 2)} €`,
    );
    s.toast(`Gasto actualizado · ${label}: ${fmtNum(amount, 2)} €`, 'ok');
  };

  // Apunte rápido en el desglose opcional (suma automáticamente a la partida elegida)
  const [movKind, setMovKind] = useState<'income' | 'expense'>('income');
  const [movCat, setMovCat] = useState<string>('tasca');
  const [movConcept, setMovConcept] = useState('');
  const [movAmount, setMovAmount] = useState('');

  const addMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round((parseFloat(movAmount.replace(',', '.')) || 0) * 100) / 100;
    if (!movConcept.trim() || amt <= 0) {
      s.toast('Indica un concepto y un importe mayor que 0 €', 'warn');
      return;
    }
    const item: FinanceMovement = {
      id: uid(),
      kind: movKind,
      category: movCat,
      concept: movConcept.trim(),
      amount: amt,
      date: new Date().toISOString().slice(0, 10),
    };
    const next: FinanceSettings = {
      ...fin,
      incomes: { ...fin.incomes },
      expenses: { ...fin.expenses },
      movements: [item, ...(fin.movements ?? [])],
    };
    if (movKind === 'income' && movCat in next.incomes) {
      const k = movCat as IncomeKey;
      next.incomes[k] = Math.round(((next.incomes[k] || 0) + amt) * 100) / 100;
    } else if (movKind === 'expense' && movCat in next.expenses) {
      const k = movCat as ExpenseKey;
      next.expenses[k] = Math.round(((next.expenses[k] || 0) + amt) * 100) / 100;
    }
    saveFinances(next, `Apunte: ${item.concept} (${amt} €)`);
    setMovConcept('');
    setMovAmount('');
    s.toast(`Añadido a la partida: ${item.concept} (${fmtNum(amt, 2)} €)`, 'ok');
  };

  const removeMovement = (m: FinanceMovement) => {
    if (!confirm(`¿Borrar el apunte "${m.concept}" (${fmtNum(m.amount, 2)} €) y descontarlo de su partida?`)) return;
    const next: FinanceSettings = {
      ...fin,
      incomes: { ...fin.incomes },
      expenses: { ...fin.expenses },
      movements: (fin.movements ?? []).filter((x) => x.id !== m.id),
    };
    if (m.kind === 'income' && m.category in next.incomes) {
      const k = m.category as IncomeKey;
      next.incomes[k] = Math.max(0, Math.round(((next.incomes[k] || 0) - m.amount) * 100) / 100);
    } else if (m.kind === 'expense' && m.category in next.expenses) {
      const k = m.category as ExpenseKey;
      next.expenses[k] = Math.max(0, Math.round(((next.expenses[k] || 0) - m.amount) * 100) / 100);
    }
    saveFinances(next, `Borrar apunte: ${m.concept}`);
  };

  const allCatLabels: Record<string, string> = {
    tasca: 'Barra / Tasca',
    sponsors: 'Patrocinadores',
    other: 'Otros',
    referees: 'Árbitros',
    trophies: 'Trofeos',
    insurance: 'Seguros',
    facilities: 'Instalaciones',
  };

  return (
    <div className="finance-module">
      {/* MARCADOR GRANDE DE BALANCE TOTAL EN TIEMPO REAL */}
      <div className={`card finance-scoreboard ${balance > 0 ? 'profit' : balance < 0 ? 'loss' : 'even'}`}>
        <div className="fin-sb-top">
          <span className="kicker">FASE 2 · CUADRO DE MANDO ECONÓMICO</span>
          <span className={`fin-badge ${balance > 0 ? 'ok' : balance < 0 ? 'err' : 'neutral'}`}>
            {balance > 0 ? '📈 BENEFICIO NETO' : balance < 0 ? '📉 PÉRDIDA ACTUAL' : '⚖️ EQUILIBRIO'}
          </span>
        </div>

        <div className="fin-balance-amount">
          {balance > 0 ? '+' : ''}
          {fmtNum(balance, 2)} €
        </div>
        <div className="muted small" style={{ textAlign: 'center', marginBottom: 14 }}>
          Balance en directo = Ingresos totales ({fmtNum(totalIncomes, 2)} €) − Gastos totales ({fmtNum(totalExpenses, 2)} €)
        </div>

        <div className="fin-summary-grid">
          <div className="fin-sum-box inc">
            <div className="row-between">
              <small>🟢 INGRESOS TOTALES</small>
              <b>{fmtNum(totalIncomes, 2)} €</b>
            </div>
            <div className="fin-mini-bar">
              <i style={{ width: `${incBarPct}%` }} />
            </div>
          </div>

          <div className="fin-sum-box exp">
            <div className="row-between">
              <small>🔴 GASTOS TOTALES</small>
              <b>{fmtNum(totalExpenses, 2)} €</b>
            </div>
            <div className="fin-mini-bar">
              <i style={{ width: `${expBarPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 1: INGRESOS */}
      <Section
        title="🟢 Ingresos del Torneo"
        action={<b className="ok-text">+{fmtNum(totalIncomes, 2)} €</b>}
      >
        <div className="card fin-list">
          {/* Partida automática conectada con Fase 1 */}
          <div className="fin-line fin-auto">
            <div className="fin-line-info">
              <span className="fin-icon">👕</span>
              <div>
                <div className="row-center">
                  <b>Inscripciones de equipos</b>
                  <span className="tag">AUTOMÁTICO · FASE 1</span>
                </div>
                <small className="muted block">
                  {paidTeams.length} equipo{paidTeams.length === 1 ? '' : 's'} pagado{paidTeams.length === 1 ? '' : 's'} × {fmtNum(fee, 0)} €
                  {pendingTeams.length > 0 && ` · (${pendingTeams.length} pendiente${pendingTeams.length === 1 ? '' : 's'}: ${fmtNum(pendingTeams.length * fee, 0)} € sin cobrar)`}
                </small>
              </div>
            </div>
            <div className="fin-auto-right">
              <b className="fin-auto-amount">{fmtNum(registrationsIncome, 2)} €</b>
              <a href="#/admin/equipos" className="btn btn-sm btn-ghost">
                Gestionar pagos ›
              </a>
            </div>
          </div>

          {/* Partidas editables de ingresos */}
          {INCOME_CATEGORIES.map((c) => (
            <AmountLine
              key={`${c.key}-${fin.incomes[c.key]}`}
              icon={c.icon}
              label={c.label}
              hint={c.hint}
              amount={Number(fin.incomes[c.key] || 0)}
              kind="income"
              onSave={(val) => setIncome(c.key, c.label, val)}
            />
          ))}
        </div>
      </Section>

      {/* BLOQUE 2: GASTOS */}
      <Section
        title="🔴 Gastos del Torneo"
        action={<b className="error">−{fmtNum(totalExpenses, 2)} €</b>}
      >
        <div className="card fin-list">
          {EXPENSE_CATEGORIES.map((c) => (
            <AmountLine
              key={`${c.key}-${fin.expenses[c.key]}`}
              icon={c.icon}
              label={c.label}
              hint={c.hint}
              amount={Number(fin.expenses[c.key] || 0)}
              kind="expense"
              onSave={(val) => setExpense(c.key, c.label, val)}
            />
          ))}
        </div>
      </Section>

      {/* BLOQUE 3: APUNTES / TICKETS INDIVIDUALES (OPCIONAL) */}
      <Section title="🧾 Sumar ticket o apunte al desglose">
        <div className="card">
          <p className="muted small" style={{ marginTop: 0 }}>
             Puedes editar directamente los totales arriba o añadir aquí tickets sueltos (ej. <i>"Patrocinio Panadería 150 €"</i> o <i>"Recibo árbitros sábado 200 €"</i>) para que se sumen automáticamente a su partida.
          </p>
          <form className="fin-mov-form" onSubmit={addMovement}>
            <select
              value={movKind}
              onChange={(e) => {
                const k = e.target.value as 'income' | 'expense';
                setMovKind(k);
                setMovCat(k === 'income' ? 'tasca' : 'referees');
              }}
              aria-label="Tipo de movimiento"
            >
              <option value="income">🟢 Ingreso (+)</option>
              <option value="expense">🔴 Gasto (−)</option>
            </select>

            <select value={movCat} onChange={(e) => setMovCat(e.target.value)} aria-label="Partida">
              {(movKind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>

            <input
              className="grow"
              placeholder="Concepto (ej. Caja barra sábado noche)"
              value={movConcept}
              onChange={(e) => setMovConcept(e.target.value)}
            />

            <input
              className="fin-mov-amt"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              placeholder="Importe €"
              value={movAmount}
              onChange={(e) => setMovAmount(e.target.value)}
            />

            <button className="btn btn-gold">+ Sumar</button>
          </form>

          {fin.movements && fin.movements.length > 0 && (
            <ul className="fin-mov-list">
              {fin.movements.map((m) => (
                <li key={m.id}>
                  <span className={`tag ${m.kind === 'expense' ? 'red' : ''}`}>
                    {m.kind === 'income' ? '+' : '−'} {allCatLabels[m.category] ?? m.category}
                  </span>
                  <span className="grow">
                    <b>{m.concept}</b>
                    <small className="muted"> · {m.date}</small>
                  </span>
                  <b className={m.kind === 'income' ? 'ok-text' : 'error'}>
                    {m.kind === 'income' ? '+' : '−'}
                    {fmtNum(m.amount, 2)} €
                  </b>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => removeMovement(m)}
                    title="Borrar apunte y descontar"
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}
