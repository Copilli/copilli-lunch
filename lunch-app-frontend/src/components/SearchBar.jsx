import { useState, useEffect, useRef } from 'react';

const SearchBar = ({ search, setSearch, students, onSelect }) => {
  const [suggestions, setSuggestions] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!search.trim()) {
      setSuggestions([]);
      return;
    }

    const lowered = search.toLowerCase();
    const filtered = students.filter(
      (s) =>
        s.name.toLowerCase().includes(lowered) ||
        s.studentId.toLowerCase().includes(lowered)
    );
    setSuggestions(filtered.slice(0, 5)); // Limita a 5 sugerencias
  }, [search, students]);

  const handleSelect = (student) => {
    setSearch('');
    setSuggestions([]);
    if (onSelect) onSelect(student);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleSelect(suggestions[0]);
    }
  };

  // Cierra las sugerencias si se da clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="position-relative mb-0 flex-grow-1" style={{ minWidth: 250 }}>
      <input
        type="text"
        placeholder="Buscar por nombre o ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        className="form-control"
        style={{ width: '100%' }}
      />

      {suggestions.length > 0 && (
        <ul
          className="list-group position-absolute w-100"
          style={{
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s.studentId}
              onClick={() => handleSelect(s)}
              className="list-group-item list-group-item-action"
              style={{ cursor: 'pointer' }}
            >
              <strong>{s.name}</strong> ({s.studentId})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
