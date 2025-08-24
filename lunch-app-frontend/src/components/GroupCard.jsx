// src/components/GroupCard.jsx
import { useState } from 'react';

const accent = '#0d6efd';
const softBg = 'rgba(13,110,253,.12)';

const GroupCard = ({ group, onClick, studentsCount }) => {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="card h-100 border-0 shadow-sm"
      role="button"
      onClick={() => onClick?.(group)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Grupo ${group}`}
      style={{
        borderRadius: 14,
        cursor: 'pointer',
        transition: 'box-shadow .15s ease, transform .05s ease',
        transform: hover ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? '0 .5rem 1rem rgba(0,0,0,.08)' : undefined,
      }}
    >
      <div className="card-body d-flex align-items-center" style={{ gap: 14, minHeight: 72 }}>
        {/* Icono */}
        <div
          className="rounded-circle d-flex align-items-center justify-content-center"
          style={{
            width: 44,
            height: 44,
            flex: '0 0 44px',
            background: softBg,
            color: accent,
            fontSize: 20,
          }}
          aria-hidden
        >
          🏷️
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-grow-1">
          <div className="fw-semibold text-truncate">Grupo {group}</div>
          <div className="text-muted small text-truncate">
            Ver estudiantes{typeof studentsCount === 'number' ? ` · ${studentsCount}` : ''}
          </div>
        </div>

        {/* Chevron */}
        <div className="text-muted" aria-hidden style={{ fontSize: 18 }}>
          ›
        </div>
      </div>
    </div>
  );
};

export default GroupCard;
