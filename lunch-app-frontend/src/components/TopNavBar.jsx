// src/components/TopNavBar.jsx
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
    window.location.replace(BASE);
  };

  const handleHome = () => { window.location.href = BASE; };
  const goPayments = () => navigate('/admin/payments');
  const goCutoffs  = () => navigate('/admin/cutoffs');

  return (
    <nav className="navbar navbar-expand-md navbar-light bg-light border-bottom shadow-sm mb-3 mb-md-4">
      <div className="container-fluid">
        {/* Brand / Inicio */}
        <button className="btn btn-outline-primary me-2" onClick={handleHome}>
          Inicio
        </button>

        {/* Toggler */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarMain"
          aria-controls="navbarMain"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Contenido colapsable */}
        <div className="collapse navbar-collapse" id="navbarMain">
          {/* ======== MÓVIL (≤ md): botones a ancho completo, espaciados uniformes ======== */}
          <div className="d-md-none w-100">
            <div className="d-grid gap-2">
              {user?.role === 'admin' && (
                <>
                  <button className="btn btn-outline-secondary w-100" onClick={goPayments}>
                    Pagos
                  </button>
                  <button className="btn btn-outline-secondary w-100" onClick={goCutoffs}>
                    Cortes
                  </button>
                </>
              )}

              {showImport && (
                <button className="btn btn-success w-100" onClick={onImportClick}>
                  Importar estudiantes
                </button>
              )}

              {/* Buscador a 100% con margen vertical */}
              {children && (
                <div className="my-1">
                  {children}
                </div>
              )}

              <button className="btn btn-outline-danger w-100" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* ======== DESKTOP (≥ md): layout en línea y centrado ======== */}
          <div className="d-none d-md-flex align-items-center w-100">
            {/* Izquierda: navegación */}
            <div className="btn-group me-2" role="group" aria-label="Navegación principal">
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

            {/* Import opcional */}
            {showImport && (
              <button type="button" className="btn btn-success me-2" onClick={onImportClick}>
                Importar estudiantes
              </button>
            )}

            {/* Buscador centrado (máx 800px) */}
            {children && (
              <div className="flex-grow-1" style={{ maxWidth: 800 }}>
                {children}
              </div>
            )}

            {/* Logout a la derecha */}
            <div className="ms-auto">
              <button type="button" className="btn btn-outline-danger" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ajustes finos de spacing en móvil */}
      <style>{`
        @media (max-width: 767.98px) {
          .navbar .btn { border-radius: .75rem; }         /* look más suave */
          .navbar .form-control { border-radius: .75rem; }
        }
      `}</style>
    </nav>
  );
};

export default TopNavBar;
