import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import apiClient, { setAccessToken } from '../api/client';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchMe = async () => {
    try {
      const res = await apiClient.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // On initial load, try to refresh token and get user
    const initAuth = async () => {
      try {
        const res = await apiClient.post('/auth/refresh');
        setAccessToken(res.data.access_token);
        await fetchMe();
      } catch (err) {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  // Both portals post OAuth2 form-encoded credentials; only the path differs.
  const loginAt = async (path, email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await apiClient.post(path, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    setAccessToken(res.data.access_token);
    await fetchMe();
    return res.data;
  };

  // User portal: accepts any active account.
  const login = (email, password) => loginAt('/auth/login/user', email, password);

  // Admin console: the endpoint rejects non-admin accounts with a 403.
  const loginAdmin = (email, password) => loginAt('/auth/login/admin', email, password);

  const register = async (userData) => {
    await apiClient.post('/auth/register', userData);
    // After register, automatically log in
    await login(userData.email, userData.password);
  };

  const logout = async () => {
    // Capture before state clears - the draft key is derived from the user id.
    const userId = user?.id;
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      // Never leave one user's financial draft behind for the next person
      // on this browser.
      try {
        if (userId) localStorage.removeItem(`finshield_assessment:${userId}`);
        localStorage.removeItem('finshield_assessment');
      } catch {
        // Storage unavailable (private mode); nothing to clean up.
      }
      navigate('/login');
    }
  };

  if (loading) {
    return <div>Loading...</div>; // or a proper spinner
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAdmin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};
