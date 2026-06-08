'use client';

import { useParams, useRouter } from 'next/navigation';
import { WashStationLayout } from '@/components/washstation/WashStationLayout';
import { useStationSession } from '@/hooks/useStationSession';
import { useStationOrder } from '@/hooks/useStationOrders';
import { useStationOrderStatus } from '@/hooks/useStationOrderStatus';
import { useQuery, useAction } from 'convex/react';
import { api } from "@jordan6699/washlab-backend/api";
import { LoadingSpinner } from '@/components/washstation/LoadingSpinner';
import { EmptyState } from '@/components/washstation/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Package,
  CheckCircle,
  Clock,
  Droplets,
  Wind,
  Shirt,
  Truck,
  MapPin,
  Scale,
  Tag,
  CreditCard,
  Pause,
  Play,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { type OrderStatus } from '@/hooks/useStationOrders';
import { ActionVerification } from '@/components/washstation/ActionVerification';
import { Id } from "@jordan6699/washlab-backend/dataModel";
import { toast } from 'sonner';

const WASH_STAGES = [
  { id: 'pending_dropoff', label: 'Pending Dropoff', icon: Package,     requiresVerification: false },
  { id: 'checked_in',     label: 'Received',         icon: Package,     requiresVerification: false },
  { id: 'sorting',        label: 'Start Wash',        icon: Package,     requiresVerification: false },
  { id: 'washing',        label: 'Washing',           icon: Droplets,    requiresVerification: false },
  { id: 'drying',         label: 'Drying',            icon: Wind,        requiresVerification: false },
  { id: 'folding',        label: 'Folding',           icon: Shirt,       requiresVerification: false },
  { id: 'ready',          label: 'Ready',             icon: CheckCircle, requiresVerification: false },
  { id: 'completed',      label: 'Delivered',         icon: Truck,       requiresVerification: true  },
];

const STAGE_DURATIONS: Record<string, number> = {
  sorting: 10 * 60 * 1000,
  washing: 35 * 60 * 1000,
  drying:  40 * 60 * 1000,
  folding: 20 * 60 * 1000,
};

const mapLegacyStatus = (status: string): string => {
  const mapping: Record<string, string> = {
    'pending':          'pending_dropoff',
    'in_progress':      'washing',
    'ready_for_pickup': 'ready',
    'delivered':        'completed',
  };
  return mapping[status] || status;
};

interface TimerState {
  orderId: string;
  status: string;
  startTime: number;
  pausedTime: number;
  isPaused: boolean;
  duration: number;
}

