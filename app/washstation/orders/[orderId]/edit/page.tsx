'use client';

import { useParams, useRouter } from 'next/navigation';
import { WashStationLayout } from '@/components/washstation/WashStationLayout';
import { useStationSession } from '@/hooks/useStationSession';
import { useStationOrder } from '@/hooks/useStationOrders';
import { useMutation } from 'convex/react';
import { api } from '@jordan6699/washlab-backend/api';
import { LoadingSpinner } from '@/components/washstation/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const { stationToken, isSessionValid } = useStationSession();
  const { order, isLoading } = useStationOrder(stationToken, orderId as any, isSessionValid);
  const updateOrder = useMutation(api.stations.updateOrderDetails);

  const [serviceType, setServiceType] = useState<'wash_only' | 'wash_and_dry' | 'dry_only'>('wash_and_dry');
  const [actualWeight, setActualWeight] = useState('');
  const [extraWashLoads, setExtraWashLoads] = useState('');
  const [extraDryLoads, setExtraDryLoads] = useState('');
  const [bagCardNumber, setBagCardNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [whitesSeparate, setWhitesSeparate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setServiceType((order.serviceType as any) ?? 'wash_and_dry');
      setActualWeight(String(order.actualWeight ?? order.estimatedWeight ?? ''));
      setExtraWashLoads(String(order.extraWashLoads ?? ''));
      setExtraDryLoads(String(order.extraDryLoads ?? ''));
      setBagCardNumber(order.bagCardNumber ?? '');
      setNotes(order.notes ?? '');
      setWhitesSeparate(order.whitesSeparate ?? false);
    }
  }, [order]);

  const handleSave = async () => {
    if (!stationToken || !order) return;
    setIsSaving(true);
    try {
      const result = await updateOrder({
        stationToken,
        orderId: order._id,
        serviceType,
        actualWeight: actualWeight ? parseFloat(actualWeight) : undefined,
        extraWashLoads: extraWashLoads ? parseInt(extraWashLoads) : 0,
        extraDryLoads: extraDryLoads ? parseInt(extraDryLoads) : 0,
        bagCardNumber: bagCardNumber || undefined,
        notes: notes || undefined,
        whitesSeparate,
      });
      toast.success(`Order updated - new total: GHS ${result.newPrice.toFixed(2)}`);
      router.push(`/washstation/orders/${orderId}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update order');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSessionValid) return <WashStationLayout title="Edit Order"><LoadingSpinner text="Verifying session..." /></WashStationLayout>;
  if (isLoading) return <WashStationLayout title="Edit Order"><LoadingSpinner text="Loading order..." /></WashStationLayout>;
  if (!order) return <WashStationLayout title="Edit Order"><p className="text-center text-muted-foreground mt-12">Order not found.</p></WashStationLayout>;
  if (order.paymentStatus === 'paid') return <WashStationLayout title="Edit Order"><p className="text-center text-muted-foreground mt-12">This order has been paid and cannot be edited.</p></WashStationLayout>;

  return (
    <WashStationLayout title={`Edit Order #${order.orderNumber}`}>
      <div className="max-w-lg mx-auto space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <Card>
          <CardHeader>
            <CardTitle>Edit Order #{order.orderNumber}</CardTitle>
            <p className="text-sm text-muted-foreground">Customer: {order.customer?.name}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Service Type</Label>
              <div className="flex gap-2">
                {(['wash_only', 'wash_and_dry', 'dry_only'] as const).map((s) => (
                  <button key={s} onClick={() => setServiceType(s)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${serviceType === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}>
                    {s === 'wash_only' ? 'Wash Only' : s === 'wash_and_dry' ? 'Wash & Dry' : 'Dry Only'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Actual Weight (kg)</Label>
              <Input id="weight" type="number" step="0.1" min="0" placeholder="e.g. 6.5" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="extraWash">Extra Wash Loads</Label>
                <Input id="extraWash" type="number" min="0" placeholder="0" value={extraWashLoads} onChange={(e) => setExtraWashLoads(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraDry">Extra Dry Loads</Label>
                <Input id="extraDry" type="number" min="0" placeholder="0" value={extraDryLoads} onChange={(e) => setExtraDryLoads(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bagCard">Bag Card Number</Label>
              <Input id="bagCard" placeholder="e.g. 42" value={bagCardNumber} onChange={(e) => setBagCardNumber(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="whites" checked={whitesSeparate} onChange={(e) => setWhitesSeparate(e.target.checked)} className="w-4 h-4 accent-primary" />
              <Label htmlFor="whites" className="cursor-pointer">Whites Separate (+1 load)</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" rows={3} placeholder="Any special instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <Button className="w-full" size="lg" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </WashStationLayout>
  );
}
