import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('logitrack_token'));

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('logitrack_token');
      if (storedToken) {
        try {
          const response = await api.get('/auth/me');
          if (response.data.user) {
            setUser(response.data.user);
            if (response.data.user.langue_preferee) {
              localStorage.setItem('logitrack_langue', response.data.user.langue_preferee);
              window.dispatchEvent(new Event('langue-changed'));
            }
          } else if (response.data.operateur) {
            const op = response.data.operateur;
            const role = op.is_admin ? 'admin' : (response.data.role || 'operateur');
            setUser({ ...op, role });
            if (op.langue_preferee) {
              localStorage.setItem('logitrack_langue', op.langue_preferee);
              window.dispatchEvent(new Event('langue-changed'));
            }
          }
        } catch (error) {
          console.error('Erreur de vérification du token:', error);
          localStorage.removeItem('logitrack_token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Login avec username/password (admin)
  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user } = response.data;
      
      localStorage.setItem('logitrack_token', token);
      setToken(token);
      setUser(user);
      if (user.langue_preferee) {
        localStorage.setItem('logitrack_langue', user.langue_preferee);
        window.dispatchEvent(new Event('langue-changed'));
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Erreur de connexion' 
      };
    }
  };

  // Login avec code opérateur (6 chiffres)
  const loginWithCode = async (code) => {
    try {
      const response = await api.post('/auth/login-code', { code });
      const { token, operateur } = response.data;
      
      localStorage.setItem('logitrack_token', token);
      setToken(token);
      // Gérer les opérateurs promus admin
      const role = operateur.is_admin ? 'admin' : 'operateur';
      setUser({ ...operateur, role });
      if (operateur.langue_preferee) {
        localStorage.setItem('logitrack_langue', operateur.langue_preferee);
        window.dispatchEvent(new Event('langue-changed'));
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Code invalide' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('logitrack_token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    loginWithCode,
    logout,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    isOperateur: user?.role === 'operateur'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
