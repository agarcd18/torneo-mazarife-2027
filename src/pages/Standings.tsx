import { useStore } from '../lib/store';
import { Section } from '../components/ui';
import { StandingsTable } from '../components/StandingsTable';
import { shareCanvas, standingsCanvas, standingsText, whatsappUrl } from '../lib/share';
import type { GroupName } from '../lib/types';

export function ShareBar({ onImage, text }: { onImage: () => void; text: string }) {
  return (
    <div className="share-bar">
      <button className="btn btn-sm btn-ghost" onClick={onImage}>
        📷 Imagen
      </button>
      <a className="btn btn-sm btn-whatsapp" href={whatsappUrl(text)} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
    </div>
  );
}

export default function Standings() {
  const { view, toast } = useStore();
  const v = view!;
  const share = async (g: GroupName) => {
    const r = await shareCanvas(standingsCanvas(v, g), `clasificacion-grupo-${g}.png`, standingsText(v, g));
    if (r === 'downloaded') toast('Imagen descargada', 'ok');
  };
  return (
    <>
      <h1 className="page-title">Clasificación</h1>
      {(['A', 'B'] as GroupName[]).map((g) => (
        <Section key={g} title={`Grupo ${g}`} action={v.standings[g].rows.length ? <ShareBar onImage={() => share(g)} text={standingsText(v, g)} /> : null}>
          <StandingsTable st={v.standings[g]} />
          <div className="muted small">
            {v.standings[g].played}/{v.standings[g].total} partidos jugados
          </div>
        </Section>
      ))}
      <div className="legend">
        <span>
          <i className="lg-q" /> Pasan a cuartos (4 primeros)
        </span>
        <span>
          <i className="lg-out" /> Eliminados
        </span>
      </div>
      <p className="muted small">
        PJ jugados · G ganados · E empatados · P perdidos · GF goles a favor · GC en contra · DG diferencia · FP fair play (amarilla 1, roja 3) · Pts puntos.
        Desempate: enfrentamiento directo, DG, GF, fair play y sorteo.
      </p>
    </>
  );
}
