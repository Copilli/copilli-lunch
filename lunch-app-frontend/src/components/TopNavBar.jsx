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

  return (
    <nav className="navbar navbar-expand-md navbar-light bg-light border-bottom shadow-sm">
      <div className="container-fluid">
        {/* Brand / Inicio */}
        <button
          className="btn btn-outline-primary me-2"
          onClick={() => (window.location.href = BASE)}
        >
          Inicio
        </button>

        {/* Toggler para móvil */}
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
          {/* Links de admin */}
          {user?.role === 'admin' && (
            <ul className="navbar-nav me-3">
              <li className="nav-item">
                <button className="btn btn-outline-secondary me-2" onClick={() => navigate('/admin/payments')}>
                  Pagos
                </button>
              </li>
              <li className="nav-item">
                <button className="btn btn-outline-secondary me-2" onClick={() => navigate('/admin/cutoffs')}>
                  Cortes
                </button>
              </li>
              {showImport && (
                <li className="nav-item">
                  <button className="btn btn-success me-2" onClick={onImportClick}>
                    Importar estudiantes
                  </button>
                </li>
              )}
            </ul>
          )}

          {/* Search centrado */}
          {children && (
            <div className="mx-auto my-2 my-md-0" style={{ maxWidth: 600, flex: 1 }}>
              {children}
            </div>
          )}

          {/* Logout siempre a la derecha */}
          <div className="ms-auto">
            <button className="btn btn-outline-danger" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TopNavBar;
