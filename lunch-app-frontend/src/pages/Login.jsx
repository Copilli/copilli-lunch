import { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/auth/login`, {
        username,
        password,
      });

      const { token } = response.data;
      localStorage.setItem('token', token);

      const me = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const user = me.data;
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user); // La redirección ahora es responsabilidad de App.jsx
    } catch (err) {
      console.error(err);
      setError('Credenciales incorrectas o error de red');
    }
  };

  return (
    <div className="app-container login-container" style={{ maxWidth: 400, margin: 'auto', padding: '2rem' }}>
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleSubmit}>
        <label>Usuario:</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <br />
        <label>Contraseña:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <br />
        <button type="submit">Entrar</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </div>
  );
};

export default Login;
