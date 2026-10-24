import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import apiClient, { setAccessToken } from '../api/client';
import { RouteSkeleton } from '../components/Skeleton';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True from the moment logout starts until the router has actually landed
  // on '/'. React Router v7 applies navigate() as a low-priority transition,
  // while setUser(null) commits immediately - so for one render the old
  // protected page sees user=null, and its guard's <Navigate to="/login"/>
  // would win the race. Holding this flag until the location really changes
  // keeps the guards neutral for that whole window.
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loggingOut && location.pathname === '/') setLoggingOut(false);
  }, [loggingOut, location.pathname]);

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
    setLoggingOut(true);
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
      navigate('/', { replace: true });
    }
  };

  // Never block the whole app (including public pages like Landing) on this
  // network round-trip - only routes that actually require a known auth
  // state (ProtectedRoute/AdminRoute below) wait on `loading`. This matters
  // a lot in practice: the Render backend's free tier cold-starts after
  // idling, so this call alone can take 30-60s, and the app used to show a
  // blank "Loading..." screen for that whole window on every single visit,
  // even to pages that need no login at all.
  return (
    <AuthContext.Provider value={{ user, loading, loggingOut, login, loginAdmin, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const ProtectedRoute = ({ children }) => {
  const { user, loading, loggingOut } = useAuth();

  if (loading || loggingOut) return <RouteSkeleton />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
