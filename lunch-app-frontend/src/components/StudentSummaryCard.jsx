import dayjs from 'dayjs';

const StudentSummaryCard = ({ student, onSelect }) => {
  const inPeriod =
    student.hasSpecialPeriod &&
    dayjs().isSameOrAfter(dayjs(student.specialPeriod.startDate)) &&
    dayjs().isSameOrBefore(dayjs(student.specialPeriod.endDate));

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
        backgroundColor: '#f5f5f5'
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
        <p>Periodo: {inPeriod ? '✅ Activo' : '—'}</p>
      </div>
      <button onClick={() => onSelect(student)}>Ver detalles</button>
    </div>
  );
};

export default StudentSummaryCard;
