import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Utilidades
const getDaysInMonth = (month, year) => {
  const days = [];
  const total = dayjs(`${year}-${month}-01`).daysInMonth();
  for (let d = 1; d <= total; d++) days.push(d);
  return days;
};

const isInAnyPeriod = (date, logs = []) => {
  return logs.some(period => {
    if (!period.startDate || !period.endDate) return false;
    const d = dayjs.utc(date).startOf('day');
    const start = dayjs.utc(period.startDate).startOf('day');
    const end = dayjs.utc(period.endDate).startOf('day');
    return d.isSameOrAfter(start) && d.isSameOrBefore(end);
  });
};

// Componente que pinta la tabla del calendario
const StudentCalendarTable = ({ students, movements, periodLogs = [], invalidDates = [], month, year }) => {
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

  const CalendarLegend = () => (
    <div className="d-flex justify-content-start align-items-center gap-3 mb-2 flex-wrap">
      <span>
        <span style={{ width: 16, height: 16, backgroundColor: '#c1f0c1', border: '1px solid #ccc', display: 'inline-block', marginRight: 5 }} />
        Periodo activo
      </span>
      <span>
        <span style={{ width: 16, height: 16, backgroundColor: '#add8e6', border: '1px solid #ccc', display: 'inline-block', marginRight: 5 }} />
        Uso normal
      </span>
      <span>
        <span style={{ width: 16, height: 16, backgroundColor: '#ffb3b3', border: '1px solid #ccc', display: 'inline-block', marginRight: 5 }} />
        Consumo con deuda
      </span>
      <span>
        <span style={{ width: 16, height: 16, backgroundColor: '#d9d9d9', border: '1px solid #ccc', display: 'inline-block', marginRight: 5 }} />
        Dia sin clases
      </span>
    </div>
  );

  return (
    <>
      <CalendarLegend />
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
                if (!tokenMap[dateKey]) tokenMap[dateKey] = [];
                tokenMap[dateKey].push(m);
              });

              const logs = periodLogsMap[student.studentId] || [];

              return (
                <tr key={student.studentId}>
                  <td className="fw-bold text-start">{student.name}</td>
                  {days.map(d => {
                    const dayStr = String(d).padStart(2, '0');
                    const monthStr = String(selectedMonth).padStart(2, '0');
                    const currentDate = dayjs.utc(`${selectedYear}-${monthStr}-${dayStr}`).startOf('day').format('YYYY-MM-DD');
                    const movementsForDay = tokenMap[currentDate] || [];
                    const movement = movementsForDay.find(m => m.reason === 'uso-con-deuda') || movementsForDay.find(m => m.reason === 'uso');
                    const inPeriod = isInAnyPeriod(currentDate, logs);
                    const isInvalid = invalidDates.includes(currentDate);
                    let bg = '';

                    if (isInvalid) {
                      bg = '#d9d9d9'; // Gris claro
                    } else if (movement?.reason === 'uso-con-deuda') {
                      bg = '#ffb3b3'; // Rojo suave
                    } else if (movement?.reason === 'uso') {
                      bg = '#add8e6'; // Azul claro
                    } else if (inPeriod) {
                      bg = '#c1f0c1'; // Verde claro
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
    </>
  );
};

// Componente que hace fetch y aplica filtros
export const StudentCalendarContainer = ({ month, year, selectedStudent, currentGroup }) => {
  const [students, setStudents] = useState([]);
  const [movements, setMovements] = useState([]);
  const [periodLogs, setPeriodLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invalidDates, setInvalidDates] = useState([]);

  const token = localStorage.getItem('token');
  const API = import.meta.env.VITE_API_URL;

  const fetchInvalidDates = async () => {
    const res = await axios.get(`${API}/invalid-dates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setInvalidDates(res.data.map(d => dayjs(d.date).format('YYYY-MM-DD')));
  };

  const fetchAllPeriodLogs = async (students) => {
    const allLogs = await Promise.all(
      students.map(async (s) => {
        try {
          const res = await axios.get(`${API}/students/${s.studentId}/period-logs`, {
            headers: { Authorization: `Bearer ${token}` },
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
        await fetchInvalidDates();

        setLoading(false);
      } catch (err) {
        console.error('Error al cargar los datos:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) return <p>Cargando calendario...</p>;

  let visibleStudents = students;
  if (selectedStudent) {
    visibleStudents = students.filter(s => s.studentId === selectedStudent.studentId);
  } else if (currentGroup) {
    visibleStudents = students.filter(
      s => s.group?.name === currentGroup.name && s.group?.level === currentGroup.level
    );
  }

  const visibleMovements = movements.filter(m =>
    visibleStudents.some(s => s.studentId === m.studentId)
  );

  const visiblePeriodLogs = periodLogs.filter(p =>
    visibleStudents.some(s => s.studentId === p.studentId)
  );

  return (
    <StudentCalendarTable
      students={visibleStudents}
      movements={visibleMovements}
      periodLogs={visiblePeriodLogs}
      invalidDates={invalidDates}
      month={month}
      year={year}
    />
  );
};

export default StudentCalendarTable;
