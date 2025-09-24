// src/pages/CocinaPanel.jsx
import { useEffect, useState } from 'react';
import { useInvalidDates } from '../context/InvalidDatesContext';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import TopNavBar from '../components/TopNavBar';
import SearchBar from '../components/SearchBar';
import LevelCard from '../components/LevelCard';
import GroupCard from '../components/GroupCard';

// Helper para obtener los próximos N días válidos usando el contexto
function getNextValidDates(n = 5, invalidDates = []) {
  let dates = [];
  let day = dayjs();
  const invalidSet = new Set(
    invalidDates.map(d => typeof d === 'string' ? d : (d.dateYMD || d.date?.slice(0, 10) || d.date))
  );
  while (dates.length < n) {
    const dStr = day.format('YYYY-MM-DD');
    if (!invalidSet.has(dStr)) dates.push(dStr);
    day = day.add(1, 'day');
  }
  return dates;
}

const CocinaPanel = ({ setUser }) => {
  const [students, setStudents] = useState([]);
  const [validDates, setValidDates] = useState([]);
  const { invalidDates, loading: loadingInvalidDates, fetchInvalidDates } = useInvalidDates();
  useEffect(() => {
    fetchInvalidDates?.();
    // Solo se llama una vez al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [lunchCounts, setLunchCounts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Vista por búsqueda directa
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Mensajes
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal de confirmación
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingStudent, setPendingStudent] = useState(null); // <- alumno del modal

  const showError = (msg) => {
    setFormError(msg);
    setTimeout(() => setFormError(''), 3000);
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Fetch all persons (flat)
  const fetchStudents = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/persons?flat=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setStudents(res.data);
  };


  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (invalidDates) {
      setValidDates(getNextValidDates(5, invalidDates));
    }
  }, [invalidDates]);

  useEffect(() => {
    if (students.length && validDates.length) {
      // For each valid date, count students with valid period and with tokens
      const counts = validDates.map(date => {
        let periodCount = 0;
        let tokenCount = 0;
        students.forEach(s => {
          const lunch = s.lunch || {};
          const inPeriod = lunch.hasSpecialPeriod &&
            dayjs(date).isSameOrAfter(dayjs(lunch.specialPeriod?.startDate)) &&
            dayjs(date).isSameOrBefore(dayjs(lunch.specialPeriod?.endDate));
          if (inPeriod) {
            periodCount++;
          } else if (lunch.tokens > 0) {
            tokenCount++;
          }
        });
        return { periodCount, tokenCount, total: periodCount + tokenCount };
      });
      setLunchCounts(counts);
    }
  }, [students, validDates]);

  const today = dayjs().format('YYYY-MM-DD');
  const levels = ['preescolar', 'primaria', 'secundaria', 'personal'];

  const filtered = search
    ? students.filter(
        s =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.entityId && s.entityId.toLowerCase().includes(search.toLowerCase()))
      )
    : students;

  const groupsInLevel = selectedLevel
    ? [
        ...new Set(
          filtered
            .filter(
              s =>
                s.level &&
                s.groupName &&
                typeof s.level === 'string' &&
                typeof s.groupName === 'string' &&
                s.level.toLowerCase() === selectedLevel.toLowerCase()
            )
            .map(s => s.groupName)
            .filter(name => !!name)
        ),
      ]
    : [];

  const studentsInGroup = selectedGroup
    ? filtered.filter(
        s =>
          s.level &&
          s.groupName &&
          typeof s.level === 'string' &&
          typeof s.groupName === 'string' &&
          s.level.toLowerCase() === selectedLevel.toLowerCase() &&
          s.groupName === selectedGroup
      )
    : [];

  // Helper para saber si ya tiene consumo ese día
  const hasConsumptionToday = (student) => {
    const lunch = student.lunch || {};
    if (!lunch.movements) return false;
    return lunch.movements.some(mov => {
      const movDate = mov.timestamp ? dayjs(mov.timestamp).format('YYYY-MM-DD') : null;
      return movDate === today && ['uso', 'uso-con-deuda', 'uso-periodo'].includes(mov.reason);
    });
  };

  const getStatus = (student) => {
    const lunch = student.lunch || {};
    const start = lunch.specialPeriod?.startDate ? dayjs(lunch.specialPeriod.startDate) : null;
    const end = lunch.specialPeriod?.endDate ? dayjs(lunch.specialPeriod.endDate) : null;
    const isActivePeriod = start && end && dayjs(today).isSameOrAfter(start) && dayjs(today).isSameOrBefore(end);
    if (isActivePeriod) return 'periodo-activo';
    if (lunch.status === 'bloqueado') return 'bloqueado';
    if (lunch.tokens > 0) return 'con-fondos';
    return 'sin-fondos';
  };

  // Click en tarjeta: para periodo activo, registra consumo especial; para otros, sigue igual
  const handleClick = async (student) => {
    const lunch = student.lunch || {};
    const status = getStatus(student);
    const hasTokens = lunch.tokens > 0;

    if (hasConsumptionToday(student)) {
      showError('Ya se registró consumo para este alumno hoy.');
      return;
    }

    if (status === 'periodo-activo') {
      // Registrar movimiento especial
      if (!lunch._id || !student.entityId) {
        showError('No se encontró el registro de lunch para este estudiante');
        return;
      }
      try {
        const token = localStorage.getItem('token');
        await axios.post(
          `${import.meta.env.VITE_API_URL}/movements`,
          {
            entityId: student.entityId,
            change: 0,
            reason: 'uso-periodo',
            note: 'Consumo con periodo activo',
            performedBy: localStorage.getItem('username') || 'cocina',
            userRole: 'cocina',
            dateAffected: today
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showSuccess('Consumo de periodo activo registrado');
        await fetchStudents();
      } catch (err) {
        console.error(err);
        const backendError = err?.response?.data?.error;
        showError(backendError || 'Error al registrar consumo de periodo activo');
      }
      return;
    }

    if (status === 'bloqueado' && !hasTokens) {
      showError('Este alumno está bloqueado y no tiene tokens. No se puede registrar consumo.');
      return;
    }

    setPendingStudent(student);
    setConfirmMessage(
      hasTokens
        ? `¿Deseas descontar un token? Total final: ${lunch.tokens - 1}`
        : `No tiene tokens ni periodo activo. ¿Deseas registrar el desayuno en negativo? Total final: ${lunch.tokens - 1}`
    );
    setConfirming(true);
  };

  const closeModal = () => {
    setConfirming(false);
    setSubmitting(false);
    setConfirmMessage('');
    setPendingStudent(null); // <- no tocar selectedStudent
  };

  const handleConfirm = async () => {
    const lunch = pendingStudent?.lunch;
    if (!lunch?._id) {
      showError('No se encontró el registro de lunch para este estudiante');
      closeModal();
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/lunch/${lunch._id}/use`,
        { performedBy: localStorage.getItem('username') || 'cocina' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showSuccess('Registro guardado');
      await fetchStudents();

      // Opcional: limpiar la vista de búsqueda directa
      setSelectedStudent(null);
      setSearch('');
    } catch (err) {
      console.error(err);
      const backendError = err?.response?.data?.error;
      showError(backendError || 'Error al registrar consumo');
    } finally {
      closeModal();
    }
  };

  // Colores por estado (cocina)
  const statusColor = {
    'periodo-activo': '#c6f6c6', // verde
    'con-fondos': '#cce5ff',     // azul
    'sin-fondos': '#f8d7da',     // rojo
    'bloqueado': '#c2c2c2'       // gris
  };
  const disabledStyle = {
    opacity: 0.5,
    pointerEvents: 'none'
  };

  const statusLabels = {
    'periodo-activo': 'Periodo activo',
    'con-fondos': 'Con fondos',
    'sin-fondos': 'Sin fondos',
    'bloqueado': 'Bloqueado'
  };

  return (
    <div className="app-container container py-4">
      {/* Título centrado */}
      <h2 className="section-title text-center">Panel de Cocina</h2>

      <TopNavBar setUser={setUser}>
        <SearchBar
          search={search}
          setSearch={setSearch}
          persons={students}
          onSelect={(student) => {
            setSelectedLevel(student.level);
            setSelectedGroup(student.groupName);
            setSelectedStudent(student); // vista de un solo alumno por búsqueda directa
          }}
        />
      </TopNavBar>

      {/* Alerta de conteo de desayunos en formato tabla y en español, con desglose */}
      {validDates.length > 0 && lunchCounts.length === validDates.length && (
        <div className="alert alert-info mt-3 text-center" style={{ fontSize: '1.1rem' }}>
          <strong>Desayunos programados próximos días:</strong>
          <div className="table-responsive mt-2">
            <table className="table table-bordered table-sm mb-0" style={{ background: '#f8f9fa', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Día</th>
                  <th>Periodos (100%)</th>
                  <th>Tokens (?)</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {validDates.map((date, idx) => (
                  <tr key={date}>
                    <td>{dayjs(date).format('DD/MM/YYYY')}</td>
                    <td>{dayjs(date).locale('es').format('dddd')}</td>
                    <td><strong>{lunchCounts[idx].periodCount}</strong></td>
                    <td><strong>{lunchCounts[idx].tokenCount}</strong> <span title="Posible desayuno">?</span></td>
                    <td><strong>{lunchCounts[idx].total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerts */}
      {formError && (
        <div
          className="alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3 z-3 text-center"
          role="alert"
          style={{ zIndex: 9999 }}
        >
          {formError}
        </div>
      )}

      {successMsg && (
        <div
          className="alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3 z-3 text-center"
          role="alert"
          style={{ zIndex: 9999 }}
        >
          {successMsg}
        </div>
      )}

      {/* Modal de confirmación (no altera la vista de fondo) */}
      {confirming && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4">
              <div className="modal-header">
                <h5 className="modal-title">¿Confirmas esta acción?</h5>
                <button type="button" className="btn-close" onClick={closeModal} />
              </div>
              <div className="modal-body">
                <p className="mb-0">{confirmMessage}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Sí, confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vista seleccionada por búsqueda directa — CARD CENTRADO */}
      {selectedStudent ? (
        <div className="d-flex justify-content-center mt-4">
          <div
            onClick={() => handleClick(selectedStudent)}
            className="student-tile card p-3 rounded-4 text-center"
            style={{
              backgroundColor: statusColor[getStatus(selectedStudent)],
              width: 320,
              cursor: 'pointer'
            }}
          >
            <img
              className="student-photo rounded-circle mx-auto d-block mb-2"
              src={selectedStudent.photoUrl || 'https://via.placeholder.com/88'}
              alt={selectedStudent.name}
              width={88}
              height={88}
              style={{ objectFit: 'cover' }}
            />
            <strong className="d-block">{selectedStudent.name}</strong>
            <p className="mb-1">ID: {selectedStudent.entityId}</p>
            <p className="mb-1">Tokens: {selectedStudent.lunch?.tokens ?? 0}</p>
            <p className="mb-0">Status: {statusLabels[getStatus(selectedStudent)]}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Niveles */}
          {!search && !selectedLevel && (
            <div className="row gx-3 gy-3 justify-content-center">
              {levels.map((level) => (
                <div key={level} className="col-12 col-sm-6 col-md-4">
                  <LevelCard level={level} onClick={setSelectedLevel} />
                </div>
              ))}
            </div>
          )}

          {/* Grupos */}
          {selectedLevel && !selectedGroup && (
            <div className="mt-3">
              <div className="pb-2 section-title text-center">
                <h3 className="mb-0">Grupos en {selectedLevel}</h3>
                <div className="text-muted">
                  {groupsInLevel.length} grupo{groupsInLevel.length !== 1 ? 's' : ''}
                </div>
              </div>

              {groupsInLevel.length === 0 ? (
                <div className="text-center text-muted py-5 border rounded-4">
                  No hay grupos en este nivel.
                </div>
              ) : (
                <div className="row gx-3 gy-3 justify-content-center">
                  {groupsInLevel.map((group) => {
                    const count = students.filter(
                      (s) =>
                        s.level &&
                        s.groupName &&
                        typeof s.level === 'string' &&
                        typeof s.groupName === 'string' &&
                        s.level.toLowerCase() === selectedLevel.toLowerCase() &&
                        s.groupName === group
                    ).length;
                    return (
                      <div key={group} className="col-12 col-sm-6 col-md-4">
                        <GroupCard
                          group={group}
                          studentsCount={count}
                          onClick={setSelectedGroup}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="d-flex justify-content-start">
                <button onClick={() => setSelectedLevel(null)} className="btn btn-secondary mt-3">
                  ← Volver a niveles
                </button>
              </div>
            </div>
          )}

          {/* Estudiantes */}
          {selectedGroup && (
            <div className="mt-3">
              <div className="pb-2 section-title text-center">
                <h3 className="mb-0">
                  Estudiantes en {selectedLevel} — Grupo {selectedGroup}
                </h3>
              </div>

              <div className="row gx-3 gy-3 justify-content-center">
                {studentsInGroup.map((student) => {
                  const status = getStatus(student);
                  const disabled = hasConsumptionToday(student);

                  return (
                    <div
                      key={student.entityId}
                      className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex justify-content-center"
                    >
                      <div
                        className="student-tile card p-3 rounded-4 text-center"
                        style={{
                          backgroundColor: statusColor[status],
                          width: 320,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          ...(disabled ? disabledStyle : {})
                        }}
                        onClick={() => !disabled && handleClick(student)}
                      >
                        <img
                          className="student-photo rounded-circle mx-auto d-block mb-2"
                          src={student.photoUrl || 'https://via.placeholder.com/88'}
                          alt={student.name}
                          width={88}
                          height={88}
                          style={{ objectFit: 'cover' }}
                        />
                        <strong className="d-block">{student.name}</strong>
                        <p className="mb-1">ID: {student.entityId}</p>
                        <p className="mb-1">Tokens: {student.lunch?.tokens ?? 0}</p>
                        <p className="mb-0">Status: {statusLabels[status]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="d-flex justify-content-start">
                <button onClick={() => setSelectedGroup(null)} className="btn btn-secondary mt-3">
                  ← Volver a grupos
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CocinaPanel;
