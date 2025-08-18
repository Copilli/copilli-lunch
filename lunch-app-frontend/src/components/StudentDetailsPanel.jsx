import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import StudentLunchActions from './StudentLunchActions';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

const StudentDetailsPanel = ({ student, movements, onClose, fetchStudents, fetchMovements }) => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [originalTokens, setOriginalTokens] = useState(0);
  const [lastValidStatus, setLastValidStatus] = useState(null);
  const [visibleMovements, setVisibleMovements] = useState(5);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [invalidDates, setInvalidDates] = useState([]);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    if (student) {
      const today = dayjs.utc().startOf('day');
      const periodStart = dayjs.utc(student.specialPeriod?.startDate).startOf('day');
      const periodEnd = dayjs.utc(student.specialPeriod?.endDate).startOf('day');

      const periodExists = !!(student.specialPeriod?.startDate && student.specialPeriod?.endDate);
      const isActive = periodExists && today.isSameOrAfter(periodStart) && today.isSameOrBefore(periodEnd);

      setForm({
        ...student,
        specialPeriod: {
          startDate: student.specialPeriod?.startDate || null,
          endDate: student.specialPeriod?.endDate || null
        },
        hasSpecialPeriod: isActive
      });

      setOriginalTokens(student.tokens);
      setLastValidStatus(student.status);
      setVisibleMovements(5);
    }
  }, [student]);

  useEffect(() => {
    const fetchInvalidDates = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/invalid-dates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvalidDates(res.data.map(d => dayjs(d.date).format('YYYY-MM-DD')));
    };
    fetchInvalidDates();
  }, []);

  if (!student || !form) return null;

  const isReadOnly = user?.role === 'oficina';
  const isAdmin = user?.role === 'admin';

  const studentMovements = movements
    .filter(m => m.studentId === student.studentId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const showError = (msg) => {
    setFormError(msg);
    setTimeout(() => setFormError(''), 3000);
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const isDateInvalid = (date) => invalidDates.includes(dayjs(date).format('YYYY-MM-DD'));

  const handleChange = (field, value) => {
    if (field.startsWith('group.')) {
      setForm(prev => ({
        ...prev,
        group: {
          ...prev.group,
          [field.split('.')[1]]: value
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

  const handleSave = async () => {
    // Validar fechas inválidas en el periodo especial
    if (form.hasSpecialPeriod && (isDateInvalid(form.specialPeriod?.startDate) || isDateInvalid(form.specialPeriod?.endDate))
    ) {
      showError('El periodo especial tiene fechas no válidas.');
      return;
    }

    // Validar que haya al menos 5 días válidos si hay periodo especial
    if (form.hasSpecialPeriod && form.specialPeriod?.startDate && form.specialPeriod?.endDate) {
      const validCount = getValidDaysCount(form.specialPeriod.startDate, form.specialPeriod.endDate);
      if (validCount < 5) {
        showError('El periodo especial debe tener al menos 5 días válidos.');
        return;
      }
    }

    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const tokenDelta = form.tokens - originalTokens;

      // Si hay ajuste de tokens y es admin
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

      // Guardar cambios generales del estudiante (incluye email)
      await axios.put(`${import.meta.env.VITE_API_URL}/students/${student._id}`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showSuccess('Estudiante actualizado.');
    } catch (err) {
      console.error(err);
      showError('Error al guardar cambios.');
    } finally {
      setSaving(false);
    }
  };

  const getValidDaysCount = (start, end) => {
    if (!start || !end) return 0;
    const s = dayjs(start).startOf('day');
    const e = dayjs(end).startOf('day');
    let c = s;
    let valid = 0;
    while (c.isSameOrBefore(e, 'day')) {
      if (!isDateInvalid(c)) valid++;
      c = c.add(1, 'day');
    }
    return valid;
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

  const handleLoadMore = () => setVisibleMovements(prev => prev + 5);

  const handleDeletePeriod = async () => {
    if (!form.hasSpecialPeriod) return;
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/students/${student._id}/period`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForm(prev => ({
        ...prev,
        hasSpecialPeriod: false,
        specialPeriod: { startDate: null, endDate: null }
      }));
      if (fetchStudents) fetchStudents();
      if (fetchMovements) fetchMovements();
      showSuccess('Periodo especial eliminado.');
    } catch (err) {
      console.error(err);
      showError('Error al eliminar el periodo especial.');
    } finally {
      setSaving(false);
    }
  };

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

      <div className="card mt-4">
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

          {/* NUEVO: Email para envío de tickets */}
          <div className="mb-3">
            <label className="form-label">Email (para tickets):</label>
            <input
              type="email"
              className="form-control"
              value={form.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              disabled={isReadOnly}
              placeholder="padre@mimail.com"
            />
            <div className="form-text">Se usará para enviar el ticket de pago.</div>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Nivel:</label>
              <input
                type="text"
                className="form-control"
                value={form.group.level}
                onChange={(e) => handleChange('group.level', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Grupo:</label>
              <input
                type="text"
                className="form-control"
                value={form.group.name}
                onChange={(e) => handleChange('group.name', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Estado:</label>
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
            <input type="number" className="form-control bg-light text-muted" value={form.tokens} disabled />
          </div>

          {isAdmin && (
            <div className="form-text mb-3">
              Para modificar los tokens, utiliza la sección "Ajustar desayunos" más abajo.
            </div>
          )}

          {form.hasSpecialPeriod && (
            <>
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label">Inicio:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dayjs.utc(form.specialPeriod?.startDate).format('YYYY-MM-DD')}
                    disabled
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Fin:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dayjs.utc(form.specialPeriod?.endDate).format('YYYY-MM-DD')}
                    disabled
                  />
                </div>
              </div>
              <div className="form-text mb-3">
                Para modificar un periodo, utiliza la sección "Ajustar desayunos" más abajo.
              </div>
              {isAdmin && (
                <div className="row mb-3">
                  <button
                    className="btn btn-outline-danger mb-3"
                    onClick={handleDeletePeriod}
                    disabled={saving}
                  >
                    {saving ? 'Eliminando...' : 'Eliminar periodo especial'}
                  </button>
                </div>
              )}
            </>
          )}

          {isAdmin && (
            <div className="row mb-3">
              <button className="btn btn-primary mb-3" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      </div>

      <StudentLunchActions
        student={student}
        onUpdate={() => {
          if (fetchStudents) fetchStudents();
          if (fetchMovements) fetchMovements();
        }}
      />

      <div className="card mt-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Historial de movimientos</h5>
            {isAdmin && (
              <button className="btn btn-outline-success" onClick={exportCSV}>
                Exportar historial a CSV
              </button>
            )}
          </div>

          {studentMovements.length === 0 && <p>No hay transacciones registradas.</p>}
          {studentMovements.slice(0, visibleMovements).map((m, i) => (
            <div key={i} className="border rounded p-3 mb-2 bg-light">
              <p><strong>Fecha:</strong> {dayjs.utc(m.timestamp).local().format('DD/MM/YYYY HH:mm')}</p>
              <p><strong>Motivo:</strong> {m.reason}</p>
              {m.note && <p><strong>Nota:</strong> {m.note}</p>}
              <p><strong>Responsable:</strong> {m.performedBy} ({m.userRole})</p>
              <p><strong>Cambio:</strong> {m.change > 0 ? '+' : ''}{m.change}</p>
            </div>
          ))}
          {visibleMovements < studentMovements.length && (
            <button className="btn btn-outline-secondary mt-2" onClick={handleLoadMore}>
              Cargar más
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default StudentDetailsPanel;
