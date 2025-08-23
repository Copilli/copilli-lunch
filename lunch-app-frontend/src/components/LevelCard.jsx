// src/components/LevelCard.jsx
import { useState } from 'react';

const LABEL = { preescolar: 'Preescolar', primaria: 'Primaria', secundaria: 'Secundaria' };
const ICON  = { preescolar: '🎨', primaria: '📘', secundaria: '🧪' };

const accent = '#0d6efd';
const softBg = 'rgba(13,110,253,.1)';

const LevelCard = ({ level, onClick }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="card h-100 shadow-sm border-0"
      style={{
        borderRadius: 14,
        boxShadow: hover ? '0 .5rem 1rem rgba(0,0,0,.08)' : undefined,
        transition: 'box-shadow .15s ease, transform .05s ease',
        transform: hover ? 'translateY(-1px)' : 'none',
        cursor: 'pointer'
      }}
      role="button"
      onClick={() => onClick?.(level)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={LABEL[level] || level}
    >
      <div className="card-body d-flex flex-column">
        <div className="d-flex align-items-center mb-2" style={{ gap: 12 }}>
          <div
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 44, height: 44, background: softBg, color: accent, fontSize: 20 }}
            aria-hidden
          >
            {ICON[level] || '🏫'}
          </div>
          <h5 className="mb-0">{LABEL[level] || level}</h5>
        </div>
      </div>
    </div>
  );
};

export default LevelCard;
