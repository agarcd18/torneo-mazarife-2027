import { Section } from '../components/ui';
import { useStore } from '../lib/store';

export default function Rules() {
  const { view, toast } = useStore();
  const tournamentName = view?.tournament.name ?? 'Torneo de Verano de Fútbol Sala';

  const downloadReglamentoPdf = () => {
    toast('📄 Abriendo Reglamento Oficial en formato PDF…', 'ok');
    const win = window.open('', '_blank');
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reglamento Oficial - ${tournamentName} · Villar de Mazarife</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; max-width: 780px; margin: 32px auto; padding: 0 20px; line-height: 1.55; }
    h1 { color: #0b2a1c; border-bottom: 3px solid #d4af37; padding-bottom: 8px; margin-bottom: 4px; }
    h2 { color: #1f7a4a; margin-top: 22px; margin-bottom: 6px; font-size: 18px; }
    .sub { color: #555; font-weight: bold; margin-bottom: 20px; }
    ul, ol { margin-top: 6px; }
    li { margin-bottom: 6px; }
    .toolbar { background: #0b2a1c; color: #fff; padding: 12px 16px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .toolbar button { background: #d4af37; color: #0b1a12; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; }
    @media print { .toolbar { display: none; } body { margin: 10px auto; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>📄 Reglamento Oficial · ${tournamentName} (Villar de Mazarife)</span>
    <button onclick="window.print()">🖨️ Guardar como PDF / Imprimir</button>
  </div>
  <h1>REGLAMENTO OFICIAL DEL TORNEO</h1>
  <div class="sub">${tournamentName} · Villar de Mazarife</div>
  <h2>1. Duración de los Partidos</h2>
  <ul>
    <li><b>Fase de grupos:</b> 2 partes de 10 minutos a tiempo parado.</li>
    <li><b>Fase final (Cuartos, Semifinales y Final):</b> 2 partes de 15 minutos a tiempo parado.</li>
    <li><b>Puntualidad:</b> Tolerancia máxima de 10 minutos de retraso. Pasado ese tiempo, el equipo no presentado pierde el partido por 3-0.</li>
  </ul>
  <h2>2. Tarjetas, Expulsiones y Sanciones</h2>
  <ul>
    <li><b>Doble amarilla:</b> Dos tarjetas amarillas en un mismo partido equivalen a tarjeta roja. El equipo jugará con un jugador menos durante 2 minutos o hasta que encaje un gol.</li>
    <li><b>Acumulación en fase de grupos:</b> 3 tarjetas amarillas acumuladas suponen 1 partido de suspensión automática.</li>
    <li><b>Roja directa:</b> Mínimo 1 partido de suspensión automática (ampliable por el comité de organización en caso de conducta grave).</li>
  </ul>
  <h2>3. Normas de Juego</h2>
  <ul>
    <li>Saques de banda y de esquina con el pie, disponiendo de un máximo de 4 segundos.</li>
    <li>La decisión del árbitro y de la mesa de control es definitiva e inapelable.</li>
  </ul>
  <h2>4. Puntuación y Criterios Estrictos de Desempate</h2>
  <ul>
    <li>Victoria: 3 puntos · Empate: 1 punto · Derrota: 0 puntos.</li>
    <li>Se clasifican para Cuartos de Final los 4 primeros equipos de cada grupo.</li>
  </ul>
  <p>En caso de empate a puntos entre dos o más equipos, se desempata en este orden estricto:</p>
  <ol>
    <li>Enfrentamiento directo (puntos y diferencia de goles solo en los partidos jugados entre los equipos empatados).</li>
    <li>Diferencia de goles general (DG).</li>
    <li>Goles a favor (GF).</li>
    <li>Fair Play (Amarilla = 1 punto, Roja = 3 puntos; gana el equipo con menor puntuación).</li>
    <li>Sorteo aleatorio oficial registrado por la organización.</li>
  </ol>
  <h2>5. Fase Final y Trofeos Individuales</h2>
  <ul>
    <li><b>Cruces de Cuartos:</b> 1.º A vs 4.º B (C1) · 2.º A vs 3.º B (C2) · 3.º A vs 2.º B (C3) · 4.º A vs 1.º B (C4).</li>
    <li><b>Empate en eliminatorias:</b> Se resuelve mediante tanda de penaltis. Los goles de la tanda de penaltis NO suman para el trofeo de Máximo Goleador ni cuentan en contra para el Portero Menos Goleado.</li>
    <li><b>Trofeo Portero Menos Goleado:</b> Promedio = Goles encajados ÷ Partidos jugados.</li>
  </ul>
</body>
</html>`);
    win.document.close();
  };

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">Normas y Reglamento</h1>
        <button type="button" className="btn btn-gold" onClick={downloadReglamentoPdf}>
          📄 Descargar Reglamento (PDF)
        </button>
      </div>

      <div className="card row-between" style={{ borderColor: 'rgba(212,175,55,0.45)' }}>
        <div>
          <span className="kicker">DOCUMENTACIÓN OFICIAL · VILLAR DE MAZARIFE</span>
          <b className="block" style={{ marginTop: 2 }}>
            Reglamento completo del {tournamentName}
          </b>
          <small className="muted">Disponible para consulta en el móvil o descarga en PDF imprimible.</small>
        </div>
        <button type="button" className="btn btn-sm btn-primary" onClick={downloadReglamentoPdf}>
          ⬇️ Abrir PDF
        </button>
      </div>

      <Section title="⏱️ Duración">
        <ul className="rules">
          <li><b>Fase de grupos:</b> 2 partes de 10 minutos a tiempo parado.</li>
          <li><b>Fase final:</b> 2 partes de 15 minutos a tiempo parado.</li>
          <li>Tolerancia de <b>10 minutos</b> de retraso. Pasado ese tiempo, el equipo pierde el partido por <b>3-0</b>.</li>
        </ul>
      </Section>
      <Section title="🟨 Tarjetas y sanciones">
        <ul className="rules">
          <li>Dos amarillas en un mismo partido = <b>roja</b>. El equipo juega con un jugador menos 2 minutos o hasta que reciba gol.</li>
          <li><b>3 amarillas acumuladas</b> en la fase de grupos = 1 partido de suspensión.</li>
          <li><b>Roja directa</b> = mínimo 1 partido de suspensión.</li>
          <li>La web marca automáticamente a los jugadores sancionados.</li>
        </ul>
      </Section>
      <Section title="⚽ Juego">
        <ul className="rules">
          <li>Saques de banda y de esquina con el pie, en 4 segundos.</li>
          <li>La decisión del árbitro es definitiva.</li>
        </ul>
      </Section>
      <Section title="📊 Puntuación">
        <ul className="rules">
          <li>Victoria 3 puntos · Empate 1 punto · Derrota 0 puntos.</li>
          <li>Pasan a cuartos los <b>4 primeros</b> de cada grupo.</li>
        </ul>
      </Section>
      <Section title="⚖️ Desempates (en este orden estricto)">
        <ol className="rules">
          <li>Enfrentamiento directo entre los empatados (puntos y diferencia de goles solo en esos partidos).</li>
          <li>Diferencia de goles general (DG).</li>
          <li>Goles a favor (GF).</li>
          <li>Fair play: amarilla = 1 punto, roja = 3 puntos. Gana quien tenga menos.</li>
          <li>Sorteo aleatorio guardado en base de datos.</li>
        </ol>
      </Section>
      <Section title="🏆 Fase final y Penaltis">
        <ul className="rules">
          <li>Cuartos: 1.º A – 4.º B · 2.º A – 3.º B · 3.º A – 2.º B · 4.º A – 1.º B.</li>
          <li>Semifinales: ganador C1 – ganador C2 · ganador C3 – ganador C4.</li>
          <li>Final: ganadores de las semifinales.</li>
          <li>En caso de empate, tanda de penaltis (sus goles no suman al Máximo Goleador ni penalizan al Portero Menos Goleado).</li>
        </ul>
      </Section>
      <Section title="📈 Estadísticas">
        <ul className="rules">
          <li><b>Máximo goleador:</b> total de goles en juego; promedio = goles ÷ partidos jugados por su equipo.</li>
          <li><b>Portero menos goleado:</b> promedio = goles encajados ÷ partidos jugados (menor es mejor).</li>
        </ul>
      </Section>
    </>
  );
}
