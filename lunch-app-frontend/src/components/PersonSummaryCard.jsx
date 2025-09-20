import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

const statusColors = {
  'periodo-activo': '#c1f0c1',   // verde claro
  'con-fondos': '#add8e6',       // azul claro
  'sin-fondos': '#f5f5f5',       // gris claro
  'bloqueado': '#f8d7da'         // rojo claro
};

const statusLabels = {
  'periodo-activo': 'Periodo activo',
  'con-fondos': 'Con fondos',
  'sin-fondos': 'Sin fondos',
  'bloqueado': 'Bloqueado'
};

const PersonSummaryCard = ({ person, onSelect }) => {
  const today = dayjs.utc().startOf('day');
  const lunch = person.lunch || {};
  const specialPeriod = lunch.specialPeriod || {};
  const hasPeriod = specialPeriod.startDate && specialPeriod.endDate;
  let isPeriodActive = false;
  if (hasPeriod) {
    const start = dayjs.utc(specialPeriod.startDate).startOf('day');
    const end = dayjs.utc(specialPeriod.endDate).startOf('day');
    isPeriodActive = today.isSameOrAfter(start) && today.isSameOrBefore(end);
  }

  const effectiveStatus = isPeriodActive ? 'periodo-activo' : lunch.status;

  const bg = statusColors[effectiveStatus] || '#ffffff';
  const label = statusLabels[effectiveStatus] || effectiveStatus;

  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: '1rem',
        marginBottom: '1rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        backgroundColor: bg
      }}
    >
      {person.photoUrl ? (
        <img
          src={person.photoUrl}
          alt={person.name}
          className="rounded-circle"
          style={{ width: 60, height: 60, objectFit: 'cover' }}
        />
      ) : (
        <div
          className="rounded-circle bg-secondary d-flex align-items-center justify-content-center"
          style={{ width: 60, height: 60, color: '#fff', fontSize: 24 }}
        >
          <span>{person.name ? person.name[0] : '?'}</span>
        </div>
      )}
      <div style={{ flex: 1 }}>
        <p><strong>{person.name}</strong></p>
        <p>ID: {person.entityId}</p>
        <p>Tokens: {lunch.tokens ?? 0}</p>
        <p>Estado: {label}</p>
      </div>
      <button type="button" className="btn btn-outline-secondary" onClick={() => onSelect(person)}>Ver detalles</button>
    </div>
  );
};

export default PersonSummaryCard;
