'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import WashStationSidebar from '@/components/washstation/WashStationSidebar';
import { useStationSession } from '@/hooks/useStationSession';
import { useStationOrder } from '@/hooks/useStationOrders';
import { Id } from '@jordan6699/washlab-backend/dataModel';
import { CheckCircle, Plus, MessageSquare, LayoutDashboard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DeliveryHandoffCard } from '@/components/washstation/DeliveryHandoffCard';

function formatServiceType(code: string | undefined): string {
  if (!code) return 'Laundry';
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function OrderCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { stationToken, isSessionValid } = useStationSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const orderIdParam = searchParams?.get('orderId');
  const paymentMethod = searchParams?.get('paymentMethod') || 'cash';
  const amountPaidParam = parseFloat(searchParams?.get('amountPaid') || '0');
  const changeDue = parseFloat(searchParams?.get('changeDue') || '0');

  const { order, isLoading } = useStationOrder(
    stationToken,
    orderIdParam ? (orderIdParam as Id<'orders'>) : null,
    isSessionValid
  );

  const amountPaid = amountPaidParam > 0 ? amountPaidParam : (order?.finalPrice ?? 0);
  const orderNumber = order?.orderNumber ?? '';
  const isMobileMoneyPending = paymentMethod === 'mobile_money';
  const isDeliveryOrder = !!(order as any)?.isDelivery;

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Cash', card: 'Credit Card',
      mobile_money: 'Mobile Money', momo: 'Mobile Money',
    };
    return labels[method] || 'Card';
  };

  const handleWhatsAppReceipt = () => {
    const rawPhone = order?.customer?.phoneNumber || (order as any)?.customerPhoneNumber || (order as any)?.customerPhone || '';
    if (!rawPhone) { toast.error('No phone number on file'); return; }
    const phone = rawPhone.replace(/[\s\-]/g, '').replace(/^\+/, '').replace(/^0/, '233');
    if (!phone) { toast.error('Invalid phone number'); return; }
    const customerPhone = rawPhone;
    const name = order?.customer?.name || 'Customer';
    const num = order?.orderNumber || orderIdParam || '';
    const price = (order?.finalPrice != null ? order.finalPrice : amountPaid).toFixed(2);
    const service = formatServiceType(order?.serviceType);
    const weight = order?.estimatedWeight ?? order?.actualWeight ?? 0;
    const serviceDesc = weight > 0 ? `${service} (${weight.toFixed(1)}kg)` : service;
    const bagCard = order?.bagCardNumber ? `Bag Card: *#${order.bagCardNumber}*\n` : '';
    const loads = order?.estimatedLoads ?? 1;
    const whitesLine = order?.whitesSeparate ? `Whites: *Washed Separately (+1 load)*\n` : '';
    const deliveryLine = isDeliveryOrder ? `Delivery: *Yes*\n` : '';
    const voucherLine = (order as any)?.voucherCode ? `Voucher: *${(order as any).voucherCode}* applied\n` : (paymentMethod === 'voucher' || paymentMethod === 'loyalty') ? `Payment: *Free (${paymentMethod === 'loyalty' ? 'Loyalty Reward' : 'Voucher'})*\n` : '';
    const basePriceLine = order?.basePrice != null && order?.finalPrice != null && order.basePrice !== order.finalPrice
      ? `Original: GHS ${order.basePrice.toFixed(2)}\nDiscount: -GHS ${(order.basePrice - order.finalPrice).toFixed(2)}\n`
      : '';
    const msg =
      `🧺 Rapid Wash Receipt\n\n` +
      `Hi ${name},\n` +
      `Thank you for using Rapid Wash!\n\n` +
      `Order: *#${num}*\n` +
      `Service: ${serviceDesc}\n` +
      `Wash Cycles: *${loads} load${loads !== 1 ? 's' : ''}*\n` +
      whitesLine +
      deliveryLine +
      `Amount Paid: *GHS ${price}*\n` +
      basePriceLine +
      voucherLine +
      `Payment: ${getPaymentMethodLabel(paymentMethod)}\n` +
      bagCard +
      `Phone: ${customerPhone}\n\n` +
      (isDeliveryOrder
        ? `Your laundry will be delivered to you once ready. We'll be in touch! 🚚\n`
        : `Please bring your bag card when collecting your laundry.\n`) +
      `We appreciate your business! 🙏`;
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
    toast.success('WhatsApp receipt opened!');
  };

  const orderSummaryLines: { name: string; notes?: string; quantity: number; price: number }[] = [];
  if (order) {
    const serviceLabel = formatServiceType(order.serviceType);
    const weight = order.estimatedWeight ?? order.actualWeight ?? 0;
    const serviceName = weight > 0 ? `${serviceLabel} (${weight.toFixed(1)} kg)` : serviceLabel;
    orderSummaryLines.push({ name: serviceName, notes: order.notes || undefined, quantity: 1, price: order.basePrice ?? order.finalPrice ?? 0 });
    if (order.deliveryFee && order.deliveryFee > 0) {
      orderSummaryLines.push({ name: 'Delivery Fee', quantity: 1, price: order.deliveryFee });
    }
  }
  if (orderSummaryLines.length === 0) {
    orderSummaryLines.push({ name: 'Order', quantity: 1, price: amountPaid });
  }

  if (!isSessionValid) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Session invalid. Please sign in again.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <WashStationSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <main className={`flex-1 transition-all duration-300 lg:${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-success" />
          <span className="font-medium text-foreground">Order Completion</span>
        </header>

        <div className="flex flex-col items-center justify-center py-12 px-6">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-success" />
          </div>

          {/* Title */}
          {isLoading && !order ? (
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading order...</span>
            </div>
          ) : (
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Order #{orderNumber || orderIdParam?.slice(-6).toUpperCase()} Confirmed
            </h1>
          )}

          {/* Delivery tag */}
          {isDeliveryOrder && (
            <span className="mb-4 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium rounded-full">
              🚚 Delivery Order
            </span>
          )}

          {/* Order Summary Card */}
          <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden mb-6">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">ORDER SUMMARY</h3>
              {orderNumber && <span className="text-sm text-muted-foreground font-medium">#{orderNumber}</span>}
            </div>
            <div className="p-5 space-y-4">
              {orderSummaryLines.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">{item.quantity}</span>
                      <span className="font-medium text-foreground">{item.name}</span>
                    </div>
                    {item.notes && <p className="text-sm text-muted-foreground ml-8">{item.notes}</p>}
                  </div>
                  <span className="font-semibold text-foreground">₵{item.price.toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-4 border-t border-border flex justify-between">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="text-xl font-bold text-foreground">₵{amountPaid.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Handoff Card — shown for delivery orders */}
          {isDeliveryOrder && stationToken && orderIdParam && (
            <DeliveryHandoffCard
              orderId={orderIdParam as Id<'orders'>}
              stationToken={stationToken}
              deliveryAddress={(order as any)?.deliveryAddress}
              deliveryHall={(order as any)?.deliveryHall}
              deliveryRoom={(order as any)?.deliveryRoom}
              customerPhone={order?.customer?.phoneNumber || (order as any)?.customerPhoneNumber}
              orderStatus={order?.status}
              driverStatus={(order as any)?.driverStatus}
              assignedDriverId={(order as any)?.assignedDriverId}
            />
          )}

          {/* WhatsApp Receipt */}
          <Button
            onClick={handleWhatsAppReceipt}
            className="w-full max-w-md h-14 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-xl text-lg font-semibold mb-3"
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Send Receipt via WhatsApp
          </Button>

          {/* Start New Order */}
          <Button
            onClick={() => router.push('/washstation/new-order')}
            className="w-full max-w-md h-14 bg-primary text-primary-foreground rounded-xl text-lg font-semibold mb-3"
          >
            <Plus className="w-5 h-5 mr-2" />
            Start New Order
          </Button>

          {/* Back to Dashboard */}
          <Button
            onClick={() => router.push('/washstation/dashboard')}
            variant="outline"
            className="w-full max-w-md h-12 rounded-xl text-base font-medium"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
}

export default function OrderCompletePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <OrderCompleteContent />
    </Suspense>
  );
}
