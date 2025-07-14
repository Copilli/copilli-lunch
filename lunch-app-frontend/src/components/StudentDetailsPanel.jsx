import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

const statusLabels = {
  'con-fondos': 'success',
  'sin-fondos': 'warning',
  'bloqueado': 'danger',
  'periodo-activo': 'primary'
};

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
  const [visibleMovements, setVisibleMovements] = useState(5);
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
      setVisibleMovements(5);
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
        userRole: user?.role || 'admin'
      }, {
        headers: { Authorization: `Bearer ${token}` }
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

  const handleLoadMore = () => {
    setVisibleMovements(prev => prev + 5);
  };

  return (
  <div className="container mt-4">
    <div className="card shadow-sm mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h4 className="mb-0">Detalle del alumno</h4>
        <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cerrar</button>
      </div>
      <div className="card-body">

        <div className="row mb-3">
          <div className="col-auto">
            <img
              src={form.photoUrl}
              alt={form.name}
              className="rounded-circle"
              style={{ width: 100, height: 100, objectFit: 'cover' }}
            />
          </div>
          <div className="col">
            <label className="form-label">URL de la foto:</label>
            <input
              type="text"
              className="form-control"
              value={form.photoUrl}
              onChange={(e) => handleChange('photoUrl', e.target.value)}
              disabled={isReadOnly}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">ID del estudiante:</label>
          <input type="text" className="form-control" value={form.studentId} disabled />
        </div>

        <div className="mb-3">
          <label className="form-label">Nombre:</label>
          <input
            type="text"
            className="form-control"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div className="mb-3 row">
          <div className="col-md-6">
            <label className="form-label">Nivel:</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nivel"
              value={form.group.level}
              onChange={(e) => handleChange('group.level', e.target.value)}
              disabled={isReadOnly}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Nombre del grupo:</label>
            <input
              type="text"
              className="form-control"
              placeholder="Grupo"
              value={form.group.name}
              onChange={(e) => handleChange('group.name', e.target.value)}
              disabled={isReadOnly}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">Status:</label>
          {form.hasSpecialPeriod ? (
            <input
              type="text"
              className="form-control-plaintext text-muted fst-italic"
              value="periodo-activo"
              disabled
            />
          ) : (
            <select
              className="form-select"
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              disabled={isReadOnly}
            >
              <option value="con-fondos">Con fondos</option>
              <option value="sin-fondos">Sin fondos</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label">Tokens actuales:</label>
          <input
            type="number"
            className="form-control bg-light text-muted"
            value={form.tokens}
            disabled
          />
        </div>

        {isAdmin && (
          <div className="form-text mb-3">
            Para modificar los tokens, utiliza la sección "Ajustar tokens manualmente" más abajo.
          </div>
        )}

        <div className="form-check mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="hasSpecialPeriod"
            checked={form.hasSpecialPeriod}
            onChange={(e) => handleChange('hasSpecialPeriod', e.target.checked)}
            disabled={isReadOnly}
          />
          <label className="form-check-label" htmlFor="hasSpecialPeriod">
            ¿Tiene periodo especial activo?
          </label>
        </div>

        {form.hasSpecialPeriod && (
          <>
            <div className="mb-3 row">
              <div className="col-md-6">
                <label className="form-label">Inicio:</label>
                <input
                  type="date"
                  className="form-control"
                  value={dayjs(form.specialPeriod?.startDate).format('YYYY-MM-DD')}
                  onChange={(e) => handleSpecialPeriodChange('startDate', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Fin:</label>
                <input
                  type="date"
                  className="form-control"
                  value={dayjs(form.specialPeriod?.endDate).format('YYYY-MM-DD')}
                  onChange={(e) => handleSpecialPeriodChange('endDate', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {!isReadOnly && (
              <>
                <div className="mb-3">
                  <label className="form-label">Motivo del periodo:</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Motivo"
                    value={periodReason}
                    onChange={(e) => setPeriodReason(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Nota:</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Justificación o comentario"
                    value={periodNote}
                    onChange={(e) => setPeriodNote(e.target.value)}
                  ></textarea>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  </div>
  );
};

export default StudentDetailsPanel;
