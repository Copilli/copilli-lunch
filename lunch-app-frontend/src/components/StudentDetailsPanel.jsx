import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const StudentDetailsPanel = ({ student, movements, onClose }) => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [originalTokens, setOriginalTokens] = useState(0);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('pago');
  const [note, setNote] = useState('');
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (student) {
      setForm({ ...student });
      setOriginalTokens(student.tokens);
    }
  }, [student]);

  if (!student || !form) return null;

  const studentMovements = movements
    .filter(m => m.studentId === student.studentId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const handleChange = (field, value) => {
    if (field.startsWith('group.')) {
      setForm(prev => ({
        ...prev,
        group: {
          ...prev.group,
          [field.split('.')[1]]: value
        }
      }));
    } else {
      setForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSpecialPeriodChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      specialPeriod: {
        ...prev.specialPeriod,
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      // PATCH if tokens changed
      const tokenDelta = form.tokens - originalTokens;
      if (tokenDelta !== 0) {
        await axios.patch(`${import.meta.env.VITE_API_URL}/students/${student._id}/tokens`, {
          delta: tokenDelta,
          reason: 'ajuste manual',
          note: 'ajuste desde panel admin',
          performedBy: user?.username || 'admin',
          userRole: user?.role || 'admin'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // PUT to update the rest
      await axios.put(`${import.meta.env.VITE_API_URL}/students/${student._id}`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Estudiante actualizado.');
    } catch (err) {
      console.error(err);
      alert('Error al guardar cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleTokenChange = async () => {
    if ((reason === 'pago' || reason === 'justificado') && !note.trim()) {
      alert('La nota es obligatoria para este motivo.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${import.meta.env.VITE_API_URL}/students/${student._id}/tokens`, {
        delta,
        reason,
        note,
        performedBy: user?.username || 'admin',
        userRole: user?.role || 'admin',
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Tokens actualizados.');
      setDelta(0);
      setNote('');
    } catch (err) {
      console.error(err);
      alert('Error al actualizar tokens.');
    }
  };

  const exportCSV = (student, movimientos) => {
    const header = 'Fecha,Motivo,Nota,Responsable,Cambio\n';
    const rows = movimientos.map(m => {
      const fecha = dayjs(m.timestamp).format('YYYY-MM-DD HH:mm');
      const motivo = m.reason;
      const nota = m.note?.replace(/,/g, ';') || '';
      const responsable = `${m.performedBy} (${m.userRole})`;
      const cambio = m.change;
      return `${fecha},${motivo},${nota},${responsable},${cambio}`;
    });

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${student.studentId}_historial.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3>Detalle del alumno</h3>
        <button onClick={onClose}>Cerrar</button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <img
          src={form.photoUrl}
          alt={form.name}
          style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover' }}
        />
        <input
          type="text"
          value={form.photoUrl}
          onChange={(e) => handleChange('photoUrl', e.target.value)}
          placeholder="URL de la foto"
          style={{ flex: 1 }}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <p><strong>ID:</strong> {form.studentId}</p>
        <p>
          <strong>Nombre:</strong><br />
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            style={{ width: '100%' }}
          />
        </p>
        <p>
          <strong>Grupo:</strong><br />
          <input
            type="text"
            placeholder="Nivel"
            value={form.group.level}
            onChange={(e) => handleChange('group.level', e.target.value)}
          />{' '}-{' '}
          <input
            type="text"
            placeholder="Nombre"
            value={form.group.name}
            onChange={(e) => handleChange('group.name', e.target.value)}
          />
        </p>
        <p>
          <strong>Status:</strong><br />
          <input
            type="text"
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
          />
        </p>
        <p>
          <strong>Tokens:</strong><br />
          <input
            type="number"
            value={form.tokens}
            onChange={(e) => handleChange('tokens', parseInt(e.target.value))}
          />
        </p>
        <p>
          <strong>Periodo especial activo:</strong><br />
          <input
            type="checkbox"
            checked={form.hasSpecialPeriod}
            onChange={(e) => handleChange('hasSpecialPeriod', e.target.checked)}
          />
        </p>
        {form.hasSpecialPeriod && (
          <>
            <p>
              <strong>Inicio:</strong><br />
              <input
                type="date"
                value={dayjs(form.specialPeriod?.startDate).format('YYYY-MM-DD')}
                onChange={(e) => handleSpecialPeriodChange('startDate', e.target.value)}
              />
            </p>
            <p>
              <strong>Fin:</strong><br />
              <input
                type="date"
                value={dayjs(form.specialPeriod?.endDate).format('YYYY-MM-DD')}
                onChange={(e) => handleSpecialPeriodChange('endDate', e.target.value)}
              />
            </p>
          </>
        )}
      </div>

      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* Ajuste de tokens desde panel */}
      <hr style={{ margin: '2rem 0' }} />
      <h4>Ajustar tokens manualmente</h4>
      <div>
        <label>Cantidad (+/-):</label>
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(parseInt(e.target.value))}
          style={{ width: '60px', marginRight: '1rem' }}
        />

        <label>Motivo:</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="pago">Pago</option>
          <option value="justificado">Justificado</option>
          {user?.role === 'admin' && <option value="ajuste manual">Ajuste manual</option>}
        </select>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <label>Nota:</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Detalle o justificación"
          style={{ width: '100%' }}
        />
      </div>

      <button onClick={handleTokenChange} style={{ marginTop: '1rem' }}>
        Aplicar cambio de tokens
      </button>

      <button onClick={() => exportCSV(student, studentMovements)} style={{ marginTop: '1rem', marginLeft: '1rem' }}>
        Exportar historial a CSV
      </button>

      <hr style={{ margin: '1rem 0' }} />
      <h4>Historial de movimientos</h4>

      {studentMovements.length === 0 && <p>No hay transacciones registradas.</p>}
      {studentMovements.map((m, i) => (
        <div key={i} style={{
          border: '1px solid #ddd',
          borderRadius: 6,
          padding: '0.5rem',
          marginBottom: '0.5rem',
          backgroundColor: '#f5f5f5'
        }}>
          <p><strong>Fecha:</strong> {dayjs(m.timestamp).format('DD/MM/YYYY HH:mm')}</p>
          <p><strong>Motivo:</strong> {m.reason}</p>
          {m.note && <p><strong>Nota:</strong> {m.note}</p>}
          <p><strong>Responsable:</strong> {m.performedBy} ({m.userRole})</p>
          <p><strong>Cambio:</strong> {m.change > 0 ? '+' : ''}{m.change}</p>
        </div>
      ))}
    </div>
  );
};

export default StudentDetailsPanel;
