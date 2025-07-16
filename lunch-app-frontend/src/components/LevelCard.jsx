const LevelCard = ({ level, onClick }) => {
  const levelNames = {
    preescolar: 'Preescolar',
    primaria: 'Primaria',
    secundaria: 'Secundaria'
  };

  const levelColors = {
    preescolar: 'warning',
    primaria: 'info',
    secundaria: 'success'
  };

  const color = levelColors[level] || 'secondary';

  return (
    <div
      className={`card text-center border-${color} shadow-sm hover-shadow cursor-pointer`}
      onClick={() => onClick(level)}
      style={{ cursor: 'pointer' }}
    >
      <div className={`card-body bg-${color} text-white`}>
        <h5 className="card-title m-0">{levelNames[level] || level}</h5>
      </div>
    </div>
  );
};

export default LevelCard;
