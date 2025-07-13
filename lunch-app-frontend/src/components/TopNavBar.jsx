// src/components/TopNavBar.jsx
import { useNavigate } from 'react-router-dom';

const TopNavBar = ({ children }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
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
        <button onClick={() => navigate('/')} style={{ marginRight: '1rem' }}>
          Inicio
        </button>
        <button onClick={handleLogout}>Cerrar sesión</button>
      </div>
      <div>{children}</div>
    </div>
  );
};

export default TopNavBar;
