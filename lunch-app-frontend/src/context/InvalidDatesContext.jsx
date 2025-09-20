import { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const InvalidDatesContext = createContext();

export function InvalidDatesProvider({ children }) {
  const [invalidDates, setInvalidDates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // fetchInvalidDates: llamada manual desde los paneles
  const fetchInvalidDates = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setInvalidDates(null);
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/invalid-dates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvalidDates(res.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <InvalidDatesContext.Provider value={{ invalidDates, loading, error, fetchInvalidDates }}>
      {children}
    </InvalidDatesContext.Provider>
  );
}

export function useInvalidDates() {
  return useContext(InvalidDatesContext);
}
