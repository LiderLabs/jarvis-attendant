'use client';

import { useState, Suspense, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { WashStationLayout } from "@/components/washstation/WashStationLayout";
import { useStationSession } from "@/hooks/useStationSession"
import { useAttendantSession } from "@/hooks/use-attendant-session";
import { useStationOrder } from "@/hooks/useStationOrders";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@devlider001/washlab-backend/api";
import { Id } from "@devlider001/washlab-backend/dataModel";
import { ActionVerification } from "@/components/washstation/ActionVerification";
import {
  Banknote, Smartphone, CreditCard,
  ArrowRight, ArrowLeft, Clock, CheckCircle2, Loader2, ShieldCheck,
  AlertTriangle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";


type PaymentMethodType = "cash" | "mobile_money" | "card";
type Stage = "idle" | "verification" | "paystack" | "finalizing" | "recovering";

const PAYSTACK_FEE_RATE = 0.02;

function calcPaystackCharge(orderAmount: number): { chargeAmount: number; fee: number } {
  const chargeAmount = parseFloat((orderAmount / (1 - PAYSTACK_FEE_RATE)).toFixed(2));
  const fee = parseFloat((chargeAmount - orderAmount).toFixed(2));
  return { chargeAmount, fee };
}

function usePaystackScript() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).PaystackPop) { setLoaded(true); return; }
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) { existing.addEventListener("load", () => setLoaded(true)); return; }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => console.error("Failed to load Paystack script");
    document.body.appendChild(script);
  }, []);
  return loaded;
}


