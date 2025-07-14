import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

//
// 🔧 Utilidades
//

const getDaysInMonth = (month, year) => {
  const days = [];
  const total = dayjs(`${year}-${month}-01`).daysInMonth();
  for (let d = 1; d <= total; d++) {
    days.push(d);
  }
  return days;
};

const isInAnyPeriod = (date, logs = []) => {
  return logs.some(period => {
    if (!period.startDate || !period.endDate) return false;
    const d = dayjs(date).startOf('day');
    const start = dayjs(period.startDate).startOf('day');
    const end = dayjs(period.endDate).startOf('day');
    return d.isSameOrAfter(start) && d.isSameOrBefore(end);
  });
};

//
// 📦 Componente 1: Solo pinta la tabla
//

const StudentCalendarTable = ({ students, movements, periodLogs = [], month, year }) => {
  const selectedMonth = month;
  const selectedYear = year;
  const days = getDaysInMonth(selectedMonth, selectedYear);

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

//
// 🚀 Componente 2: Hace fetch de datos y muestra la tabla
//

const StudentCalendarContainer = ({ month, year }) => {
  const [students, setStudents] = useState([]);
  const [movements, setMovements] = useState([]);
  const [periodLogs, setPeriodLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const API = import.meta.env.VITE_API_URL;

  const fetchAllPeriodLogs = async (students) => {
    const allLogs = await Promise.all(
      students.map(async (s) => {
        try {
          const res = await axios.get(`${API}/students/${s.studentId}/period-logs`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          return res.data.map(log => ({ ...log, studentId: s.studentId }));
        } catch (err) {
          console.error(`Error al obtener logs de ${s.studentId}`, err);
          return [];
        }
      })
    );
    return allLogs.flat();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sRes, mRes] = await Promise.all([
          axios.get(`${API}/students`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API}/token-movements`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);

        const studentsData = sRes.data;
        const movementsData = mRes.data;
        const periodLogsData = await fetchAllPeriodLogs(studentsData);

        setStudents(studentsData);
        setMovements(movementsData);
        setPeriodLogs(periodLogsData);
        setLoading(false);
      } catch (err) {
        console.error('Error al cargar los datos:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) return <p>Cargando calendario...</p>;

  return (
    <StudentCalendarTable
      students={students}
      movements={movements}
      periodLogs={periodLogs}
      month={month}
      year={year}
    />
  );
};

export default StudentCalendarContainer;