export default function OrderDetailsPage() {
  const params  = useParams();
  const router  = useRouter();
  const orderId = params.orderId as string;

  const { stationToken, isSessionValid } = useStationSession();
  const { order, isLoading } = useStationOrder(stationToken, orderId as any, isSessionValid);
  const { changeStatus } = useStationOrderStatus(stationToken);

  const activeAttendances = useQuery(
    api.stations.getActiveStationAttendances,
    stationToken && isSessionValid ? { stationToken } : 'skip'
  ) as Array<{
    _id: Id<'attendanceLogs'>;
    clockInAt: number;
    deviceId: string;
    attendant: { _id: Id<'attendants'>; name: string; email: string } | null;
  }> | undefined;

  const verifyAndRecoverPayment = useAction((api as any).paymentsRecovery.verifyAndRecoverPayment);

  const [isUpdating,          setIsUpdating]          = useState(false);
  const [showVerification,    setShowVerification]    = useState(false);
  const [pendingStage,        setPendingStage]        = useState<string | null>(null);
  const [whatsappSent,        setWhatsappSent]        = useState(false);
  const [isVerifyingPayment,  setIsVerifyingPayment]  = useState(false);

  const [elapsedTime,      setElapsedTime]      = useState(0);
  const [stageDuration,    setStageDuration]    = useState(0);
  const [isPaused,         setIsPaused]         = useState(false);
  const [timerInitialized, setTimerInitialized] = useState(false);

  const timerRef      = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef  = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const audioRef      = useRef<HTMLAudioElement | null>(null);

  const currentStatus       = order ? mapLegacyStatus(order.status) : 'pending_dropoff';
  const currentStageIndex   = WASH_STAGES.findIndex(s => s.id === currentStatus);
  const effectiveStageIndex = currentStageIndex >= 0 ? currentStageIndex : 0;
  const nextStage           = effectiveStageIndex < WASH_STAGES.length - 1 ? WASH_STAGES[effectiveStageIndex + 1] : null;
  const showWhatsApp        = currentStatus === 'ready' || currentStatus === 'completed';

  const getTimerKey    = (id: string) => `rapidwash_timer_${id}`;
  const loadTimerState = (id: string): TimerState | null => {
    try {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem(getTimerKey(id));
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  };
  const saveTimerState  = (s: TimerState) => { try { localStorage.setItem(getTimerKey(s.orderId), JSON.stringify(s)); } catch {} };
  const clearTimerState = (id: string)    => { try { localStorage.removeItem(getTimerKey(id)); } catch {} };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTUIGWi68OScTgwMUKvm8LNgGgU7k9nyz3gsBS1/zPLaizsKGGS66OihUBELTKXh8bllHAU2jdTxz38vBSl+zPDaizwLGGa67+idUBELTqfi8bllHAU3jdXyz38vBSp+zPDaizwKF2W57+idUREKTqXi8bhlHAU3jdXxz38vBSl+y/HajDsLF2S57umeUBELTqXi8bhlHAU2jdXxz38vBSl+y/HajDsLGGS57umeUBELTabh8bllHAU2jdXxz38vBSl+y/HajDsLGGS47umeTxALTabh8bllHAU2jdXxz38vBSl+y/HajDwLGGO67+meTxALTabh8blmHAU1jdXxz38vBSl+y/HajDwLTabh8blmHAU1');
    }
  }, []);

  useEffect(() => {
    if (!order || timerInitialized) return;
    if (!STAGE_DURATIONS[currentStatus]) { clearTimerState(orderId); setTimerInitialized(true); return; }

    const saved = loadTimerState(orderId);
    if (saved && saved.status === currentStatus) {
      const now = Date.now();
      let elapsed = now - saved.startTime - saved.pausedTime;
      if (elapsed > saved.duration) elapsed = saved.duration;
      setStageDuration(saved.duration);
      setElapsedTime(elapsed);
      setIsPaused(saved.isPaused);
      startTimeRef.current  = saved.startTime;
      pausedTimeRef.current = saved.pausedTime;
    } else {
      const now      = Date.now();
      const duration = STAGE_DURATIONS[currentStatus];
      setStageDuration(duration);
      setElapsedTime(0);
      setIsPaused(false);
      startTimeRef.current  = now;
      pausedTimeRef.current = 0;
      saveTimerState({ orderId, status: currentStatus, startTime: now, pausedTime: 0, isPaused: false, duration });
    }
    setTimerInitialized(true);
  }, [order, orderId, currentStatus, timerInitialized]);

  useEffect(() => {
    if (!order || !timerInitialized) return;
    const stageDurationMs = STAGE_DURATIONS[currentStatus];
    if (!stageDurationMs) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    let lastSaveTime = 0;
    timerRef.current = setInterval(() => {
      if (!isPaused) {
        const now     = Date.now();
        const elapsed = now - startTimeRef.current - pausedTimeRef.current;
        setElapsedTime(elapsed);
        if (now - lastSaveTime > 10000) {
          lastSaveTime = now;
          saveTimerState({ orderId, status: currentStatus, startTime: startTimeRef.current, pausedTime: pausedTimeRef.current, isPaused: false, duration: stageDurationMs });
        }
        if (elapsed >= stageDurationMs) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          clearTimerState(orderId);
          const stageName = WASH_STAGES.find(s => s.id === currentStatus)?.label;
          toast.success(`"${stageName}" stage complete`, { description: 'Moving to next stage...', duration: 3000 });
          setTimeout(() => { if (nextStage) handleAdvanceStage(nextStage.id); }, 500);
        }
      }
    }, 100);

    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [order, currentStatus, nextStage, isPaused, timerInitialized, orderId, stageDuration]);

  const togglePause = () => {
    const newPausedState = !isPaused;
    if (newPausedState) {
      setElapsedTime(Date.now() - startTimeRef.current - pausedTimeRef.current);
    } else {
      pausedTimeRef.current += Date.now() - (startTimeRef.current + pausedTimeRef.current + elapsedTime);
    }
    setIsPaused(newPausedState);
    saveTimerState({ orderId, status: currentStatus, startTime: startTimeRef.current, pausedTime: pausedTimeRef.current, isPaused: newPausedState, duration: stageDuration });
  };

  const handleAdvanceStage = (stageId: string) => {
    clearTimerState(orderId);
    setTimerInitialized(false);
    const stage = WASH_STAGES.find(s => s.id === stageId);
    if (stage?.requiresVerification) {
      setPendingStage(stageId);
      setShowVerification(true);
    } else {
      handleStatusUpdate(stageId as OrderStatus);
    }
  };

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!order) return;
    setIsUpdating(true);
    try {
      const success = await changeStatus(order._id, newStatus);
      if (success) toast.success(`Order advanced to ${WASH_STAGES.find(s => s.id === newStatus)?.label}`);
    } catch {
      toast.error('Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVerifySuccess = async (attendantId: Id<'attendants'>, verificationId: Id<'biometricVerifications'>) => {
    if (!pendingStage || !order) return;
    setShowVerification(false);
    setIsUpdating(true);
    const attendance   = activeAttendances?.find(a => a.attendant?._id === attendantId);
    const attendanceId = attendance?._id;
    try {
      const success = await changeStatus(order._id, pendingStage as OrderStatus, undefined, attendantId, attendanceId);
      if (success) toast.success(`Order advanced to ${WASH_STAGES.find(s => s.id === pendingStage)?.label}`);
    } catch {
      toast.error('Failed to update order status');
    } finally {
      setIsUpdating(false);
      setPendingStage(null);
    }
  };

  // Verify with Paystack — checks if customer already paid and marks order as paid if so
  const handleVerifyWithPaystack = async () => {
    if (!order) return;
    setIsVerifyingPayment(true);
    try {
      const result = await verifyAndRecoverPayment({ orderId: order._id });
      if (result.recovered) {
        toast.success(`Payment verified! ₵${result.amount?.toFixed(2)} via ${result.method === 'mobile_money' ? 'Mobile Money' : 'Card'}`);
      } else if (result.alreadyPaid) {
        toast.info('Payment already recorded.');
      } else if (result.noReference) {
        toast.warning('No Paystack payment found for this order. Customer may not have paid via Paystack yet.');
      } else {
        toast.error(result.error ?? 'Payment not confirmed by Paystack.');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to verify with Paystack');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  useEffect(() => {
    if (order && typeof window !== 'undefined') {
      const sent = localStorage.getItem(`whatsapp_sent_${order._id}`);
      if (sent === 'true') setWhatsappSent(true);
    }
  }, [order]);

  const handleWhatsAppClick = () => {
    if (!order?.customer?.phoneNumber) { toast.error('Customer phone number not available'); return; }
    const phone   = order.customer.phoneNumber.replace(/\D/g, '');
    const loads = order.estimatedLoads ?? 1;
    const whitesLine = order.whitesSeparate ? `Whites: *Washed Separately (+1 load)*\n` : '';
    const voucherLine = (order as any)?.voucherCode ? `Voucher: *${(order as any).voucherCode}* applied\n` : '';
    const basePriceLine = order.basePrice != null && order.basePrice !== order.finalPrice
      ? `Original: ₵${order.basePrice.toFixed(2)}\nDiscount: -₵${(order.basePrice - order.finalPrice).toFixed(2)}\n`
      : '';
    const message = encodeURIComponent(
      `🧺 Rapid Wash Update\n\nHi ${order.customer.name},\nYour laundry order *#${order.orderNumber}* is ready for pickup.\n\nService: ${order.serviceType?.replace(/_/g, ' ')}\nWash Cycles: *${loads} load${loads !== 1 ? 's' : ''}*\n` +
      whitesLine +
      `Total: ₵${order.finalPrice.toFixed(2)}\n` +
      basePriceLine +
      voucherLine +
      `Please come along with your bag card.\n\nThank you!`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    setWhatsappSent(true);
    localStorage.setItem(`whatsapp_sent_${order._id}`, 'true');
    toast.success('WhatsApp notification sent!');
  };

  const getStatusColor = (stageId: string) => {
    const idx = WASH_STAGES.findIndex(s => s.id === stageId);
    if (idx < effectiveStageIndex)  return 'bg-success text-success-foreground';
    if (idx === effectiveStageIndex) return 'bg-primary text-primary-foreground';
    return 'bg-muted text-muted-foreground';
  };

  const progressPercentage = stageDuration > 0 ? Math.min((elapsedTime / stageDuration) * 100, 100) : 0;
  const remainingTime      = Math.max(stageDuration - elapsedTime, 0);
  const remainingMinutes   = Math.floor(remainingTime / 60000);
  const remainingSeconds   = Math.floor((remainingTime % 60000) / 1000);
  const elapsedMinutes     = Math.floor(elapsedTime / 60000);
  const elapsedSeconds     = Math.floor((elapsedTime % 60000) / 1000);

  if (!isSessionValid) return <WashStationLayout title="Order Details"><LoadingSpinner text="Verifying session..." /></WashStationLayout>;
  if (isLoading)       return <WashStationLayout title="Order Details"><LoadingSpinner text="Loading order details..." /></WashStationLayout>;
  if (!order)          return (
    <WashStationLayout title="Order Details">
      <EmptyState icon={Package} title="Order not found"
        description="The order you're looking for doesn't exist or you don't have access to it."
        action={{ label: 'Back to Orders', onClick: () => router.push('/washstation/orders') }} />
    </WashStationLayout>
  );

  return (
    <WashStationLayout title={`Order #${order.orderNumber}`}>
      <div className="space-y-6">

        {/* Back Button */}
        <button onClick={() => router.push('/washstation/orders')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Orders</span>
        </button>

        {/* Progress Timer Bar */}
        {['sorting','washing','drying','folding'].includes(currentStatus) && timerInitialized && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">
                      {WASH_STAGES.find(s => s.id === currentStatus)?.label} in Progress
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isPaused ? 'Paused' : `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '00')} remaining`}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={togglePause} disabled={isUpdating}>
                  {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-3 bg-primary transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-muted-foreground">Elapsed: {elapsedMinutes}:{elapsedSeconds.toString().padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">{Math.floor(progressPercentage)}% complete</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Order Header with Visual Progress */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <CardTitle className="text-2xl">{order.orderNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{format(new Date(order.createdAt), 'PPp')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'outline'}
                      className={order.paymentStatus === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                      {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                    </Badge>
                    <Badge className={getStatusColor(currentStatus)}>
                      {WASH_STAGES.find(s => s.id === currentStatus)?.label || currentStatus}
                    </Badge>
                  </div>
                </div>

                {/* Visual Progress Steps */}
                <div className="flex items-center justify-between overflow-x-auto pb-2">
                  {WASH_STAGES.slice(0, -1).map((stage, index) => {
                    const StageIcon   = stage.icon;
                    const isCompleted = index < effectiveStageIndex;
                    const isCurrent   = index === effectiveStageIndex;
                    return (
                      <div key={stage.id} className="flex items-center">
                        <div className={`flex flex-col items-center ${index < WASH_STAGES.length - 2 ? 'flex-1' : ''}`}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                            isCompleted ? 'bg-success text-success-foreground' :
                            isCurrent   ? 'bg-primary text-primary-foreground animate-pulse' :
                                          'bg-muted text-muted-foreground'
                          }`}>
                            <StageIcon className="w-5 h-5" />
                          </div>
                          <span className={`text-xs mt-2 text-center whitespace-nowrap ${
                            isCompleted || isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                          }`}>{stage.label}</span>
                        </div>
                        {index < WASH_STAGES.length - 2 && (
                          <div className={`h-1 w-16 mx-2 rounded transition-all ${isCompleted ? 'bg-success' : 'bg-muted'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardHeader>
            </Card>

            {/* Bag Card Number */}
            {order.bagCardNumber && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary" /> Bag Card
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary">#{order.bagCardNumber}</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Card Number</p>
                      <p className="text-lg font-semibold text-foreground">#{order.bagCardNumber}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Items */}
            <Card>
              <CardHeader><CardTitle>Order Items</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Scale className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Wash & Fold</p>
                        <p className="text-sm text-muted-foreground">
                          {(order.actualWeight || order.estimatedWeight || 0).toFixed(2)}kg
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-foreground">₵{order.finalPrice.toFixed(2)}</span>
                  </div>
                </div>
                {order.basePrice != null && order.basePrice > order.finalPrice && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Original Price</span>
                      <span className="line-through text-muted-foreground">₵{order.basePrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                        <Tag className="w-3.5 h-3.5" />
                        {(order as any).voucherCode ? `Voucher (${(order as any).voucherCode})` : "Loyalty Discount"}
                      </span>
                      <span className="text-green-700 dark:text-green-400 font-semibold">-₵{(order.basePrice - order.finalPrice).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="border-t border-border mt-4 pt-4 flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-xl text-primary">₵{order.finalPrice.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Notification */}
            {showWhatsApp && (
              <Card>
                <CardHeader><CardTitle>Customer Notification</CardTitle></CardHeader>
                <CardContent>
                  <Button size="lg"
                    className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleWhatsAppClick} disabled={whatsappSent}>
                    <MessageCircle className="w-5 h-5 mr-2" />
                    {whatsappSent ? 'WhatsApp Notification Sent ✓' : 'Send WhatsApp Notification'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {whatsappSent ? 'Customer has been notified via WhatsApp' : 'Notify customer that their order is ready for pickup'}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {nextStage && order.status !== 'completed' && (
              <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent>

                  {/* Payment banner — only shown when order is unpaid */}
                  {order.paymentStatus !== 'paid' && (
                    <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-4 space-y-3">
                      <p className="text-warning font-medium flex items-center gap-2">
                        <CreditCard className="w-5 h-5" /> Payment Required
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Collect payment from the customer before or after the wash.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          size="default"
                          className="w-full sm:w-auto bg-success hover:bg-success/90 text-white"
                          onClick={() => router.push(`/washstation/payment?orderId=${order._id}`)}
                        >
                          <CreditCard className="w-4 h-4 mr-2" /> Collect Payment
                        </Button>
                        {/* Shown only when order is unpaid — hides automatically once payment is confirmed */}
                        <Button
                          size="default"
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={isVerifyingPayment}
                          onClick={handleVerifyWithPaystack}
                        >
                          {isVerifyingPayment
                            ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Checking Paystack…</>
                            : <><RefreshCw className="w-4 h-4 mr-2" /> Verify with Paystack</>
                          }
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        If the customer already paid via Paystack but the order still shows unpaid, tap "Verify with Paystack" to check and update automatically.
                      </p>
                    </div>
                  )}

                  <Button size="lg" className="w-full" onClick={() => handleAdvanceStage(nextStage.id)} disabled={isUpdating}>
                    <nextStage.icon className="w-5 h-5 mr-2" /> Move to {nextStage.label}
                    {nextStage.requiresVerification && <span className="ml-2 text-xs opacity-75">(Requires Verification)</span>}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Customer Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Customer Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{order.customer?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">Customer</p>
                  </div>
                </div>
                {order.customer?.phoneNumber && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <span className="text-foreground">{order.customer.phoneNumber}</span>
                  </div>
                )}
                {order.customer?.email && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <span className="text-foreground">{order.customer.email}</span>
                  </div>
                )}
                {order.deliveryHall && (
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <span className="text-foreground">{order.deliveryHall} - Room {order.deliveryRoom || 'N/A'}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Order Created</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), 'PPp')}</p>
                    </div>
                  </div>
                  {order.paymentStatus === 'paid' && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-success mt-2" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Payment Confirmed</p>
                        <p className="text-xs text-muted-foreground">
                          {order.statusHistory?.find((e: any) => e.status === 'checked_in')
                            ? format(new Date(order.statusHistory.find((e: any) => e.status === 'checked_in')!.changedAt), 'PPp')
                            : 'Confirmed'}
                        </p>
                      </div>
                    </div>
                  )}
                  {currentStatus !== 'pending_dropoff' && currentStatus !== 'checked_in' && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 animate-pulse" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Processing</p>
                        <p className="text-xs text-muted-foreground">In progress</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <ActionVerification
          open={showVerification}
          onCancel={() => { setShowVerification(false); setPendingStage(null); }}
          onVerified={handleVerifySuccess}
          actionType={`update_order_status:${pendingStage || 'completed'}`}
          orderId={order?._id}
        />
      </div>
    </WashStationLayout>
  );
}