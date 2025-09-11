// src/pages/CocinaPanel.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';

import TopNavBar from '../components/TopNavBar';
import SearchBar from '../components/SearchBar';
import LevelCard from '../components/LevelCard';
import GroupCard from '../components/GroupCard';

// Helper to get next N valid dates
const getNextValidDates = async (n = 5) => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${import.meta.env.VITE_API_URL}/invalid-dates`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const invalidDates = res.data.map(d => d.date);
  let dates = [];
  let day = dayjs();
  while (dates.length < n) {
    const dStr = day.format('YYYY-MM-DD');
    if (!invalidDates.includes(dStr)) dates.push(dStr);
    day = day.add(1, 'day');
  }
  return dates;
};

const CocinaPanel = ({ setUser }) => {
  const [students, setStudents] = useState([]);
  const [validDates, setValidDates] = useState([]);
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

  const fetchStudents = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/students`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setStudents(res.data);
  };


  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    // Fetch next 5 valid dates
    getNextValidDates(5).then(setValidDates);
  }, []);

  useEffect(() => {
    if (students.length && validDates.length) {
      // For each valid date, count students with tokens > 0 or valid period
      const counts = validDates.map(date => {
        return students.filter(s => {
          const hasTokens = s.tokens > 0;
          const inPeriod = s.hasSpecialPeriod &&
            dayjs(date).isSameOrAfter(dayjs(s.specialPeriod?.startDate)) &&
            dayjs(date).isSameOrBefore(dayjs(s.specialPeriod?.endDate));
          return hasTokens || inPeriod;
        }).length;
      });
      setLunchCounts(counts);
    }
  }, [students, validDates]);

  const today = dayjs().format('YYYY-MM-DD');
  const levels = ['preescolar', 'primaria', 'secundaria'];

  const filtered = search
    ? students.filter(
        s =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.studentId.toLowerCase().includes(search.toLowerCase())
      )
    : students;

  const groupsInLevel = selectedLevel
    ? [...new Set(filtered.filter(s => s.group.level === selectedLevel).map(s => s.group.name))]
    : [];

  const studentsInGroup = selectedGroup
    ? filtered.filter(
        s => s.group.level === selectedLevel && s.group.name === selectedGroup
      )
    : [];

  const getStatus = (student) => {
    const inPeriod = student.hasSpecialPeriod &&
      dayjs(today).isSameOrAfter(dayjs(student.specialPeriod.startDate)) &&
      dayjs(today).isSameOrBefore(dayjs(student.specialPeriod.endDate));

    if (inPeriod) return 'periodo-activo';
    if (student.status === 'bloqueado') return 'bloqueado';
    if (student.tokens > 0) return 'con-fondos';
    return 'sin-fondos';
  };

  // Click en tarjeta: prepara modal sin alterar la vista de fondo
  const handleClick = (student) => {
    const status = getStatus(student);
    const hasTokens = student.tokens > 0;

    if (status === 'periodo-activo') {
      showError('Tiene un periodo activo. No se requiere token.');
      return;
    }

    if (status === 'bloqueado' && !hasTokens) {
      showError('Este alumno está bloqueado y no tiene tokens. No se puede registrar consumo.');
      return;
    }

    setPendingStudent(student);
    setConfirmMessage(
      hasTokens
        ? `¿Deseas descontar un token? Total final: ${student.tokens - 1}`
        : `No tiene tokens ni periodo activo. ¿Deseas registrar el desayuno en negativo? Total final: ${student.tokens - 1}`
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
    if (!pendingStudent?._id) {
      showError('Estudiante no seleccionado');
      closeModal();
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/students/${pendingStudent._id}/use`,
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
          students={students}
          onSelect={(student) => {
            setSelectedLevel(student.group.level);
            setSelectedGroup(student.group.name);
            setSelectedStudent(student); // vista de un solo alumno por búsqueda directa
          }}
        />
      </TopNavBar>

      {/* Lunch count alert, similar to cutOff alert */}
      {validDates.length > 0 && lunchCounts.length === validDates.length && (
        <div className="alert alert-info mt-3 text-center" style={{ fontSize: '1.1rem' }}>
          <strong>Comidas programadas:</strong>
          <ul className="list-unstyled mb-0 mt-2">
            {validDates.map((date, idx) => (
              <li key={date}>
                <span style={{ fontWeight: 'bold' }}>{dayjs(date).format('dddd, DD MMM YYYY')}</span>: {lunchCounts[idx]} desayunos
              </li>
            ))}
          </ul>
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
            <p className="mb-1">ID: {selectedStudent.studentId}</p>
            <p className="mb-1">Tokens: {selectedStudent.tokens}</p>
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
                      (s) => s.group.level === selectedLevel && s.group.name === group
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
                  const disabled = status === 'periodo-activo';

                  return (
                    <div
                      key={student.studentId}
                      className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex justify-content-center"
                    >
                      <div
                        className="student-tile card p-3 rounded-4 text-center"
                        style={{
                          backgroundColor: statusColor[status],
                          width: 320,
                          cursor: disabled ? 'default' : 'pointer'
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
                        <p className="mb-1">ID: {student.studentId}</p>
                        <p className="mb-1">Tokens: {student.tokens}</p>
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
