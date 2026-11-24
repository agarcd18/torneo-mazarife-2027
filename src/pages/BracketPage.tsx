import { useStore } from '../lib/store';
import { BracketView } from '../components/Bracket';

export default function BracketPage() {
  const { view } = useStore();
  const v = view!;
  return (
    <>
      <h1 className="page-title">Fase final</h1>
      {!v.groupsReady && (
        <p className="muted small">
          Los cruces se rellenan solos al terminar la fase de grupos: 1.º A – 4.º B, 2.º A – 3.º B, 3.º A – 2.º B y 4.º A – 1.º B.
          {(v.standings.A.pendingLotteries.length > 0 || v.standings.B.pendingLotteries.length > 0) && ' Pendiente de sorteo de desempate.'}
        </p>
      )}
      <BracketView />
      <p className="muted small">Partidos de 2 partes de 15 minutos. Si hay empate se decide por penaltis.</p>
    </>
  );
}
