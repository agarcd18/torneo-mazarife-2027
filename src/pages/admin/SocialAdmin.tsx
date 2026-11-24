import { useState } from 'react';
import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { uid } from '../../lib/ids';
import { fmtNum } from '../../lib/format';
import { Section } from '../../components/ui';
import type { Announcement, TascaItem } from '../../lib/types';

export default function SocialAdmin() {
  const s = useStore();
  const v = s.view!;
  const announcements = v.announcements;
  const tasca = v.tasca;

  // Formulario Nuevo Anuncio
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annTag, setAnnTag] = useState('20:00h');
  const [annPinned, setAnnPinned] = useState(true);

  // Formulario Nuevo Producto de La Tasca
  const [itemCat, setItemCat] = useState<TascaItem['category']>('Comida / Bocadillos');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  const saveAnnouncements = (items: Announcement[], label: string) => {
    s.commit([op.upsert('settings', { key: 'announcements', value: { items } })], label);
  };

  const saveTasca = (items: TascaItem[], label: string) => {
    s.commit([op.upsert('settings', { key: 'tasca', value: { items } })], label);
  };

  const addAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim()) return s.toast('Escribe un título para el anuncio', 'warn');
    const next: Announcement = {
      id: uid(),
      title: annTitle.trim(),
      body: annBody.trim(),
      tag: annTag.trim() || 'AVISO',
      pinned: annPinned,
      created_at: new Date().toISOString(),
    };
    saveAnnouncements([next, ...announcements], `Publicar anuncio: ${next.title}`);
    setAnnTitle('');
    setAnnBody('');
    s.toast('📢 Anuncio publicado en la portada en directo', 'ok');
  };

  const removeAnnouncement = (id: string) => {
    saveAnnouncements(
      announcements.filter((a) => a.id !== id),
      'Borrar anuncio',
    );
    s.toast('Anuncio eliminado', 'info');
  };

  const addTascaItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Math.max(0, Math.round((parseFloat(itemPrice.replace(',', '.')) || 0) * 100) / 100);
    if (!itemName.trim() || price <= 0) return s.toast('Indica el nombre del producto y su precio', 'warn');
    const next: TascaItem = {
      id: uid(),
      category: itemCat,
      name: itemName.trim(),
      price,
      available: true,
    };
    saveTasca([...tasca, next], `Tasca: añadir ${next.name}`);
    setItemName('');
    setItemPrice('');
    s.toast(`🍻 Añadido a La Tasca: ${next.name} (${fmtNum(price, 2)} €)`, 'ok');
  };

  const updateTascaPrice = (id: string, rawPrice: string) => {
    const price = Math.max(0, Math.round((parseFloat(rawPrice.replace(',', '.')) || 0) * 100) / 100);
    saveTasca(
      tasca.map((i) => (i.id === id ? { ...i, price } : i)),
      'Actualizar precio de La Tasca',
    );
  };

  const toggleTascaAvail = (id: string) => {
    saveTasca(
      tasca.map((i) => (i.id === id ? { ...i, available: !i.available } : i)),
      'Disponibilidad en La Tasca',
    );
  };

  const removeTascaItem = (id: string) => {
    saveTasca(
      tasca.filter((i) => i.id !== id),
      'Quitar producto de La Tasca',
    );
  };

  return (
    <>
      <Section title="📢 Tablón de Anuncios (Portada Pública)">
        <div className="card">
          <p className="muted small" style={{ marginTop: 0 }}>
            Publica eventos especiales que verá todo el público al abrir la app (ej. <i>"Sorteo de jamón a las 20:00"</i>, <i>"Concurso de triples"</i>, <i>"Entrega de trofeos 22:30"</i>).
          </p>
          <form onSubmit={addAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <div className="row-gap">
              <input
                className="grow"
                placeholder="Título del evento (ej. 🍖 Sorteo de Jamón a las 20:00)"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
              <input
                style={{ width: 120 }}
                placeholder="Hora / Etiqueta"
                value={annTag}
                onChange={(e) => setAnnTag(e.target.value)}
              />
              <label className="gk-check">
                <input type="checkbox" checked={annPinned} onChange={(e) => setAnnPinned(e.target.checked)} />
                <span>📌 Destacar</span>
              </label>
            </div>
            <div className="row-gap">
              <input
                className="grow"
                placeholder="Descripción opcional (ej. Papeletas a 2 € en la barra)"
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
              />
              <button className="btn btn-gold">+ Publicar anuncio</button>
            </div>
          </form>

          <div className="ann-list">
            {announcements.map((a) => (
              <div key={a.id} className={`ann-card ${a.pinned ? 'pinned' : ''}`}>
                <div className="grow">
                  <div className="row-center" style={{ marginBottom: 3 }}>
                    <span className="tag">{a.tag}</span>
                    <b>{a.title}</b>
                  </div>
                  {a.body && <small className="muted block">{a.body}</small>}
                </div>
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => removeAnnouncement(a.id)}
                  title="Eliminar anuncio"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="🍻 La Tasca / Barra (Lista de Precios en Directo)">
        <div className="card">
          <p className="muted small" style={{ marginTop: 0 }}>
            Gestiona la carta de bocadillos y bebidas que ve el público en la pantalla principal.
          </p>
          <form className="fin-mov-form" onSubmit={addTascaItem} style={{ marginBottom: 14 }}>
            <select value={itemCat} onChange={(e) => setItemCat(e.target.value as TascaItem['category'])}>
              <option value="Comida / Bocadillos">🍔 Comida / Bocadillos</option>
              <option value="Bebidas">🍺 Bebidas</option>
              <option value="Combos / Otros">🎟️ Combos / Otros</option>
            </select>
            <input
              className="grow"
              placeholder="Producto (ej. Bocadillo de lomo y queso)"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
            <input
              style={{ width: 95 }}
              type="number"
              step="0.10"
              min="0"
              placeholder="Precio €"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
            />
            <button className="btn btn-gold">+ Añadir</button>
          </form>

          <div className="tasca-admin-list">
            {tasca.map((item) => (
              <div key={item.id} className={`tasca-admin-row ${item.available ? '' : 'soldout'}`}>
                <span className="tag">{item.category.split(' ')[0]}</span>
                <span className="grow">
                  <b>{item.name}</b>
                </span>
                <div className="fin-input-box" style={{ padding: '2px 8px' }}>
                  <input
                    style={{ width: 64, fontSize: 14 }}
                    type="number"
                    step="0.10"
                    min="0"
                    defaultValue={item.price}
                    key={`${item.id}-${item.price}`}
                    onBlur={(e) => updateTascaPrice(item.id, e.target.value)}
                  />
                  <span>€</span>
                </div>
                <button
                  type="button"
                  className={`chip-btn ${item.available ? 'on' : ''}`}
                  onClick={() => toggleTascaAvail(item.id)}
                >
                  {item.available ? '✅ Disponible' : '🚫 Agotado'}
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={() => removeTascaItem(item.id)}
                  title="Borrar producto"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
