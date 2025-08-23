import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TopNavBar = ({ children, setUser, onImportClick, showImport }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user'));
  const BASE = (import.meta.env?.base || import.meta.env?.BASE_URL || '/');

  // Redirección al entrar en "/"
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
    // salir “duro” al root para no quedar en /admin/payments o /admin/cutoffs
    window.location.replace(BASE);
  };

  const handleHome = () => { window.location.href = BASE; };
  const goPayments = () => navigate('/admin/payments');
  const goCutoffs  = () => navigate('/admin/cutoffs');

  return (
    <div className="bg-light border-bottom">
      <div className="container py-2">
        {/* Fila de acciones */}
        <div className="row g-2 align-items-center">
          {/* Grupo de navegación izquierda */}
          <div className="col-12 col-md-auto">
            <div className="btn-group" role="group" aria-label="Navegación principal">
              <button type="button" className="btn btn-outline-primary" onClick={handleHome}>
                Inicio
              </button>
              {user?.role === 'admin' && (
                <>
                  <button type="button" className="btn btn-outline-secondary" onClick={goPayments}>
                    Pagos
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={goCutoffs}>
                    Cortes
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Import (si aplica) */}
          {showImport && (
            <div className="col-6 col-md-auto">
              <button type="button" className="btn btn-success w-100" onClick={onImportClick}>
                Importar estudiantes
              </button>
            </div>
          )}

          {/* Logout a la derecha */}
          <div className="col-6 col-md-auto ms-md-auto">
            <button type="button" className="btn btn-outline-danger w-100" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>

          {/* Search centrado en una fila aparte; 100% en móvil, máx. 800px en desktop */}
          {children && (
            <div className="col-12">
              <div
                className="mx-auto"
                style={{ maxWidth: 800 }}
              >
                {children}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopNavBar;
