// src/components/GroupCard.jsx
const GroupCard = ({ group, onClick, studentsCount }) => {
  return (
    <button
      type="button"
      onClick={() => onClick?.(group)}
      className="tile-button group-card"          // ← usa clases del CSS global
      aria-label={`Grupo ${group}`}
    >
      <div className="tile">                       {/* caja visual */}
        <div className="tile-content">             {/* fila interna */}
          <div className="tile-icon" aria-hidden>🏷️</div>

          <div className="tile-text">
            <div className="tile-title">Grupo {group}</div>
            <div className="tile-subtitle">
              Ver estudiantes{typeof studentsCount === 'number' ? ` · ${studentsCount}` : ''}
            </div>
          </div>

          <div className="tile-caret" aria-hidden>›</div>
        </div>
      </div>
    </button>
  );
};

export default GroupCard;
