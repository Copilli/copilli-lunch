import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import TopNavBar from '../components/TopNavBar';
import SearchBar from '../components/SearchBar';
import LevelCard from '../components/LevelCard';
import GroupCard from '../components/GroupCard';

const CocinaPanel = ({ setUser }) => {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    setSelectedStudent(student);
    setConfirmMessage(
      hasTokens
        ? `¿Deseas descontar un token? Total final: ${student.tokens - 1}`
        : `No tiene tokens ni periodo activo. ¿Deseas registrar el desayuno en negativo? Total final: ${student.tokens - 1}`
    );
    setConfirming(true);
  };

  const handleConfirm = async () => {
    if (!selectedStudent?._id) {
      showError('Estudiante no seleccionado');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/students/${selectedStudent._id}/use`, {
        performedBy: localStorage.getItem('username') || 'cocina'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showSuccess('Registro guardado');
      await fetchStudents();
      setSelectedStudent(null);
      setSearch('');
    } catch (err) {
      console.error(err);
      const backendError = err?.response?.data?.error;
      showError(backendError || 'Error al registrar consumo');
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  const statusColor = {
    'periodo-activo': '#c6f6c6',
    'con-fondos': '#cce5ff',
    'sin-fondos': '#f8d7da',
    'bloqueado': '#c2c2c2'
  };

  const statusLabels = {
    'periodo-activo': 'Periodo activo',
    'con-fondos': 'Con fondos',
    'sin-fondos': 'Sin fondos',
    'bloqueado': 'Bloqueado'
  };

  return (
    <div className="app-container container py-4">
      <h2>Panel de Cocina</h2>
      <TopNavBar setUser={setUser}>
        <SearchBar
          search={search}
          setSearch={setSearch}
          students={students}
          onSelect={(student) => {
            setSelectedLevel(student.group.level);
            setSelectedGroup(student.group.name);
            setSelectedStudent(null); // forzar reset
            setShowDetails(false);
            
            // esperar a que se monte el grupo y luego mostrar detalles
            setTimeout(() => {
              setSelectedStudent(student);
              setShowDetails(true);
            }, 100); // 100ms suele ser suficiente
          }}
        />
      </TopNavBar>

      {formError && (
        <div className="alert alert-warning position-fixed top-0 start-50 translate-middle-x mt-3 z-3 text-center" role="alert" style={{ zIndex: 9999 }}>
          {formError}
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3 z-3 text-center" role="alert" style={{ zIndex: 9999 }}>
          {successMsg}
        </div>
      )}

      {confirming && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">¿Confirmas esta acción?</h5>
                <button type="button" className="btn-close" onClick={() => setConfirming(false)}></button>
              </div>
              <div className="modal-body">
                <p>{confirmMessage}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirming(false)}>
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

      {selectedStudent ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <div
            onClick={() => handleClick(selectedStudent)}
            style={{
              backgroundColor: statusColor[getStatus(selectedStudent)],
              padding: '1rem',
              borderRadius: 8,
              cursor: 'pointer',
              width: '200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            <img
              src={selectedStudent.photoUrl}
              alt={selectedStudent.name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover',
                marginBottom: '0.5rem'
              }}
            />
            <strong>{selectedStudent.name}</strong>
            <p>ID: {selectedStudent.studentId}</p>
            <p>Tokens: {selectedStudent.tokens}</p>
            <p>Status: {statusLabels[getStatus(selectedStudent)]}</p>
          </div>
        </div>
      ) : (
        <>
          {!search && !selectedLevel && (
            <div>
              {levels.map(level => (
                <LevelCard key={level} level={level} onClick={setSelectedLevel} />
              ))}
            </div>
          )}

          {selectedLevel && !selectedGroup && (
            <div>
              <h3>Grupos en {selectedLevel}</h3>
              {groupsInLevel.map(group => (
                <GroupCard key={group} group={group} onClick={setSelectedGroup} />
              ))}
              <button onClick={() => setSelectedLevel(null)} style={{ marginTop: '1rem' }}>
                ← Volver a niveles
              </button>
            </div>
          )}

          {selectedGroup && (
            <div>
              <h3>Estudiantes en {selectedLevel} - Grupo {selectedGroup}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {studentsInGroup.map(student => {
                  const status = getStatus(student);
                  return (
                    <div
                      key={student.studentId}
                      onClick={() => handleClick(student)}
                      style={{
                        backgroundColor: statusColor[status],
                        padding: '1rem',
                        borderRadius: 8,
                        cursor: status === 'periodo-activo' ? 'default' : 'pointer',
                        width: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                      }}
                    >
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          marginBottom: '0.5rem'
                        }}
                      />
                      <strong>{student.name}</strong>
                      <p>ID: {student.studentId}</p>
                      <p>Tokens: {student.tokens}</p>
                      <p>Status: {statusLabels[status]}</p>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => setSelectedGroup(null)} style={{ marginTop: '1rem' }}>
                ← Volver a grupos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CocinaPanel;
