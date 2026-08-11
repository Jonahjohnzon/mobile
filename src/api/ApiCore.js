import axios from 'axios';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const client = axios.create({
  baseURL: process.env.EXPO_PUBLIC_MOVIELINK,
  timeout: 15000,
});

client.defaults.headers.common['Authorization'] = process.env.EXPO_PUBLIC_BEARER;
client.defaults.headers.common['accept'] = 'application/json';

client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('API error:', error.response);
    // No response at all = network error, timeout, offline, etc. Nothing
    // to read a status code off of, so handle it before anything below
    // touches `error.response`.
    if (!error.response) {
      return Promise.reject(
        new ApiError(error.message || 'Network error — check your connection.', 0)
      );
    }

    const status = error.response.status;

    // Unlike the web app, there's no `window.location` to redirect with —
    // a mobile screen can't "navigate away" from inside an interceptor
    // without a nav ref. So 404/403 are just surfaced as typed errors and
    // it's up to the screen (or a nav-ref helper, if you wire one up) to
    // decide whether that means bouncing to a NotFound screen.
    const message =
      (error.response.data && error.response.data['message']) ||
      (status === 401 ? 'Invalid credentials' : null) ||
      error.message ||
      'Something went wrong.';

    return Promise.reject(new ApiError(message, status));
  }
);

export default class Apicore {
  async get(endpoint, queryParams = {}) {
    // Deliberately not caught here — same reasoning as the web version.
    // Callers (see HomeScreen using Promise.allSettled) decide how to
    // degrade; this just does the fetch.
    const response = await client.get(endpoint, { params: queryParams });
    return response.data;
  }
}

export const api = new Apicore();
