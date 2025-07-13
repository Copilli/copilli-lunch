import { useState } from 'react';
import dayjs from 'dayjs';
import axios from 'axios';

const StudentOfficeActions = ({ student, onUpdate }) => {
  const [actionType, setActionType] = useState('tokens');
  const [tokenAmount, setTokenAmount] = useState(0);
  const [note, setNote] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');

      if (actionType === 'tokens') {
        await axios.post(`${import.meta.env.VITE_API_URL}/token-movements`, {
          studentId: student.studentId,
          change: tokenAmount,
          reason: note?.toLowerCase().includes('ticket') ? 'pago' : 'justificado',
          note
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (actionType === 'period') {
        await axios.patch(`${import.meta.env.VITE_API_URL}/students/${student._id}/period`, {
          startDate,
          endDate
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
          <label>Motivo o ticket (opcional):</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
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