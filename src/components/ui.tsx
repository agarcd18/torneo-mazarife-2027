import React, { useEffect } from 'react';
import type { Match, Team } from '../lib/types';
import { initials, statusLabel, textColorFor } from '../lib/format';

export function TeamBadge({ team, size = 32, label }: { team?: Team | null; size?: number; label?: string }) {
  const color = team?.color ?? '#2a3b33';
  const text = team ? initials(team.name) : label ? initials(label) : '?';
  return (
    <span
      className={`badge ${team ? '' : 'badge-empty'}`}
      style={{ width: size, height: size, fontSize: size * 0.46, background: team ? color : undefined, color: team ? textColorFor(color) : undefined }}
      aria-hidden
    >
      {team ? text : '?'}
    </span>
  );
}

export function TeamLink({ team, fallback }: { team?: Team | null; fallback?: string }) {
  if (!team) return <span className="muted">{fallback ?? 'Por definir'}</span>;
  return (
    <a className="team-link" href={`#/equipo/${team.id}`} onClick={(e) => e.stopPropagation()}>
      {team.name}
    </a>
  );
}

export function Section({ title, action, children, className }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`section ${className ?? ''}`}>
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusChip({ m }: { m: Match }) {
  return <span className={`chip chip-${m.status}`}>{m.status === 'live' && <i className="dot" />}{statusLabel(m.status)}</span>;
}

export function Sheet({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', k);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon = '⚽', title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export const Icons = {
  home: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  ),
  table: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16M8 4v16" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  bracket: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h5v5H3M3 14h5v5H3M8 7.5h3v9H8M11 12h4M15 9h6v6h-6z" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),
};
