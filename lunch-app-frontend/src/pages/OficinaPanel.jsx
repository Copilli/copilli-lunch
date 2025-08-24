import { useEffect, useState } from 'react';
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
  const [invalidDates, setInvalidDates] = useState([]);
  const [search, setSearch] = useState(''); 
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(dayjs().month() + 1);
  const [calendarYear, setCalendarYear] = useState(dayjs().year());
  const [showDetails, setShowDetails] = useState(false);

  const token = localStorage.getItem('token');
  const API = import.meta.env.VITE_API_URL;

  const fetchStudents = async () => {
    const res = await axios.get(`${API}/students`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setStudents(res.data);
  };

  const fetchMovements = async () => {
    const res = await axios.get(`${API}/token-movements`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setMovements(res.data);
  };

  const fetchInvalidDates = async () => {
    const res = await axios.get(`${API}/invalid-dates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setInvalidDates(res.data.map(d => ({
      date: dayjs(d.date).format('YYYY-MM-DD'),
      reason: d.reason || 'Día no válido'
    })));
  };

  useEffect(() => {
    fetchStudents();
    fetchMovements();
    fetchInvalidDates();
  }, []);

  useEffect(() => {
    setShowDetails(false);
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
            setSelectedStudent(null);
            setShowDetails(false);
            setTimeout(() => {
              setSelectedStudent(student);
              setShowDetails(true);
            }, 100);
          }}
        />
      </TopNavBar>

      {!search && !selectedLevel && (
        <div className="row g-3">
          {levels.map(level => (
            <div key={level} className="col-12 col-sm-6 col-md-4">
              <LevelCard level={level} onClick={setSelectedLevel} />
            </div>
          ))}
        </div>
      )}

      {selectedLevel && !selectedGroup && (
        <div>
          <h3>Grupos en {selectedLevel}</h3>

          <div className="row g-3">
            {groupsInLevel.map(group => (
              <div key={group} className="col-12 col-sm-6 col-md-4">
                <GroupCard group={group} onClick={setSelectedGroup} />
              </div>
            ))}
          </div>

          <button onClick={() => setSelectedLevel(null)} className="btn btn-secondary mt-3">
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
            invalidDates={invalidDates}
          />

          <div style={{ marginTop: '2rem' }}>
            <h4>Resumen por alumno</h4>
            <div>
              {studentsInGroup.map(student => (
                <div key={student.studentId}>
                  <StudentSummaryCard
                    student={student}
                    onSelect={() => {
                      if (selectedStudent && selectedStudent.studentId === student.studentId) {
                        setSelectedStudent(null);
                        setShowDetails(false);
                      } else {
                        setSelectedStudent(student);
                        setShowDetails(true);
                      }
                    }}
                  />
                  {showDetails && selectedStudent && selectedStudent.studentId === student.studentId && (
                    <div className="accordion-panel card card-body bg-light mt-2 mb-3">
                      <StudentDetailsPanel
                        student={selectedStudent}
                        movements={movements}
                        onClose={() => {
                          setSelectedStudent(null);
                          setShowDetails(false);
                        }}
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
