import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { LoginRequest } from '@/types';

export function useAnalytics(params?: {
  startDate?: string;
  endDate?: string;
  facilityId?: string;
}) {
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => apiClient.getAnalytics(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useInsights(params?: {
  startDate?: string;
  endDate?: string;
  facilityId?: string;
}) {
  return useQuery({
    queryKey: ['insights', params],
    queryFn: () => apiClient.getInsights(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useForecast() {
  return useMutation({
    mutationFn: (params: {
      metric: string;
      model: string;
      startDate: string;
      endDate: string;
      horizon: number;
      frequency: string;
    }) => apiClient.getForecast(params),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (credentials: LoginRequest) => apiClient.login(credentials),
  });
}

export function useAuditLogs(params?: {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
}) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => apiClient.getGovernanceAuditLogs(params),
    staleTime: 1 * 60 * 1000,
  });
}
