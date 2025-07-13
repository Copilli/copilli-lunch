import { useEffect, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import OficinaPanel from './pages/OficinaPanel';
import CocinaPanel from './pages/CocinaPanel';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Para no mostrar nada mientras carga

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    axios
      .get(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null; // o un spinner si prefieres

  return (
    <Routes>
      <Route path="/" element={<Login onLogin={setUser} />} />
      {user?.role === 'admin' && <Route path="/admin" element={<AdminPanel />} />}
      {user?.role === 'oficina' && <Route path="/oficina" element={<OficinaPanel />} />}
      {user?.role === 'cocina' && <Route path="/cocina" element={<CocinaPanel />} />}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default App;
