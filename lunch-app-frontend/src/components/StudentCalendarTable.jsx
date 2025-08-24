// src/components/StudentCalendarTable.jsx
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Helpers
const getDaysInMonth = (month, year) => {
  const total = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
  return Array.from({ length: total }, (_, i) => i + 1);
};

const isInAnyPeriod = (dateISO, logs = []) => {
  const d = dayjs.utc(dateISO).startOf('day');
  return logs.some(p => {
    if (!p?.startDate || !p?.endDate) return false;
    const start = dayjs.utc(p.startDate).startOf('day');
    const end   = dayjs.utc(p.endDate).startOf('day');
    return d.isSameOrAfter(start) && d.isSameOrBefore(end);
  });
};

// ---------- PRESENTATION TABLE ----------
const StudentCalendarTable = ({
  students,
  movements,
  periodLogs = [],
  invalidDates = [],
  month,
  year,
}) => {
  const days = useMemo(() => getDaysInMonth(month, year), [month, year]);

  // normaliza invalidDates (string o {date, reason})
  const invalidSet = useMemo(() => {
    const list = invalidDates.map(d =>
      typeof d === 'string' ? d : dayjs(d.date).utc().startOf('day').format('YYYY-MM-DD')
    );
    return new Set(list);
  }, [invalidDates]);

  const invalidReasonMap = useMemo(() => {
    const map = new Map();
    invalidDates.forEach(d => {
      const k = typeof d === 'string' ? d : dayjs(d.date).utc().startOf('day').format('YYYY-MM-DD');
      const r = typeof d === 'string' ? '' : (d.reason || '');
      map.set(k, r);
    });
    return map;
  }, [invalidDates]);

  // agrupa logs por estudiante
  const periodLogsMap = useMemo(() => {
    if (Array.isArray(periodLogs)) {
      return periodLogs.reduce((acc, log) => {
        (acc[log.studentId] ||= []).push(log);
        return acc;
      }, {});
    }
    return periodLogs || {};
  }, [periodLogs]);

  const styles = {
    wrap: {
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      overflow: 'hidden',
    },
    scrollX: {
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      overscrollBehaviorX: 'contain',
    },
    table: {
      minWidth: 980, // fuerza scroll horizontal y asegura barra visible
      position: 'relative',
    },
    thDay: {
      whiteSpace: 'nowrap',
      padding: '6px 8px',
      fontSize: 12,
      position: 'sticky',
      top: 0,
      zIndex: 3,
      background: '#f8f9fa',
    },
    thAlumno: {
      position: 'sticky',
      left: 0,
      zIndex: 4,
      background: '#f8f9fa',
      width: 220,
      minWidth: 180,
      maxWidth: 260,
    },
    tdAlumno: {
      position: 'sticky',
      left: 0,
      zIndex: 2,
      background: '#fff',
      width: 220,
      minWidth: 180,
      maxWidth: 260,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    dayCell: {
      width: 30,
      minWidth: 30,
      height: 30,
      padding: 0,
      verticalAlign: 'middle',
      lineHeight: '30px',
      fontSize: 12,
      userSelect: 'none',
    },
    legendDot: (bg) => ({
      width: 16, height: 16, backgroundColor: bg, border: '1px solid #ccc', display: 'inline-block', marginRight: 6
    }),
  };

  const CalendarLegend = () => (
    <div className="d-flex justify-content-start align-items-center gap-3 mb-2 flex-wrap">
      <span><span style={styles.legendDot('#c1f0c1')} />Periodo activo</span>
      <span><span style={styles.legendDot('#add8e6')} />Uso normal</span>
      <span><span style={styles.legendDot('#ffb3b3')} />Consumo con deuda</span>
      <span><span style={styles.legendDot('#b0b0b0')} />Día sin clases</span>
    </div>
  );

  return (
    <>
      <CalendarLegend />

      {/* Solo el grid de días scrollea en X; la columna Alumno queda fija */}
      <div style={styles.wrap}>
        <div style={styles.scrollX} className="table-responsive calendar-scroll-x">
          <table className="table table-bordered table-sm text-center mb-0 calendar-table" style={styles.table}>
            <thead className="table-light">
              <tr>
                <th style={{ ...styles.thDay, ...styles.thAlumno, textAlign: 'left' }}>Alumno</th>
                {days.map(d => (
                  <th key={d} style={styles.thDay}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                // movimientos del alumno indexados por YYYY-MM-DD
                const studentMovs = movements
                  .filter(m => String(m.studentId) === String(student.studentId))
                  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const tokenByDay = {};
                studentMovs.forEach(m => {
                  const k = dayjs(m.timestamp).utc().startOf('day').format('YYYY-MM-DD');
                  (tokenByDay[k] ||= []).push(m);
                });

                const logs = periodLogsMap[student.studentId] || [];

                return (
                  <tr key={student.studentId}>
                    <td
                      className="fw-bold text-start"
                      style={styles.tdAlumno}
                      title={`${student.name} (${student.studentId})`}
                    >
                      {student.name}
                    </td>

                    {days.map(d => {
                      const dayStr   = String(d).padStart(2, '0');
                      const monthStr = String(month).padStart(2, '0');
                      const current  = `${year}-${monthStr}-${dayStr}`;

                      const movement = (tokenByDay[current] || [])
                        .find(m => m.reason === 'uso-con-deuda') ||
                        (tokenByDay[current] || []).find(m => m.reason === 'uso');

                      const inPeriod = isInAnyPeriod(current, logs);
                      const isInvalid = invalidSet.has(current);

                      let bg = '';
                      if (isInvalid) bg = '#b0b0b0';
                      else if (movement?.reason === 'uso-con-deuda') bg = '#ffb3b3';
                      else if (movement?.reason === 'uso')           bg = '#add8e6';
                      else if (inPeriod)                             bg = '#c1f0c1';

                      const title =
                        isInvalid ? (invalidReasonMap.get(current) || 'Día no válido') :
                        movement ? (movement.reason === 'uso-con-deuda' ? 'Consumo con deuda' : 'Uso') :
                        inPeriod ? 'Periodo activo' : '';

                      return (
                        <td
                          key={d}
                          style={{ ...styles.dayCell, backgroundColor: bg }}
                          title={title}
                          aria-label={title}
                        >
                          {(movement || (inPeriod && !isInvalid)) ? '✓' : ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estilos del scroll/barra y compactación móvil */}
      <style>{`
        .calendar-scroll-x {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          scroll-snap-type: x proximity; /* anclajes suaves al deslizar */
        }

        /* Sombra en la columna fija para marcar el "corte" visual */
        .calendar-table th:first-child,
        .calendar-table td:first-child {
          box-shadow: 3px 0 6px rgba(0,0,0,.06);
        }

        /* Compacto en pantallas pequeñas: 1 renglón por alumno */
        @media (max-width: 576px) {
          .calendar-table thead th {
            font-size: 11px;
            padding: 4px 6px;
            white-space: nowrap;
          }
          .calendar-table td {
            height: 26px;
            line-height: 26px;
            padding: 0;
            font-size: 11px;
            white-space: nowrap;
          }
        }
      `}</style>
    </>
  );
};

// ---------- DATA CONTAINER (fetch + filtros de grupo/alumno) ----------
export const StudentCalendarContainer = ({ month, year, selectedStudent, currentGroup }) => {
  const [students, setStudents] = useState([]);
  const [movements, setMovements] = useState([]);
  const [periodLogs, setPeriodLogs] = useState([]);
  const [invalidDates, setInvalidDates] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const API = import.meta.env.VITE_API_URL;

  const fetchInvalidDates = async () => {
    const res = await axios.get(`${API}/invalid-dates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setInvalidDates(res.data || []);
  };

  const fetchAllPeriodLogs = async (list) => {
    const all = await Promise.all(
      (list || []).map(async (s) => {
        try {
          const res = await axios.get(`${API}/students/${s.studentId}/period-logs`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return (res.data || []).map(log => ({ ...log, studentId: s.studentId }));
        } catch {
          return [];
        }
      })
    );
    return all.flat();
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [sRes, mRes] = await Promise.all([
          axios.get(`${API}/students`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/token-movements`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const s = sRes.data || [];
        const m = mRes.data || [];
        const logs = await fetchAllPeriodLogs(s);
        await fetchInvalidDates();

        if (!alive) return;
        setStudents(s);
        setMovements(m);
        setPeriodLogs(logs);
      } catch (e) {
        console.error('Error al cargar calendario:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p>Cargando calendario…</p>;

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
