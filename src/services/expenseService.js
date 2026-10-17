import API from '../api';

const expenseService = {
  async getExpenses() {
    const response = await API.get('/expenses');

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid expenses response received');
    }

    return response.data;
  },

  async createExpense(data) {
    const response = await API.post('/expenses', data);
    return response.data;
  },

  async updateExpense(id, data) {
    const response = await API.put(
      `/expenses/${encodeURIComponent(id)}`,
      data
    );

    return response.data;
  },

  async deleteExpense(id) {
    const response = await API.delete(
      `/expenses/${encodeURIComponent(id)}`
    );

    return response.data;
  },
};

export default expenseService;