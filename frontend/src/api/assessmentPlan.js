import apiClient from './client';

export const assessmentPlanApi = {
  // 1. GET /assessments/{id}/plan?lang=
  getAssessmentPlan: async (id, lang = 'en') => {
    return apiClient.get(`/assessments/${id}/plan?lang=${encodeURIComponent(lang)}`);
  },

  // 2. POST /whatif
  simulateWhatIf: async (payload, lang = 'en') => {
    return apiClient.post(`/whatif?lang=${encodeURIComponent(lang)}`, payload);
  },

  // 3. GET /assessments/{id}/schemes?lang=
  getAssessmentSchemes: async (id, lang = 'en') => {
    return apiClient.get(`/assessments/${id}/schemes?lang=${encodeURIComponent(lang)}`);
  },

  // 4. GET /schemes/{id}/checklist?lang=
  getSchemeChecklist: async (id, lang = 'en') => {
    return apiClient.get(`/schemes/${id}/checklist?lang=${encodeURIComponent(lang)}`);
  },

  // 5. PUT /schemes/{id}/my-status
  updateSchemeStatus: async (id, status) => {
    return apiClient.put(`/schemes/${id}/my-status`, { status });
  },

  // 6. GET /assessments/{id}/report.pdf?lang=
  downloadReportPdf: async (id, lang = 'en') => {
    return apiClient.get(`/assessments/${id}/report.pdf?lang=${encodeURIComponent(lang)}`, {
      responseType: 'blob'
    });
  }
};

export default assessmentPlanApi;
