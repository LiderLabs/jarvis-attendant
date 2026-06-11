'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStationSession } from '@/hooks/useStationSession';
import { useStationStats } from '@/hooks/useStationStats';
import { startOfToday, endOfToday, startOfWeek, endOfWeek } from 'date-fns';
import { useStationOrders } from '@/hooks/useStationOrders';
import { StatCard } from '../StatCard';
import { OrderList } from '../OrderList';
import { LoadingSpinner } from '../LoadingSpinner';
import { EmptyState } from '../EmptyState';
import {
  Plus,
  ShoppingBag,
  Users,
  Package,
  Banknote,
  Clock,
  ArrowRight,
  Globe,
  Loader,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@jordan6699/washlab-backend/api';

// ── Weekly Target Card ────────────────────────────────────────────────────────
function WeeklyTargetCard({
  branchId,
  stationToken,
}: {
  branchId: string;
  stationToken: string;
}) {
 const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }).getTime();
const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 }).getTime();

  const { stats } = useStationStats(stationToken, weekStart, weekEnd);

  const branch = useQuery(
    (api.branches as any).getById,
    branchId ? { branchId } : 'skip'
  );

  const target = (branch as any)?.weeklyOrderTarget ?? 0;
  const current = stats?.totalOrders ?? 0;

  if (!target) return null;

  const pct = Math.min(100, Math.round((current / target) * 100));
  const remaining = Math.max(0, target - current);
  const met = current >= target;

const dayIndex = new Date().getDay();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const barColor = met ? 'bg-green-500' : 'bg-blue-500';

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Weekly target</span>
        </div>

        <div className="mb-3">
          <span className="text-3xl font-semibold text-foreground">{current}</span>
          <span className="text-base text-muted-foreground ml-1">/ {target} orders</span>
        </div>

        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          <span>{pct}% complete</span>
          <span>{remaining > 0 ? `${remaining} to go` : 'Done!'}</span>
        </div>

        <div className="flex gap-1 mb-1">
          {dayNames.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full ${
                i < dayIndex
                  ? barColor
                  : i === dayIndex
                  ? `${barColor} opacity-40`
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <div className="flex">
          {dayNames.map((d) => (
            <span key={d} className="flex-1 text-center text-[10px] text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function DashboardContent() {
  const router = useRouter();
  const { stationToken, sessionData, isLoading: sessionLoading } = useStationSession();
  const isSessionValid = sessionData?.valid ?? false;
  const branchId = sessionData?.branchId;

  const todayStart = startOfToday().getTime();
  const todayEnd = endOfToday().getTime();
  const { stats, isLoading: statsLoading } = useStationStats(stationToken, todayStart, todayEnd);

  const { orders: pendingOrders, isLoading: ordersLoading } = useStationOrders(
    stationToken,
    { status: 'pending' }
  );

  const { orders: inProgressOrders } = useStationOrders(
    stationToken,
    { status: 'in_progress' }
  );

  const { orders: recentOrders } = useStationOrders(stationToken);

  const branchServices = useQuery(
    (api as any).admin.getBranchServices,
    branchId ? { branchId } : 'skip'
  ) ?? [];

  const isLoading = statsLoading || ordersLoading;
  const totalPending = (pendingOrders?.length || 0) + (inProgressOrders?.length || 0);

  const [ordersToShow, setOrdersToShow] = useState(recentOrders?.slice(0, 6) ?? []);

  useEffect(() => {
    if (recentOrders?.length) {
      const sortedOrders = [...recentOrders]
        .filter(order => order.status !== 'delivered')
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6);
      setOrdersToShow(sortedOrders);
    }
  }, [recentOrders]);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msToMidnight = midnight.getTime() - now.getTime();
    const timer = setTimeout(() => window.location.reload(), msToMidnight);
    return () => clearTimeout(timer);
  }, []);

  if (sessionLoading || !isSessionValid) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Top Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingBag}
          iconClassName="text-primary"
        />
        <StatCard
          title="In Progress"
          value={stats.ordersByStatus.in_progress}
          icon={Loader}
          iconClassName="text-blue-500"
        />
        <StatCard
          title="Pending"
          value={totalPending}
          icon={Clock}
          iconClassName="text-orange-500"
          subtitle={pendingOrders?.length ? `${pendingOrders.length} new` : undefined}
        />
        <StatCard
          title="Revenue"
          value={`₵${stats.totalRevenue.toFixed(2)}`}
          icon={Banknote}
          iconClassName="text-green-500"
        />
      </div>

      {/* ── Weekly Target ──────────────────────────────────────────────────── */}
      {branchId && stationToken && (
        <WeeklyTargetCard branchId={branchId} stationToken={stationToken} />
      )}

      {/* ── Action Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
          className="bg-primary text-primary-foreground cursor-pointer hover:shadow-lg transition-all"
          onClick={() => router.push('/washstation/new-order')}
        >
          <CardContent className="p-6 md:p-8">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary-foreground/20 flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-bold mb-1">Start New Walk-in Order</h3>
            <p className="text-primary-foreground/80 text-sm">Select Service & Customer</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-all"
          onClick={() => router.push('/washstation/customers')}
        >
          <CardContent className="p-6 md:p-8">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-muted flex items-center justify-center mb-4">
              <Users className="w-6 h-6 md:w-7 md:h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">Find Customer</h3>
            <p className="text-muted-foreground text-sm">Search by phone, name, or ID</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-all relative"
          onClick={() => router.push('/washstation/online-orders')}
        >
          {totalPending > 0 && (
            <div className="absolute top-4 right-4 px-2 py-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
              {totalPending} Pending
            </div>
          )}
          <CardContent className="p-6 md:p-8">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-muted flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 md:w-7 md:h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">Online Orders</h3>
            <p className="text-muted-foreground text-sm">Review and accept incoming requests</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Orders ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/washstation/orders">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner text="Loading orders..." />
          ) : ordersToShow && ordersToShow.length > 0 ? (
            <OrderList
              orders={ordersToShow}
              branchServices={branchServices}
              onOrderClick={(orderId) => router.push(`/washstation/orders/${orderId}`)}
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No orders yet"
              description="Start by creating a new walk-in order or wait for online orders to come in."
              action={{
                label: 'Create New Order',
                onClick: () => router.push('/washstation/new-order'),
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
