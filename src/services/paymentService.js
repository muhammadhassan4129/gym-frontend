import API from '../api';

const paymentService = {
  async getPayments() {
    const response = await API.get('/payments');

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid payments response');
    }

    return response.data;
  },

  async getPayment(id) {
    const response = await API.get(
      `/payments/${encodeURIComponent(id)}`
    );

    return response.data;
  },

  async recordPayment(payload) {
    const response = await API.post('/payments/pay', payload);
    return response.data;
  },
};

export default paymentService;