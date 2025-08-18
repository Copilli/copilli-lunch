import { useEffect, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import OficinaPanel from './pages/OficinaPanel';
import CocinaPanel from './pages/CocinaPanel';
import AdminPayments from './pages/AdminPayments';
import AdminCutoffs from './pages/AdminCutoffs';


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
      {/* Si no hay usuario, mostrar login */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to={
                user.role === 'admin'
                  ? '/admin'
                  : user.role === 'oficina'
                  ? '/oficina'
                  : user.role === 'cocina'
                  ? '/cocina'
                  : '/'
              }
              replace
            />
          ) : (
            <Login onLogin={setUser} />
          )
        }
      />

      {/* Rutas protegidas */}
      <Route path="/admin" element={<AdminPanel setUser={setUser} />} />
      <Route path="/oficina" element={<OficinaPanel setUser={setUser} />} />
      <Route path="/cocina" element={<CocinaPanel setUser={setUser} />} />
      <Route path="/admin/payments" element={<AdminPayments />} />
      <Route path="/admin/cutoffs" element={<AdminCutoffs />} />

      {/* Cualquier otra ruta redirige al login */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default App;
