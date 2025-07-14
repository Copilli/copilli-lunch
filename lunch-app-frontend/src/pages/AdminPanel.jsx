import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import TopNavBar from '../components/TopNavBar';
import SearchBar from '../components/SearchBar';
import LevelCard from '../components/LevelCard';
import GroupCard from '../components/GroupCard';
import StudentCalendarTable from '../components/StudentCalendarTable';
import StudentDetailsPanel from '../components/StudentDetailsPanel';
import StudentSummaryCard from '../components/StudentSummaryCard';
import StudentImportPanel from '../components/StudentImportPanel'; // <--- Importa aquí

const AdminPanel = ({ setUser }) => {
  const [students, setStudents] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(dayjs().month() + 1);
  const [calendarYear, setCalendarYear] = useState(dayjs().year());
  const [periodLogs, setPeriodLogs] = useState([]);
  const user = JSON.parse(localStorage.getItem('user'));

  const fetchStudents = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/students`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setStudents(res.data);
  };

  const fetchPeriodLogs = async (studentId) => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/students/${studentId}/period-logs`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPeriodLogs(res.data);
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

  useEffect(() => {
    setSelectedStudent(null);
  }, [selectedGroup, selectedLevel]);

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

  const relevantMovements = useMemo(() => {
    return movements.filter(m => m.reason === 'uso');
  }, [movements]);

  const showGroupView = !search && selectedLevel && selectedGroup;
  const showSelectedStudent = search && selectedStudent;
  const showLevelView = !search && selectedLevel && !selectedGroup;
  const showStartView = !search && !selectedLevel;

  return (
    <div className="app-container container py-4">
      <h2 className="mb-4">Panel de Administración</h2>
      <TopNavBar setUser={setUser}>
        <SearchBar
          search={search}
          setSearch={setSearch}
          students={students}
          onSelect={(student) => {
            setSelectedLevel(student.group.level);
            setSelectedGroup(student.group.name);
            setSelectedStudent(student);
            fetchPeriodLogs(student._id);
          }}
        />
      </TopNavBar>

      {/* Import solo visible para admin */}
      {user?.role === 'admin' && (
        <StudentImportPanel onSuccess={fetchStudents} />
      )}

      {showStartView && (
        <div className="row">
          {levels.map(level => (
            <div className="col-md-4 mb-3" key={level}>
              <LevelCard level={level} onClick={setSelectedLevel} />
            </div>
          ))}
        </div>
      )}

      {showLevelView && (
        <div>
          <h3>Grupos en {selectedLevel}</h3>
          <div className="row">
            {groupsInLevel.map(group => (
              <div className="col-md-3 mb-2" key={group}>
                <GroupCard group={group} onClick={setSelectedGroup} />
              </div>
            ))}
          </div>
          <button className="btn btn-secondary mt-3" onClick={() => setSelectedLevel(null)}>
            ← Volver a niveles
          </button>
        </div>
      )}

      {showSelectedStudent && (
        <div>
          <h3>Resultado de búsqueda</h3>
          <p><strong>{selectedStudent.name}</strong> ({selectedStudent.studentId})</p>

          <StudentCalendarTable
            students={[selectedStudent]}
            movements={relevantMovements}
            periodLogs={periodLogs}
            month={calendarMonth}
            year={calendarYear}
          />

          <div style={{ marginTop: '2rem' }}>
            <h4>Resumen por alumno</h4>
            <StudentSummaryCard
              student={selectedStudent}
              onSelect={() => {}} // deshabilitado
            />
          </div>

          <StudentDetailsPanel
            student={selectedStudent}
            movements={movements}
            onClose={() => {
              setSelectedStudent(null);
              setSearch('');
            }}
          />

          <button onClick={() => {
            setSearch('');
            setSelectedStudent(null);
          }} style={{ marginTop: '1rem' }}>
            ← Limpiar búsqueda
          </button>
        </div>
      )}

      {showGroupView && (
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

          <StudentCalendarTable
            students={studentsInGroup}
            movements={relevantMovements}
            periodLogs={periodLogs}
            month={calendarMonth}
            year={calendarYear}
          />

          <div style={{ marginTop: '2rem' }}>
            <h4>Resumen por alumno</h4>
            {studentsInGroup.map(student => (
              <StudentSummaryCard
                key={student.studentId}
                student={student}
                onSelect={setSelectedStudent}
              />
            ))}
          </div>

          <StudentDetailsPanel
            student={selectedStudent}
            movements={movements}
            onClose={() => setSelectedStudent(null)}
          />

          <button className="btn btn-secondary mt-3" onClick={() => setSelectedGroup(null)}>
            ← Volver a grupos
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
