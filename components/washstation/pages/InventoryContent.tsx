'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  RefreshCw, AlertTriangle, Package, CheckCircle, Droplets, Info, Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStationSession } from '@/hooks/useStationSession';
import {
  useStationInventory,
  type InventoryItem,
} from '@/hooks/useStationInventory';
import { useMutation } from 'convex/react';
import { api } from '@jordan6699/washlab-backend/api';
import { format } from 'date-fns';

export function InventoryContent() {
  const { stationToken } = useStationSession();
  const [filter, setFilter] = useState<'all' | 'critical' | 'low'>('all');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  const { inventory, isLoading, stats } = useStationInventory(
    stationToken,
    filter === 'all' ? undefined : { status: filter }
  );

  const requestOrder = useMutation((api as any).inventory.requestOrder);

  const handleRequestClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setRequestNotes('');
    setRequestDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedItem || !stationToken) return;
    setIsRequesting(true);
    try {
      await requestOrder({
        itemId: selectedItem._id,
        stationToken,
        notes: requestNotes || undefined,
      });
      toast.success('Order request sent to admin');
      setRequestDialogOpen(false);
      setSelectedItem(null);
      setRequestNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setIsRequesting(false);
    }
  };

  const getStatusConfig = (status: string) => ({
    critical: { label: 'Critical', cls: 'bg-red-100 text-red-700', icon: AlertTriangle },
    low: { label: 'Low Stock', cls: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
    ok: { label: 'In Stock', cls: 'bg-green-100 text-green-700', icon: CheckCircle },
    ordered: { label: 'Requested', cls: 'bg-blue-100 text-blue-700', icon: Package },
  }[status] || { label: 'In Stock', cls: 'bg-green-100 text-green-700', icon: CheckCircle });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading inventory...</p>
      </div>
    );
  }

  return (
    <>
      {/* Stats bar */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {stats.critical > 0 && (
            <div className="px-4 py-2 bg-red-100 text-red-700 rounded-lg flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{stats.critical} Critical</span>
            </div>
          )}
          {stats.low > 0 && (
            <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{stats.low} Low</span>
            </div>
          )}
          {stats.ordered > 0 && (
            <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{stats.ordered} Requested</span>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'critical', label: 'Critical' },
              { id: 'low', label: 'Low' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.success('Refreshed')} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-lg mb-4">
        <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          You can request orders for low or critical items. The admin will be notified and fulfil the order.
        </p>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {inventory.map((item: any) => {
          const cfg = getStatusConfig(item.status);
          const StatusIcon = cfg.icon;
          const stockPct = Math.min((item.currentStock / item.maxStock) * 100, 100);
          const totalScoops = item.scoopsPerUnit && item.currentStock > 0
            ? Math.floor(item.currentStock * item.scoopsPerUnit)
            : null;

          return (
            <div key={item._id} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.category.replace(/_/g, ' ')}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${cfg.cls}`}>
                  <StatusIcon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </div>

              {/* Stock bar */}
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Stock</span>
                  <span className="font-semibold">{item.currentStock} / {item.maxStock} {item.unit}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${stockPct < 20 ? 'bg-red-500' : stockPct < 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${stockPct}%` }}
                  />
                </div>
                {/* Thresholds - only show when at/below threshold */}
                {(item.currentStock <= item.minStock || item.currentStock <= item.reorderPoint) && (
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {item.currentStock <= item.minStock && (
                      <div className="flex items-center justify-between text-xs px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded">
                        <span className="text-red-600">Critical below</span>
                        <span className="font-semibold text-red-700">{item.minStock} {item.unit}</span>
                      </div>
                    )}
                    {item.currentStock <= item.reorderPoint && (
                      <div className="flex items-center justify-between text-xs px-2 py-1 bg-amber-50 dark:bg-amber-950/20 rounded">
                        <span className="text-amber-600">Reorder at</span>
                        <span className="font-semibold text-amber-700">{item.reorderPoint} {item.unit}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Scoops info */}
              {item.scoopsPerUnit && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg mb-3">
                  <Droplets className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <div className="text-xs">
                    <span className="text-blue-600">{item.scoopsPerUnit} scoops per {item.unit}</span>
                    {totalScoops !== null && (
                      <span className="text-blue-800 dark:text-blue-300 font-semibold ml-2">˜ {totalScoops} scoops left</span>
                    )}
                  </div>
                </div>
              )}

              {/* Usage notes */}
              {item.usageNotes && (
                <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg mb-3">
                  <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{item.usageNotes}</p>
                </div>
              )}

              {/* Order status */}
              {item.status === 'ordered' && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg mb-3 text-xs text-blue-700">
                  {item.expectedArrivalDate
                    ? `Expected: ${format(new Date(item.expectedArrivalDate), 'MMM d, yyyy')}`
                    : 'Order request sent — awaiting admin'}
                </div>
              )}

              {/* Request Order button only */}
              <div className="pt-2 border-t border-border">
                <Button
                  variant={item.status === 'critical' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleRequestClick(item)}
                  disabled={item.status === 'ordered' || item.currentStock > item.reorderPoint}
                >
                  <Package className="w-3.5 h-3.5" />
                  {item.status === 'ordered' ? 'Request Sent' : 'Request Order'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {inventory.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No inventory items found</p>
          <p className="text-xs text-muted-foreground mt-1">The admin will add items for your branch</p>
        </div>
      )}

      {/* Request Order Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Order — {selectedItem?.name}</DialogTitle>
            <DialogDescription>
              This will notify the admin to place an order for this item.
              Current stock: <strong>{selectedItem?.currentStock} {selectedItem?.unit}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedItem?.scoopsPerUnit && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <Droplets className="w-4 h-4 text-blue-500" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  ˜ {Math.floor((selectedItem.currentStock || 0) * selectedItem.scoopsPerUnit)} scoops remaining
                </p>
              </div>
            )}
            <div>
              <Label>Notes for admin (optional)</Label>
              <Textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="e.g., Running very low, need urgently"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={isRequesting}>
              {isRequesting ? 'Sending...' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
