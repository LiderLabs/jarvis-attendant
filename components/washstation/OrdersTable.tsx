'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Id } from '@jordan6699/washlab-backend/dataModel';
import { Clock, Package, CheckCircle, Truck, PhoneCall, Pencil, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { OrderRowExpander } from './OrderRowExpander';

export type OrderStatus =
  | 'pending_dropoff' | 'checked_in' | 'sorting' | 'washing' | 'drying'
  | 'folding' | 'ready' | 'completed' | 'cancelled' | 'pending'
  | 'in_progress' | 'ready_for_pickup' | 'delivered';

interface OrdersTableProps {
  orders: Order[];
  stationToken?: string | null;
  onOrderClick?: (orderId: Id<'orders'>) => void;
  onCollectPayment?: (orderId: Id<'orders'>) => void;
  branchServices?: any[];
}

interface Order {
  _id: Id<'orders'>;
  orderNumber: string;
  status: OrderStatus;
  orderType?: 'walk_in' | 'online';
  paymentStatus?: string;
  paymentMethod?: string;
  serviceType?: string;
  actualWeight?: number;
  estimatedWeight?: number;
  finalPrice: number;
  createdAt: number;
  customer?: { name: string; phoneNumber: string; email?: string } | null;
  bagCardNumber?: string;
  statusHistory?: Array<{ status: string; changedAt: number }>;
}

const getStatusBadge = (status: OrderStatus) => {
  const statusConfig: Record<string, { label: string; className: string; icon: LucideIcon }> = {
    pending_dropoff: { label: 'New Order', className: 'bg-primary/10 text-primary', icon: Clock },
    pending: { label: 'New Order', className: 'bg-primary/10 text-primary', icon: Clock },
    checked_in: { label: 'Checked in', className: 'bg-warning/10 text-warning', icon: Package },
    sorting: { label: 'Sorting', className: 'bg-warning/10 text-warning', icon: Package },
    washing: { label: 'Washing', className: 'bg-warning/10 text-warning', icon: Package },
    drying: { label: 'Drying', className: 'bg-warning/10 text-warning', icon: Package },
    folding: { label: 'Folding', className: 'bg-warning/10 text-warning', icon: Package },
    in_progress: { label: 'In Progress', className: 'bg-warning/10 text-warning', icon: Package },
    ready: { label: 'Ready for Pickup', className: 'bg-success/10 text-success', icon: CheckCircle },
    ready_for_pickup: { label: 'Ready for Pickup', className: 'bg-success/10 text-success', icon: CheckCircle },
    completed: { label: 'Delivered', className: 'bg-muted text-muted-foreground', icon: Truck },
    delivered: { label: 'Delivered', className: 'bg-muted text-muted-foreground', icon: Truck },
    cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive', icon: Clock },
  };
  return statusConfig[status] || statusConfig.pending_dropoff;
};

function formatServiceType(serviceType?: string, services?: any[]): string {
  if (!serviceType) return 'Wash & Fold';
  if (services && services.length > 0) {
    const match = services.find((s: any) => s.code === serviceType);
    if (match?.name) return match.name;
  }
  const s = serviceType.toLowerCase();
  if (s.includes('wash') && s.includes('dry')) return 'Wash & Dry';
  if (s.includes('wash')) return 'Wash Only';
  if (s.includes('dry')) return 'Dry Only';
  return serviceType.replace(/_/g, ' ').replace(/and/gi, '&').replace(/s+&s+/g, ' & ');
}

export function OrdersTable({ orders, stationToken, onCollectPayment, branchServices }: OrdersTableProps) {
  const tableRows = useMemo(
    () =>
      orders.map((order) => {
        const weight = order.actualWeight || order.estimatedWeight || 0;
        const serviceType = formatServiceType(order.serviceType, branchServices);
        const unpaid = order.paymentStatus !== 'paid';
        return (
          <TableRow key={order._id} className="hover:bg-muted/30 transition-colors">
            <TableCell className="whitespace-nowrap" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <OrderRowExpander order={order} stationToken={stationToken ?? null} unpaid={unpaid} onCollectPayment={() => onCollectPayment?.(order._id)} />
                {order.customer?.phoneNumber && (
                  <button
                    onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${order.customer!.phoneNumber}`; }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-semibold hover:bg-green-200 transition-colors"
                  >
                    <PhoneCall className="w-3 h-3" />
                    Call
                  </button>
                )}
                {unpaid && order.status !== 'completed' && order.status !== 'delivered' && (
                  <Link
                    href={`/washstation/orders/${order._id}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Link>
                )}
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap font-semibold text-foreground">{order.orderNumber}</TableCell>
            <TableCell className="whitespace-nowrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                  {order.customer?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'CU'}
                </div>
                <div>
                  <span className="font-medium text-foreground">{order.customer?.name || 'Unknown'}</span>
                  {(order as any).bagCardNumber && <p className="text-xs text-muted-foreground">Bag #{(order as any).bagCardNumber}</p>}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap">
  <span>{serviceType} ({weight.toFixed(1)}kg)</span>
  {order.finalPrice > 0 && (
    <p className="text-xs font-semibold text-foreground mt-0.5">?{order.finalPrice.toFixed(2)}</p>
  )}
</TableCell>
            <TableCell className="whitespace-nowrap">
              {(() => {
                const isCompleted = order.status === 'completed' || order.status === 'delivered';
                const completedEntry = isCompleted
                  ? [...(order.statusHistory || [])].reverse().find(h => h.status === 'completed' || h.status === 'delivered')
                  : null;
                const displayTs = completedEntry ? completedEntry.changedAt : order.createdAt;
                return (
                  <>
                    <p className="text-sm font-medium text-foreground">{format(new Date(displayTs), 'MMM d')}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(displayTs), 'h:mm a')}</p>
                    {isCompleted && completedEntry && (
                      <p className="text-xs text-success">Completed</p>
                    )}
                  </>
                );
              })()}
            </TableCell>
          </TableRow>
        );
      }),
    [orders, onCollectPayment]
  );

  if (orders.length === 0) {
    return <div className="text-center py-12"><p className="text-muted-foreground">No orders found</p></div>;
  }

  return (
    <div className="overflow-x-auto overflow-y-auto rounded-xl border border-border bg-card max-h-[70vh]">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Actions</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Order ID</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Customer</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Services</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Date & Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{tableRows}</TableBody>
      </Table>
    </div>
  );
}
