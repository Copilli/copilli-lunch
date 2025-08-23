import { useEffect, useMemo, useState } from 'react';
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

function normalizeHistoryPayload(hist) {
  const arr = Array.isArray(hist) ? hist : hist?.cutoffs || [];
  return arr.map((c) => ({
    _id: c._id,
    amount: c.amount ?? c.total ?? 0,
    from: c.from ?? null,
    to: c.to ?? null,
    createdAt: c.createdAt ?? c.date ?? null,
  }));
}

export default function AdminCutoffs() {
  const API = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [pending, setPending] = useState({ total: 0, from: null, to: null });
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: pend }, { data: hist }] = await Promise.all([
        axios.get(`${API}/cutoffs/pending`, { headers }),
        axios.get(`${API}/cutoffs`, { headers }),
      ]);
      setPending(pend || { total: 0, from: null, to: null });
      setHistory(normalizeHistoryPayload(hist));
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Error al cargar información de cortes');
    } finally {
      setLoading(false);
    }
  };

  const makeCutoff = async () => {
    if (!pending?.total || pending.total <= 0) {
      alert('No hay pagos pendientes para corte.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/cutoffs`, {}, { headers });
      const amount = data.amount ?? data.total ?? 0;
      alert(`Corte registrado por ${currency(amount)}`);
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Error al realizar corte');
    } finally {
      setBusy(false);
    }
  };

  const exportHistoryCSV = () => {
    if (!history.length) return;
    const header = 'Fecha de corte,Monto,Desde,Hasta\n';
    const lines = history.map((c) => {
      const fecha = c.createdAt ? dayjs(c.createdAt).tz(TZ).format('YYYY-MM-DD HH:mm') : '';
      const monto = c.amount ?? 0;
      const desde = c.from ? dayjs(c.from).tz(TZ).format('YYYY-MM-DD HH:mm') : '';
      const hasta = c.to ? dayjs(c.to).tz(TZ).format('YYYY-MM-DD HH:mm') : '';
      return `${fecha},${monto},${desde},${hasta}`;
    });
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortes_${dayjs().tz(TZ).format('YYYYMMDD_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <TopNavBar />

      <div className="container py-3">
        <div className="d-flex align-items-center mb-3 flex-wrap" style={{ gap: 8 }}>
          <h4 className="mb-0 me-auto">Corte de caja</h4>
          <button className="btn btn-outline-secondary" onClick={load} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn btn-outline-secondary" onClick={exportHistoryCSV} disabled={!history.length}>
            Exportar historial CSV
          </button>
        </div>

        <div className="card mb-4">
          <div className="card-body d-flex align-items-center flex-wrap" style={{ gap: 16 }}>
            <div className="badge bg-warning text-dark fs-6">
              Pendiente: {currency(pending.total || 0)}
            </div>
            <div className="text-muted">
              {pending.from && pending.to ? (
                <>Rango: <strong>{dayjs(pending.from).tz(TZ).format('YYYY-MM-DD HH:mm')}</strong> → <strong>{dayjs(pending.to).tz(TZ).format('YYYY-MM-DD HH:mm')}</strong></>
              ) : 'Sin rango pendiente'}
            </div>
            <button
              className="btn btn-danger ms-auto"
              onClick={makeCutoff}
              disabled={busy || !pending.total}
              title={!pending.total ? 'No hay pagos pendientes' : 'Hacer corte'}
            >
              {busy ? 'Procesando...' : 'Hacer corte'}
            </button>
          </div>
        </div>

        <h6>Historial de cortes</h6>
        <div className="table-responsive">
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>Fecha de corte</th>
                <th>Monto</th>
                <th>Desde</th>
                <th>Hasta</th>
              </tr>
            </thead>
            <tbody>
              {history.map((c) => (
                <tr key={c._id}>
                  <td>{c.createdAt ? dayjs(c.createdAt).tz(TZ).format('YYYY-MM-DD HH:mm') : '—'}</td>
                  <td>{currency(c.amount)}</td>
                  <td>{c.from ? dayjs(c.from).tz(TZ).format('YYYY-MM-DD HH:mm') : '—'}</td>
                  <td>{c.to ? dayjs(c.to).tz(TZ).format('YYYY-MM-DD HH:mm') : '—'}</td>
                </tr>
              ))}
              {!history.length && (
                <tr><td colSpan="4" className="text-center text-muted">Sin cortes registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
