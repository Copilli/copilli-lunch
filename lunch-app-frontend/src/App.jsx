// App.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import OficinaPanel from './pages/OficinaPanel';
import CocinaPanel from './pages/CocinaPanel';
import AdminPayments from './pages/AdminPayments';
import AdminCutoffs from './pages/AdminCutoffs';

// Wrapper centrado y con ancho máximo (usa la clase .app-container del CSS)
const AppShell = ({ children }) => (
  <main className="app-container">{children}</main>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    axios
      .get(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setUser(res.data))
      .catch(() => { localStorage.removeItem('token'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <Routes>
      {/* raíz: login o redirect por rol */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to={
                user.role === 'admin'   ? '/admin'  :
                user.role === 'oficina' ? '/oficina':
                user.role === 'cocina'  ? '/cocina' : '/'
              }
              replace
            />
          ) : (
            // Centra específicamente la pantalla de login
            <div className="login-page">
              <Login onLogin={setUser} />
            </div>
          )
        }
      />

      {/* Rutas protegidas (envueltas en AppShell) */}
      <Route path="/admin"          element={<AppShell><AdminPanel  setUser={setUser} /></AppShell>} />
      <Route path="/oficina"        element={<AppShell><OficinaPanel setUser={setUser} /></AppShell>} />
      <Route path="/cocina"         element={<AppShell><CocinaPanel  setUser={setUser} /></AppShell>} />
      <Route path="/admin/payments" element={<AppShell><AdminPayments /></AppShell>} />
      <Route path="/admin/cutoffs"  element={<AppShell><AdminCutoffs  /></AppShell>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default App;
