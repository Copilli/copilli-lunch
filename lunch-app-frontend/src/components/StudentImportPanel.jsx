import { useRef, useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';

const StudentImportPanel = ({ onSuccess }) => {
  const fileInputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    e.preventDefault(); // ✅ evita recarga de página

    const file = fileInputRef.current.files[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/students/import-bulk`,
            { students: results.data },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          setResult(res.data);
          if (onSuccess) onSuccess();
        } catch (err) {
          console.error(err);
          alert('Error al importar estudiantes');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <form
      onSubmit={handleFileUpload}
      style={{
        marginBottom: '2rem',
        border: '1px solid #ccc',
        padding: '1rem',
        borderRadius: 8
      }}
    >
      <h3>Importar estudiantes desde CSV</h3>
      <input type="file" accept=".csv" ref={fileInputRef} />
      <button type="submit" disabled={loading} style={{ marginLeft: '1rem' }}>
        {loading ? 'Importando...' : 'Importar'}
      </button>

      {result && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Resultado:</strong>
          <p>✔️ {result.created} estudiantes creados</p>
          <p>♻️ {result.updated} estudiantes actualizados</p>
          {result.errores?.length > 0 && (
            <details style={{ marginTop: '0.5rem' }}>
              <summary>⚠️ Errores ({result.errores.length})</summary>
              <ul>
                {result.errores.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
};

export default StudentImportPanel;
