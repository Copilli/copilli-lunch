import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

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
          {students.map(student => {
            // reconstrucción de tokens por día
            let runningTokens = 0;
            const studentMovs = movements
              .filter(m => m.studentId === student.studentId)
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            const tokenMap = {};
            studentMovs.forEach(m => {
              const date = dayjs(m.timestamp).format('YYYY-MM-DD');
              runningTokens += m.change;
              tokenMap[date] = { ...m, runningTokens };
            });

            return (
              <tr key={student.studentId}>
                <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                {days.map(d => {
                  const date = dayjs(`${selectedYear}-${selectedMonth}-${d}`).format('YYYY-MM-DD');
                  const movement = tokenMap[date];
                  const inPeriod = isInPeriod(date, student.specialPeriod);

                  let bg = '';
                  if (movement && movement.reason === 'uso') {
                    bg = movement.runningTokens < 0 ? '#ffb3b3' : '#add8e6';
                  } else if (inPeriod) {
                    bg = '#c1f0c1';
                  }

                  return (
                    <td key={d} style={{ backgroundColor: bg, textAlign: 'center' }}>
                      {bg ? '✓' : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StudentCalendarTable;
