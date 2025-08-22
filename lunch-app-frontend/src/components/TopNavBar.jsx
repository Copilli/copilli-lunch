// src/components/TopNavBar.jsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TopNavBar = ({ children, setUser, onImportClick, showImport }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // 👇 MUY IMPORTANTE en Vite: BASE_URL (no "base")
  // En GH Pages suele ser "/copilli-lunch/" y SIEMPRE termina con "/"
  const BASE = (import.meta.env.BASE_URL || '/');

  // Helper para construir rutas absolutas respetando el base path
  const abs = (p = '') => `${BASE}${String(p).replace(/^\//, '')}`;

  // Navegación SPA con fallback a redirección dura (para páginas “pesadas”).
  const go = (path, { replace = false } = {}) => {
    try {
      navigate(path, { replace });
    } catch (_) {
      // ignore
    } finally {
      // Garantiza que la URL final respete el BASE, útil en GH Pages
      // (evita quedarse “atorado” en /admin/payments con token inválido)
      if (replace) {
        window.location.replace(abs(path));
      } else {
        window.location.assign(abs(path));
      }
    }
  };

  // 🔁 Redirección automática si se entra al root lógico de la app
  // Nota: si usas <BrowserRouter basename={import.meta.env.BASE_URL} />,
  // cuando estás en "/copilli-lunch/" el pathname expuesto será "/".
  useEffect(() => {
    if (location.pathname === '/') {
      if (!user) {
        go('login', { replace: true });
      } else if (user.role === 'admin') {
        go('admin', { replace: true });
      } else if (user.role === 'oficina') {
        go('oficina', { replace: true });
      } else if (user.role === 'cocina') {
        go('cocina', { replace: true });
      } else {
        go('login', { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.role]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser?.(null);
    // Forzamos ir a /copilli-lunch/login (o el BASE que corresponda)
    // replace = true evita que vuelvan atrás a una pantalla protegida.
    go('login', { replace: true });
  };

  const handleHome = () => {
    // Ir al inicio real de la app respetando BASE (hard redirect para limpiar estado)
    window.location.replace(BASE);
  };

  const goPayments = () => go('/admin/payments'); // SPA + fallback a /copilli-lunch/admin/payments
  const goCutoffs  = () => go('/admin/cutoffs');

  return (
    <div className="d-flex align-items-center p-3 bg-light border-bottom" style={{ gap: 16 }}>
      {/* Izquierda: Inicio */}
      <div>
        <button type="button" className="btn btn-outline-primary" onClick={handleHome}>
          Inicio
        </button>
      </div>

      {/* Admin shortcuts: Pagos / Cortes */}
      {user?.role === 'admin' && (
        <>
          <div>
            <button type="button" className="btn btn-outline-secondary" onClick={goPayments}>
              Pagos
            </button>
          </div>
          <div>
            <button type="button" className="btn btn-outline-secondary" onClick={goCutoffs}>
              Cortes
            </button>
          </div>
        </>
      )}

      {/* Importar (si aplica) */}
      {showImport && (
        <div>
          <button type="button" className="btn btn-success" onClick={onImportClick}>
            Importar estudiantes
          </button>
        </div>
      )}

      {/* Centro: SearchBar u otros children */}
      <div className="flex-grow-1 d-flex justify-content-center align-items-center">
        {children}
      </div>

      {/* Derecha: Cerrar sesión */}
      <div>
        {/* type="button" evita submits accidentales si hay formularios en la página */}
        <button type="button" className="btn btn-outline-danger" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default TopNavBar;
