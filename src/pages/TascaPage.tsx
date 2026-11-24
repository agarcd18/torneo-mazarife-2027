import { useStore } from '../lib/store';
import { fmtNum } from '../lib/format';
import { Section } from '../components/ui';

export default function TascaPage() {
  const { view, isOrganizer } = useStore();
  const v = view!;
  const categories = ['Comida / Bocadillos', 'Bebidas', 'Combos / Otros'] as const;

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">🍻 La Tasca del Torneo</h1>
        {isOrganizer && (
          <a href="#/admin/social" className="btn btn-sm btn-gold">
            ✎ Editar precios
          </a>
        )}
      </div>

      <div className="card tasca-hero">
        <span className="kicker">VILLAR DE MAZARIFE · BARRA OFICIAL</span>
        <h3 style={{ margin: '4px 0 6px', fontFamily: 'var(--font-display)', fontSize: 26 }}>
          Bocadillos calientes, bebida fría y ambiente de fútbol sala
        </h3>
        <p className="muted small" style={{ margin: 0 }}>
          Todo lo recaudado en La Tasca ayuda a financiar los premios, trofeos y organización del torneo de verano.
        </p>
      </div>

      {categories.map((cat) => {
        const items = v.tasca.filter((i) => i.category === cat);
        if (!items.length) return null;
        return (
          <Section
            key={cat}
            title={cat === 'Comida / Bocadillos' ? '🍔 Bocadillos y Plancha' : cat === 'Bebidas' ? '🍺 Bebidas Frías' : '🎟️ Combos y Sorteos'}
          >
            <div className="card tasca-menu-card">
              {items.map((item) => (
                <div key={item.id} className={`tasca-menu-item ${item.available ? '' : 'soldout'}`}>
                  <div className="grow">
                    <b>{item.name}</b>
                    {!item.available && <span className="tag red" style={{ marginLeft: 8 }}>AGOTADO</span>}
                  </div>
                  <span className="tasca-price">{fmtNum(item.price, 2)} €</span>
                </div>
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}
