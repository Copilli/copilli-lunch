import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import TopNavBar from '../components/TopNavBar';
import SearchBar from '../components/SearchBar';
import LevelCard from '../components/LevelCard';
import GroupCard from '../components/GroupCard';
import { StudentCalendarContainer } from '../components/StudentCalendarTable';
import StudentSummaryCard from '../components/StudentSummaryCard';
import StudentDetailsPanel from '../components/StudentDetailsPanel';

const OficinaPanel = ({ setUser }) => {
  const [students, setStudents] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState(''); 
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(dayjs().month() + 1);
  const [calendarYear, setCalendarYear] = useState(dayjs().year());
  const [showDetails, setShowDetails] = useState(false);

  const fetchStudents = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/students`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setStudents(res.data);
  };

  const fetchMovements = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/token-movements`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setMovements(res.data);
  };

  useEffect(() => {
    fetchStudents();
    fetchMovements();
  }, []);

  const levels = ['preescolar', 'primaria', 'secundaria'];

   useEffect(() => {
    setShowDetails(false);
  }, [selectedGroup, selectedLevel]);

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

  const relevantMovements = useMemo(() => {
    return movements.filter(m => m.reason === 'uso' || m.reason === 'uso-con-deuda');
  }, [movements]);

  return (
    <div className="app-container" style={{ padding: '2rem' }}>
      <h2>Panel de Oficina</h2>
      <TopNavBar setUser={setUser}>
        <SearchBar
          search={search}
          setSearch={setSearch}
          students={students}
          onSelect={(student) => {
            setSelectedLevel(student.group.level);
            setSelectedGroup(student.group.name);
            setSelectedStudent(student);
            setShowDetails(true);
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
          <p>{studentsInGroup.length} estudiante(s)</p>

          <div style={{ marginBottom: '1rem' }}>
            <label>Mes: </label>
            <select value={calendarMonth} onChange={e => setCalendarMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {dayjs().month(i).format('MMMM')}
                </option>
              ))}
            </select>

            <label style={{ marginLeft: '1rem' }}>Año: </label>
            <select value={calendarYear} onChange={e => setCalendarYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => calendarYear - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <StudentCalendarContainer
            currentGroup={{ name: selectedGroup, level: selectedLevel }}
            selectedStudent={showDetails ? selectedStudent : null}
            month={calendarMonth}
            year={calendarYear}
          />

          <div style={{ marginTop: '2rem' }}>
            <h4>Resumen por alumno</h4>
            <div>
              {studentsInGroup.map(student => (
                <div key={student.studentId}>
                  <StudentSummaryCard
                    student={student}
                    onSelect={() => {
                      setSelectedStudent(student);
                      setShowDetails(true);
                    }}
                  />
                  {/* Mostrar detalles justo debajo del alumno seleccionado */}
                  {showDetails && selectedStudent && selectedStudent.studentId === student.studentId && (
                    <div className="slide-panel">
                      <StudentDetailsPanel
                        student={selectedStudent}
                        movements={movements}
                        onClose={() => setShowDetails(false)}
                        fetchStudents={fetchStudents}
                        fetchMovements={fetchMovements}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setSelectedGroup(null)} style={{ marginTop: '1rem' }}>
            ← Volver a grupos
          </button>
        </div>
      )}
    </div>
  );
};

export default OficinaPanel;
