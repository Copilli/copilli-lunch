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
  const [persons, setPersons] = useState([]);
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
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Mensajes
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal de confirmación
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingPerson, setPendingPerson] = useState(null); // <- persona del modal

  const showError = (msg) => {
    setFormError(msg);
    setTimeout(() => setFormError(''), 3000);
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Fetch all persons (flat)
  const fetchPersons = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/persons?flat=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPersons(res.data);
  };


  useEffect(() => {
    fetchPersons();
  }, []);

  useEffect(() => {
    if (invalidDates) {
      setValidDates(getNextValidDates(5, invalidDates));
    }
  }, [invalidDates]);

  useEffect(() => {
    if (persons.length && validDates.length) {
      // For each valid date, count persons with valid period and with tokens
      const counts = validDates.map(date => {
        let periodCount = 0;
        let tokenCount = 0;
        persons.forEach(p => {
          const lunch = p.lunch || {};
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
  }, [persons, validDates]);

  const today = dayjs().format('YYYY-MM-DD');
  const levels = ['preescolar', 'primaria', 'secundaria', 'personal'];

  const filtered = search
    ? persons.filter(
        p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.entityId && p.entityId.toLowerCase().includes(search.toLowerCase()))
      )
    : persons;

  const groupsInLevel = selectedLevel
    ? [
        ...new Set(
          filtered
            .filter(
              p =>
                p.level &&
                p.groupName &&
                typeof p.level === 'string' &&
                typeof p.groupName === 'string' &&
                p.level.toLowerCase() === selectedLevel.toLowerCase()
            )
            .map(p => p.groupName)
            .filter(name => !!name)
        ),
      ]
    : [];

  const personsInGroup = selectedGroup
    ? filtered.filter(
        p =>
          p.level &&
          p.groupName &&
          typeof p.level === 'string' &&
          typeof p.groupName === 'string' &&
          p.level.toLowerCase() === selectedLevel.toLowerCase() &&
          p.groupName === selectedGroup
      )
    : [];

  // Helper para saber si ya tiene consumo ese día
  const hasConsumptionToday = (person) => {
    const lunch = person.lunch || {};
    if (!lunch.movements) return false;
    return lunch.movements.some(mov => {
      const movDate = mov.timestamp ? dayjs(mov.timestamp).format('YYYY-MM-DD') : null;
      return movDate === today && ['uso', 'uso-con-deuda', 'uso-periodo'].includes(mov.reason);
    });
  };

  const getStatus = (person) => {
    const lunch = person.lunch || {};
    const start = lunch.specialPeriod?.startDate ? dayjs(lunch.specialPeriod.startDate) : null;
    const end = lunch.specialPeriod?.endDate ? dayjs(lunch.specialPeriod.endDate) : null;
    const isActivePeriod = start && end && dayjs(today).isSameOrAfter(start) && dayjs(today).isSameOrBefore(end);
    if (isActivePeriod) return 'periodo-activo';
    if (lunch.status === 'bloqueado') return 'bloqueado';
    if (lunch.tokens > 0) return 'con-fondos';
    return 'sin-fondos';
  };

  // Click en tarjeta: para periodo activo, registra consumo especial; para otros, sigue igual
  const handleClick = async (person) => {
    const lunch = person.lunch || {};
    const status = getStatus(person);
    const hasTokens = lunch.tokens > 0;

    if (hasConsumptionToday(person)) {
      showError('Ya se registró consumo para esta persona hoy.');
      return;
    }

    if (status === 'periodo-activo') {
      // Registrar consumo especial usando el endpoint correcto
      if (!lunch._id) {
        showError('No se encontró el registro de lunch para esta persona');
        return;
      }
      try {
        const token = localStorage.getItem('token');
        await axios.post(
          `${import.meta.env.VITE_API_URL}/lunch/${lunch._id}/use`,
          {
            performedBy: localStorage.getItem('username') || 'cocina',
            userRole: 'cocina'
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showSuccess('Consumo de periodo activo registrado');
        await fetchPersons();
        // Actualiza selectedPerson con los datos más recientes
        setSelectedPerson(prev => {
          if (!prev) return null;
          const updated = persons.find(p => p.entityId === prev.entityId || p.entityId === prev.person?.entityId);
          return updated || prev;
        });
      } catch (err) {
        console.error(err);
        const backendError = err?.response?.data?.error;
        showError(backendError || 'Error al registrar consumo de periodo activo');
      }
      return;
    }

    if (status === 'bloqueado' && !hasTokens) {
      showError('Esta persona está bloqueada y no tiene tokens. No se puede registrar consumo.');
      return;
    }

    setPendingPerson(person);
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
    setPendingPerson(null); // <- no tocar selectedPerson
  };

  const handleConfirm = async () => {
    const lunch = pendingPerson?.lunch;
    if (!lunch?._id) {
      showError('No se encontró el registro de lunch para esta persona');
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
      await fetchPersons();

      // Opcional: limpiar la vista de búsqueda directa
      setSelectedPerson(null);
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
          persons={persons}
          onSelect={(person) => {
            setSelectedLevel(person.level);
            setSelectedGroup(person.groupName);
            setSelectedPerson(person); // vista de una sola persona por búsqueda directa
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
      {selectedPerson ? (
        <div className="d-flex justify-content-center mt-4">
          <div
            onClick={() => handleClick(selectedPerson)}
            className="student-tile card p-3 rounded-4 text-center"
            style={{
              backgroundColor: statusColor[getStatus(selectedPerson)],
              width: 320,
              cursor: 'pointer'
            }}
          >
            <div className="col-auto mb-2">
              {selectedPerson.photoUrl ? (
                <img
                  src={selectedPerson.photoUrl}
                  alt={selectedPerson.name}
                  className="rounded-circle mx-auto d-block"
                  style={{ width: 88, height: 88, objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="rounded-circle bg-secondary d-flex align-items-center justify-content-center mx-auto mb-2"
                  style={{ width: 88, height: 88, color: '#fff', fontSize: 32 }}
                >
                  <span>{selectedPerson.name ? selectedPerson.name[0] : '?'}</span>
                </div>
              )}
            </div>
            <strong className="d-block">{selectedPerson.name}</strong>
            <p className="mb-1">ID: {selectedPerson.entityId}</p>
            <p className="mb-1">Tokens: {selectedPerson.lunch?.tokens ?? 0}</p>
            <p className="mb-0">Status: {statusLabels[getStatus(selectedPerson)]}</p>
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
                    const count = persons.filter(
                      (p) =>
                        p.level &&
                        p.groupName &&
                        typeof p.level === 'string' &&
                        typeof p.groupName === 'string' &&
                        p.level.toLowerCase() === selectedLevel.toLowerCase() &&
                        p.groupName === group
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

          {/* Personas */}
          {selectedGroup && (
            <div className="mt-3">
              <div className="pb-2 section-title text-center">
                <h3 className="mb-0">
                  Personas en {selectedLevel} — Grupo {selectedGroup}
                </h3>
              </div>

              <div className="row gx-3 gy-3 justify-content-center">
                {personsInGroup.map((person) => {
                  const status = getStatus(person);
                  const disabled = hasConsumptionToday(person);

                  return (
                    <div
                      key={person.entityId}
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
                        onClick={() => !disabled && handleClick(person)}
                      >
                        <div className="col-auto mb-2">
                          {person.photoUrl ? (
                            <img
                              src={person.photoUrl}
                              alt={person.name}
                              className="rounded-circle mx-auto d-block"
                              style={{ width: 88, height: 88, objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              className="rounded-circle bg-secondary d-flex align-items-center justify-content-center mx-auto mb-2"
                              style={{ width: 88, height: 88, color: '#fff', fontSize: 32 }}
                            >
                              <span>{person.name ? person.name[0] : '?'}</span>
                            </div>
                          )}
                        </div>
                        <strong className="d-block">{person.name}</strong>
                        <p className="mb-1">ID: {person.entityId}</p>
                        <p className="mb-1">Tokens: {person.lunch?.tokens ?? 0}</p>
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
