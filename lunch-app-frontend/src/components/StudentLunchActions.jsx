// src/pages/StudentLunchActions.jsx
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
dayjs.extend(isSameOrBefore);

const PRICE_PER_TOKEN = 40; // solo display (BE es la fuente real)
const PRICE_PER_DAY = 35;   // solo display

const StudentLunchActions = ({ student, onUpdate }) => {
  const [actionType, setActionType] = useState('tokens');
  const [tokenAmount, setTokenAmount] = useState(0);
  const [reason, setReason] = useState('pago');
  const [note, setNote] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [consumptionDate, setConsumptionDate] = useState(null);
  const [consumptionReason, setConsumptionReason] = useState('');
  const [invalidDates, setInvalidDates] = useState([]);

  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user?.role === 'admin';
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!student) {
      setActionType('tokens');
      setTokenAmount(0);
      setReason('pago');
      setNote('');
      setStartDate(null);
      setEndDate(null);
      setConsumptionDate(null);
      setConsumptionReason('');
      setConfirming(false);
      setSubmitting(false);
      setFormError('');
    } else {
      if (!isAdmin) setReason('pago');
    }
  }, [student, isAdmin]);

  useEffect(() => {
    const fetchInvalidDates = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/invalid-dates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvalidDates(res.data.map(d => dayjs(d.date).toDate()));
    };
    fetchInvalidDates();
  }, [API]);

  const showError = (msg) => {
    setFormError(msg);
    setTimeout(() => setFormError(''), 3000);
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const isDateInvalid = (date) => {
    if (!date) return false;
    return invalidDates.some(d => dayjs(d).isSame(dayjs(date), 'day'));
  };

  const getValidDaysCount = (start, end) => {
    if (!start || !end) return 0;
    let valid = 0;
    let c = dayjs(start);
    const e = dayjs(end);
    while (c.isSameOrBefore(e, 'day')) {
      if (!invalidDates.some(d => dayjs(d).isSame(c, 'day'))) valid++;
      c = c.add(1, 'day');
    }
    return valid;
  };

  // Totales para mostrar en confirmación
  const validDaysForPeriod = useMemo(() => getValidDaysCount(startDate, endDate), [startDate, endDate, invalidDates]);
  const totalForTokens = useMemo(() => (reason === 'pago' ? tokenAmount * PRICE_PER_TOKEN : 0), [tokenAmount, reason]);
  const totalForPeriod = useMemo(() => (reason === 'pago' ? validDaysForPeriod * PRICE_PER_DAY : 0), [validDaysForPeriod, reason]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      if (actionType === 'tokens') {
        if (!isAdmin && reason !== 'pago') {
          showError('Solo los administradores pueden usar ese motivo.');
          setSubmitting(false);
          return;
        }
        if (tokenAmount <= 0) {
          showError('Especifica una cantidad de tokens mayor a 0.');
          setSubmitting(false);
          return;
        }
        // Para no-pago exigimos nota
        if (reason !== 'pago' && !note.trim()) {
          showError('La nota es obligatoria para este motivo.');
          setSubmitting(false);
          return;
        }

        const resp = await axios.patch(`${API}/students/${student._id}/tokens`, {
          delta: tokenAmount,
          reason,
          note, // opcional para pago
          performedBy: user?.username || 'desconocido',
          userRole: user?.role || 'oficina'
        }, { headers: { Authorization: `Bearer ${token}` } });

        const ticket = resp?.data?.paymentTicket;
        const amount = resp?.data?.paymentAmount;
        showSuccess(ticket ? `Pago registrado. Ticket: ${ticket} ($${amount})` : 'Tokens actualizados correctamente.');
        setConfirming(false);

      } else if (actionType === 'period') {
        if (!isAdmin && reason !== 'pago') {
          showError('Solo los administradores pueden usar ese motivo.');
          setSubmitting(false);
          return;
        }
        if (!startDate || !endDate) {
          showError('Especifica las fechas de inicio y fin.');
          setSubmitting(false);
          return;
        }
        if (isDateInvalid(startDate) || isDateInvalid(endDate)) {
          showError('La fecha de inicio o fin no puede ser un día inválido.');
          setSubmitting(false);
          return;
        }
        if (validDaysForPeriod < 5) {
          showError('El periodo debe tener al menos 5 días válidos.');
          setSubmitting(false);
          return;
        }
        // Para no-pago exigimos nota
        if (reason !== 'pago' && !note.trim()) {
          showError('La nota es obligatoria para este motivo.');
          setSubmitting(false);
          return;
        }

        const resp = await axios.patch(`${API}/students/${student._id}/period`, {
          startDate,
          endDate,
          reason,
          note,
          performedBy: user?.username || 'desconocido',
          userRole: user?.role || 'oficina'
        }, { headers: { Authorization: `Bearer ${token}` } });

        const ticket = resp?.data?.paymentTicket;
        const amount = resp?.data?.paymentAmount;
        showSuccess(ticket ? `Periodo registrado. Ticket: ${ticket} ($${amount})` : 'Periodo especial registrado correctamente.');
        setConfirming(false);

      } else if (actionType === 'manual-consumption') {
        if (!consumptionDate || !consumptionReason) {
          showError('Debes seleccionar motivo y fecha para registrar el consumo.');
          setSubmitting(false);
          return;
        }

        await axios.patch(`${API}/students/${student._id}/tokens`, {
          delta: -1,
          reason: consumptionReason,
          note: `Consumo manual (${dayjs(consumptionDate).format('YYYY-MM-DD')})`,
          performedBy: user?.username || 'admin',
          userRole: user?.role || 'admin',
          customDate: dayjs(consumptionDate).startOf('day').toISOString()
        }, { headers: { Authorization: `Bearer ${token}` } });

        showSuccess('Consumo manual registrado correctamente.');
        setConfirming(false);
      }

      // reset
      setFormError('');
      setTokenAmount(0);
      setNote('');
      setStartDate(null);
      setEndDate(null);
      setConsumptionDate(null);
      setConsumptionReason('');
      onUpdate && onUpdate();

    } catch (err) {
      console.error(err);
      const backendError = err?.response?.data?.error || err?.response?.data?.message;
      showError(backendError || 'Error al registrar el cambio.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  const showConfirmation = () => {
    if (actionType === 'tokens' && tokenAmount === 0) {
      showError('Especifica una cantidad de tokens.');
      return;
    }
    if (actionType === 'period' && (!startDate || !endDate)) {
      showError('Especifica las fechas de inicio y fin.');
      return;
    }
    if (actionType === 'manual-consumption' && (!consumptionDate || !consumptionReason)) {
      showError('Debes seleccionar motivo y fecha para registrar el consumo.');
      return;
    }
    setFormError('');
    setConfirming(true);
  };

  if (!student) return null;

  return (
    <>
      {formError && (
        <div className="alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3 z-3" role="alert" style={{ zIndex: 9999 }}>
          {formError}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3 z-3" role="alert" style={{ zIndex: 9999 }}>
          {successMsg}
        </div>
      )}

      <div className="mt-4 p-3 border rounded">
        <h4>Ajustar desayunos</h4>

        <div className="mb-3">
          <label className="form-label">Tipo de acción:</label>
          <select className="form-select" value={actionType} onChange={(e) => setActionType(e.target.value)}>
            <option value="tokens">Agregar tokens</option>
            <option value="period">Agregar periodo</option>
            {isAdmin && <option value="manual-consumption">Registrar consumo faltante</option>}
          </select>
        </div>

        {actionType === 'tokens' && (
          <>
            <div className="mb-3">
              <label className="form-label">Cantidad de tokens:</label>
              <input
                type="number"
                className="form-control"
                min="0"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(Math.max(0, Number(e.target.value)))}
              />
            </div>

            <div className="mb-3">
              <div className="mb-3 d-flex align-items-center gap-2">
                <label className="form-label mb-0">Motivo:</label>
                {isAdmin ? (
                  <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value="pago">Pago</option>
                    <option value="justificado">Justificado</option>
                    <option value="ajuste manual">Ajuste manual</option>
                  </select>
                ) : (
                  <span className="form-control-plaintext mb-0">Pago</span>
                )}
              </div>
            </div>

            {reason !== 'pago' && (
              <div className="mb-3">
                <label className="form-label">Nota:</label>
                <textarea
                  className="form-control"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Especifica detalles"
                />
              </div>
            )}
          </>
        )}

        {actionType === 'period' && (
          <>
            <div className="mb-3">
              <label className="form-label">Fecha inicio:</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                excludeDates={invalidDates}
                dateFormat="yyyy-MM-dd"
                className="form-control"
                placeholderText="Selecciona una fecha válida"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Fecha fin:</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                excludeDates={invalidDates}
                dateFormat="yyyy-MM-dd"
                className="form-control"
                placeholderText="Selecciona una fecha válida"
              />
            </div>

            <div className="mb-3 d-flex align-items-center gap-2">
              <label className="form-label mb-0 me-1">Motivo:</label>
              {isAdmin ? (
                <select
                  className="form-select w-auto"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="pago">Pago</option>
                  <option value="justificado">Justificado</option>
                  <option value="ajuste manual">Ajuste manual</option>
                </select>
              ) : (
                <span className="form-control-plaintext mb-0">Pago</span>
              )}
            </div>

            {reason !== 'pago' && (
              <div className="mb-3">
                <label className="form-label">Nota:</label>
                <textarea
                  className="form-control"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Especifica detalles"
                />
              </div>
            )}
          </>
        )}

        {actionType === 'manual-consumption' && (
          <>
            <div className="mb-3">
              <label className="form-label">Fecha del consumo:</label>
              <DatePicker
                selected={consumptionDate}
                onChange={(date) => setConsumptionDate(date)}
                excludeDates={invalidDates}
                dateFormat="yyyy-MM-dd"
                className="form-control"
                placeholderText="Selecciona una fecha válida"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Motivo:</label>
              <select className="form-select" value={consumptionReason} onChange={(e) => setConsumptionReason(e.target.value)}>
                <option value="">Selecciona</option>
                <option value="uso">Uso</option>
                <option value="uso-con-deuda">Uso con deuda</option>
              </select>
            </div>
          </>
        )}

        <button className="btn btn-primary" onClick={showConfirmation}>
          Confirmar acción
        </button>
      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      {confirming && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">¿Confirmas esta acción?</h5>
                <button type="button" className="btn-close" onClick={() => setConfirming(false)}></button>
              </div>
              <div className="modal-body">
                {actionType === 'tokens' && (
                  <>
                    <p>Tokens actuales: {student.tokens} → Total: {student.tokens + tokenAmount}</p>
                    <p><strong>Motivo:</strong> {reason}</p>
                    {reason === 'pago' ? (
                      <p className="mb-0"><strong>Total a pagar:</strong> ${totalForTokens}</p>
                    ) : (
                      <p><strong>Nota:</strong> {note || '(sin nota)'}</p>
                    )}
                  </>
                )}

                {actionType === 'period' && (
                  <>
                    <p>Periodo: {startDate ? dayjs(startDate).format('YYYY-MM-DD') : '—'} a {endDate ? dayjs(endDate).format('YYYY-MM-DD') : '—'}</p>
                    <p>Días válidos (sin inválidos): <strong>{validDaysForPeriod}</strong></p>
                    <p><strong>Motivo:</strong> {reason}</p>
                    {reason === 'pago' ? (
                      <p className="mb-0"><strong>Total a pagar:</strong> ${totalForPeriod}</p>
                    ) : (
                      <p><strong>Nota:</strong> {note || '(sin nota)'}</p>
                    )}
                  </>
                )}

                {actionType === 'manual-consumption' && (
                  <>
                    <p>Registrar -1 token por consumo no anotado.</p>
                    <p><strong>Fecha:</strong> {consumptionDate ? dayjs(consumptionDate).format('YYYY-MM-DD') : '—'}</p>
                    <p><strong>Motivo:</strong> {consumptionReason}</p>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirming(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Sí, registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentLunchActions;
