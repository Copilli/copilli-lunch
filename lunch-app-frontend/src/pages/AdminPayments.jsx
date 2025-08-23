// src/pages/AdminPayments.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import TopNavBar from '../components/TopNavBar';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'America/Mexico_City';
const currency = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

export default function AdminPayments() {
  const API = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Fechas (local CDMX)
  const [from, setFrom] = useState(dayjs().tz(TZ).format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().tz(TZ).format('YYYY-MM-DD'));
  const [studentId, setStudentId] = useState('');

  // Datos
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Resumen
  const [groupBy, setGroupBy] = useState('day'); // 'day' | 'student'
  const [summary, setSummary] = useState([]);
  const [overallTotal, setOverallTotal] = useState(0);

  // Convierte días locales a ISO (UTC) cubriendo todo el día local
  const rangeToISO = (fromDay, toDay) => ({
    fromISO: dayjs.tz(fromDay, 'YYYY-MM-DD', TZ).startOf('day').toISOString(),
    toISO: dayjs.tz(toDay, 'YYYY-MM-DD', TZ).endOf('day').toISOString(),
  });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { fromISO, toISO } = rangeToISO(from, to);
      const { data } = await axios.get(`${API}/payments`, {
        params: { from: fromISO, to: toISO, studentId: studentId || undefined },
        headers,
      });
      setRows(data.payments || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const { fromISO, toISO } = rangeToISO(from, to);
      const { data } = await axios.get(`${API}/payments/summary`, {
        params: { from: fromISO, to: toISO, groupBy, tz: TZ },
        headers,
      });
      setSummary(data.rows || []);
      setOverallTotal(data.overallTotal || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async () => {
    // valida rango
    const { fromISO, toISO } = rangeToISO(from, to);
    if (new Date(fromISO) > new Date(toISO)) {
      alert('La fecha "Desde" no puede ser mayor que "Hasta".');
      return;
    }
    await fetchPayments();
    await fetchSummary();
  };

  const resendPending = async () => {
    try {
      const { fromISO, toISO } = rangeToISO(from, to);
      const { data } = await axios.post(
        `${API}/payments/resend-mails`,
        { from: fromISO, to: toISO, studentId: studentId || undefined },
        { headers }
      );
      alert(`Reenviados: ${data.sent} / Intentados: ${data.attempted}`);
      handleSearch();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Error al reenviar correos pendientes');
    }
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const header = 'Fecha,Ticket,Alumno,Monto,Correo Enviado,Nota\n';
    const lines = rows.map((r) => {
      const fecha = dayjs(r.date).tz(TZ).format('YYYY-MM-DD HH:mm');
      const ticket = r.ticketNumber;
      const alumno = r.studentId;
      const monto = r.amount;
      const mail = r.sentEmail ? 'Sí' : 'No';
      const nota = r?.tokenMovementId?.note?.replace(/[\r\n,]/g, ' ') || '';
      return `${fecha},${ticket},${alumno},${monto},${mail},${nota}`;
    });
    const blob = new Blob([header + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Carga inicial (día actual)
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-actualiza SOLO el resumen cuando cambia el agrupador (Día/Alumno)
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy]);

  return (
    <>
      <TopNavBar />

      <div className="container py-3">
        <div className="d-flex align-items-center mb-3">
          <h4 className="mb-0">Pagos</h4>
          <div className="ms-auto d-flex gap-2">
            <button
              className="btn btn-outline-secondary"
              onClick={exportCSV}
              disabled={!rows.length}
            >
              Exportar CSV
            </button>
            <button className="btn btn-outline-secondary" onClick={resendPending}>
              Reenviar correos pendientes
            </button>
          </div>
        </div>

        {/* Filtros (no auto-buscan; esperan a "Buscar") */}
        <form
          className="row g-2 mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <div className="col-12 col-md-3">
            <label className="form-label">Desde</label>
            <input
              type="date"
              className="form-control"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label">Hasta</label>
            <input
              type="date"
              className="form-control"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label">Alumno (studentId)</label>
            <input
              type="text"
              className="form-control"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="col-12 col-md-3 d-flex align-items-end">
            <button className="btn btn-primary w-100" type="submit" disabled={loading}>
              {loading ? 'Cargando...' : 'Buscar'}
            </button>
          </div>
        </form>

        {/* Encabezado de resumen */}
        <div className="d-flex align-items-center mb-2">
          <span className="badge bg-success fs-6">Total: {currency(total)}</span>
          <div className="ms-auto d-flex align-items-center gap-2">
            <span className="text-muted">Resumen por:</span>
            <select
              className="form-select form-select-sm"
              style={{ width: 160 }}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="day">Día</option>
              <option value="student">Alumno</option>
            </select>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="table-responsive mb-4">
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>{groupBy === 'student' ? 'Alumno' : 'Fecha'}</th>
                <th>Total</th>
                <th>Pagos</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r, idx) => (
                <tr key={idx}>
                  <td>
                    {groupBy === 'student' ? (
                      <Link
                        to={`/admin?studentId=${encodeURIComponent(r.studentId)}`}
                        className="link-primary"
                      >
                        {r.studentId}
                      </Link>
                    ) : (
                      dayjs(r.date).tz(TZ).format('YYYY-MM-DD')
                    )}
                  </td>
                  <td>{currency(r.total)}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
              {!summary.length && (
                <tr>
                  <td colSpan="3" className="text-center text-muted">
                    Sin datos de resumen.
                  </td>
                </tr>
              )}
            </tbody>
            {summary.length > 0 && (
              <tfoot>
                <tr>
                  <th>Total periodo</th>
                  <th>{currency(overallTotal)}</th>
                  <th></th>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* LISTA DE PAGOS */}
        <div className="table-responsive">
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Fecha</th>
                <th>Ticket</th>
                <th>Alumno</th>
                <th>Monto</th>
                <th>Correo</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {dayjs(r.date).tz(TZ).format('YYYY-MM-DD HH:mm')}
                  </td>
                  <td>{r.ticketNumber}</td>
                  <td>
                    <Link
                      to={`/admin?studentId=${encodeURIComponent(r.studentId)}`}
                      className="link-primary"
                    >
                      {r.studentId}
                    </Link>
                  </td>
                  <td>{currency(r.amount)}</td>
                  <td>{r.sentEmail ? 'Enviado' : 'Pendiente'}</td>
                  <td>{r?.tokenMovementId?.note || ''}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
                    Sin pagos en el rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
