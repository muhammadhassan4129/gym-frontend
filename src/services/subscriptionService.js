import API from '../api';

const subscriptionService = {
  async getSubscriptions() {
    const response = await API.get('/subscriptions');

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid subscriptions response received');
    }

    return response.data;
  },

  async createSubscription(data) {
    const response = await API.post('/subscriptions', data);
    return response.data;
  },

  async cancelSubscription(id) {
    const response = await API.patch(
      `/subscriptions/${encodeURIComponent(id)}/cancel`
    );

    return response.data;
  },
};

export default subscriptionService;