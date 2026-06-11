'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search,
  Banknote,
  CreditCard,
  Smartphone,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from 'convex/react';
import { api } from '@jordan6699/washlab-backend/api';
import { useStationSession } from '@/hooks/useStationSession';
import { LoadingSpinner } from '@/components/washstation/LoadingSpinner';

interface Transaction {
  orderId: string;
  orderCode: string;
  amount: number;
  paymentMethod: string;
  orderType: 'walk_in' | 'online';
  status: string;
  staffId?: string;
  staffName: string;
  verifiedAt: number;
  customerPhone: string;
  customerName: string;
  createdAt: number;
}

export function TransactionsContent() {
  const { stationToken, isSessionValid } = useStationSession();
  const [filter, setFilter] = useState<'all' | 'cash' | 'card' | 'mobile_money'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'walk_in' | 'online'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const clearDateRange = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleClearFilters = () => {
    setFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  };

  const startTimestamp = startDate ? new Date(startDate).getTime() : undefined;
  const endTimestamp = endDate
    ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1
    : undefined;

  const stationTransactions = useQuery(
    api.stations.getStationTransactions,
    stationToken
      ? { stationToken, startDate: startTimestamp, endDate: endTimestamp }
      : "skip"
  ) as Transaction[] | undefined;

  const transactionsToDisplay = stationTransactions || [];
  const isLoadingTransactions =
    stationToken !== null && stationTransactions === undefined;

  if (!isSessionValid) {
    return <LoadingSpinner text="Verifying session..." />;
  }

  const getPaymentIcon = (method: string) => {
    switch(method) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'mobile_money': return <Smartphone className="w-4 h-4" />;
      default: return <Banknote className="w-4 h-4" />;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch(method) {
      case 'cash': return 'Cash';
      case 'card': return 'Card';
      case 'mobile_money': return 'Mobile Money';
      case 'momo': return 'Mobile Money';
      case 'hubtel': return 'Card';
      default: return method;
    }
  };

  const filteredTransactions = transactionsToDisplay.filter(txn => {
    if (filter !== 'all') {
      if (filter === 'cash' && txn.paymentMethod !== 'cash') return false;
      if (filter === 'card' && !['card', 'hubtel'].includes(txn.paymentMethod)) return false;
      if (filter === 'mobile_money' && !['mobile_money', 'momo'].includes(txn.paymentMethod)) return false;
    }
    if (typeFilter !== 'all' && txn.orderType !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        txn.orderCode?.toLowerCase().includes(query) ||
        txn.customerName?.toLowerCase().includes(query) ||
        txn.customerPhone?.includes(query)
      );
    }
    return true;
  });

  const totalAmount = filteredTransactions.reduce((sum, txn) => sum + txn.amount, 0);
  const cashRevenue = filteredTransactions.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.amount, 0);
  const cardRevenue = filteredTransactions.filter(t => ['card', 'hubtel'].includes(t.paymentMethod)).reduce((sum, t) => sum + t.amount, 0);
  const mobileRevenue = filteredTransactions.filter(t => ['mobile_money', 'momo'].includes(t.paymentMethod)).reduce((sum, t) => sum + t.amount, 0);

  return (
    <>
      {/* Revenue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-foreground">₵{totalAmount.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Cash</p>
          <p className="text-2xl font-bold text-success">₵{cashRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Card</p>
          <p className="text-2xl font-bold text-primary">₵{cardRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Mobile Money</p>
          <p className="text-2xl font-bold text-warning">₵{mobileRevenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters — single row */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[180px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Order code, customer, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="w-[150px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
              <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Order Type */}
            <div className="w-[130px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Order Type</label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="w-[140px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="w-[140px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Clear */}
            <Button variant="outline" size="sm" onClick={handleClearFilters} className="flex-shrink-0 gap-2 self-end">
              <Filter className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 md:px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Order</th>
                <th className="text-left px-4 md:px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Customer</th>
                <th className="text-left px-4 md:px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Payment</th>
                <th className="text-left px-4 md:px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Amount</th>
                <th className="text-left px-4 md:px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Staff</th>
                <th className="text-left px-4 md:px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoadingTransactions ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((txn) => (
                  <tr key={txn.orderId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 md:px-6 py-4 font-medium text-foreground">{txn.orderCode}</td>
                    <td className="px-4 md:px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{txn.customerName}</p>
                        <p className="text-sm text-muted-foreground">{txn.customerPhone}</p>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getPaymentIcon(txn.paymentMethod)}
                        <span className="text-sm text-foreground">{getPaymentLabel(txn.paymentMethod)}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className="font-semibold text-foreground">₵{txn.amount.toFixed(2)}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">{txn.staffName}</td>
                    <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(txn.verifiedAt || txn.createdAt), 'MMM d, h:mm a')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
