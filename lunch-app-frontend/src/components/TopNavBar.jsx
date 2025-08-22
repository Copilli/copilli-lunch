// src/components/TopNavBar.jsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TopNavBar = ({ children, setUser, onImportClick, showImport }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // BASE real de la app en GH Pages (siempre termina con "/")
  const BASE = import.meta.env.BASE_URL || '/';

  // helper SPA + fallback absoluto respetando BASE
  const go = (path, { replace = false } = {}) => {
    try { navigate(path, { replace }); } catch {}
  };

  // 🔁 Si entro al root lógico ("/"), redirigir al panel del rol
  //     siempre con un token de refresh en la query
  useEffect(() => {
    if (location.pathname === '/') {
      const r = Date.now();
      if (!user) {
        go(`/login?refresh=${r}`, { replace: true });
      } else if (user.role === 'admin') {
        go(`/admin?refresh=${r}`, { replace: true });
      } else if (user.role === 'oficina') {
        go(`/oficina?refresh=${r}`, { replace: true });
      } else if (user.role === 'cocina') {
        go(`/cocina?refresh=${r}`, { replace: true });
      } else {
        go(`/login?refresh=${r}`, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.role]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser?.(null);
    // salir a login con refresh para limpiar estados
    const r = Date.now();
    go(`/login?refresh=${r}`, { replace: true });
  };

  const handleHome = () => {
    // SOFT: navegar a "/" para que el efecto anterior te mande a /admin?refresh=...
    go('/', { replace: true });

    // Si prefieres recargar duro (como antes), descomenta:
    // window.location.replace(BASE);
  };

  const goPayments = () => go('/admin/payments');
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
        <button type="button" className="btn btn-outline-danger" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default TopNavBar;
