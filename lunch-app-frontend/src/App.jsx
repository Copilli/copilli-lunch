import { useEffect, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import OficinaPanel from './pages/OficinaPanel';
import CocinaPanel from './pages/CocinaPanel';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  // Redirigir al panel según el rol una vez que el usuario está autenticado
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    if (!user) return;

    if (user.role === 'admin') navigate(`${base}admin`);
    else if (user.role === 'oficina') navigate(`${base}oficina`);
    else if (user.role === 'cocina') navigate(`${base}cocina`);
    else navigate(base);
  }, [user]);

  if (loading) return null;

  return (
    <Routes>
      <Route path="/" element={<Login onLogin={setUser} />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/oficina" element={<OficinaPanel />} />
      <Route path="/cocina" element={<CocinaPanel />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default App;
