// src/components/PersonCalendarTable.jsx
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useInvalidDates } from '../context/InvalidDatesContext';
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
const PersonCalendarTable = ({
  persons,
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
      typeof d === 'string' ? d : (
        d.date && typeof d.date === 'string' ? d.date : dayjs(d.date).format('YYYY-MM-DD')
      )
    );
    return new Set(list);
  }, [invalidDates]);

  const invalidReasonMap = useMemo(() => {
    const map = new Map();
    invalidDates.forEach(d => {
      const k = typeof d === 'string' ? d : (
        d.date && typeof d.date === 'string' ? d.date : dayjs(d.date).format('YYYY-MM-DD')
      );
      const r = typeof d === 'string' ? '' : (d.reason || '');
      map.set(k, r);
    });
    return map;
  }, [invalidDates]);

  // agrupa logs por lunchId
  const periodLogsMap = useMemo(() => {
    if (Array.isArray(periodLogs)) {
      return periodLogs.reduce((acc, log) => {
        (acc[log.lunchId] ||= []).push(log);
        return acc;
      }, {});
    }
    return periodLogs || {};
  }, [periodLogs]);

  // tamaños base (coordinados con CSS responsive)
  const CELL_W = 30;        // ancho base de cada día
  const FIRST_COL_W = 220;  // ancho base columna "Persona"

  // minWidth dinámico para forzar/permitir la barra horizontal
  const tableDynamicStyle = {
    minWidth: FIRST_COL_W + (days.length * CELL_W),
    width: 'max-content',
  };

  const CalendarLegend = () => (
    <div className="d-flex justify-content-start align-items-center gap-3 mb-2 flex-wrap">
      <span><span style={{width:16,height:16,background:'#c1f0c1',border:'1px solid #ccc',display:'inline-block',marginRight:6}} />Periodo activo</span>
      <span><span style={{width:16,height:16,background:'#add8e6',border:'1px solid #ccc',display:'inline-block',marginRight:6}} />Uso normal</span>
      <span><span style={{width:16,height:16,background:'#ffb3b3',border:'1px solid #ccc',display:'inline-block',marginRight:6}} />Consumo con deuda</span>
      <span><span style={{width:16,height:16,background:'#b0b0b0',border:'1px solid #ccc',display:'inline-block',marginRight:6}} />Día sin clases</span>
    </div>
  );

  // ...existing code...
  return (
    <>
      <CalendarLegend />
      {/* Viewport + contenedor con scroll horizontal */}
      <div className="calendar-wrap">
        <div className="calendar-scroll-x">
          <table
            className="table table-bordered table-sm text-center mb-0 calendar-table"
            style={tableDynamicStyle}
          >
            <thead className="table-light">
              <tr>
                {/* th "Persona" sticky (CSS global) */}
                <th className="text-start" style={{minWidth: FIRST_COL_W}}>
                  Alumno
                </th>
                {days.map(d => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {persons.map((person) => {
                // movimientos de la persona indexados por YYYY-MM-DD
                const personMovs = movements
                  .filter(m => String(m.entityId) === String(person.entityId))
                  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const tokenByDay = {};
                personMovs.forEach(m => {
                  const k = dayjs(m.timestamp).utc().startOf('day').format('YYYY-MM-DD');
                  (tokenByDay[k] ||= []).push(m);
                });

                const logs = periodLogsMap[person.lunch?._id] || [];

                return (
                  <tr key={person.entityId}>
                    {/* Columna sticky "Persona" (ancho controlado por CSS + minWidth de arriba) */}
                    <td
                      className="fw-bold text-start"
                      title={`${person.name} (${person.entityId})`}
                    >
                      {person.name}
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
                          className="calendar-day-cell"
                          style={{ backgroundColor: bg, minWidth: CELL_W, width: CELL_W }}
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
    </>
  );
};

// ---------- DATA CONTAINER (fetch + filtros de grupo/persona) ----------
export const PersonCalendarContainer = ({ month, year, selectedPerson, currentGroup }) => {
  const [persons, setPersons] = useState([]);
  const [movements, setMovements] = useState([]);
  const [periodLogs, setPeriodLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');
  const API = import.meta.env.VITE_API_URL;
  const { invalidDates, loading: loadingInvalidDates } = useInvalidDates();

  // Solo pide period-logs del usuario seleccionado (o grupo actual)
  const fetchPeriodLogs = async (list) => {
    if (selectedPerson && selectedPerson.lunch?._id) {
      try {
        const res = await axios.get(`${API}/lunch/${selectedPerson.lunch._id}/period-logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return (res.data || []).map(log => ({ ...log, lunchId: selectedPerson.lunch._id }));
      } catch {
        return [];
      }
    } else if (currentGroup) {
      // Si hay grupo seleccionado, usar endpoint batch
      const groupPersons = (list || []).filter(
        p => p.groupName === currentGroup.name && p.level === currentGroup.level && p.lunch?._id && p.entityId
      );
      if (!groupPersons.length) return [];
      const entityIds = groupPersons.map(p => p.entityId).join(',');
      try {
        const res = await axios.get(`${API}/lunch/period-logs?entityIds=${entityIds}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // El resultado es un objeto { entityId: [logs] }
        // Hay que mapear cada log para agregar lunchId
        let logs = [];
        for (const p of groupPersons) {
          const arr = res.data[p.entityId] || [];
          logs = logs.concat(arr.map(log => ({ ...log, lunchId: p.lunch._id })));
        }
        return logs;
      } catch {
        return [];
      }
    }
    return [];
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [pRes, mRes] = await Promise.all([
          axios.get(`${API}/persons?flat=1`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/movements`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const p = pRes.data || [];
        const m = mRes.data || [];
        const logs = await fetchPeriodLogs(p);

        if (!alive) return;
        setPersons(p);
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
  }, [selectedPerson, currentGroup]);

  if (loading || loadingInvalidDates) return <p>Cargando calendario…</p>;

  let visiblePersons = persons;
  if (selectedPerson) {
    visiblePersons = persons.filter(p => p.entityId === selectedPerson.entityId);
  } else if (currentGroup) {
    visiblePersons = persons.filter(
      p => p.groupName === currentGroup.name && p.level === currentGroup.level
    );
  }

  const visibleMovements = movements.filter(m =>
    visiblePersons.some(p => m.entityId === p.entityId)
  );

  const visiblePeriodLogs = periodLogs.filter(p =>
    visiblePersons.some(per => p.lunchId === per.lunch?._id)
  );

  return (
    <PersonCalendarTable
      persons={visiblePersons}
      movements={visibleMovements}
      periodLogs={visiblePeriodLogs}
      invalidDates={invalidDates || []}
      month={month}
      year={year}
    />
  );
};

export default PersonCalendarTable;
