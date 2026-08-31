import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

let accessToken: string | null = null;
let sessionExpiredCallback: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const setSessionExpiredCallback = (cb: () => void) => {
  sessionExpiredCallback = cb;
};

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Type': 'web',
  },
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return config;
});

export const bootstrapSession = async (): Promise<string | null> => {
  try {
    const response = await axios.post<{ access_token: string }>(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/refresh`,
      {},
      {
        withCredentials: true,
        headers: {
          'X-Client-Type': 'web',
          'Content-Type': 'application/json',
        },
      }
    );
    const newAccessToken = response.data.access_token;
    setAccessToken(newAccessToken);
    return newAccessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) return Promise.reject(error);

    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/v1/auth/login' && originalRequest.url !== '/v1/auth/refresh') {
      
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post<{ access_token: string }>(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              'X-Client-Type': 'web',
              'Content-Type': 'application/json',
            },
          }
        );

        const newAccessToken = response.data.access_token;
        setAccessToken(newAccessToken);
        isRefreshing = false;
        onRefreshed(newAccessToken);

        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        setAccessToken(null);
        if (sessionExpiredCallback) {
          sessionExpiredCallback();
        }
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 403) {
      // 403 Forbidden: user is authenticated but lacks permission.
      // Do not refresh token, do not redirect to login. Preserve error for caller.
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
