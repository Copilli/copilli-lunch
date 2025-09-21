import { useEffect, useState, useMemo, useRef } from 'react';
import { useInvalidDates } from '../context/InvalidDatesContext';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import TopNavBar from '../components/TopNavBar';
import SearchBar from '../components/SearchBar';
import LevelCard from '../components/LevelCard';
import GroupCard from '../components/GroupCard';
import { PersonCalendarContainer } from '../components/PersonCalendarTable';
import PersonSummaryCard from '../components/PersonSummaryCard';
import PersonDetailsPanel from '../components/PersonDetailsPanel';
import PersonImportPanel from '../components/PersonImportPanel';

const AdminPanel = ({ setUser }) => {
  const navigate = useNavigate();
  const [persons, setPersons] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(dayjs().month() + 1);
  const [calendarYear, setCalendarYear] = useState(dayjs().year());
  const [showDetails, setShowDetails] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const { invalidDates, loading: loadingInvalidDates, fetchInvalidDates } = useInvalidDates();
  useEffect(() => {
    fetchInvalidDates?.();
    // Solo se llama una vez al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const user = JSON.parse(localStorage.getItem('user'));
  const location = useLocation();
  const API = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');

  const selectPersonForDetails = (person) => {
    setSelectedLevel(person.level);
    setSelectedGroup(person.groupName);
    setSelectedStudent(null);
    setShowDetails(false);
    setTimeout(() => {
      setSelectedStudent(person);
      setShowDetails(true);
    }, 100);
  };

  const openedFromQueryRef = useRef(false);

  // Fetch all persons (flat)
  const fetchPersons = async () => {
    const res = await axios.get(`${API}/persons?flat=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPersons(res.data);
  };

  // Fetch all movements
  const fetchMovements = async () => {
    const res = await axios.get(`${API}/movements`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setMovements(res.data);
  };


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pid = params.get('entityId');
    if (!pid || openedFromQueryRef.current) return;

    const tryOpen = (list) => {
      const person = Array.isArray(list) ? list.find(s => s.entityId === pid) : null;
      if (person) {
        openedFromQueryRef.current = true;
        selectPersonForDetails(person);
        navigate('/admin', { replace: true });
      }
    };
    // 1) Si ya tienes personas cargadas, intenta directo
    if (Array.isArray(persons) && persons.length) {
      tryOpen(persons);
      return;
    }
    // 2) Si aún no están, pide la lista y luego intenta
    axios.get(`${API}/persons?flat=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => tryOpen(data))
      .catch(() => { /* silencioso */ });
  }, [location.search, persons]);

  useEffect(() => {
    fetchPersons();
    fetchMovements();
  // invalidDates se obtiene del contexto global
  }, []);

  useEffect(() => {
    setShowDetails(false);
    setSelectedStudent(null);
  }, [selectedGroup, selectedLevel]);

  const levels = ['preescolar', 'primaria', 'secundaria', 'personal'];

  const filtered = search
    ? persons.filter(
        s =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.entityId && s.entityId.toLowerCase().includes(search.toLowerCase()))
      )
    : persons;

  const groupsInLevel = selectedLevel
    ? [
        ...new Set(
          persons
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

  const personsInGroup = selectedGroup
    ? persons.filter(
        s =>
          s.level &&
          s.groupName &&
          typeof s.level === 'string' &&
          typeof s.groupName === 'string' &&
          s.level.toLowerCase() === selectedLevel.toLowerCase() &&
          s.groupName === selectedGroup
      )
    : [];

  const relevantMovements = useMemo(() => {
    return movements.filter(m => m.reason === 'uso' || m.reason === 'uso-con-deuda');
  }, [movements]);

  return (
    <div className="app-container container py-4 ">
      <h2 className="mb-4 text-center">Panel de Administración</h2>
      <TopNavBar
        setUser={setUser}
        onImportClick={() => setShowImportModal(true)}
        showImport={user?.role === 'admin'}
      >
        <SearchBar
          search={search}
          setSearch={setSearch}
          persons={persons}
          onSelect={(person) => {
            setSelectedLevel(person.level);
            setSelectedGroup(person.groupName);
            setSelectedStudent(null);
            setShowDetails(false);
            setTimeout(() => {
              setSelectedStudent(person);
              setShowDetails(true);
            }, 100);
          }}
        />
      </TopNavBar>

      {showImportModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Importar personas</h5>
                <button type="button" className="btn-close" onClick={() => setShowImportModal(false)}></button>
              </div>
              <div className="modal-body">
                <PersonImportPanel
                  onSuccess={() => {
                    fetchPersons();
                    setShowImportModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

            {!search && !selectedLevel && (
        <div className="row gx-3 gy-3 justify-content-center">
          {levels.map(level => (
            <div key={level} className="col-12 col-sm-6 col-md-4">
              <LevelCard
                level={level}
                onClick={() => {
                  setSearch('');
                  setSelectedLevel(level);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {selectedLevel && !selectedGroup && (
        <div className="mt-3 text-center">
          <div className="pb-2">
            <h3 className="mb-0">Grupos en {selectedLevel}</h3>
            <div className="text-muted">
              {groupsInLevel.length} grupo{groupsInLevel.length !== 1 ? 's' : ''}
            </div>
          </div>

          {groupsInLevel.length === 0 ? (
            <div className="text-muted py-5 border rounded-4">
              No hay grupos en este nivel.
            </div>
          ) : (
            <div className="row gx-3 gy-3 justify-content-center">{/* ← antes: g-3 */}
              {groupsInLevel.map((group) => {
                const count = persons.filter(
                  s =>
                    s.level &&
                    s.groupName &&
                    typeof s.level === 'string' &&
                    typeof s.groupName === 'string' &&
                    s.level.toLowerCase() === selectedLevel.toLowerCase() &&
                    s.groupName === group
                ).length;
                return (
                  <div key={group} className="col-12 col-sm-6 col-md-4">
                    <GroupCard group={group} studentsCount={count} onClick={setSelectedGroup} />
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

      {selectedGroup && (
        <div>
          <h3 className='text-center'>Personas en {selectedLevel} - Grupo {selectedGroup}</h3>
          <p className='text-center'>{personsInGroup.length} persona(s)</p>

          <div style={{ marginBottom: '1rem' }}>
            <label>Mes:  </label> 
            <select value={calendarMonth} onChange={e => setCalendarMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {dayjs().month(i).format('MMMM')}
                </option>
              ))}
            </select>

            <label style={{ marginLeft: '1rem' }}>Año:  </label> 
            <select value={calendarYear} onChange={e => setCalendarYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => calendarYear - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <PersonCalendarContainer
            currentGroup={{ name: selectedGroup, level: selectedLevel }}
            selectedPerson={showDetails ? selectedStudent : null}
            month={calendarMonth}
            year={calendarYear}
            invalidDates={invalidDates}
          />

          <div style={{ marginTop: '2rem' }}>
            <h4 className='text-center'>Resumen por persona</h4>
            {personsInGroup.map(person => (
              <div key={person.entityId}>
                <PersonSummaryCard
                  person={person}
                  onSelect={() => {
                    if (selectedStudent && selectedStudent.entityId === person.entityId) {
                      setSelectedStudent(null);
                      setShowDetails(false);
                    } else {
                      setSelectedStudent(person);
                      setShowDetails(true);
                    }
                  }}
                />
                {showDetails && selectedStudent?.entityId === person.entityId && (
                  <div className="accordion-panel card card-body bg-light mt-2 mb-3">
                    <PersonDetailsPanel
                      person={selectedStudent}
                      movements={movements}
                      onClose={() => {
                        setSelectedStudent(null);
                        setShowDetails(false);
                      }}
                      fetchPersons={fetchPersons}
                      fetchMovements={fetchMovements}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="btn btn-secondary mt-3" onClick={() => setSelectedGroup(null)}>
            ← Volver a grupos
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
