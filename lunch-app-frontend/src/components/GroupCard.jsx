// src/components/GroupCard.jsx
import { useState } from 'react';

const accent = '#0d6efd';
const softBg = 'rgba(13,110,253,.1)';

const GroupCard = ({ group, onClick, studentsCount }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      className="btn w-100 text-start border bg-white h-100 p-3 shadow-sm"
      style={{
        borderRadius: 12,
        boxShadow: hover ? '0 .5rem 1rem rgba(0,0,0,.08)' : undefined,
        transition: 'box-shadow .15s ease, transform .05s ease',
        transform: hover ? 'translateY(-1px)' : 'none',
        cursor: 'pointer'
      }}
      onClick={() => onClick?.(group)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Grupo ${group}`}
    >
      <div className="d-flex align-items-center" style={{ gap: 10 }}>
        <div
          className="rounded-circle d-flex align-items-center justify-content-center"
          style={{ width: 40, height: 40, background: softBg, color: accent, fontSize: 18 }}
          aria-hidden
        >
          🏷️
        </div>
        <div className="min-w-0">
          <div className="fw-semibold text-truncate">Grupo {group}</div>
          {typeof studentsCount === 'number' && (
            <div className="text-muted small">Alumnos: {studentsCount}</div>
          )}
        </div>
      </div>
    </button>
  );
};

export default GroupCard;
