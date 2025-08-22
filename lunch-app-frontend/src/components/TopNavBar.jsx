import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TopNavBar = ({ children, setUser, onImportClick, showImport }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user'));
  // Base segura (Vite expone BASE_URL); fallback a "/"
  const BASE = (import.meta.env?.base || import.meta.env?.BASE_URL || '/');

  // 🔁 Redirección automática si se entra en "/"
  useEffect(() => {
    if (location.pathname === '/') {
      if (!user) {
        navigate('/login', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'oficina') {
        navigate('/oficina', { replace: true });
      } else if (user.role === 'cocina') {
        navigate('/cocina', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [location.pathname, navigate, user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser?.(null);
    // Redirección "dura" al root/base (evita quedarse en /admin/payments o /admin/cutoffs)
    window.location.replace(BASE);
  };

  const handleHome = () => {
    window.location.href = BASE;
  };

  const goPayments = () => navigate('/admin/payments');
  const goCutoffs  = () => navigate('/admin/cutoffs');

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
