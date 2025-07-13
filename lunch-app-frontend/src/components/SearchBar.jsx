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
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '1rem' }}>
      <input
        type="text"
        placeholder="Buscar por nombre o ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ width: '100%', padding: '0.5rem' }}
      />

      {suggestions.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '0.5rem',
            position: 'absolute',
            width: '100%',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s.studentId}
              onClick={() => handleSelect(s)}
              style={{
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#f1f1f1';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'white';
              }}
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
