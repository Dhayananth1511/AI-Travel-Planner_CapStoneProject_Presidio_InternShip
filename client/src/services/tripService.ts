import api from '../lib/axios';

export const tripService = {
  async getTrips() {
    const res = await api.get('/trips');
    return res.data;
  },

  async getTripById(tripId: string) {
    const res = await api.get(`/trips/${tripId}`);
    return res.data;
  },

  async planTrip(payload: { message: string; tripId?: string; confirmCancel?: boolean }) {
    const res = await api.post('/trips/plan', payload);
    return res.data;
  },

  async selectHotel(tripId: string, payload: { hotelName: string; category: string }) {
    const res = await api.post(`/trips/${tripId}/select-hotel`, payload);
    return res.data;
  },

  async selectTransport(tripId: string, payload: { operator: string; mode: string }) {
    const res = await api.post(`/trips/${tripId}/select-transport`, payload);
    return res.data;
  },

  async approveTrip(tripId: string) {
    const res = await api.post(`/trips/${tripId}/approve`);
    return res.data;
  },

  async rejectTrip(tripId: string, reason: string) {
    const res = await api.post(`/trips/${tripId}/reject`, { reason });
    return res.data;
  },

  async cancelTrip(tripId: string) {
    const res = await api.post(`/trips/${tripId}/cancel`);
    return res.data;
  },

  async deleteTrip(tripId: string) {
    const res = await api.delete(`/trips/${tripId}`);
    return res.data;
  },

  async syncCalendar(tripId: string) {
    const res = await api.post(`/trips/${tripId}/sync-calendar`);
    return res.data;
  },

  async getGoogleOAuthUrl(tripId?: string) {
    const res = await api.get(`/auth/google${tripId ? `?tripId=${tripId}` : ''}`);
    return res.data;
  },

  // Razorpay MCP — create a payment order before checkout
  async createRazorpayOrder(tripId: string) {
    const res = await api.post(`/trips/${tripId}/razorpay-order`);
    return res.data as {
      success: boolean;
      orderId?: string;
      keyId?: string;
      amount_inr?: number;           // Only accommodation + transport (the bookable amount)
      accommodation_cost?: number;   // Hotel portion of the bill
      transport_cost?: number;       // Transit portion of the bill
      error?: string;
    };
  },

  // Razorpay MCP — verify payment signature server-side and approve the trip
  async verifyPaymentAndApprove(
    tripId: string,
    payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  ) {
    const res = await api.post(`/trips/${tripId}/verify-payment`, payload);
    return res.data;
  },
};

