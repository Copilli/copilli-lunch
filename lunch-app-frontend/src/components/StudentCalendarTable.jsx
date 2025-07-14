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

const isInAnyPeriod = (date, logs = []) => {
  return logs.some(period =>
    dayjs(date).isSameOrAfter(dayjs(period.startDate), 'day') &&
    dayjs(date).isSameOrBefore(dayjs(period.endDate), 'day')
  );
};

const StudentCalendarTable = ({ students, movements, periodLogs = [], month, year }) => {
  const selectedMonth = month ?? dayjs().month() + 1;
  const selectedYear = year ?? dayjs().year();
  const days = getDaysInMonth(selectedMonth, selectedYear);

  // Construye el mapa de logs por studentId
  const periodLogsMap = Array.isArray(periodLogs)
    ? periodLogs.reduce((acc, log) => {
        if (!acc[log.studentId]) acc[log.studentId] = [];
        acc[log.studentId].push(log);
        return acc;
      }, {})
    : periodLogs;

  return (
    <div className="table-responsive">
      <table className="table table-bordered table-sm text-center">
        <thead className="table-light">
          <tr>
            <th>Alumno</th>
            {days.map(d => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map(student => {
            // Debug: muestra los ids
            // console.log('Student:', student.studentId, 'Movements:', movements.map(m => m.studentId));

            // Fuerza ambos a string para evitar problemas de tipo
            const studentMovs = movements
              .filter(m => String(m.studentId) === String(student.studentId))
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            const tokenMap = {};
            studentMovs.forEach(m => {
              const dateKey = dayjs(m.timestamp).startOf('day').format('YYYY-MM-DD');
              tokenMap[dateKey] = m;
            });

            const logs = periodLogsMap[student.studentId] || [];

            return (
              <tr key={student.studentId}>
                <td className="fw-bold text-start">{student.name}</td>
                {days.map(d => {
                  const dayStr = String(d).padStart(2, '0');
                  const monthStr = String(selectedMonth).padStart(2, '0');
                  const currentDate = dayjs(`${selectedYear}-${monthStr}-${dayStr}`).startOf('day').format('YYYY-MM-DD');

                  const movement = tokenMap[currentDate];
                  const inPeriod = isInAnyPeriod(currentDate, logs);

                  let bg = '';
                  if (movement?.reason === 'uso') {
                    bg = movement.change < 0 ? '#ffb3b3' : '#add8e6';
                  } else if (inPeriod) {
                    bg = '#c1f0c1';
                  }

                  return (
                    <td key={d} style={{ backgroundColor: bg }}>
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
