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
const CSV_HEADERS_TEMPLATE = ['name','email','level','group']; // level: preescolar | primaria | secundaria

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

const StudentImportPanel = ({ onSuccess, onCancel }) => {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // === Descargas ===
  const handleDownloadFullCSV = async () => {
    try {
      const list = await fetchAllStudentsFlat();
      const rows = list.map(s => toCsvRow([
        s.studentId || '',
        s.name || '',
        s.email || '',
        s.level || '',
        s.groupName || '',
        s.photoUrl || '',
        s.tokens ?? '',
        s.hasSpecialPeriod ? 'TRUE' : 'FALSE',
        s.specialStartDate || '',
        s.specialEndDate || '',
        s.status || ''
      ]));
      downloadCsv(`students_full_${dayjs().format('YYYYMMDD_HHmm')}.csv`, CSV_HEADERS_FULL, rows);
    } catch {
      setErrorMsg('No se pudo descargar el CSV de estudiantes.');
      setTimeout(()=>setErrorMsg(''), 3500);
    }
  };

  const handleDownloadTemplateCSV = () => {
    downloadCsv(
      `students_template_min_${dayjs().format('YYYYMMDD_HHmm')}.csv`,
      CSV_HEADERS_TEMPLATE,
      []
    );
  };

  // === Importación ===
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
            const {
              'group.level': level, 'group.name': name,
              'specialPeriod.startDate': startDate,
              'specialPeriod.endDate': endDate, ...rest
            } = row;

            return {
              ...rest,
              tokens: parseInt(row.tokens || 0, 10),
              hasSpecialPeriod: row.hasSpecialPeriod === 'TRUE' || row.hasSpecialPeriod === true,
              group: { level: (level || row.level || '').toLowerCase(), name: name || row.group },
              specialPeriod:
                (row.hasSpecialPeriod === 'TRUE' || row.hasSpecialPeriod === true)
                  ? { startDate: startDate || row['specialPeriod.startDate'] || null,
                      endDate: endDate || row['specialPeriod.endDate'] || null }
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

  // === Cancelar ===
  const handleCancel = () => {
    if (typeof onCancel === 'function') {
      onCancel();
      return;
    }
    // Fallback: reset local del formulario
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFileName('');
    setResult(null);
    setLoading(false);
    setErrorMsg('');
    setSuccessMsg('');
  };

  return (
    <form onSubmit={handleFileUpload} className="card p-3 p-md-5 shadow-sm">
      {/* Alertas */}
      {errorMsg && <div className="alert alert-danger mb-3" role="alert">{errorMsg}</div>}
      {successMsg && <div className="alert alert-success mb-3" role="alert">{successMsg}</div>}

      {/* Paso 1: Descargas */}
      <div className="mb-3">
        <div className="d-flex align-items-center mb-2">
          <span className="badge rounded-pill text-bg-primary me-2">1</span>
          <h6 className="m-0">Descargar archivos CSV</h6>
        </div>

        {/* En móvil: botones a 100% ancho; en escritorio siguen grandes pero contenidos */}
        <div className="d-grid gap-2">
          <button
            type="button"
            className="btn btn-outline-primary btn-lg w-100"
            onClick={handleDownloadFullCSV}
            disabled={loading}
            aria-label="Descargar CSV completo de estudiantes"
          >
            <span className="me-2">⬇️</span> Descargar la información de los usuarios en un archivo CSV
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-lg w-100"
            onClick={handleDownloadTemplateCSV}
            disabled={loading}
            aria-label="Descargar plantilla CSV"
          >
            <span className="me-2">⬇️</span> Descargar la plantilla CSV en blanco
          </button>
        </div>
      </div>

      {/* Paso 2: Instrucciones + tabla muestra */}
      <div className="mb-3">
        <div className="d-flex align-items-center mb-2">
          <span className="badge rounded-pill text-bg-primary me-2">2</span>
          <h6 className="m-0">Agregar o editar la información en la plantilla</h6>
        </div>
        <p className="text-muted mb-2">
          Campos obligatorios: <code>name</code>, <code>email</code>, <code>level</code>, <code>group</code>.
          El <code>studentId</code> se genera automáticamente para altas nuevas.
        </p>

        {/* Tabla responsive (compacta en pantallas pequeñas) */}
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle mb-2">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Level</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Juan Pérez</td>
                <td>juan@colegio.mx</td>
                <td>primaria</td>
                <td>3B</td>
              </tr>
            </tbody>
          </table>
        </div>

        <small className="text-muted">
          Formato de fecha cuando aplique: <code>YYYY-MM-DD</code>. Para actualizaciones masivas usa el CSV completo.
        </small>
      </div>

      {/* Paso 3: Subir CSV */}
      <div className="mb-4">
        <div className="d-flex align-items-center mb-2">
          <span className="badge rounded-pill text-bg-primary me-2">3</span>
          <h6 className="m-0">Subir un archivo CSV</h6>
        </div>

        {/* En móvil apila, en escritorio se muestra en línea */}
        <input
          type="file"
          accept=".csv,text/csv"
          id="csvFile"
          ref={fileInputRef}
          onChange={onFileChange}
          className="visually-hidden"
        />

        {/* UI custom: botón + “campo” con el nombre, apilado en móvil */}
        <div className="d-flex flex-column flex-md-row gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-controls="csvFile"
          >
            {fileName ? 'Cambiar' : 'Elegir archivo'}
          </button>

          <div className="form-control text-truncate" aria-live="polite">
            {fileName || 'Ningún archivo seleccionado'}
          </div>
        </div>

        <small id="csvHelp" className="form-text">
          {fileName ? `Seleccionado: ${fileName}` : 'Selecciona un archivo .csv'}
        </small>

        {result && (
          <div className="alert alert-info mt-3 mb-0">
            <div><strong>Resultado:</strong></div>
            <div>✔️ {result.created} creados, ♻️ {result.updated} actualizados</div>
            {result.errores?.length > 0 && (
              <details className="mt-1">
                <summary>⚠️ Errores ({result.errores.length})</summary>
                <ul className="mb-0">{result.errores.map((e,i)=><li key={i}>{e}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Footer de acciones: apilado en móvil, horizontal desde sm */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-stretch gap-2">
        <div className="text-muted small">
          Tamaño recomendado &lt; 5MB.
        </div>
        <button
          type="submit"
          className="btn btn-primary w-100 w-sm-auto"
          disabled={loading}
        >
          {loading ? 'Importando…' : 'Importar'}
        </button>
      </div>
    </form>
  );
};

export default StudentImportPanel;
