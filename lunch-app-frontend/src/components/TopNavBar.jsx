// src/components/TopNavBar.jsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Props:
 * - setUser?: fn
 * - onImportClick?: fn
 * - showImport?: boolean
 * - searchHideAt?: number   // px; oculta el buscador en desktop por debajo de este ancho, antes del colapso
 */
const TopNavBar = ({ children, setUser, onImportClick, showImport, searchHideAt = 1100 }) => {
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
    <nav className="navbar navbar-expand-md navbar-light bg-light border-bottom shadow-sm mb-3 mb-md-4 justify-content-center">
      <div className="container-fluid">
        {/* Brand / Inicio - only for mobile */}
        <button className="btn btn-outline-primary d-md-none me-2" onClick={handleHome} style={{ marginBottom: '0.5rem' }}>
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
          style={{ marginBottom: '0.5rem' }}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Contenido colapsable */}
        <div className="collapse navbar-collapse" id="navbarMain">
          {/* ======== MÓVIL (≤ md): botones a ancho completo ======== */}
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

              {/* Buscador en móvil (siempre visible dentro del colapso) */}
              {children && (
                <div className="my-2 topnav-search-mobile">
                  {children}
                </div>
              )}

              <button className="btn btn-outline-danger w-100" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* ======== DESKTOP (≥ md): layout centrado ======== */}
          <div className="d-none d-md-flex align-items-center justify-content-center gap-2">
            {/* Brand / Inicio - desktop */}
            <button type="button" className="btn btn-outline-primary" onClick={handleHome}>
              Inicio
            </button>

            {/* Navegación */}
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

            {/* Import opcional */}
            {showImport && (
              <button type="button" className="btn btn-success" onClick={onImportClick}>
                Importar estudiantes
              </button>
            )}

            {/* Buscador (centrado con el resto) */}
            {children && (
              <div className="topnav-search-desktop" style={{ maxWidth: 500 }}>
                {children}
              </div>
            )}

            {/* Logout (centrado junto con todo) */}
            <button type="button" className="btn btn-outline-danger" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Ajustes finos + regla para ocultar buscador en desktop bajo cierto ancho */}
      <style>{`
        @media (max-width: 767.98px) {
          .navbar .btn { border-radius: .75rem; }
          .navbar .form-control { border-radius: .75rem; }
          .navbar .btn-outline-primary,
          .navbar .navbar-toggler {
            margin-bottom: 0.5rem;
          }
        }

        /* Oculta SOLO el buscador de la vista desktop cuando el viewport
           es menor al umbral pero aún ≥ md (no afecta el de móvil). */
        @media (max-width: ${searchHideAt}px) and (min-width: 768px) {
          .topnav-search-desktop { display: none !important; }
        }
      `}</style>
    </nav>
  );
};

export default TopNavBar;
