'use client';

import { useQuery } from 'convex/react';
import { api } from "@jordan6699/washlab-backend/api";

export interface StationStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  ordersByStatus: {
    pending: number;
    in_progress: number;
    ready_for_pickup: number;
    delivered: number;
    completed: number;
    cancelled: number;
  };
  averageOrderValue: number;
}

/**
 * Hook to fetch station dashboard statistics.
 *
 * ✅ Fixes:
 * - isLoading is only true while the token exists AND query hasn't resolved yet.
 * - When token is null (session still loading) we return isLoading: true so the
 *   dashboard waits rather than rendering empty zeroes.
 * - stats falls back to a safe zero-filled object so the dashboard never crashes
 *   on undefined optional chains.
 */
export function useStationStats(
  stationToken: string | null | undefined,
  startDate?: number,
  endDate?: number
) {
  const rawStats = useQuery(
    api.stations.getStationStats,
    stationToken
      ? { stationToken, startDate, endDate }
      : 'skip'
  ) as StationStats | undefined;

  // ✅ Token not yet available — treat as loading, not as "no data"
  const isLoading = !stationToken || rawStats === undefined;

  // ✅ Safe fallback so consumers never need to null-check ordersByStatus fields
  const stats: StationStats = rawStats ?? {
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    ordersByStatus: {
      pending: 0,
      in_progress: 0,
      ready_for_pickup: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
    },
    averageOrderValue: 0,
  };

  return { stats, isLoading };
}
