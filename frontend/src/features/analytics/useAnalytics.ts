import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  AnalyticsSummary,
  CategoryAnalyticsResponse,
  CompareResponse,
  HeatmapResponse,
  PaymentMethodAnalyticsResponse,
  TopMerchantsResponse,
  TrendResponse,
} from '../../types/analytics';

export interface AnalyticsPeriodParams {
  period?: 'week' | 'month' | 'last_month';
  from?: string;
  to?: string;
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      return api.get<AnalyticsSummary>('/analytics/summary');
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useAnalyticsByCategory(params: AnalyticsPeriodParams = { period: 'month' }) {
  return useQuery({
    queryKey: ['analytics-by-category', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.period) searchParams.append('period', params.period);
      if (params.from) searchParams.append('from', params.from);
      if (params.to) searchParams.append('to', params.to);
      const qs = searchParams.toString();
      return api.get<CategoryAnalyticsResponse>(`/analytics/by-category${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useAnalyticsTrend(
  params: AnalyticsPeriodParams & { granularity?: 'day' } = { period: 'month' }
) {
  return useQuery({
    queryKey: ['analytics-trend', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.period) searchParams.append('period', params.period);
      if (params.from) searchParams.append('from', params.from);
      if (params.to) searchParams.append('to', params.to);
      if (params.granularity) searchParams.append('granularity', params.granularity);
      const qs = searchParams.toString();
      return api.get<TrendResponse>(`/analytics/trend${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useAnalyticsPaymentMethod(params: AnalyticsPeriodParams = { period: 'month' }) {
  return useQuery({
    queryKey: ['analytics-payment-method', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.period) searchParams.append('period', params.period);
      if (params.from) searchParams.append('from', params.from);
      if (params.to) searchParams.append('to', params.to);
      const qs = searchParams.toString();
      return api.get<PaymentMethodAnalyticsResponse>(
        `/analytics/by-payment-method${qs ? `?${qs}` : ''}`
      );
    },
    staleTime: 30 * 1000,
  });
}

export function useTopMerchants(
  params: AnalyticsPeriodParams & { limit?: number } = { period: 'month', limit: 5 }
) {
  return useQuery({
    queryKey: ['analytics-top-merchants', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.period) searchParams.append('period', params.period);
      if (params.from) searchParams.append('from', params.from);
      if (params.to) searchParams.append('to', params.to);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      const qs = searchParams.toString();
      return api.get<TopMerchantsResponse>(`/analytics/top-merchants${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useAnalyticsCompare(period: 'month' = 'month') {
  return useQuery({
    queryKey: ['analytics-compare', period],
    queryFn: async () => {
      return api.get<CompareResponse>(`/analytics/compare?period=${period}`);
    },
    staleTime: 30 * 1000,
  });
}

export function useAnalyticsHeatmap(params: AnalyticsPeriodParams = { period: 'month' }) {
  return useQuery({
    queryKey: ['analytics-heatmap', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.period) searchParams.append('period', params.period);
      if (params.from) searchParams.append('from', params.from);
      if (params.to) searchParams.append('to', params.to);
      const qs = searchParams.toString();
      return api.get<HeatmapResponse>(`/analytics/heatmap${qs ? `?${qs}` : ''}`);
    },
    staleTime: 30 * 1000,
  });
}
