// src/components/PersonLunchActions.jsx
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
dayjs.extend(isSameOrBefore);

function getPricesForPerson(person) {
  if (!person) return { priceToken: 0, pricePeriod: 0 };
  const level = (person.level || '').toLowerCase();
  const groupName = person.groupName || '';

  const groupNameUpper = groupName.toUpperCase();

  if (level === 'preescolar') {
    return { priceToken: 44, pricePeriod: 40 };
  }
  if (level === 'secundaria') {
    return { priceToken: 62, pricePeriod: 52 };
  }
  if (level === 'primaria') {
    if (/^[1-3]/.test(groupNameUpper)) {
      return { priceToken: 50, pricePeriod: 44 };
    }
    if (/^[4-6]/.test(groupNameUpper)) {
      return { priceToken: 57, pricePeriod: 47 };
    }
    // Grupo no válido: usar el precio más alto de primaria
    return { priceToken: 57, pricePeriod: 47 };
  }
    // Grupo no válido: usar el precio más alto de secundaria
    return { priceToken: 62, pricePeriod: 52 };
}

const PersonLunchActions = ({ person, onUpdate }) => {
  const [actionType, setActionType] = useState('tokens');

  // Input numérico como string (permite borrar/editar libremente)
  const [tokenAmountStr, setTokenAmountStr] = useState('1'); // por defecto 1
  const tokenAmountNum = Number.parseInt(tokenAmountStr, 10) || 0;
  const [tokenInputError, setTokenInputError] = useState('');

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

  const resetFields = () => {
    setActionType('tokens');
    setTokenAmountStr('1'); // volver a 1
    setTokenInputError('');
    setReason('pago');
    setNote('');
    setStartDate(null);
    setEndDate(null);
    setConsumptionDate(null);
    setConsumptionReason('');
    setSubmitting(false);
    setFormError('');
  };

  useEffect(() => {
    if (!person) {
      resetFields();
    } else {
      if (!isAdmin) setReason('pago');
    }
  }, [person, isAdmin]);

  // Cargar días inválidos y normalizarlos a medianoche
  useEffect(() => {
    const fetchInvalidDates = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/invalid-dates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const toMidnight = (d) => {
        const raw = typeof d === 'string' ? d : d?.date;
        return dayjs(raw).startOf('day').toDate();
      };
      setInvalidDates(res.data.map(toMidnight));
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

  // Helpers para invalid dates
  const isInvalidDay = (date) =>
    invalidDates.some(d => dayjs(d).isSame(dayjs(date), 'day'));
  const filterValidDate = (date) => !isInvalidDay(date);
  const dayClassName = (date) => (isInvalidDay(date) ? 'rdp-invalid-day' : undefined);

  const getValidDaysCount = (start, end) => {
    if (!start || !end) return 0;
    let valid = 0;
    let c = dayjs(start);
    const e = dayjs(end);
    while (c.isSameOrBefore(e, 'day')) {
      if (!isInvalidDay(c)) valid++;
      c = c.add(1, 'day');
    }
    return valid;
  };

  // Totales para confirmación
  const validDaysForPeriod = useMemo(
    () => getValidDaysCount(startDate, endDate),
    [startDate, endDate, invalidDates]
  );
  const prices = useMemo(() => {
    const result = getPricesForPerson(person);
    if (!result) return { priceToken: 62, pricePeriod: 52 };
    return result;
  }, [person]);
  const priceToken = prices.priceToken;
  const pricePeriod = prices.pricePeriod;
  const totalForTokens = useMemo(
    () => (reason === 'pago' ? tokenAmountNum * priceToken : 0),
    [tokenAmountNum, reason, priceToken]
  );
  const totalForPeriod = useMemo(
    () => (reason === 'pago' ? validDaysForPeriod * pricePeriod : 0),
    [validDaysForPeriod, reason, pricePeriod]
  );

  const closeModal = () => {
    setConfirming(false);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      if (actionType === 'tokens') {
        if (!isAdmin && reason !== 'pago') {
          showError('Solo los administradores pueden usar ese motivo.');
          closeModal();
          return;
        }
        if (tokenAmountNum <= 0) {
          showError('Especifica una cantidad de tokens mayor a 0.');
          closeModal();
          return;
        }
        if (reason !== 'pago' && !note.trim()) {
          showError('La nota es obligatoria para este motivo.');
          closeModal();
          return;
        }

        const resp = await axios.patch(
          `${API}/lunch/${person.lunch._id}/tokens`,
          {
            delta: tokenAmountNum,
            reason,
            note, // opcional para pago
            performedBy: user?.username || 'desconocido',
            userRole: user?.role || 'oficina'
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const ticket = resp?.data?.paymentTicket;
        const amount = resp?.data?.paymentAmount;
        showSuccess(ticket ? `Pago registrado. Ticket: ${ticket} ($${amount})` : 'Tokens actualizados correctamente.');

        setTokenAmountStr('1'); // vuelve a 1 tras éxito
        setNote('');
        onUpdate && onUpdate();

      } else if (actionType === 'period') {
        if (!isAdmin && reason !== 'pago') {
          showError('Solo los administradores pueden usar ese motivo.');
          closeModal();
          return;
        }
        if (!startDate || !endDate) {
          showError('Especifica las fechas de inicio y fin.');
          closeModal();
          return;
        }
        if (isInvalidDay(startDate) || isInvalidDay(endDate)) {
          showError('La fecha de inicio o fin no puede ser un día inválido.');
          closeModal();
          return;
        }
        if (validDaysForPeriod < 5) {
          showError('El periodo debe tener al menos 5 días válidos.');
          closeModal();
          return;
        }
        if (reason !== 'pago' && !note.trim()) {
          showError('La nota es obligatoria para este motivo.');
          closeModal();
          return;
        }

        const resp = await axios.patch(
          `${API}/lunch/${person.lunch._id}/period`,
          {
            startDate,
            endDate,
            reason,
            note,
            performedBy: user?.username || 'desconocido',
            userRole: user?.role || 'oficina'
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const ticket = resp?.data?.paymentTicket;
        const amount = resp?.data?.paymentAmount;
        showSuccess(ticket ? `Periodo registrado. Ticket: ${ticket} ($${amount})` : 'Periodo especial registrado correctamente.');

        setNote('');
        setStartDate(null);
        setEndDate(null);
        onUpdate && onUpdate();


      } else if (actionType === 'manual-consumption') {
        if (!consumptionDate || !consumptionReason) {
          showError('Debes seleccionar motivo y fecha para registrar el consumo.');
          closeModal();
          return;
        }

        await axios.post(
          `${API}/lunch/${person.lunch._id}/use`,
          {
            reason: consumptionReason,
            note: `Consumo manual (${dayjs(consumptionDate).format('YYYY-MM-DD')})`,
            performedBy: user?.username || 'admin',
            userRole: user?.role || 'admin',
            customDate: dayjs(consumptionDate).startOf('day').toISOString()
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        showSuccess('Consumo manual registrado correctamente.');
        setConsumptionDate(null);
        setConsumptionReason('');
        onUpdate && onUpdate();
      }

      closeModal();
    } catch (err) {
      console.error(err);
      const backendError = err?.response?.data?.error || err?.response?.data?.message;
      showError(backendError || 'Error al registrar el cambio.');
      closeModal();
    } finally {
      setSubmitting(false);
    }
  };

  const showConfirmation = () => {
    if (actionType === 'tokens') {
      if (!tokenAmountStr || tokenInputError || tokenAmountNum <= 0) {
        showError(tokenInputError || 'Especifica una cantidad válida de tokens.');
        return;
      }
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

  if (!person) return null;

  return (
    <>
      {formError && (
        <div
          className="alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3 z-3"
          role="alert"
          style={{ zIndex: 9999 }}
        >
          {formError}
        </div>
      )}
      {successMsg && (
        <div
          className="alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3 z-3"
          role="alert"
          style={{ zIndex: 9999 }}
        >
          {successMsg}
        </div>
      )}

      <div className="mt-4 p-3 border rounded">
        <h4>Ajustar desayunos</h4>

        <div className="mb-3">
          <label className="form-label">Tipo de acción:</label>
          <select
            className="form-select"
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
          >
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
                type="text"
                className={`form-control ${tokenInputError ? 'is-invalid' : ''}`}
                value={tokenAmountStr}
                inputMode="numeric"
                onChange={(e) => {
                  const v = e.target.value;

                  // permitir vacío temporal para que el usuario pueda borrar y teclear
                  if (v === '') {
                    setTokenAmountStr('');
                    setTokenInputError('Especifica una cantidad de tokens.');
                    return;
                  }

                  // solo dígitos
                  if (/^\d+$/.test(v)) {
                    setTokenAmountStr(v);
                    if (parseInt(v, 10) <= 0) {
                      setTokenInputError('Debe ser un número mayor a 0.');
                    } else {
                      setTokenInputError('');
                    }
                  } else {
                    setTokenAmountStr(v); // mantener lo escrito para feedback
                    setTokenInputError('Solo se permiten números.');
                  }
                }}
              />
              {tokenInputError && (
                <div className="invalid-feedback">{tokenInputError}</div>
              )}
            </div>

            <div className="mb-3">
              <div className="mb-3 d-flex align-items-center gap-2">
                <label className="form-label mb-0">Motivo:</label>
                {isAdmin ? (
                  <select
                    className="form-select"
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
                filterDate={filterValidDate}
                dayClassName={dayClassName}
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
                filterDate={filterValidDate}
                dayClassName={dayClassName}
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
                filterDate={filterValidDate}
                dayClassName={dayClassName}
                excludeDates={invalidDates}
                dateFormat="yyyy-MM-dd"
                className="form-control"
                placeholderText="Selecciona una fecha válida"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Motivo:</label>
              <select
                className="form-select"
                value={consumptionReason}
                onChange={(e) => setConsumptionReason(e.target.value)}
              >
                <option value="">Selecciona</option>
                <option value="uso">Uso</option>
                <option value="uso-con-deuda">Uso con deuda</option>
              </select>
            </div>
          </>
        )}

        <button
          className="btn btn-primary"
          onClick={showConfirmation}
          disabled={
            (actionType === 'tokens' && (!!tokenInputError || tokenAmountNum <= 0))
          }
        >
          Confirmar acción
        </button>
      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      {confirming && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4">
              <div className="modal-header">
                <h5 className="modal-title">¿Confirmas esta acción?</h5>
                <button type="button" className="btn-close" onClick={closeModal} />
              </div>
              <div className="modal-body">
                {actionType === 'tokens' && (
                  <>
                    <p>Tokens actuales: {person.lunch?.tokens ?? 0} → Total: {(person.lunch?.tokens ?? 0) + tokenAmountNum}</p>
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
                    <p><strong>Motivo:</strong> {consumptionReason || '—'}</p>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal}>
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

export default PersonLunchActions;
