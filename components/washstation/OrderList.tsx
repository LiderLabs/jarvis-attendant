'use client';

import { OrderCard } from './OrderCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Id } from '@jordan6699/washlab-backend/dataModel';
import { OrderStatus } from './OrderStatusBadge';

interface Order {
  _id: Id<'orders'>;
  orderNumber: string;
  status: OrderStatus;
  finalPrice: number;
  createdAt: number;
  serviceType?: string;
  estimatedLoads?: number;
  whitesSeparate?: boolean;
  totalPrice?: number;
  customer?: {
    name: string;
    phoneNumber: string;
    email?: string;
  } | null;
}

interface OrderListProps {
  orders: Order[];
  isLoading?: boolean;
  onOrderClick?: (orderId: Id<'orders'>) => void;
  emptyMessage?: string;
  branchServices?: any[];
}

export function OrderList({
  orders,
  isLoading = false,
  onOrderClick,
  emptyMessage = 'No orders found',
  branchServices = [],
}: OrderListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-48 rounded-lg" />
      ))}
    </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.map((order) => (
        <OrderCard
          key={order._id}
          order={{ ...order, services: branchServices }}
          onClick={() => onOrderClick?.(order._id)}
        />
      ))}
    </div>
  );
}
