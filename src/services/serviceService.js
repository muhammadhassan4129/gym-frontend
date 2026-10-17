import API from '../api';

const serviceService = {
  async getServices() {
    const response = await API.get('/services');

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid services response received');
    }

    return response.data;
  },

  async createService(data) {
    const response = await API.post('/services', data);
    return response.data;
  },

  async updateService(id, data) {
    const response = await API.put(
      `/services/${encodeURIComponent(id)}`,
      data
    );

    return response.data;
  },
};

export default serviceService;