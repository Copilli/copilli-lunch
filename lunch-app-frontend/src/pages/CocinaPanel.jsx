import { useEffect, useState, useMemo } from 'react';
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

  const handleClick = async (student) => {
    const status = getStatus(student);
    const hasTokens = student.tokens > 0;

    if (status === 'periodo-activo') {
      alert('Tiene un periodo activo. No se requiere token.');
      return;
    }

    if (status === 'bloqueado' && !hasTokens) {
      alert('Este alumno está bloqueado y no tiene tokens. No se puede registrar consumo.');
      return;
    }

    const confirm = window.confirm(
      hasTokens
        ? `¿Deseas descontar un token? Total final: ${student.tokens - 1}`
        : `No tiene tokens ni periodo activo. ¿Deseas registrar el desayuno en negativo? Total final: ${student.tokens - 1}`
    );

    if (!confirm) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/students/${student._id}/use`, {
        performedBy: localStorage.getItem('username') || 'cocina'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Registro guardado');
      await fetchStudents(); // Actualizar lista sin recargar
    } catch (err) {
      console.error(err);
      alert('Error al registrar consumo');
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
    <div className="app-container" style={{ padding: '2rem' }}>
      <h2>Panel de Cocina</h2>
      <TopNavBar setUser={setUser}>
        <SearchBar
          search={search}
          setSearch={setSearch}
          students={students}
          onSelect={(student) => {
            setSelectedLevel(student.group.level);
            setSelectedGroup(student.group.name);
            setSelectedStudent?.(student); // Solo si hay detalles en el panel
          }}
        />
      </TopNavBar>

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
    </div>
  );
};

export default CocinaPanel;
