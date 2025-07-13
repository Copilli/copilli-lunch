const LevelCard = ({ level, onClick }) => {
  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: '1rem',
        marginBottom: '0.5rem',
        cursor: 'pointer',
        backgroundColor: '#f9f9f9'
      }}
      onClick={() => onClick(level)}
    >
      <strong>{level.toUpperCase()}</strong>
    </div>
  );
};

export default LevelCard;
