import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AuthResponse, LoginRequest, User, AnalyticsKPI } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api/${API_VERSION}`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', credentials);
    this.setToken(response.data.token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  }

  async logout(): Promise<void> {
    this.clearToken();
  }

  async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined') return null;
    
    const token = this.getToken();
    if (!token) return null;

    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch {
      return null;
    }
  }

  async getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    facilityId?: string;
  }): Promise<AnalyticsKPI> {
    const response = await this.client.get<AnalyticsKPI>('/analytics/kpis', { params });
    return response.data;
  }

  async getForecast(params: {
    metric: string;
    model: string;
    startDate: string;
    endDate: string;
    horizon: number;
    frequency: string;
  }): Promise<any> {
    const response = await this.client.post('/analytics/forecast', params);
    return response.data;
  }

  async getInsights(params?: {
    startDate?: string;
    endDate?: string;
    facilityId?: string;
  }): Promise<any> {
    const response = await this.client.get('/analytics/insights', { params });
    return response.data;
  }

  async getGovernanceAuditLogs(params?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    action?: string;
  }): Promise<any> {
    const response = await this.client.get('/analytics/governance/audit-logs', { params });
    return response.data;
  }
}

export const apiClient = new ApiClient();
