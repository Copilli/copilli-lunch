import { useRef, useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import dayjs from 'dayjs';

const CSV_HEADERS_FULL = [
  'studentId',
  'name',
  'email',
  'level',
  'group',
  'photoUrl',
  'tokens',
  'hasSpecialPeriod',
  'specialPeriod.startDate',
  'specialPeriod.endDate',
  'status'
];

const CSV_HEADERS_TEMPLATE = [
  'name',
  'email',
  'level',
  'group',
  'photoUrl',
  'specialPeriod.startDate',
  'specialPeriod.endDate'
];

function toCsvRow(values) {
  return values.map(v => {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  }).join(',');
}

function downloadCsv(filename, headers, rows) {
  const bom = '\uFEFF';
  const content = [toCsvRow(headers), ...rows].join('\n');
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchAllStudentsFlat() {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(`${import.meta.env.VITE_API_URL}/students?flat=1`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('No se pudo obtener estudiantes');
  return await res.json();
}

const StudentImportPanel = ({ onSuccess }) => {
  const fileInputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current.files[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const transformed = results.data.map(row => {
            const {
              'group.level': level,
              'group.name': name,
              'specialPeriod.startDate': startDate,
              'specialPeriod.endDate': endDate,
              ...rest
            } = row;

            return {
              ...rest,
              tokens: parseInt(row.tokens || 0),
              hasSpecialPeriod: row.hasSpecialPeriod === 'TRUE' || row.hasSpecialPeriod === true,
              group: { level: level?.toLowerCase(), name },
              specialPeriod:
                row.hasSpecialPeriod === 'TRUE' || row.hasSpecialPeriod === true
                  ? { startDate: startDate || null, endDate: endDate || null }
                  : undefined
            };
          });

          const token = localStorage.getItem('token');
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/students/import-bulk`,
            { students: transformed },
            { headers: { Authorization: `Bearer ${token}` } }
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

  // === descargas ===
  const handleDownloadFullCSV = async () => {
    try {
      const list = await fetchAllStudentsFlat();
      const rows = list.map(s =>
        toCsvRow([
          s.studentId || '',
          s.name || '',
          s.email || '',
          s.level || '',
          s.group || '',
          s.photoUrl || '',
          s.tokens ?? '',
          s.hasSpecialPeriod ? 'TRUE' : 'FALSE',
          s['specialPeriod.startDate'] || '',
          s['specialPeriod.endDate'] || '',
          s.status || ''
        ])
      );
      downloadCsv(`students_full_${dayjs().format('YYYYMMDD_HHmm')}.csv`, CSV_HEADERS_FULL, rows);
    } catch (e) {
      alert('Error al descargar CSV completo');
    }
  };

  const handleDownloadTemplateCSV = () => {
    const example = toCsvRow([
      'Juan Pérez',
      'juan@escuela.mx',
      'primaria',
      '3B',
      'https://.../foto.jpg',
      '2025-09-01',
      '2025-09-30'
    ]);
    downloadCsv(`students_template_${dayjs().format('YYYYMMDD_HHmm')}.csv`, CSV_HEADERS_TEMPLATE, [example]);
  };

  return (
    <form onSubmit={handleFileUpload}
      style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1rem', borderRadius: 8 }}
    >
      <h3>Importar estudiantes desde CSV</h3>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button type="button" onClick={handleDownloadFullCSV}>⬇️ Descargar CSV (todos)</button>
        <button type="button" onClick={handleDownloadTemplateCSV}>⬇️ Descargar plantilla vacía</button>
      </div>

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
              <ul>{result.errores.map((err, i) => <li key={i}>{err}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
};

export default StudentImportPanel;
