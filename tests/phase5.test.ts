import { describe, expect, it } from 'vitest';
import { emptyDB } from '../src/lib/types';
import { buildView } from '../src/domain/view';
import { MASTER_ADMIN_PASS, MAX_PHOTO_BYTES } from '../src/lib/backend';

describe('FASE 5 y UI Outdoor XL: Portal Público, Tasca, Anuncios, Galería y Contraseña Maestra', () => {
  it('1. buildView carga el Tablón de Anuncios y la carta de precios de La Tasca por defecto', () => {
    const db = emptyDB();
    const view = buildView(db);
    expect(view.announcements.length).toBeGreaterThan(0);
    expect(view.tasca.length).toBeGreaterThan(0);
    expect(view.tasca.some((i) => i.category === 'Comida / Bocadillos')).toBe(true);
    expect(view.tasca.some((i) => i.category === 'Bebidas')).toBe(true);
  });

  it('2. El límite de subida de fotos colaborativas es exactamente 5 MB (5242880 bytes)', () => {
    expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024);
  });

  it('3. La contraseña maestra obligatoria de Acceso Organizador es Mazarife25', () => {
    expect(MASTER_ADMIN_PASS).toBe('Mazarife25');
  });
});
