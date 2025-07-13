const SearchBar = ({ search, setSearch }) => {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <input
        type="text"
        placeholder="Buscar por nombre o ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: '0.5rem' }}
      />
    </div>
  );
};

export default SearchBar;
