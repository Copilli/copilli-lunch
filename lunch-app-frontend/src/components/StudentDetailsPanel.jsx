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
  const [periodReason, setPeriodReason] = useState('nuevo periodo');
  const [periodNote, setPeriodNote] = useState('');
  const [lastValidStatus, setLastValidStatus] = useState(null);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (student) {
      const today = dayjs().startOf('day');
      const periodEnd = dayjs(student.specialPeriod?.endDate).startOf('day');
      const isExpired = student.hasSpecialPeriod && periodEnd.isBefore(today);

      setForm({
        ...student,
        hasSpecialPeriod: isExpired ? false : student.hasSpecialPeriod,
        specialPeriod: isExpired ? { startDate: null, endDate: null } : student.specialPeriod
      });

      setOriginalTokens(student.tokens);
      setLastValidStatus(student.status);
    }
  }, [student]);

  if (!student || !form) return null;

  const isReadOnly = user?.role === 'oficina';
  const isAdmin = user?.role === 'admin';

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
    } else if (field === 'hasSpecialPeriod' && value === false) {
      setForm(prev => ({
        ...prev,
        hasSpecialPeriod: false,
        specialPeriod: {
          startDate: null,
          endDate: null
        }
      }));
    } else if (field === 'status') {
      if (isReadOnly) return;
      if (value === 'sin-fondos' && form.tokens > 0) {
        alert('No puedes establecer el estado como "sin fondos" si el estudiante tiene tokens.');
        setForm(prev => ({ ...prev, status: lastValidStatus }));
        return;
      }
      setLastValidStatus(value);
      setForm(prev => ({ ...prev, status: value }));
    } else {
      setForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSpecialPeriodChange = (field, value) => {
    if (isReadOnly) return;
    setForm(prev => ({
      ...prev,
      specialPeriod: {
        ...prev.specialPeriod,
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (form.hasSpecialPeriod && (!periodReason.trim() || !periodNote.trim())) {
      alert('Para asignar un periodo especial se requiere un motivo y una nota.');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const tokenDelta = form.tokens - originalTokens;
      if (tokenDelta !== 0 && isAdmin) {
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

      await axios.put(`${import.meta.env.VITE_API_URL}/students/${student._id}`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (form.hasSpecialPeriod) {
        await axios.patch(`${import.meta.env.VITE_API_URL}/students/${student._id}/period`, {
          startDate: form.specialPeriod.startDate,
          endDate: form.specialPeriod.endDate,
          reason: periodReason,
          note: periodNote,
          performedBy: user?.username || 'admin',
          userRole: user?.role || 'admin'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

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

    if (form.status === 'bloqueado' && delta < 0) {
      alert('Este alumno está bloqueado. No se pueden reducir tokens.');
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

  const exportCSV = () => {
    if (!isAdmin) return;

    const header = 'Fecha,Motivo,Nota,Responsable,Cambio\n';
    const rows = studentMovements.map(m => {
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
          disabled={isReadOnly}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <p><strong>ID:</strong> {form.studentId}</p>
        <p><strong>Nombre:</strong><br />
          <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} style={{ width: '100%' }} disabled={isReadOnly} />
        </p>
        <p><strong>Grupo:</strong><br />
          <input type="text" placeholder="Nivel" value={form.group.level} onChange={(e) => handleChange('group.level', e.target.value)} disabled={isReadOnly} /> -
          <input type="text" placeholder="Nombre" value={form.group.name} onChange={(e) => handleChange('group.name', e.target.value)} disabled={isReadOnly} />
        </p>
        <p><strong>Status:</strong><br />
          {form.hasSpecialPeriod ? (
            <input type="text" value="periodo-activo" disabled style={{ width: '100%', fontStyle: 'italic', color: 'gray' }} />
          ) : (
            <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} style={{ width: '100%' }} disabled={isReadOnly}>
              <option value="con-fondos">Con fondos</option>
              <option value="sin-fondos">Sin fondos</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          )}
        </p>
        <p><strong>Tokens actuales:</strong><br />
          <input type="number" value={form.tokens} disabled style={{ width: '100%', backgroundColor: '#f9f9f9', color: 'gray' }} />
        </p>
        {isAdmin && (
          <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: '#555' }}>
            Para modificar los tokens, utiliza la sección "Ajustar tokens manualmente" más abajo.
          </p>
        )}
        <p><strong>Periodo especial activo:</strong><br />
          <input type="checkbox" checked={form.hasSpecialPeriod} onChange={(e) => handleChange('hasSpecialPeriod', e.target.checked)} disabled={isReadOnly} />
        </p>
        {form.hasSpecialPeriod && (
          <>
            <p><strong>Inicio:</strong><br />
              <input type="date" value={dayjs(form.specialPeriod?.startDate).format('YYYY-MM-DD')} onChange={(e) => handleSpecialPeriodChange('startDate', e.target.value)} disabled={isReadOnly} />
            </p>
            <p><strong>Fin:</strong><br />
              <input type="date" value={dayjs(form.specialPeriod?.endDate).format('YYYY-MM-DD')} onChange={(e) => handleSpecialPeriodChange('endDate', e.target.value)} disabled={isReadOnly} />
            </p>
            {!isReadOnly && (
              <>
                <p><strong>Motivo del periodo:</strong><br />
                  <input type="text" value={periodReason} onChange={(e) => setPeriodReason(e.target.value)} placeholder="Motivo" style={{ width: '100%' }} />
                </p>
                <p><strong>Nota del periodo:</strong><br />
                  <textarea value={periodNote} onChange={(e) => setPeriodNote(e.target.value)} placeholder="Justificación o comentario" rows={2} style={{ width: '100%' }} />
                </p>
              </>
            )}
          </>
        )}
      </div>

      {!isReadOnly && (
        <>
          <button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>

          <hr style={{ margin: '2rem 0' }} />
          <h4>Ajustar tokens manualmente</h4>
          <div>
            <label>Cantidad (+/-):</label>
            <input type="number" value={delta} onChange={(e) => setDelta(parseInt(e.target.value))} style={{ width: '60px', marginRight: '1rem' }} />
            <label>Motivo:</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="pago">Pago</option>
              <option value="justificado">Justificado</option>
              {isAdmin && <option value="ajuste manual">Ajuste manual</option>}
            </select>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label>Nota:</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalle o justificación" style={{ width: '100%' }} />
          </div>
          <button onClick={handleTokenChange} style={{ marginTop: '1rem' }}>Aplicar cambio de tokens</button>
        </>
      )}

      {isAdmin && (
        <button onClick={exportCSV} style={{ marginTop: '1rem', marginLeft: '1rem' }}>
          Exportar historial a CSV
        </button>
      )}

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
