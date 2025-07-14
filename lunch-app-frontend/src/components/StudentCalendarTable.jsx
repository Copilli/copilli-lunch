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

const StudentCalendarTable = ({ students, movements, periodLogsMap = {}, month, year }) => {
  const selectedMonth = month ?? dayjs().month() + 1;
  const selectedYear = year ?? dayjs().year();
  const days = getDaysInMonth(selectedMonth, selectedYear);

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
            const studentMovs = movements
              .filter(m => m.studentId === student.studentId)
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
                    bg = '#add8e6'; // azul
                  } else if (movement?.reason === 'uso-con-deuda') {
                    bg = '#ffb3b3'; // rojo
                  } else if (inPeriod) {
                    bg = '#c1f0c1'; // verde
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
