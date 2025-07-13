import { useNavigate } from 'react-router-dom';

const TopNavBar = ({ children }) => {
  const navigate = useNavigate();
  const base = import.meta.env.BASE_URL; // "/copilli-launch/"

  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate(base);
  };

  const handleHome = () => {
    if (!user) return navigate(base);

    if (user.role === 'admin') navigate(`${base}admin`);
    else if (user.role === 'oficina') navigate(`${base}oficina`);
    else if (user.role === 'cocina') navigate(`${base}cocina`);
    else navigate(base);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: '#f0f0f0',
      borderBottom: '1px solid #ccc'
    }}>
      <div>
        <button onClick={handleHome} style={{ marginRight: '1rem' }}>
          Inicio
        </button>
        <button onClick={handleLogout}>Cerrar sesión</button>
      </div>
      <div>{children}</div>
    </div>
  );
};

export default TopNavBar;
