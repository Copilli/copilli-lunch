const GroupCard = ({ group, onClick }) => {
  return (
    <div
      style={{
        display: 'inline-block',
        padding: '0.5rem 1rem',
        margin: '0.25rem',
        border: '1px solid #ccc',
        borderRadius: 6,
        cursor: 'pointer',
        backgroundColor: '#e6f7ff'
      }}
      onClick={() => onClick(group)}
    >
      {group}
    </div>
  );
};

export default GroupCard;
