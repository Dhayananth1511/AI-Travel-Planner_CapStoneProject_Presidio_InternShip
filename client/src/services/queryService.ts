import api from '../lib/axios';

export interface SubmitQueryPayload {
  email: string;
  category: 'PAYMENT' | 'BOOKING' | 'CALENDAR' | 'OTHER';
  tripId?: string;
  paymentId?: string;
  amount?: number;
  message: string;
}

export const queryService = {
  async submitQuery(payload: SubmitQueryPayload) {
    const res = await api.post('/queries', payload);
    return res.data;
  },

  async getMyQueries() {
    const res = await api.get('/queries/my');
    return res.data;
  },

  async getAdminQueries(status?: string) {
    const res = await api.get('/admin/queries', { params: { status } });
    return res.data;
  },

  async resolveQuery(queryId: string, adminReply?: string) {
    const res = await api.post(`/admin/queries/${queryId}/resolve`, { adminReply });
    return res.data;
  }
};
