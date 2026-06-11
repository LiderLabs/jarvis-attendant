'use client';

import { usePaginatedQuery, useQuery } from 'convex/react';
import { api } from "@jordan6699/washlab-backend/api";
import { Id } from "@jordan6699/washlab-backend/dataModel";

export type OrderStatus = 
  | "pending_dropoff"
  | "checked_in"
  | "sorting"
  | "washing"
  | "drying"
  | "folding"
  | "ready"
  | "completed"
  | "cancelled"
  // Legacy statuses for backward compatibility
  | "pending"
  | "in_progress"
  | "ready_for_pickup"
  | "delivered";

export interface StationOrderFilters {
  status?: OrderStatus;
  orderType?: "walk_in" | "online";
  search?: string;
}

/**
 * Hook to fetch and manage station orders
 * Provides paginated order list with filtering
 */
export function useStationOrders(
  stationToken: string | null,
  filters?: StationOrderFilters
) {
  const result = usePaginatedQuery(
    api.stations.getStationOrders,
    stationToken ? {
      stationToken,
      status: filters?.status,
      orderType: filters?.orderType,
    } : 'skip',
    { initialNumItems: 200 }
  );

  return {
    orders: result.results ?? [],
    isLoading: result.status === 'LoadingFirstPage' || result.status === 'LoadingMore',
    loadMore: result.loadMore,
    hasMore: result.status === 'CanLoadMore',
  };
}

/**
 * Hook to fetch single order details.
 *
 * ✅ Fix: added `isSessionValid` guard so the query never fires until the
 * session is fully confirmed. Without this, the token could be present in
 * localStorage but the session verification query hasn't resolved yet,
 * causing the backend to throw "Invalid station session".
 */
export function useStationOrder(
  stationToken: string | null,
  orderId: Id<'orders'> | null,
  isSessionValid?: boolean
) {
  const order = useQuery(
    api.stations.getStationOrderDetails,
    stationToken && orderId && isSessionValid ? {
      stationToken,
      orderId,
    } : 'skip'
  );

  return {
    order: order ?? null,
    isLoading: order === undefined && stationToken !== null && orderId !== null && isSessionValid === true,
  };
}
