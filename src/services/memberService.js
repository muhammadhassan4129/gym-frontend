import API from '../api';

const memberService = {
  async getMembers(search = '') {
    const response = await API.get('/members', {
      params: search.trim() ? { search: search.trim() } : {},
    });

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid members response received');
    }

    return response.data;
  },

  async createMember(data) {
    const response = await API.post('/members', data);
    return response.data;
  },

  async updateMember(id, data) {
    const response = await API.put(
      `/members/${encodeURIComponent(id)}`,
      data
    );

    return response.data;
  },

  async getMemberLedger(id) {
    const response = await API.get(
      `/members/${encodeURIComponent(id)}/ledger`
    );

    return response.data;
  },
};

export default memberService;