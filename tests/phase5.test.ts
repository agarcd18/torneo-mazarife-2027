import { describe, expect, it } from 'vitest';
import { emptyDB } from '../src/lib/types';
import { buildView } from '../src/domain/view';
import { MASTER_ADMIN_PASS, MAX_PHOTO_BYTES } from '../src/lib/backend';
import { backupFilename, buildTournamentExcelCSV, createMasterBackup, validateBackupJSON } from '../src/domain/backup';

describe('FASE 5 y UI Outdoor XL: Portal Público, Tasca, Anuncios, Galería, Contraseña Maestra y Backups', () => {
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

  it('4. Sistema de Backup y Restauración genera JSON Maestro, valida resumen y exporta CSV para Excel', () => {
    const d = new Date('2026-08-15T19:35:00');
    expect(backupFilename(d)).toBe('backup-torneo-mazarife-2026-08-15-1935.json');

    const db = emptyDB();
    db.teams.push({ id: 't1', name: 'Mazarife FS', color: '#1f7a4a', group_name: 'A', group_order: 0, payment_status: 'paid' });
    db.players.push({ id: 'p1', team_id: 't1', name: 'Jugador 1', number: 10, is_goalkeeper: false });

    const master = createMasterBackup(db);
    const check = validateBackupJSON(JSON.stringify(master));
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.summary.teamsCount).toBe(1);
      expect(check.summary.playersCount).toBe(1);
      expect(check.summary.matchesCount).toBe(0);
    }

    const csv = buildTournamentExcelCSV(buildView(db));
    expect(csv).toContain('EQUIPOS E INSCRIPCIONES');
    expect(csv).toContain('Mazarife FS');
  });
});
