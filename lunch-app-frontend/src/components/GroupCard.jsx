const GroupCard = ({ group, onClick }) => {
  return (
    <div
      className="card text-center border-primary shadow-sm hover-shadow cursor-pointer"
      onClick={() => onClick(group)}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-body bg-primary text-white">
        <h6 className="card-title m-0">Grupo {group}</h6>
      </div>
    </div>
  );
};

export default GroupCard;