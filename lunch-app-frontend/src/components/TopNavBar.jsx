import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TopNavBar = ({ children, setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user'));

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
    navigate(`${import.meta.env.base}`, { replace: true }); // redirige al inicio
  };

  const handleHome = () => {
    window.location.href = `${import.meta.env.base}`;
  };

  return (
    <div className="d-flex justify-content-between align-items-center p-3 bg-light border-bottom">
      <div>
        <button className="btn btn-outline-primary me-2" onClick={handleHome}>
          Inicio
        </button>
        <button className="btn btn-outline-danger" onClick={handleLogout}>Cerrar sesión</button>
      </div>
      <div style={{ minWidth: 300 }}>{children}</div>
    </div>
  );
};

export default TopNavBar;
