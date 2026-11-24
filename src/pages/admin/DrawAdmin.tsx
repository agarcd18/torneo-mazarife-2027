import { useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { op } from '../../lib/ops';
import { drawGroups } from '../../domain/draw';
import { buildMatches, countConsecutiveSlots } from '../../domain/schedule';
import { TeamBadge, Section } from '../../components/ui';
import { BracketView } from '../../components/Bracket';
import type { GroupName, Team } from '../../lib/types';
import { fmtDateTime } from '../../lib/format';

interface Anim {
  order: { id: string; g: GroupName }[];
  shown: number;
}

export default function DrawAdmin() {
  const s = useStore();
  const v = s.view!;
  const teams = v.teams;
  const [anim, setAnim] = useState<Anim | null>(null);
  const animating = !!anim && anim.shown < anim.order.length;

  useEffect(() => {
    if (!anim || anim.shown >= anim.order.length) return;
    const t = setTimeout(() => setAnim((a) => a && { ...a, shown: a.shown + 1 }), anim.shown === 0 ? 1100 : 520);
    return () => clearTimeout(t);
  }, [anim]);

  const runDraw = () => {
    if (v.draw.confirmed) {
      s.toast('El sorteo está bloqueado. No se puede volver a sortear.', 'warn');
      return;
    }
    if (teams.length < 4) return s.toast('Necesitas al menos 4 equipos inscritos para hacer el sorteo', 'warn');
    if (teams.length !== v.tournament.numTeams && !confirm(`Hay ${teams.length} equipos inscritos y estaban previstos ${v.tournament.numTeams}. ¿Hacer el sorteo igualmente?`)) return;

    const r = drawGroups(teams.map((t) => t.id));
    const rows = teams.map((t) => {
      const ia = r.A.indexOf(t.id);
      const ib = r.B.indexOf(t.id);
      return { ...t, group_name: (ia >= 0 ? 'A' : 'B') as GroupName, group_order: ia >= 0 ? ia : ib };
    });
    const ops = [];
    if (v.db.matches.length) ops.push(op.bulkDelete('matches', v.db.matches.map((m) => m.id)));
    ops.push(op.bulkUpsert('teams', rows));
    ops.push(op.upsert('settings', { key: 'draw', value: { confirmed: false, doneAt: new Date().toISOString(), confirmedAt: null } }));
    s.commit(ops, 'Sorteo aleatorio de grupos', { undoable: false });

    const order: Anim['order'] = [];
    for (let i = 0; i < Math.max(r.A.length, r.B.length); i++) {
      if (r.A[i]) order.push({ id: r.A[i], g: 'A' });
      if (r.B[i]) order.push({ id: r.B[i], g: 'B' });
    }
    setAnim({ order, shown: 0 });
  };

  const confirmAndLockDraw = () => {
    if (!confirm('¿Confirmar y BLOQUEAR el sorteo?\n\n• El sorteo quedará bloqueado para evitar sorteos accidentales.\n• Se generarán automáticamente todos los partidos de Grupos (evitando partidos seguidos) y el Cuadro de Eliminatorias en vacío.')) {
      return;
    }
    const { matches } = buildMatches(v.teams, v.schedule);
    const consecutive = countConsecutiveSlots(matches);
    const ops = [];
    if (v.db.matches.length) ops.push(op.bulkDelete('matches', v.db.matches.map((m) => m.id)));
    ops.push(op.bulkUpsert('matches', matches));
    ops.push(
      op.upsert('settings', {
        key: 'draw',
        value: { ...v.draw, confirmed: true, confirmedAt: new Date().toISOString() },
      }),
    );
    s.commit(ops, 'Confirmar sorteo y generar calendario', { undoable: false });
    s.toast(
      `🔒 Sorteo bloqueado y ${matches.length} partidos generados (${consecutive === 0 ? '0 partidos seguidos sin descanso' : `${consecutive} cruces seguidos`})`,
      'ok',
    );
  };

  const unlockEmergency = () => {
    const word = prompt(
      '⚠️ DESBLOQUEO DE SEGURIDAD\n\nSi desbloqueas y repites el sorteo se reiniciará el calendario. Escribe DESBLOQUEAR en mayúsculas para confirmar:',
    );
    if ((word ?? '').trim() !== 'DESBLOQUEAR') return;
    s.commit(
      [op.upsert('settings', { key: 'draw', value: { ...v.draw, confirmed: false, confirmedAt: null } })],
      'Desbloquear sorteo',
      { undoable: false },
    );
    s.toast('Sorteo desbloqueado. Ya puedes repetir el sorteo si lo necesitas.', 'warn');
  };

  const groupTeams = (g: GroupName): Team[] => {
    if (anim && animating) {
      return anim.order
        .slice(0, anim.shown)
        .filter((x) => x.g === g)
        .map((x) => v.teamsById.get(x.id)!)
        .filter(Boolean);
    }
    return teams.filter((t) => t.group_name === g).sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0));
  };

  const hasGroups = teams.some((t) => t.group_name);
  const remaining = anim && animating ? anim.order.slice(anim.shown).map((x) => v.teamsById.get(x.id)!).filter(Boolean) : teams;

  return (
    <>
      <div className="card draw-hero-card">
        <div className="row-between">
          <div>
            <span className="kicker">FASE 3 · SORTEO DE GRUPOS</span>
            <h3 style={{ margin: '4px 0 6px', fontFamily: 'var(--font-display)', fontSize: 26 }}>
              Bombo Oficial · Grupo A y Grupo B
            </h3>
          </div>
          {v.draw.confirmed && <span className="fin-badge ok">🔒 BLOQUEADO</span>}
        </div>

        <p className="muted small" style={{ marginTop: 0 }}>
          Divide al azar los <b>{teams.length} equipos inscritos</b> en <b>Grupo A ({Math.ceil(teams.length / 2)})</b> y{' '}
          <b>Grupo B ({Math.floor(teams.length / 2)})</b>. Al confirmar y bloquear el sorteo, se genera automáticamente todo el calendario de grupos y el cuadro de eliminatorias vacío.
        </p>

        {v.draw.confirmed ? (
          <div className="draw-locked-box">
            <div>
              <b className="ok-text">🔒 Sorteo confirmado y bloqueado</b>
              <small className="muted block">
                {v.draw.confirmedAt ? `Bloqueado el ${fmtDateTime(v.draw.confirmedAt)}` : 'Sorteo definitivo'} · El botón de sorteo está desactivado para evitar errores.
              </small>
            </div>
            <div className="row-gap">
              <a href="#/admin/calendario" className="btn btn-gold">
                📅 Ir al Calendario ({v.matches.length} partidos)
              </a>
              <button type="button" className="btn btn-sm btn-ghost" onClick={unlockEmergency}>
                🔓 Desbloquear…
              </button>
            </div>
          </div>
        ) : (
          <div className="row-gap">
            <button type="button" className="btn btn-gold" onClick={runDraw} disabled={animating}>
              🎱 {animating ? 'Sorteando bolas…' : hasGroups ? 'Repetir Sorteo Aleatorio' : 'Hacer Sorteo Aleatorio'}
            </button>
            {hasGroups && !animating && (
              <button type="button" className="btn btn-primary" onClick={confirmAndLockDraw}>
                🔒 Confirmar y Bloquear Sorteo
              </button>
            )}
          </div>
        )}
      </div>

      {(animating || !hasGroups) && (
        <div className={`bombo ${animating ? 'spinning' : ''}`}>
          <div className="bombo-drum">
            {remaining.slice(0, 16).map((t, i) => (
              <span key={t.id} className="ball" style={{ ['--i' as any]: i, ['--n' as any]: Math.max(1, Math.min(remaining.length, 16)) }}>
                <TeamBadge team={t} size={36} />
              </span>
            ))}
          </div>
          {animating && anim && anim.shown > 0 && (
            <div className="bombo-last">
              🎱 Sale <b>{v.teamsById.get(anim.order[anim.shown - 1].id)?.name}</b> →{' '}
              <span className="gold">GRUPO {anim.order[anim.shown - 1].g}</span> ({anim.shown}/{anim.order.length})
            </div>
          )}
          {!hasGroups && !animating && (
            <p className="muted small" style={{ textAlign: 'center', marginTop: 10 }}>
              Pulsa <b>"Hacer Sorteo Aleatorio"</b> para girar el bombo y repartir los equipos.
            </p>
          )}
        </div>
      )}

      {(hasGroups || anim) && (
        <div className="draw-groups">
          {(['A', 'B'] as GroupName[]).map((g) => {
            const gList = groupTeams(g);
            return (
              <div key={g} className="draw-group">
                <div className="row-between" style={{ marginBottom: 10 }}>
                  <h3>GRUPO {g}</h3>
                  <span className="tag">{gList.length} equipos</span>
                </div>
                {gList.map((t, idx) => (
                  <div key={t.id} className="draw-team pop">
                    <span className="draw-seed">{idx + 1}</span>
                    <TeamBadge team={t} size={30} />
                    <span className="grow">
                      <b>{t.name}</b>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {v.draw.confirmed && v.matches.length > 0 && (
        <Section
          title="🏆 Cuadro de Eliminatorias (Generado en vacío)"
          action={
            <a href="#/admin/calendario" className="link">
              Editar horarios ›
            </a>
          }
        >
          <p className="muted small">
            Los cruces (1ºA vs 4ºB, 2ºA vs 3ºB, 3ºA vs 2ºB, 4ºA vs 1ºB) se rellenarán solos cuando terminen los partidos de grupos.
          </p>
          <BracketView />
        </Section>
      )}
    </>
  );
}
