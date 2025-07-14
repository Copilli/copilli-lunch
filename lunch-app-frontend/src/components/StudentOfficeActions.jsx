import { useEffect, useState } from 'react';
import axios from 'axios';

const StudentOfficeActions = ({ student, onUpdate }) => {
  const [actionType, setActionType] = useState('tokens');
  const [tokenAmount, setTokenAmount] = useState(0);
  const [reason, setReason] = useState('pago');
  const [note, setNote] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));
  const canUseAjusteManual = user?.role === 'admin';

  useEffect(() => {
    if (!student) {
      setActionType('tokens');
      setTokenAmount(0);
      setReason('pago');
      setNote('');
      setStartDate('');
      setEndDate('');
      setConfirming(false);
      setSubmitting(false);
      setFormError('');
    }
  }, [student]);

  const showError = (msg) => {
    setFormError(msg);
    setTimeout(() => setFormError(''), 3000);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');

      if (actionType === 'tokens') {
        if ((reason === 'pago' || reason === 'justificado') && !note.trim()) {
          showError('La nota es obligatoria para este motivo.');
          setSubmitting(false);
          return;
        }

        await axios.patch(`${import.meta.env.VITE_API_URL}/students/${student._id}/tokens`, {
          delta: tokenAmount,
          reason,
          note,
          performedBy: user?.username || 'desconocido',
          userRole: user?.role || 'oficina'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (actionType === 'period') {
        if (!note.trim() || !reason.trim()) {
          showError('Debes proporcionar un motivo y una nota para el periodo.');
          setSubmitting(false);
          return;
        }

        await axios.patch(`${import.meta.env.VITE_API_URL}/students/${student._id}/period`, {
          startDate,
          endDate,
          reason,
          note,
          performedBy: user?.username || 'desconocido',
          userRole: user?.role || 'oficina'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setFormError('');
      setTokenAmount(0);
      setNote('');
      setStartDate('');
      setEndDate('');
      setConfirming(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      showError('Error al registrar el cambio.');
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

    setFormError('');
    setConfirming(true);
  };

  return (
    <>
      {/* Alerta flotante con Bootstrap */}
      {formError && (
        <div className="alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3 z-3" role="alert" style={{ zIndex: 9999 }}>
          {formError}
        </div>
      )}

      <div className="mt-4 p-3 border rounded">
        <h4>Ajustar desayunos</h4>

        <div className="mb-3">
          <label className="form-label">Tipo de acción:</label>
          <select className="form-select" value={actionType} onChange={(e) => setActionType(e.target.value)}>
            <option value="tokens">Agregar tokens</option>
            <option value="period">Agregar periodo</option>
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
              <label className="form-label">Motivo:</label>
              <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="pago">Pago</option>
                <option value="justificado">Justificado</option>
                {canUseAjusteManual && <option value="ajuste manual">Ajuste manual</option>}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">Nota:</label>
              <textarea
                className="form-control"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Especifica detalles o ticket"
              />
            </div>
          </>
        )}

        {actionType === 'period' && (
          <>
            <div className="mb-3">
              <label className="form-label">Fecha inicio:</label>
              <input
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Fecha fin:</label>
              <input
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Motivo:</label>
              <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="pago">Pago</option>
                <option value="justificado">Justificado</option>
                {canUseAjusteManual && <option value="ajuste manual">Ajuste manual</option>}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">Nota:</label>
              <textarea
                className="form-control"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Especifica detalles o ticket"
              />
            </div>
          </>
        )}

        <button className="btn btn-primary" onClick={showConfirmation}>
          Confirmar acción
        </button>
      </div>

      {/* Modal Bootstrap-like */}
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
                  <p>Tokens actuales: {student.tokens} → Total: {student.tokens + tokenAmount}</p>
                )}
                {actionType === 'period' && (
                  <p>Periodo: {startDate} a {endDate}</p>
                )}
                <p><strong>Motivo:</strong> {reason}</p>
                <p><strong>Nota:</strong> {note}</p>
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

export default StudentOfficeActions;
