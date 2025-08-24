// src/components/GroupCard.jsx
import { useState } from 'react';

const accent = '#0d6efd';
const softBg = 'rgba(13,110,253,.1)';

const GroupCard = ({ group, onClick, studentsCount }) => {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="card h-100 shadow-sm border-0"
      role="button"
      onClick={() => onClick?.(group)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 14,
        boxShadow: hover ? '0 .5rem 1rem rgba(0,0,0,.08)' : undefined,
        transition: 'box-shadow .15s ease, transform .05s ease',
        transform: hover ? 'translateY(-1px)' : 'none',
        cursor: 'pointer',
        marginBottom: '1rem'
      }}
      aria-label={`Grupo ${group}`}
    >
      <div className="card-body d-flex align-items-center" style={{ gap: 14 }}>
        {/* Icono */}
        <div
          className="rounded-circle d-flex align-items-center justify-content-center"
          style={{
            width: 44,
            height: 44,
            background: softBg,
            color: accent,
            fontSize: 20,
            flex: '0 0 44px'
          }}
          aria-hidden
        >
          🏷️
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-grow-1">
          <div className="fw-semibold text-truncate mb-1">Grupo {group}</div>
          {typeof studentsCount === 'number' && (
            <div className="text-muted small">
              {studentsCount} alumno{studentsCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Chevron */}
        <div className="text-muted" aria-hidden style={{ fontSize: 18 }}>›</div>
      </div>
    </div>
  );
};

export default GroupCard;
