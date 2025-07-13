import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import SearchBar from '../components/SearchBar';
import LevelCard from '../components/LevelCard';
import GroupCard from '../components/GroupCard';

const CocinaPanel = () => {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(res.data);
    };

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

    if (inPeriod) return 'green';
    if (student.tokens > 0) return 'blue';
    return 'red';
  };

  const handleClick = async (student) => {
    const status = getStatus(student);
    if (status === 'green') return;

    const confirm = window.confirm(
      status === 'blue'
        ? `¿Deseas descontar un token? Total final: ${student.tokens - 1}`
        : `No tiene tokens ni periodo activo. ¿Deseas registrar el desayuno en negativo? Total final: ${student.tokens - 1}`
    );

    if (!confirm) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/token-movements`, {
        studentId: student.studentId,
        change: -1,
        reason: 'uso',
        note: 'consumo cocina'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('Registro guardado');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Error al registrar consumo');
    }
  };

  const statusColor = {
    green: '#c6f6c6',
    blue: '#cce5ff',
    red: '#f8d7da'
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Panel de Cocina</h2>
      <SearchBar search={search} setSearch={setSearch} />

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
                    cursor: status === 'green' ? 'default' : 'pointer',
                    width: '200px'
                  }}
                >
                  <strong>{student.name}</strong>
                  <p>ID: {student.studentId}</p>
                  <p>Tokens: {student.tokens}</p>
                  <p>Status: {status.toUpperCase()}</p>
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