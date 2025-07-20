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

const StudentSummaryCard = ({ student, onSelect }) => {
  const today = dayjs.utc().startOf('day');
  const start = dayjs.utc(student.specialPeriod?.startDate).startOf('day');
  const end = dayjs.utc(student.specialPeriod?.endDate).startOf('day');

  const isPeriodActive = student.specialPeriod?.startDate && student.specialPeriod?.endDate &&
    today.isSameOrAfter(start) && today.isSameOrBefore(end);

  const effectiveStatus = isPeriodActive ? 'periodo-activo' : student.status;

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
      <img
        src={student.photoUrl}
        alt={student.name}
        style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }}
      />
      <div style={{ flex: 1 }}>
        <p><strong>{student.name}</strong></p>
        <p>ID: {student.studentId}</p>
        <p>Tokens: {student.tokens}</p>
        <p>Estado: {label}</p>
      </div>
      <button onClick={() => onSelect(student)}>Ver detalles</button>
    </div>
  );
};

export default StudentSummaryCard;
