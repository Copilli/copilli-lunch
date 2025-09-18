import { useState, useEffect, useRef } from 'react';

const SearchBar = ({ search, setSearch, persons, onSelect }) => {
  const [suggestions, setSuggestions] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!search.trim()) {
      setSuggestions([]);
      return;
    }

    const lowered = search.toLowerCase();
    const filtered = persons.filter(
      (p) =>
        p.name.toLowerCase().includes(lowered) ||
        (p.personId && p.personId.toLowerCase().includes(lowered))
    );
    setSuggestions(filtered.slice(0, 5)); // Limita a 5 sugerencias
  }, [search, persons]);

  const handleSelect = (person) => {
    setSearch('');
    setSuggestions([]);
    if (onSelect) onSelect(person);
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
          {suggestions.map((p) => (
            <li
              key={p.personId}
              onClick={() => handleSelect(p)}
              className="list-group-item list-group-item-action"
              style={{ cursor: 'pointer' }}
            >
              <strong>{p.name}</strong> ({p.personId})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;
