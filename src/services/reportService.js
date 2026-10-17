import API from '../api';

const reportService = {
  async getSummary({ startDate, endDate }) {
    const response = await API.get('/reports/summary', {
      params: { startDate, endDate },
    });

    const data = response.data;

    if (
      !data ||
      !data.period ||
      !Number.isFinite(data.totalIncome) ||
      !Number.isFinite(data.totalExpenses) ||
      !Number.isFinite(data.netProfit)
    ) {
      throw new Error('Invalid financial report response received');
    }

    return data;
  },

  async downloadPdf({ startDate, endDate }) {
    let response;

    try {
      response = await API.get('/reports/pdf', {
        params: { startDate, endDate },
        responseType: 'blob',
      });
    } catch (error) {
      // Axios returns API errors as a Blob when responseType is blob.
      const errorData = error.response?.data;

      if (errorData instanceof Blob) {
        let serverMessage = '';

        try {
          const parsed = JSON.parse(await errorData.text());
          serverMessage = parsed.message || '';
        } catch {
          // Keep the original request error if parsing fails.
        }

        if (serverMessage) {
          throw new Error(serverMessage);
        }
      }

      throw error;
    }

    const blob = response.data;

    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('The server returned an empty PDF');
    }

    const signature = await blob.slice(0, 5).text();

    if (signature !== '%PDF-') {
      throw new Error(
        'The server did not return a valid PDF. Check the report endpoint.'
      );
    }

    return blob;
  },
};

export default reportService;