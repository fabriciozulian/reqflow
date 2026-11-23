import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  apiFetch,
  getToken,
  getStoredUser,
  setStoredSession,
  clearStoredSession,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const currentToken = getToken();
      if (!currentToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch('/api/auth/me');
        if (res && res.user) {
          setUser(res.user);
          setStoredSession(currentToken, res.user);
        }
      } catch {
        clearStoredSession();
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = async (email, senha) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
    setStoredSession(res.token, res.user);
    setToken(res.token);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    clearStoredSession();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(token && user),
        isAdmin: user?.perfil === 'ADMIN',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
