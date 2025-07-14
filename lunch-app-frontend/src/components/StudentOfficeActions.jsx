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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setConfirming(false);
      }
    };

    if (confirming) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirming]);

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
      {/* Alerta flotante de error */}
      {formError && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#f44336',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          zIndex: 9999,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        }}>
          {formError}
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: 8 }}>
        <h4>Acciones de oficina</h4>

        <label>Tipo de acción: </label>
        <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
          <option value="tokens">Agregar tokens</option>
          <option value="period">Agregar periodo</option>
        </select>

        {actionType === 'tokens' && (
          <div style={{ marginTop: '1rem' }}>
            <label>Cantidad de tokens:</label>
            <input
              type="number"
              min="0"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(Math.max(0, Number(e.target.value)))}
              style={{ width: '100%' }}
            />

            <label>Motivo:</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="pago">Pago</option>
              <option value="justificado">Justificado</option>
              {canUseAjusteManual && <option value="ajuste manual">Ajuste manual</option>}
            </select>

            <label>Nota:</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Especifica detalles o ticket"
              style={{ width: '100%' }}
            />
          </div>
        )}

        {actionType === 'period' && (
          <div style={{ marginTop: '1rem' }}>
            <label>Fecha inicio:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <label>Fecha fin:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />

            <label>Motivo:</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="pago">Pago</option>
              <option value="justificado">Justificado</option>
              {canUseAjusteManual && <option value="ajuste manual">Ajuste manual</option>}
            </select>

            <label>Nota:</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Especifica detalles o ticket"
              style={{ width: '100%' }}
            />
          </div>
        )}

        <button onClick={showConfirmation} style={{ marginTop: '1rem' }}>
          Confirmar acción
        </button>
      </div>

      {confirming && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            {/* Botón de cerrar (X) */}
            <button
              onClick={() => setConfirming(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer'
              }}
              aria-label="Cerrar modal"
            >
              ❌
            </button>

            <h5>¿Confirmas esta acción?</h5>
            {actionType === 'tokens' && (
              <p>Tokens actuales: {student.tokens} → Total: {student.tokens + tokenAmount}</p>
            )}
            {actionType === 'period' && (
              <p>Periodo: {startDate} a {endDate}</p>
            )}
            <p><strong>Motivo:</strong> {reason}</p>
            <p><strong>Nota:</strong> {note}</p>

            <button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Sí, registrar'}
            </button>
            <button onClick={() => setConfirming(false)} style={{ marginLeft: '1rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentOfficeActions;
