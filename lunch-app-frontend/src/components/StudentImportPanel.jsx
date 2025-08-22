// src/components/StudentImportPanel.jsx
import { useRef, useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import dayjs from 'dayjs';

const CSV_HEADERS_FULL = [
  'studentId','name','email','level','group','photoUrl',
  'tokens','hasSpecialPeriod','specialPeriod.startDate','specialPeriod.endDate','status'
];

// Solo campos mínimos requeridos
const CSV_HEADERS_TEMPLATE = [
  'name',
  'email',
  'level', // preescolar | primaria | secundaria
  'group'  // Ej: 3B, A, 1A
];

function toCsvRow(values) {
  return values.map(v => `"${(v ?? '').toString().replace(/"/g,'""')}"`).join(',');
}

function downloadCsv(filename, headers, rows) {
  const bom = '\uFEFF';
  const content = [toCsvRow(headers), ...rows].join('\n');
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
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
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleDownloadFullCSV = async () => {
    try {
      const list = await fetchAllStudentsFlat();
      const rows = list.map(s => toCsvRow([
        s.studentId || '', s.name || '', s.email || '',
        s.level || '', s.group || '', s.photoUrl || '',
        s.tokens ?? '', s.hasSpecialPeriod ? 'TRUE' : 'FALSE',
        s['specialPeriod.startDate'] || '', s['specialPeriod.endDate'] || '',
        s.status || ''
      ]));
      downloadCsv(`students_full_${dayjs().format('YYYYMMDD_HHmm')}.csv`, CSV_HEADERS_FULL, rows);
    } catch {
      setErrorMsg('No se pudo descargar el CSV de estudiantes.');
      setTimeout(()=>setErrorMsg(''), 3500);
    }
  };

  const handleDownloadTemplateCSV = () => {
    // Solo encabezados mínimos, sin ejemplo
    const rows = [];
    downloadCsv(
      `students_template_min_${dayjs().format('YYYYMMDD_HHmm')}.csv`,
      CSV_HEADERS_TEMPLATE,
      rows
    );
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) { setErrorMsg('Selecciona un archivo CSV.'); return; }

    setLoading(true);
    setResult(null);
    setErrorMsg(''); setSuccessMsg('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const transformed = results.data.map(row => {
            const { 'group.level': level, 'group.name': name,
                    'specialPeriod.startDate': startDate,
                    'specialPeriod.endDate': endDate, ...rest } = row;

            return {
              ...rest,
              tokens: parseInt(row.tokens || 0, 10),
              hasSpecialPeriod: row.hasSpecialPeriod === 'TRUE' || row.hasSpecialPeriod === true,
              group: { level: level?.toLowerCase(), name },
              specialPeriod:
                (row.hasSpecialPeriod === 'TRUE' || row.hasSpecialPeriod === true)
                  ? { startDate: startDate || null, endDate: endDate || null }
                  : undefined
            };
          });

          const token = localStorage.getItem('token') || '';
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/students/import-bulk`,
            { students: transformed },
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );

          setResult(res.data);
          setSuccessMsg('Importación completada.');
          setTimeout(()=>setSuccessMsg(''), 3500);
          if (onSuccess) onSuccess();
        } catch (err) {
          console.error(err);
          setErrorMsg(err?.response?.data?.error || 'Error al importar estudiantes.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const onFileChange = (e) => setFileName(e.target.files?.[0]?.name || '');

  return (
    <form onSubmit={handleFileUpload} className="sip-card">
      <div className="sip-header">
        <h5 className="m-0">Importar estudiantes desde CSV</h5>
      </div>

      <div className="sip-body">
        {errorMsg && <div className="alert alert-danger mb-3">{errorMsg}</div>}
        {successMsg && <div className="alert alert-success mb-3">{successMsg}</div>}

        <div className="sip-file">
          <label htmlFor="csvFile" className="sip-file-label">
            <span className="sip-file-title">Selecciona archivo</span>
            <span className="sip-file-name">{fileName || 'Ningún archivo seleccionado'}</span>
          </label>
          <input
            id="csvFile"
            type="file"
            accept=".csv,text/csv"
            ref={fileInputRef}
            onChange={onFileChange}
          />
        </div>

        {result && (
          <div className="mt-2 small">
            ✔️ {result.created} creados, ♻️ {result.updated} actualizados
            {result.errores?.length > 0 && (
              <details>
                <summary>⚠️ Errores ({result.errores.length})</summary>
                <ul>{result.errores.map((e,i)=><li key={i}>{e}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="sip-footer">
        <div className="sip-actions-left">
          <button type="button" className="btn btn-outline-secondary" onClick={handleDownloadFullCSV} disabled={loading}>
            ⬇️ Descargar CSV (todos)
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={handleDownloadTemplateCSV} disabled={loading}>
            ⬇️ Descargar plantilla mínima
          </button>
        </div>

        <button type="submit" className="btn btn-primary sip-primary" disabled={loading}>
          {loading ? 'Importando…' : 'Importar'}
        </button>
      </div>
    </form>
  );
};

export default StudentImportPanel;
