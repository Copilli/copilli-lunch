import { useState } from 'react';
import dayjs from 'dayjs';
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
    }
  }, [student]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');

      if (actionType === 'tokens') {
        if ((reason === 'pago' || reason === 'justificado') && !note.trim()) {
          alert('La nota es obligatoria para este motivo.');
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
          alert('Debes proporcionar un motivo y una nota para el periodo.');
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

      alert('Cambio registrado correctamente.');
      setTokenAmount(0);
      setNote('');
      setStartDate('');
      setEndDate('');
      setConfirming(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Error al registrar el cambio.');
    } finally {
      setSubmitting(false);
    }
  };

  const showConfirmation = () => {
    if (actionType === 'tokens' && tokenAmount === 0) {
      alert('Especifica una cantidad de tokens.');
      return;
    }
    if (actionType === 'period' && (!startDate || !endDate)) {
      alert('Especifica las fechas de inicio y fin.');
      return;
    }
    setConfirming(true);
  };

  return (
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
            value={tokenAmount}
            onChange={(e) => setTokenAmount(Number(e.target.value))}
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

      {confirming && (
        <div style={{ marginTop: '1rem', border: '1px solid #aaa', padding: '1rem' }}>
          <h5>¿Confirmas esta acción?</h5>
          {actionType === 'tokens' && (
            <p>
              Tokens actuales: {student.tokens} → Total: {student.tokens + tokenAmount}
            </p>
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
      )}
    </div>
  );
};

export default StudentOfficeActions;
