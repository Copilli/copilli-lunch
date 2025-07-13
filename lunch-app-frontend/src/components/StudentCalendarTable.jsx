import dayjs from 'dayjs';

const getDaysInMonth = (month, year) => {
  const days = [];
  const total = dayjs(`${year}-${month}-01`).daysInMonth();
  for (let d = 1; d <= total; d++) {
    days.push(d);
  }
  return days;
};

const isInPeriod = (date, period) => {
  if (!period || !period.startDate || !period.endDate) return false;
  return (
    dayjs(date).isSameOrAfter(dayjs(period.startDate), 'day') &&
    dayjs(date).isSameOrBefore(dayjs(period.endDate), 'day')
  );
};

const StudentCalendarTable = ({ students, movements, month, year }) => {
  const selectedMonth = month ?? dayjs().month() + 1;
  const selectedYear = year ?? dayjs().year();
  const days = getDaysInMonth(selectedMonth, selectedYear);
  const now = dayjs(); // ✅ define 'now'

  // Map de movimientos por studentId
  const movementMap = {};
  movements.forEach(m => {
    const date = dayjs(m.timestamp).format('YYYY-MM-DD');
    if (!movementMap[m.studentId]) movementMap[m.studentId] = {};
    movementMap[m.studentId][date] = m;
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Alumno</th>
            {days.map(d => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.studentId}>
              <td style={{ fontWeight: 'bold' }}>{student.name}</td>
              {days.map(d => {
                const date = dayjs(`${selectedYear}-${selectedMonth}-${d}`).format('YYYY-MM-DD');
                const movement = movementMap[student.studentId]?.[date];
                const inPeriod = isInPeriod(date, student.specialPeriod);

                let bg = '';
                if (movement && movement.reason === 'uso') {
                  bg = movement.change < 0 ? '#ffb3b3' : '#add8e6'; // rojo o azul
                } else if (inPeriod) {
                  bg = '#c1f0c1'; // verde
                }

                return (
                  <td key={d} style={{ backgroundColor: bg, textAlign: 'center' }}>
                    {bg ? '✓' : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentCalendarTable;
