import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { MAX_PHOTO_BYTES } from '../lib/backend';
import { fmtDateTime } from '../lib/format';
import { Empty, Section } from '../components/ui';
import type { TournamentPhoto } from '../lib/types';

export default function GalleryPage() {
  const s = useStore();
  const [author, setAuthor] = useState(() => localStorage.getItem('ftorneo.photo.author') || '');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState<TournamentPhoto | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onSelectFile = (f: File | null) => {
    setErr('');
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!f.type.startsWith('image/')) {
      setErr('Selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      return;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      const sizeMb = (f.size / (1024 * 1024)).toFixed(2);
      setErr(`⚠️ La imagen pesa ${sizeMb} MB y supera el límite máximo permitido de 5 MB.`);
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErr('Elige primero una foto desde tu móvil.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErr('La foto supera el límite de 5 MB.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      if (author.trim()) localStorage.setItem('ftorneo.photo.author', author.trim());
      await s.uploadPhoto(file, author.trim() || 'Afición', caption.trim());
      setFile(null);
      setPreview(null);
      setCaption('');
      if (inputRef.current) inputRef.current.value = '';
      s.toast('📸 ¡Foto subida a la galería del torneo!', 'ok');
    } catch (e: any) {
      setErr(e?.message || 'No se pudo subir la foto');
    } finally {
      setBusy(false);
    }
  };

  const handleModerateDelete = async (p: TournamentPhoto) => {
    if (!s.isOrganizer) return;
    if (!confirm(`🗑️ MODERACIÓN ADMIN\n\n¿Borrar inmediatamente esta foto de "${p.author}" de la galería pública?`)) return;
    try {
      await s.deletePhoto(p);
      if (lightbox?.id === p.id) setLightbox(null);
      s.toast('🗑️ Foto eliminada por moderación', 'ok');
    } catch (e: any) {
      s.toast(e?.message || 'Error al borrar la foto', 'error');
    }
  };

  return (
    <>
      <div className="row-between">
        <h1 className="page-title">📸 Galería del Torneo</h1>
        {s.isOrganizer && <span className="tag gold-tag">🛡️ MODO MODERADOR ACTIVO</span>}
      </div>

      <div className="card gallery-upload-card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <b>Sube tu foto desde la grada o la pista</b>
          <span className="tag">Máx. 5 MB</span>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Comparte los mejores momentos del Torneo de Villar de Mazarife. Las fotos aparecen al instante para todos.
        </p>

        <form onSubmit={submit} className="gallery-form">
          <label className="file-drop">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <div className="file-preview-wrap">
                <img src={preview} alt="Vista previa" className="file-preview-img" />
                <span className="muted small">
                  {file?.name} ({((file?.size ?? 0) / (1024 * 1024)).toFixed(2)} MB) · Pulsa para cambiar
                </span>
              </div>
            ) : (
              <div className="file-drop-placeholder">
                <span style={{ fontSize: 28 }}>📷</span>
                <b>Toca aquí para hacer una foto o elegir de tu galería</b>
                <small className="muted">Formatos JPG, PNG, WEBP · Límite 5 MB por foto</small>
              </div>
            )}
          </label>

          <div className="form-grid">
            <input
              placeholder="Tu nombre o peña (ej. Peña El Chorizo)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={40}
            />
            <input
              placeholder="Comentario / pie de foto (opcional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={100}
            />
          </div>

          {err && <div className="dup-alert">{err}</div>}

          <button className="btn btn-gold full" disabled={busy || !file}>
            {busy ? 'Subiendo foto…' : '⬆️ Publicar Foto en la Galería'}
          </button>
        </form>
      </div>

      <Section title={`Fotos de la afición (${s.photos.length})`}>
        {!s.photos.length ? (
          <Empty icon="📸" title="Aún no hay fotos subidas">
            ¡Sé el primero en subir una foto del ambiente en Villar de Mazarife!
          </Empty>
        ) : (
          <div className="photo-grid">
            {s.photos.map((p) => (
              <article key={p.id} className="photo-card">
                <div className="photo-img-wrap" onClick={() => setLightbox(p)}>
                  <img src={p.url} alt={p.caption || p.author} loading="lazy" />
                  {s.isOrganizer && (
                    <button
                      type="button"
                      className="photo-trash-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModerateDelete(p);
                      }}
                      title="Moderación Admin: Borrar foto inapropiada"
                      aria-label="Borrar foto"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <div className="photo-meta">
                  <div className="row-between">
                    <b>{p.author}</b>
                    <small className="muted">{fmtDateTime(p.created_at)}</small>
                  </div>
                  {p.caption && <p className="photo-caption">{p.caption}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      {lightbox && (
        <div className="sheet-backdrop" onClick={() => setLightbox(null)}>
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption || lightbox.author} />
            <div className="lightbox-bar">
              <div>
                <b>{lightbox.author}</b>
                {lightbox.caption && <p className="muted small" style={{ margin: '2px 0 0' }}>{lightbox.caption}</p>}
              </div>
              <div className="row-gap">
                {s.isOrganizer && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => handleModerateDelete(lightbox)}>
                    🗑️ Borrar foto
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setLightbox(null)}>
                  Cerrar ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