function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { stationToken, isSessionValid } = useStationSession();
  const { attendantId: loggedInAttendantId } = useAttendantSession();
  const paystackLoaded = usePaystackScript();

  const createPayment        = useMutation((api as any).payments.create);
  const initiatePayment      = useMutation((api as any).payments.initiate);
  const finalizePaymentSafe  = useMutation((api as any).payments.finalizePaymentSafe);
  const saveGatewayReference = useMutation((api as any).payments.saveGatewayReference);
  const resetToPending       = useMutation((api as any).payments.resetToPending);
  const verifyAndRecoverPayment = useAction((api as any).paymentsRecovery.verifyAndRecoverPayment);

  const currentPaymentId   = useRef<any>(null);
  const hasAutoRecovered   = useRef(false);
  const isPaying           = useRef(false);
  const paystackHandlerRef = useRef<any>(null);
  const pendingVerificationId = useRef<Id<"biometricVerifications"> | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("mobile_money");
  const [showVerification, setShowVerification] = useState(false);
  const [mobileView, setMobileView]   = useState<"summary" | "payment">("summary");
  const [stage, setStage]             = useState<Stage>("idle");
  const [paystackRef, setPaystackRef] = useState<string | null>(null);

  const isProcessing = stage !== "idle";

  const [voucherCode, setVoucherCode]     = useState("");
  const [voucherResult, setVoucherResult] = useState<null | {
    valid: boolean;
    discountAmount?: number;
    finalPrice?: number;
    voucher?: { code: string; name?: string; discountType: string; discountValue: number };
  }>(null);

  const applyVoucherMutation  = useMutation((api as any).vouchers.applyToOrder);
  const redeemLoyaltyMutation = useMutation((api as any).loyalty.redeemPointsForAttendant);

  const orderIdParam = searchParams?.get("orderId");
  const returnTo     = searchParams?.get("return");

  const { order, isLoading: isLoadingOrder } = useStationOrder(
    stationToken,
    orderIdParam ? (orderIdParam as Id<"orders">) : null,
    isSessionValid
  );

  const activeVouchers = useQuery(
    (api as any).vouchers.getActive,
    order ? { branchId: order.branchId } : "skip"
  );

  const customerLoyaltyPoints = useQuery(
    (api as any).loyalty.getPointsForAttendant,
    order?.customerId && stationToken ? { customerId: order.customerId, stationToken } : "skip"
  );

  // Polls the payment record — drives the recovery banner and auto-recovery
  const savedPaymentStatus = useQuery(
    (api as any).paymentsRecovery.getPaymentStatusForOrder,
    order && order.paymentStatus !== "paid" ? { orderId: order._id } : "skip"
  );

  const loyaltyPoints    = customerLoyaltyPoints?.points ?? 0;
  const hasLoyaltyReward = loyaltyPoints >= 10;
  const [useLoyalty, setUseLoyalty] = useState(false);

  const voucherValidation = useQuery(
    (api as any).vouchers.validate,
    voucherCode.length >= 6 && order
      ? { code: voucherCode.toUpperCase(), orderTotal: order.totalPrice ?? 1, branchId: order.branchId }
      : "skip"
  );

  const deliveryFee           = order?.deliveryFee || 0;
  const basePrice             = order?.basePrice || 0;
  const subtotal              = basePrice + deliveryFee;
  const baseTotalDue          = order?.finalPrice != null ? order.finalPrice : (order?.totalPrice ?? (subtotal > 0 ? subtotal : 0));
  const hasPreAppliedDiscount = order?.finalPrice != null && order?.totalPrice != null && order.finalPrice < order.totalPrice;
  const totalDue              = (voucherResult?.valid && voucherResult?.finalPrice !== undefined) ? voucherResult.finalPrice : baseTotalDue;
  const totalDueWithLoyalty   = useLoyalty && hasLoyaltyReward ? 0 : totalDue;
  const isFreeWash            = (voucherResult?.valid && totalDue === 0) || (useLoyalty && hasLoyaltyReward) || (hasPreAppliedDiscount && baseTotalDue === 0);

  const effectivePaymentMethod: PaymentMethodType = paymentMethod;
  const isPaystackMethod = effectivePaymentMethod !== "cash";

  const { chargeAmount: paystackChargeAmount, fee: paystackFee } = isPaystackMethod
    ? calcPaystackCharge(totalDueWithLoyalty)
    : { chargeAmount: totalDueWithLoyalty, fee: 0 };

  const customerFacingAmount = isPaystackMethod ? paystackChargeAmount : totalDue;

  // ─── Recovery ────────────────────────────────────────────────────────────────
  // Called automatically on load (if stuck) and manually via the banner button.

  const runRecovery = useCallback(async (gatewayReference?: string | null) => {
    if (!order || stage === "recovering") return;
    setStage("recovering");
    try {
      const result = await verifyAndRecoverPayment({
        orderId: order._id,
        ...(gatewayReference ? { gatewayReference } : {}),
      });

      if (result.recovered) {
        toast.success(
          `Payment recovered! ${
            result.method === "mobile_money" ? "Mobile Money" :
            result.method === "card" ? "Card" : "Cash"
          } — ₵${result.amount?.toFixed(2)}`
        );
        router.push(
          `/washstation/order-complete?orderId=${order._id}&paymentMethod=${result.method}&amountPaid=${result.amount}&changeDue=0`
        );
      } else if (result.alreadyPaid) {
        toast.info("Payment was already recorded.");
        router.push(`/washstation/orders/${order._id}`);
      } else if (result.noReference) {
        toast.warning("No payment reference found — the customer may not have reached Paystack yet.");
        setStage("idle");
      } else {
        toast.error(result.error ?? "Payment not confirmed by Paystack.");
        setStage("idle");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Recovery check failed. Please try again.");
      setStage("idle");
    }
  }, [order, stage, verifyAndRecoverPayment, router]);

  // Auto-recover once on page load if payment is stuck with a saved Paystack ref
  useEffect(() => {
    if (
      !order ||
      hasAutoRecovered.current ||
      order.paymentStatus === "paid" ||
      !savedPaymentStatus ||
      stage !== "idle"
    ) return;

    const isStuck = savedPaymentStatus.status === "processing" && savedPaymentStatus.hasGatewayRef;
    if (isStuck) {
      hasAutoRecovered.current = true;
      toast.loading("Checking payment with Paystack…", { id: "auto-recover" });
      runRecovery(savedPaymentStatus.gatewayReference).then(() => {
        toast.dismiss("auto-recover");
      });
    }
  }, [order, savedPaymentStatus, stage, runRecovery]);

  // ─── Step 1: Attendant clicks "Verify & Pay" ─────────────────────────────────

  const handleCompletePayment = () => {
    if (!order) { toast.error("Order not found"); return; }
    if (isPaying.current || isProcessing) return;
    if (!paystackLoaded && effectivePaymentMethod !== "cash") {
      toast.error("Payment processor not ready. Please wait a moment and try again.");
      return;
    }
    setStage("verification");
    setShowVerification(true);
  };

  // ─── Step 2: Verification passed ─────────────────────────────────────────────

  const handleVerificationSuccess = async (
    attendantId: Id<"attendants">,
    verificationId: Id<"biometricVerifications">
  ) => {
    setShowVerification(false);

    // Loyalty free wash
    if (useLoyalty && hasLoyaltyReward && order) {
      setStage("finalizing");
      try {
        await redeemLoyaltyMutation({ orderId: order._id, stationToken: stationToken!, pointsToRedeem: 10 });
        toast.success("Loyalty points redeemed! Order marked as paid.");
        router.push(`/washstation/order-complete?orderId=${order._id}&paymentMethod=loyalty&amountPaid=0&changeDue=0`);
      } catch (e: any) {
        toast.error(e?.message || "Failed to redeem loyalty points");
        setStage("idle");
      }
      return;
    }

    // Pre-applied discount free wash (no voucher code entered)
    if (isFreeWash && hasPreAppliedDiscount && !voucherCode && !voucherResult?.valid) {
      setStage("finalizing");
      try {
        await createPayment({ orderId: order!._id, amount: 0, paymentMethod: "cash" });
        await finalizePaymentSafe({ orderId: order!._id, verificationId, gatewayTransactionId: undefined, confirmedPaymentMethod: "cash" });
        toast.success("Loyalty free wash completed! Order marked as paid.");
        router.push(`/washstation/order-complete?orderId=${order!._id}&paymentMethod=loyalty&amountPaid=0&changeDue=0`);
      } catch (e: any) {
        toast.error(e?.message || "Failed to complete order");
        setStage("idle");
      }
      return;
    }

    // Voucher free wash
    if (isFreeWash) { await handleConfirmVoucher(verificationId); return; }
    if (!order) { toast.error("Order not found"); setStage("idle"); return; }

    // Partial voucher discount — record it first (non-blocking)
    if (voucherResult?.valid && voucherResult.voucher?.discountType !== "free_wash") {
      try {
        await applyVoucherMutation({ voucherCode: voucherCode.trim().toUpperCase(), orderId: order._id });
      } catch (e) {
        console.warn("Voucher record failed (non-critical):", e);
      }
    }

    try {
      const paymentId = await createPayment({
        orderId: order._id,
        amount: totalDue,
        paymentMethod: effectivePaymentMethod,
      });
      currentPaymentId.current = paymentId;

      if (effectivePaymentMethod !== "cash") {
        await initiatePayment({ paymentId });
        pendingVerificationId.current = verificationId;
        openPaystack(effectivePaymentMethod as "card" | "mobile_money", verificationId, paymentId);
        return;
      }

      finalizePayment({ verificationId, gatewayTransactionId: null, confirmedPaymentMethod: "cash" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start payment");
      currentPaymentId.current = null;
      setStage("idle");
    }
  };

  // ─── Voucher helpers ──────────────────────────────────────────────────────────

  const handleApplyVoucher = () => {
    if (!voucherCode.trim() || !order) return;
    if (voucherValidation === undefined) { toast.info("Checking voucher..."); return; }
    if (voucherValidation?.valid) {
      setVoucherResult(voucherValidation);
      if (voucherValidation.voucher?.discountType === "free_wash") toast.success("Free wash voucher applied! No payment needed.");
      else toast.success(`Voucher applied! You save GHS ${voucherValidation.discountAmount?.toFixed(2)}`);
    } else {
      toast.error(voucherValidation?.error || "Invalid voucher");
    }
  };

  const handleConfirmVoucher = async (verificationId: Id<"biometricVerifications">) => {
    if (!order || !voucherResult?.valid) return;
    setStage("finalizing");
    try {
      if (order.paymentStatus !== "paid") {
        await applyVoucherMutation({ voucherCode: voucherCode.trim().toUpperCase(), orderId: order._id });
      }
      toast.success("Voucher applied! Order marked as paid.");
      router.push(`/washstation/order-complete?orderId=${order._id}&paymentMethod=voucher&amountPaid=0&changeDue=0`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to apply voucher");
      setStage("idle");
    }
  };

  // ─── Step 3: Open Paystack popup ─────────────────────────────────────────────
  // CRITICAL: saveGatewayReference is now AWAITED before opening the popup.
  // Previously it was fire-and-forget — if it failed, recovery had no ref to
  // verify against, so stuck payments could never be recovered automatically.

  const openPaystack = async (
    method: "card" | "mobile_money",
    verificationId: Id<"biometricVerifications">,
    paymentId?: any
  ) => {
    if (!order || !paystackLoaded) return;

    if (paystackHandlerRef.current) {
      try { clearTimeout(paystackHandlerRef.current._timeoutId); } catch {}
      paystackHandlerRef.current = null;
      isPaying.current = false;
    }

    const ref = `rapidwash_${order._id}_${Date.now()}`;
    setPaystackRef(ref);

    // ✅ AWAIT this — the ref MUST be saved before the popup opens so that
    // if the network drops after the customer pays, recovery can find this ref.
    if (paymentId) {
      try {
        await saveGatewayReference({ paymentId, gatewayReference: ref });
      } catch (e) {
        // Non-fatal: log and continue. Recovery may be harder without the ref
        // but payment can still succeed normally.
        console.warn("[Payment] Failed to save gateway ref — recovery may not work if network drops:", e);
      }
    }

    const channels    = method === "card" ? ["card"] : ["mobile_money"];
    const rawPhone    = order.customer?.phoneNumber || order.customerPhoneNumber || "";
    const cleanPhone  = rawPhone.replace(/[\s\-]/g, "").replace(/^\+233/, "0").replace(/^233/, "0");
    const customerPhone = cleanPhone.startsWith("0") ? cleanPhone : "0" + cleanPhone;

    setStage("paystack");
    toast.info("Payment window opening for customer…");

    let handler: any;
    try {
      handler = (window as any).PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_KEY,
        email: order.customer?.email || order.customerEmail || "customer@rapidwash.com",
        amount: Math.round(paystackChargeAmount * 100),
        currency: "GHS",
        ref,
        channels,
        ...(customerPhone ? { phone: customerPhone } : {}),

        callback: function (response: any) {
          paystackHandlerRef.current = null;

          // Map Paystack channel → our payment method
          const paystackChannel  = response?.channel ?? response?.authorization?.channel ?? "";
          let resolvedMethod: "cash" | "card" | "mobile_money" = method as any;
          if (paystackChannel === "mobile_money")                          resolvedMethod = "mobile_money";
          else if (paystackChannel === "card")                             resolvedMethod = "card";
          else if (paystackChannel === "bank" || paystackChannel === "bank_transfer") resolvedMethod = "card";

          toast.success(`${resolvedMethod === "card" ? "Card" : "Mobile Money"} payment authorised`);
          currentPaymentId.current = null;

          finalizePayment({
            verificationId,
            gatewayTransactionId: response.reference || response.trxref || ref,
            confirmedPaymentMethod: resolvedMethod,
          });
        },

        onClose: function () {
          paystackHandlerRef.current = null;
          pendingVerificationId.current = null;
          setPaystackRef(null);
          setStage("idle");
          isPaying.current = false;

          if (currentPaymentId.current) {
            resetToPending({ paymentId: currentPaymentId.current }).catch((e) => {
              console.warn("Failed to reset payment to pending on close:", e);
            });
            currentPaymentId.current = null;
          }

          toast.warning("Customer closed the payment window. You can try again.");
        },
      });
    } catch (setupErr) {
      toast.error("Failed to open payment window. Please try again.");
      setStage("idle");
      isPaying.current = false;
      currentPaymentId.current = null;
      return;
    }

    paystackHandlerRef.current = handler;
    handler.openIframe();

    const paystackTimeout = setTimeout(() => {
      if (paystackHandlerRef.current) {
        paystackHandlerRef.current = null;
        pendingVerificationId.current = null;
        setPaystackRef(null);
        setStage("idle");
        isPaying.current = false;
        if (currentPaymentId.current) {
          resetToPending({ paymentId: currentPaymentId.current }).catch(() => {});
          currentPaymentId.current = null;
        }
        toast.error("Payment timed out. Please try again.");
      }
    }, 3 * 60 * 1000);

    paystackHandlerRef.current._timeoutId = paystackTimeout;
  };

  // ─── Step 4: Finalize payment on backend ─────────────────────────────────────

  const finalizePayment = async ({
    verificationId,
    gatewayTransactionId,
    confirmedPaymentMethod,
  }: {
    verificationId: Id<"biometricVerifications">;
    gatewayTransactionId: string | null;
    confirmedPaymentMethod?: "cash" | "card" | "mobile_money";
  }) => {
    if (!order) return;
    if (isPaying.current) { toast.error("Payment is already being processed."); return; }

    isPaying.current = true;
    setStage("finalizing");
    toast.loading("Finalizing payment…", { id: "finalizing" });

    try {
      const result = await finalizePaymentSafe({
        orderId: order._id,
        verificationId,
        gatewayTransactionId: gatewayTransactionId ?? undefined,
        confirmedPaymentMethod: confirmedPaymentMethod ?? "cash",
      });

      toast.dismiss("finalizing");

      if ((result as any)?.alreadyCompleted) {
        toast.info("This payment was already completed.");
      } else {
        toast.success("Payment completed successfully!");
      }

      sessionStorage.removeItem(`checkin_draft_${order._id}`);
      setPaystackRef(null);
      setStage("idle");
      isPaying.current = false;
      currentPaymentId.current = null;

      router.push(
        `/washstation/order-complete?orderId=${order._id}&paymentMethod=${effectivePaymentMethod}&amountPaid=${customerFacingAmount}&changeDue=0`
      );
    } catch (error) {
      toast.dismiss("finalizing");
      toast.error(error instanceof Error ? error.message : "Failed to finalize payment");
      setStage("idle");
      isPaying.current = false;
      pendingVerificationId.current = null;
    }
  };

  // ─── Verification cancelled ───────────────────────────────────────────────────

  const handleVerificationCancel = () => {
    setShowVerification(false);
    pendingVerificationId.current = null;
    setStage("idle");
    isPaying.current = false;
    currentPaymentId.current = null;
    toast.info("Verification cancelled. Payment not processed.");
  };

  // ─── Navigation ──────────────────────────────────────────────────────────────

  const handleCancel = () => {
    if (isProcessing) return;
    router.push("/washstation/dashboard");
  };

  const handleBackNavigation = () => {
    if (isProcessing) return;
    if (returnTo === "order" && order) {
      if (order.customer || order.customerId) {
        sessionStorage.setItem("rapidwash_prefilledCustomer", JSON.stringify({
          id: order.customer?._id || order.customerId,
          name: order.customer?.name || "Customer",
          phone: order.customer?.phoneNumber || order.customerPhoneNumber || "",
          email: order.customer?.email || "",
          skipPhone: true,
        }));
      }
      router.push("/washstation/new-order");
    } else {
      router.push(`/washstation/online-orders?returnOrder=${order?._id}`);
    }
  };

  const stageLabel: Record<Stage, string | null> = {
    idle:         null,
    verification: "Waiting for attendant verification…",
    paystack:     "Waiting for customer payment…",
    finalizing:   "Finalizing payment…",
    recovering:   "Checking payment with Paystack…",
  };

  // ─── Loading / error states ───────────────────────────────────────────────────

  if (!isSessionValid || isLoadingOrder) {
    return (
      <WashStationLayout title="Payment">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading order details…</span>
          </div>
        </div>
      </WashStationLayout>
    );
  }

  if (!order) {
    return (
      <WashStationLayout title="Payment">
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <div className="text-center space-y-4">
            <p className="text-destructive font-medium">Order not found</p>
            <Button onClick={handleCancel}>Back to Dashboard</Button>
          </div>
        </div>
      </WashStationLayout>
    );
  }

  if (order.paymentStatus === "paid") {
    return (
      <WashStationLayout title="Payment">
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
            <p className="text-success font-semibold">This order is already paid</p>
            <p className="text-muted-foreground text-sm">Order #{order.orderNumber}</p>
            <Button onClick={() => router.push(`/washstation/orders/${order._id}`)}>View Order</Button>
          </div>
        </div>
      </WashStationLayout>
    );
  }

  // Recovery banner — shown when a stuck processing payment with a saved ref is detected
  const showRecoveryBanner =
    stage === "idle" &&
    !!savedPaymentStatus &&
    savedPaymentStatus.status === "processing" &&
    savedPaymentStatus.hasGatewayRef;

  const RecoveryBanner = () => (
    <div className="mx-4 sm:mx-6 mt-3 flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Payment may have succeeded</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          The customer may have paid but the order wasn't updated. Click to verify with Paystack.
        </p>
        {savedPaymentStatus?.gatewayReference && (
          <p className="text-[10px] font-mono text-amber-500 mt-1 truncate">
            Ref: {savedPaymentStatus.gatewayReference}
          </p>
        )}
      </div>
      <button
        onClick={() => runRecovery(savedPaymentStatus?.gatewayReference)}
        disabled={stage === "recovering"}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`w-3 h-3 ${stage === "recovering" ? "animate-spin" : ""}`} />
        {stage === "recovering" ? "Checking…" : "Check"}
      </button>
    </div>
  );

  // ─── Panels ───────────────────────────────────────────────────────────────────

  const OrderSummaryPanel = () => (
    <div className="flex flex-col h-full p-4 sm:p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Current Order</span>
          <span className="px-2 py-0.5 bg-success/10 text-success text-xs font-medium rounded-full whitespace-nowrap">
            Ready for Payment
          </span>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">Order #{order.orderNumber || "N/A"}</h2>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3 flex-shrink-0" />
          {order.createdAt
            ? `Created at ${new Date(order.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
            : "Loading..."}
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl mb-4">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-muted-foreground">
            {order.customer?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "CU"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{order.customer?.name || "Customer"}</p>
          <p className="text-xs text-muted-foreground">{order.customerPhoneNumber || "No phone"}</p>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-foreground">₵{basePrice.toFixed(2)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery Fee</span>
            <span className="text-foreground">₵{deliveryFee.toFixed(2)}</span>
          </div>
        )}
        {hasPreAppliedDiscount && (
          <div className="flex justify-between text-sm text-green-600">
            <span className="font-medium">
              {(order as any)?.voucherCode ? "Voucher Applied" : "Loyalty Redeemed"}
              {(order as any)?.voucherCode
                ? <span className="ml-1 text-xs bg-green-100 px-1 rounded">{(order as any).voucherCode}</span>
                : <span className="ml-1 text-xs bg-green-100 px-1 rounded">🎁 1 free wash</span>}
            </span>
            <span>-₵{((order?.totalPrice ?? 0) - (order?.finalPrice ?? 0)).toFixed(2)}</span>
          </div>
        )}
        {hasPreAppliedDiscount && (
          <div className="flex justify-between text-sm line-through text-muted-foreground">
            <span>Original Total</span>
            <span>₵{(order?.totalPrice ?? 0).toFixed(2)}</span>
          </div>
        )}
        {isPaystackMethod && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Processing Fee (2%)
              <span className="ml-1 text-[10px] text-muted-foreground/60">via Paystack</span>
            </span>
            <span className="text-foreground">₵{paystackFee.toFixed(2)}</span>
          </div>
        )}

        {/* Loyalty Points */}
        {order?.customerId && (
          <div className="pt-3 border-t border-border">
            {hasLoyaltyReward ? (
              <div className={"flex items-center justify-between p-3 rounded-xl border " + (useLoyalty ? "bg-purple-100 dark:bg-purple-900/30 border-purple-400" : "bg-purple-50 dark:bg-purple-900/20 border-purple-200")}>
                <div>
                  <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">🎁 Loyalty Reward</p>
                  <p className="text-xs text-muted-foreground">{loyaltyPoints} pts — free wash available</p>
                </div>
                <button
                  onClick={() => setUseLoyalty(!useLoyalty)}
                  disabled={isProcessing || !!voucherResult?.valid}
                  className={"text-xs font-semibold px-3 py-1.5 rounded-lg " + (useLoyalty ? "bg-purple-600 text-white" : "bg-primary text-primary-foreground") + " disabled:opacity-40"}
                >
                  {useLoyalty ? "Remove" : "Apply"}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted-foreground">Loyalty Points</p>
                <p className="text-xs font-medium">{loyaltyPoints}/10 pts</p>
              </div>
            )}
          </div>
        )}

        {/* Voucher */}
        <div className="pt-3 border-t border-border">
          {voucherResult?.valid ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">{voucherResult.voucher?.code}</p>
                <p className="text-xs text-muted-foreground">-₵{voucherResult.discountAmount?.toFixed(2)} discount</p>
              </div>
              <button
                onClick={() => { setVoucherResult(null); setVoucherCode(""); }}
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                disabled={isProcessing}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              >
                <option value="">-- Select a voucher --</option>
                {(activeVouchers ?? []).map((v: any) => (
                  <option key={v._id} value={v.code}>
                    {v.code}{v.name ? ` — ${v.name}` : ""} ({v.discountType === "percentage" ? `${v.discountValue}% off` : `₵${v.discountValue} off`})
                  </option>
                ))}
              </select>
              <button
                onClick={handleApplyVoucher}
                disabled={!voucherCode.trim() || isProcessing}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2 border-t border-border items-center">
          <span className="font-semibold text-foreground">Total Due</span>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-bold text-primary">
              ₵{customerFacingAmount.toFixed(2)}
            </span>
            {isPaystackMethod && (
              <p className="text-[10px] text-muted-foreground mt-0.5">incl. 2% processing fee</p>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setMobileView("payment")}
        disabled={isProcessing}
        className="mt-5 w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 lg:hidden disabled:opacity-50"
      >
        Select Payment Method <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  const PaymentPanel = () => (
    <div className="flex flex-col h-full p-4 sm:p-6">
      <button
        onClick={() => setMobileView("summary")}
        disabled={isProcessing}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-4 lg:hidden w-fit disabled:opacity-40"
      >
        <ArrowLeft className="w-4 h-4" /> Order Summary
      </button>

      <div className="lg:hidden mb-4 px-4 py-3 bg-muted/30 rounded-xl flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Order #{order.orderNumber}</span>
        <div className="text-right">
          <span className="text-lg font-bold text-primary">₵{customerFacingAmount.toFixed(2)}</span>
          {isPaystackMethod && <p className="text-[10px] text-muted-foreground">incl. 2% fee</p>}
        </div>
      </div>

      <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">Select Payment Method</h2>
      <p className="text-muted-foreground text-sm mb-5">Choose how the customer would like to pay.</p>

      {hasPreAppliedDiscount && !isFreeWash && (
        <div className="mb-5 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <p className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-1">
            {(order as any)?.voucherCode ? `🎫 Voucher Applied: ${(order as any).voucherCode}` : "🎁 Loyalty Discount Applied"}
          </p>
          <p className="text-xs text-muted-foreground">
            Customer already redeemed a discount. Price reduced by ₵{((order?.totalPrice ?? 0) - (order?.finalPrice ?? 0)).toFixed(2)}.
            Proceed with payment of ₵{baseTotalDue.toFixed(2)}.
          </p>
        </div>
      )}

      {isFreeWash && (
        <div className="mb-5 p-5 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
          <p className="text-lg font-bold text-green-700 dark:text-green-400 mb-1">
            {hasPreAppliedDiscount && !voucherCode ? "🎁 Loyalty Free Wash!" : "Free Wash Applied!"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">No payment required. Click below to complete the order.</p>
          <button
            onClick={() => { setStage("verification"); setShowVerification(true); }}
            disabled={isProcessing}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Complete Order (Free)
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        {/* Mobile Money */}
        <button
          onClick={() => !isProcessing && setPaymentMethod("mobile_money")}
          disabled={isProcessing}
          className={`p-3 sm:p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-2 relative disabled:opacity-50 disabled:cursor-not-allowed ${effectivePaymentMethod === "mobile_money" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
        >
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${effectivePaymentMethod === "mobile_money" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className={`font-medium text-xs sm:text-sm text-center leading-tight ${effectivePaymentMethod === "mobile_money" ? "text-primary" : "text-foreground"}`}>Mobile Money</span>
          {effectivePaymentMethod === "mobile_money" && (
            <div className="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">✓</div>
          )}
        </button>

        {/* Card */}
        <button
          onClick={() => !isProcessing && setPaymentMethod("card")}
          disabled={isProcessing}
          className={`p-3 sm:p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-2 relative disabled:opacity-50 disabled:cursor-not-allowed ${effectivePaymentMethod === "card" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
        >
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${effectivePaymentMethod === "card" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className={`font-medium text-xs sm:text-sm ${effectivePaymentMethod === "card" ? "text-primary" : "text-foreground"}`}>Card</span>
          {effectivePaymentMethod === "card" && (
            <div className="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">✓</div>
          )}
        </button>

        {/* Cash */}
        <button
          onClick={() => !isProcessing && setPaymentMethod("cash")}
          disabled={isProcessing}
          className={`p-3 sm:p-5 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-muted">
            <Banknote className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
          </div>
          <span className="font-medium text-xs sm:text-sm text-foreground">Cash</span>
        </button>
      </div>

      {!isProcessing && (
        <div className="mb-5 max-w-lg flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-xl px-4 py-3">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-primary" />
          <span>
            <strong className="text-foreground">How it works:</strong>{" "}
            Verify your identity first, then the customer completes payment via Paystack.
          </span>
        </div>
      )}

      {isProcessing && stageLabel[stage] && (
        <div className="mb-5 max-w-lg px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          <span className="text-sm text-primary font-medium">{stageLabel[stage]}</span>
        </div>
      )}

      {!isProcessing && (
        <div className="mb-5 w-full max-w-lg">
          {effectivePaymentMethod === "mobile_money" && (
            <div className="bg-muted/30 rounded-xl p-4 sm:p-5 text-center">
              <div className="w-11 h-11 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">Mobile Money via Paystack</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mb-2">After you verify, a Paystack prompt opens for the customer to pay.</p>
              <p className="text-xl sm:text-2xl font-bold text-primary">₵{paystackChargeAmount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Order total ₵{totalDue.toFixed(2)} + ₵{paystackFee.toFixed(2)} processing fee</p>
            </div>
          )}
          {effectivePaymentMethod === "card" && (
            <div className="bg-muted/30 rounded-xl p-4 sm:p-5 text-center">
              <div className="w-11 h-11 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">Card Payment via Paystack</h3>
              <p className="text-muted-foreground text-xs sm:text-sm mb-2">After you verify, a secure Paystack popup opens for the customer to pay.</p>
              <p className="text-xl sm:text-2xl font-bold text-primary">₵{paystackChargeAmount.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Order total ₵{totalDue.toFixed(2)} + ₵{paystackFee.toFixed(2)} processing fee</p>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <CreditCard className="w-3 h-3" />
                <span>Powered by Paystack</span>
              </div>
            </div>
          )}
        </div>
      )}

      {paystackRef && isProcessing && (
        <p className="text-[10px] text-muted-foreground mb-3 font-mono truncate max-w-lg">
          Ref: {paystackRef}
        </p>
      )}

      <div className="flex gap-3 max-w-lg mt-auto">
        <Button
          onClick={handleCancel}
          variant="outline"
          disabled={isProcessing}
          className="flex-1 h-12 sm:h-14 rounded-xl text-sm sm:text-base disabled:opacity-50"
        >
          Cancel
        </Button>
        <Button
          onClick={handleCompletePayment}
          disabled={isProcessing}
          className={`flex-1 h-12 sm:h-14 rounded-xl text-sm sm:text-base font-semibold transition-all ${
            isProcessing
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
              {stage === "verification" && "Awaiting Verification…"}
              {stage === "paystack"     && "Awaiting Payment…"}
              {stage === "finalizing"   && "Finalizing…"}
              {stage === "recovering"   && "Checking Paystack…"}
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-2 flex-shrink-0" />
              Verify & Pay ₵{customerFacingAmount.toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <WashStationLayout title="Payment">
      <div className="flex flex-col h-full min-h-0">
        <div className="px-4 sm:px-6 pt-3 pb-1 flex-shrink-0">
          <button
            onClick={handleBackNavigation}
            disabled={isProcessing}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {showRecoveryBanner && <RecoveryBanner />}

        {/* Desktop: side-by-side */}
        <div className="hidden lg:flex flex-1 min-h-0 overflow-hidden">
          <div className="w-72 xl:w-80 border-r border-border bg-card flex-shrink-0 overflow-y-auto">
            <OrderSummaryPanel />
          </div>
          <div className="flex-1 overflow-y-auto">
            <PaymentPanel />
          </div>
        </div>

        {/* Mobile/tablet: tabs */}
        <div className="flex flex-col flex-1 min-h-0 lg:hidden overflow-hidden">
          <div className="flex border-b border-border bg-card flex-shrink-0">
            {(["summary", "payment"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileView(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  mobileView === tab
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "summary" ? "Order Summary" : "Payment"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {mobileView === "summary" ? <OrderSummaryPanel /> : <PaymentPanel />}
          </div>
        </div>
      </div>

      <ActionVerification
        open={showVerification}
        onCancel={handleVerificationCancel}
        onVerified={handleVerificationSuccess}
        actionType={`complete_payment:₵${customerFacingAmount.toFixed(2)}`}
        orderId={order._id}
      />
    </WashStationLayout>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading…</span>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}