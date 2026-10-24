import axios from 'axios';

// Backend API base URL, from frontend/.env (see .env.example)
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('VITE_API_URL is not set. Copy frontend/.env.example to frontend/.env.');
}

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for cookies
});

// In-memory token storage
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

apiClient.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Prevent infinite loops if refresh fails
    if (originalRequest.url === '/auth/refresh') {
      return Promise.reject(error);
    }
    
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Calling refresh will send the httpOnly cookie automatically
        const res = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        
        if (res.status === 200) {
          setAccessToken(res.data.access_token);
          // Retry the original request
          originalRequest.headers['Authorization'] = `Bearer ${res.data.access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed (token expired/revoked)
        setAccessToken(null);
        // We could redirect to login here or let the context handle it
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  submitAssessment: async (data) => {
    return apiClient.post('/risk/assess', data);
  },

  // Expenses
  getExpenses: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/expenses?${query}`);
  },
  getExpenseSummary: async (month) => {
    return apiClient.get(`/expenses/summary?month=${month}`);
  },
  createExpense: async (data) => {
    return apiClient.post('/expenses', data);
  },
  updateExpense: async (id, data) => {
    return apiClient.patch(`/expenses/${id}`, data);
  },
  deleteExpense: async (id) => {
    return apiClient.delete(`/expenses/${id}`);
  },
  downloadExpenseReport: async (month) => {
    return apiClient.get(`/expenses/report.pdf?month=${month}`, { responseType: 'blob' });
  },

  // Profile
  updateProfile: async (data) => {
    return apiClient.patch('/auth/me', data);
  },
  getSessions: async () => {
    return apiClient.get('/auth/sessions');
  },
  revokeSession: async (id) => {
    return apiClient.delete(`/auth/sessions/${id}`);
  },

  // Scheme Endpoints
  getSchemes: async (params) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/schemes?${query}`);
  },
  getSchemeDetail: async (slug) => {
    return apiClient.get(`/schemes/${slug}`);
  },
  matchSchemes: async (profile) => {
    return apiClient.post('/schemes/match', profile);
  },
  quickMatchSchemes: async (profile) => {
    return apiClient.post('/schemes/quick-match', profile);
  },
  checkEligibility: async (id) => {
    return apiClient.get(`/schemes/${id}/eligibility`);
  },
  
  // User Schemes
  getUserSchemes: async () => {
    return apiClient.get('/user-schemes');
  },
  saveScheme: async (schemeId) => {
    return apiClient.post('/user-schemes', { scheme_id: schemeId });
  },
  updateSchemeStatus: async (id, data) => {
    return apiClient.patch(`/user-schemes/${id}`, data);
  },

  // Admin Endpoints
  getAdminStats: async () => {
    return apiClient.get('/admin/stats');
  },
  getAdminSchemes: async (params) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/schemes?${query}`);
  },
  getAdminSchemeDetail: async (idOrSlug) => {
    return apiClient.get(`/admin/schemes/${idOrSlug}`);
  },
  createScheme: async (data) => {
    return apiClient.post('/admin/schemes', data);
  },
  updateScheme: async (id, data) => {
    return apiClient.put(`/admin/schemes/${id}`, data);
  },
  updateAdminSchemeStatus: async (id, status) => {
    return apiClient.patch(`/admin/schemes/${id}/status`, { status });
  },
  deleteScheme: async (id, permanent = true) => {
    return apiClient.delete(`/admin/schemes/${id}?permanent=${permanent}`);
  },
  archiveScheme: async (id) => {
    return apiClient.delete(`/admin/schemes/${id}?permanent=false`);
  },
  importSchemes: async (formData) => {
    return apiClient.post('/admin/schemes/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getSchemeUpdates: async (status = 'pending') => {
    return apiClient.get(`/admin/scheme-updates?status=${status}`);
  },
  handleSchemeUpdate: async (id, action) => {
    return apiClient.post(`/admin/scheme-updates/${id}/${action}`);
  },
  getAdminUsers: async (params) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/users?${query}`);
  },
  updateAdminUser: async (id, data) => {
    return apiClient.patch(`/admin/users/${id}`, data);
  },
  getAdminAuditLogs: async (params) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/audit-logs?${query}`);
  },
  getAdminAnalytics: async () => {
    return apiClient.get('/admin/analytics');
  }
};

export default apiClient;
