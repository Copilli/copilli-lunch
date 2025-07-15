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
import StudentImportPanel from '../components/StudentImportPanel';

const AdminPanel = ({ setUser }) => {
  const [students, setStudents] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(dayjs().month() + 1);
  const [calendarYear, setCalendarYear] = useState(dayjs().year());
  const [showDetails, setShowDetails] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showGroupView, setShowGroupView] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));

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

  useEffect(() => {
    setShowDetails(false);
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
    return movements.filter(m => m.reason === 'uso' || m.reason === 'uso-con-deuda');
  }, [movements]);

  return (
    <div className="app-container container py-4">
      <h2 className="mb-4">Panel de Administración</h2>
      <TopNavBar
        setUser={setUser}
        onImportClick={() => setShowImportModal(true)}
        showImport={user?.role === 'admin'}
      >
        <SearchBar
          search={search}
          setSearch={setSearch}
          students={students}
          onSelect={(student) => {
            setSelectedLevel(student.group.level);
            setSelectedGroup(student.group.name);
            setSelectedStudent(student);
            // fetchPeriodLogs(student._id);
          }}
        />
      </TopNavBar>

      {showImportModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Importar estudiantes</h5>
                <button type="button" className="btn-close" onClick={() => setShowImportModal(false)}></button>
              </div>
              <div className="modal-body">
                <StudentImportPanel
                  onSuccess={() => {
                    fetchStudents();
                    setShowImportModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!search && !selectedLevel && (
        <div className="row">
          {levels.map(level => (
            <div className="col-md-4 mb-3" key={level}>
              <LevelCard level={level} onClick={setSelectedLevel} />
            </div>
          ))}
        </div>
      )}

      {selectedLevel && !selectedGroup && (
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

          <StudentCalendarContainer
            currentGroup={{ name: selectedGroup, level: selectedLevel }}
            selectedStudent={showDetails ? selectedStudent : null}
            month={calendarMonth}
            year={calendarYear}
          />

          <div style={{ marginTop: '2rem' }}>
            <h4>Resumen por alumno</h4>
            {studentsInGroup.map(student => (
              <StudentSummaryCard
                key={student.studentId}
                student={student}
                onSelect={(s) => {
                  setSelectedStudent(s);
                  setShowDetails(true);
                }}
              />
            ))}
          </div>

          {showDetails && (
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

          <button className="btn btn-secondary mt-3" onClick={() => setSelectedGroup(null)}>
            ← Volver a grupos
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
