'use client';

import { useState } from 'react';
import { WashStationLayout } from '@/components/washstation/WashStationLayout';
import { useStationSession } from '@/hooks/useStationSession';
import { useStationCustomers } from '@/hooks/useStationCustomers';
import { LoadingSpinner } from '@/components/washstation/LoadingSpinner';
import { EmptyState } from '@/components/washstation/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, User, Phone, Mail, Plus, Star, Clock, CheckCircle, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@jordan6699/washlab-backend/api';

function CustomerCard({ customer, stationToken }: { customer: any, stationToken: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const ordersResult = useQuery(
    (api as any).stations.getStationOrders,
    expanded && stationToken ? { stationToken, paginationOpts: { numItems: 20, cursor: null } } : "skip"
  );

  const loyaltyPoints = useQuery(
    (api as any).loyalty.getPointsForAttendant,
    expanded && stationToken ? { stationToken, customerId: customer._id } : "skip"
  );

  const allOrders = (ordersResult?.page || []).filter((o: any) =>
    o.customerId === customer._id || o.customer?._id === customer._id
  );

  const activeOrders = allOrders.filter((o: any) =>
    !["completed", "cancelled", "delivered"].includes(o.status)
  );

  const completedOrders = allOrders.filter((o: any) =>
    ["completed", "delivered"].includes(o.status)
  );

  const handleCreateOrder = () => {
    sessionStorage.setItem('rapidwash_prefilledCustomer', JSON.stringify({
      id: customer._id,
      name: customer.name,
      phone: customer.phoneNumber,
      email: customer.email,
      skipPhone: true
    }));
    router.push('/washstation/new-order');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_dropoff: "bg-blue-100 text-blue-700",
      checked_in: "bg-blue-100 text-blue-700",
      sorting: "bg-yellow-100 text-yellow-700",
      washing: "bg-yellow-100 text-yellow-700",
      drying: "bg-orange-100 text-orange-700",
      folding: "bg-purple-100 text-purple-700",
      ready: "bg-green-100 text-green-700",
      ready_for_pickup: "bg-green-100 text-green-700",
      completed: "bg-muted text-muted-foreground",
      cancelled: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending_dropoff: "Pending Drop-off",
      pending: "Pending",
      checked_in: "Checked In",
      sorting: "Sorting",
      washing: "Washing",
      drying: "Drying",
      folding: "Folding",
      ready: "Ready for Pickup",
      ready_for_pickup: "Ready for Pickup",
      completed: "Completed",
      cancelled: "Cancelled",
      delivered: "Delivered",
    };
    return labels[status] || status.replace(/_/g, " ");
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors pb-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground">{customer.name}</p>
                {customer.status && customer.status !== "active" && (
                  <Badge variant="destructive" className="text-xs">{customer.status}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phoneNumber}</span>
                {customer.email && <span className="hidden sm:flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">{customer.orderCount} orders</p>
              <p className="text-xs font-semibold text-primary">GHS {customer.totalSpent?.toFixed(2)}</p>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="border-t border-border pt-4 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Orders</p>
              <p className="text-xl font-bold">{customer.orderCount}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-lg font-bold text-primary">GHS {customer.totalSpent?.toFixed(0)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Loyalty</p>
              <p className="text-xl font-bold text-yellow-600">{loyaltyPoints?.points ?? "—"}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <Button className="w-full" onClick={handleCreateOrder}>
            <Plus className="w-4 h-4 mr-2" /> New Order for {customer.name.split(" ")[0]}
          </Button>

          {/* Active Orders */}
          {ordersResult === undefined && expanded ? (
            <div className="flex justify-center py-2"><LoadingSpinner text="Loading orders..." /></div>
          ) : activeOrders.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Active Orders ({activeOrders.length})
              </h4>
              <div className="space-y-2">
                {activeOrders.map((order: any) => (
                  <div key={order._id} className="rounded-lg bg-muted/50 border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">#{order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.serviceType?.replace(/_/g, " ")} · GHS {order.finalPrice?.toFixed(2)}
                          {order.bagCardNumber ? " · Bag #" + order.bagCardNumber : ""}
                        </p>
                      </div>
                      <span className={"text-xs px-2 py-1 rounded-full font-medium " + getStatusColor(order.status)}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1"
                        onClick={() => router.push("/washstation/orders/" + order._id)}
                      >
                        View Order
                      </Button>
                      {order.paymentStatus !== "paid" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => router.push("/washstation/payment?orderId=" + order._id)}
                        >
                          <CreditCard className="w-3 h-3 mr-1" /> Pay Now
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : ordersResult !== undefined ? (
            <p className="text-xs text-muted-foreground text-center py-2 border rounded-lg">No active orders for this customer</p>
          ) : null}

          {/* Completed Orders */}
          {completedOrders.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Recent Completed
              </h4>
              <div className="space-y-2">
                {completedOrders.slice(0, 3).map((order: any) => (
                  <div
                    key={order._id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push("/washstation/orders/" + order._id)}
                  >
                    <div>
                      <p className="text-sm font-medium">#{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{order.serviceType?.replace(/_/g, " ")} · GHS {order.finalPrice?.toFixed(2)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">View →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </CardContent>
      )}
    </Card>
  );
}

export default function CustomersPage() {
  const { stationToken, isSessionValid } = useStationSession();
  const { customers, searchQuery, setSearchQuery, isLoading } = useStationCustomers(stationToken);

  if (!isSessionValid) {
    return (
      <WashStationLayout title="Customers">
        <LoadingSpinner text="Verifying session..." />
      </WashStationLayout>
    );
  }

  return (
    <WashStationLayout title="Customers">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <CardTitle>Customer Search</CardTitle>
              <div className="relative flex-1 md:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full md:w-96"
                  autoFocus
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {isLoading && searchQuery.length >= 2 ? (
          <LoadingSpinner text="Searching..." />
        ) : customers.length > 0 ? (
          <div className="space-y-3">
            {customers.map((customer) => (
              <CustomerCard key={customer._id} customer={customer} stationToken={stationToken} />
            ))}
          </div>
        ) : searchQuery.length >= 2 ? (
          <EmptyState icon={Search} title="No customers found" description="Try a different name or phone number." />
        ) : (
          <EmptyState icon={User} title="Search for a customer" description="Type a name or phone number to find a customer and manage their orders." />
        )}
      </div>
    </WashStationLayout>
  );
}
