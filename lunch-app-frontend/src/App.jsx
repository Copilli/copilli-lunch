import { useEffect, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import OficinaPanel from './pages/OficinaPanel';
import CocinaPanel from './pages/CocinaPanel';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return null;

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to={
                user.role === 'admin'
                  ? `${import.meta.env.BASE_URL}admin`
                  : user.role === 'oficina'
                  ? `${import.meta.env.BASE_URL}oficina`
                  : user.role === 'cocina'
                  ? `${import.meta.env.BASE_URL}cocina`
                  : import.meta.env.BASE_URL
              }
              replace
            />
          ) : (
            <Login onLogin={setUser} />
          )
        }
      />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/oficina" element={<OficinaPanel />} />
      <Route path="/cocina" element={<CocinaPanel />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default App;
