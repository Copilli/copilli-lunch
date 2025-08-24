// src/components/LevelCard.jsx
import { useState } from 'react';

const LABEL = { preescolar: 'Preescolar', primaria: 'Primaria', secundaria: 'Secundaria' };
const ICON  = { preescolar: '🎨', primaria: '📘', secundaria: '🧪' };

const accent = '#0d6efd';
const softBg = 'rgba(13,110,253,.12)';

const LevelCard = ({ level, onClick }) => {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onClick?.(level)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      aria-label={LABEL[level] || level}
      className="w-100 text-start bg-white border-0 p-0"
      style={{ cursor: 'pointer' }}
    >
      <div
        className="h-100 shadow-sm"
        style={{
          borderRadius: 14,
          border: '1px solid #eef1f5',
          padding: '14px 16px',
          transition: 'box-shadow .15s ease, transform .05s ease',
          boxShadow: hover ? '0 .65rem 1.25rem rgba(0,0,0,.08)' : '0 .25rem .5rem rgba(0,0,0,.04)',
          transform: hover ? 'translateY(-1px)' : 'none',
          outline: 'none',
          ...(focus ? { boxShadow: '0 0 0 4px rgba(13,110,253,.15), 0 .25rem .5rem rgba(0,0,0,.05)' } : {})
        }}
      >
        <div className="d-flex align-items-center" style={{ gap: 14, minHeight: 56 }}>
          <div
            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              width: 48,
              height: 48,
              background: softBg,
              color: accent,
              fontSize: 22
            }}
            aria-hidden
          >
            {ICON[level] || '🏫'}
          </div>

          <div className="min-w-0 flex-grow-1">
            <div className="fw-semibold text-truncate" style={{ fontSize: 16 }}>
              {LABEL[level] || level}
            </div>
            <div className="text-muted small">Ver grupos</div>
          </div>

          {/* caret sutil a la derecha */}
          <div className="ms-auto text-muted" aria-hidden style={{ fontSize: 18, opacity: .7 }}>
            ›
          </div>
        </div>
      </div>
    </button>
  );
};

export default LevelCard;
