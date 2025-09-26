import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('Response Error:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.message,
      data: error.response?.data,
    });

    // Handle common error cases
    if (error.response?.status === 413) {
      throw new Error('File size too large. Please upload a smaller file.');
    }

    if (error.response?.status === 415) {
      throw new Error('Unsupported file type. Please upload PNG, JPG, JPEG, or PDF files.');
    }

    if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later.');
    }

    if (error.response?.status === 404) {
      throw new Error('Resource not found.');
    }

    // Return the original error if not handled
    return Promise.reject(error);
  }
);

export default api;