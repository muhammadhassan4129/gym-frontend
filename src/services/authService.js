import API from '../api';

const authService = {
  async login({ username, password }) {
    const response = await API.post('/auth/login', {
      username,
      password,
    });

    const token = response.data?.token;

    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('Login response did not contain a valid token.');
    }

    localStorage.setItem('token', token);

    return response.data;
  },
};

export default authService;