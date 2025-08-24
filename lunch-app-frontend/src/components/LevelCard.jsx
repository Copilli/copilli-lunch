// src/components/LevelCard.jsx
const LABEL = { preescolar: 'Preescolar', primaria: 'Primaria', secundaria: 'Secundaria' };
const ICON  = { preescolar: '🎨', primaria: '📘', secundaria: '🧪' };

const LevelCard = ({ level, onClick }) => {
  return (
    <button
      type="button"
      onClick={() => onClick?.(level)}
      aria-label={LABEL[level] || level}
      className="tile-button level-card"
    >
      <div className="tile">
        <div className="tile-content">
          <div className="tile-icon" aria-hidden>
            {ICON[level] || '🏫'}
          </div>

          <div className="tile-text">
            <div className="tile-title">{LABEL[level] || level}</div>
            <div className="tile-subtitle">Ver grupos</div>
          </div>

          <div className="tile-caret" aria-hidden>›</div>
        </div>
      </div>
    </button>
  );
};

export default LevelCard;
