"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStationSession } from "@/hooks/useStationSession"
import { usePaginatedQuery, useMutation, useQuery } from "convex/react"
import { api } from "@jordan6699/washlab-backend/api"
import { Id } from "@jordan6699/washlab-backend/dataModel"
import {
  Search, Phone, Mail, Minus, Plus, Scale, Package,
  ShoppingBag, Trash2, MessageSquare, ArrowRight,
  User, ArrowLeft, Layers, Tag, MapPin, Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { LoadingSpinner } from "@/components/washstation/LoadingSpinner"
import { ActionVerification } from "@/components/washstation/ActionVerification"

const KG_PER_LOAD = 8

export function OnlineOrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { stationToken, isSessionValid } = useStationSession()

  const [mobileView, setMobileView] = useState<"queue" | "detail">("queue")
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showRejectVerification, setShowRejectVerification] = useState(false)

  const [weight, setWeight] = useState<string>("")
  const [laundryBags, setLaundryBags] = useState(1)
  const [bagCardNumber, setBagCardNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [extraWashLoads, setExtraWashLoads] = useState(0)
  const [extraDryLoads, setExtraDryLoads] = useState(0)
  const [overriddenServiceType, setOverriddenServiceType] = useState<string | null>(null)

  const activeBagNumbers =
    useQuery(api.stations.getActiveBagNumbers, stationToken ? { stationToken } : "skip") ?? []

  const allOnlineOrdersResult = usePaginatedQuery(
    api.stations.getStationOrders,
    stationToken ? { stationToken, orderType: "online" as any } : "skip",
    { initialNumItems: 50 }
  )

  const pendingOrders = (allOnlineOrdersResult.results || [])
    .filter(o => o.status === "pending_dropoff" || o.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt)

  const allOrders = allOnlineOrdersResult.results || []
  const isLoadingOrders = allOnlineOrdersResult.status === "LoadingFirstPage"

  const checkInOrder = useMutation(api.stations.checkInOnlineOrder)
  const cancelOrder = useMutation(api.stations.cancelOnlineOrder)

  const branchInfo = useQuery(
    (api as any).stations.getStationInfo,
    stationToken ? { stationToken } : "skip"
  ) as { pricingPerKg: number; deliveryFee: number } | undefined

  const branchServices = useQuery(
    (api as any).admin.getBranchServices,
    (selectedOrder?.branchId || (branchInfo as any)?.branchId)
      ? { branchId: selectedOrder?.branchId || (branchInfo as any).branchId }
      : "skip"
  ) ?? []

  // Restore draft on return from payment
  useEffect(() => {
    const returningOrderId = searchParams?.get("returnOrder")
    if (!returningOrderId || isLoadingOrders) return
    const draft = sessionStorage.getItem(`checkin_draft_${returningOrderId}`)
    if (!draft) return
    const returningOrder = allOrders.find(o => o._id === returningOrderId)
    if (!returningOrder) return
    try {
      const { weight: w, laundryBags: lb, bagCardNumber: bc, notes: n } = JSON.parse(draft)
      setSelectedOrder(returningOrder)
      setWeight(w)
      setLaundryBags(lb)
      setBagCardNumber(bc)
      setNotes(n)
      setMobileView("detail")
    } catch {}
  }, [searchParams, isLoadingOrders, allOrders.length])

  const handleSelectOrder = (order: any) => {
    setSelectedOrder(order)
    setWeight("")
    setLaundryBags(1)
    setBagCardNumber("")
    setNotes("")
    setExtraWashLoads(0)
    setExtraDryLoads(0)
    setOverriddenServiceType(null)
    setMobileView("detail")
  }

  const handleBack = () => { setSelectedOrder(null); setMobileView("queue") }
  const handleRejectClick = () => { if (selectedOrder) setShowRejectVerification(true) }

  const handleRejectConfirm = async (attendantId: Id<"attendants">, verificationId: Id<"biometricVerifications">) => {
    if (!selectedOrder || !stationToken) { toast.error("Please select an order"); return }
    try {
      await cancelOrder({ stationToken, orderId: selectedOrder._id, verificationId, reason: "Order rejected by attendant" })
      toast.success("Order cancelled successfully")
      setShowRejectVerification(false)
      setSelectedOrder(null)
      setMobileView("queue")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel order")
    }
  }

  const handleContact = () => { if (selectedOrder?.customer?.phoneNumber) window.location.href = `tel:${selectedOrder.customer.phoneNumber}` }
  const handleWhatsApp = () => {
    if (selectedOrder?.customer?.phoneNumber) {
      const phone = selectedOrder.customer.phoneNumber.startsWith("0")
        ? `233${selectedOrder.customer.phoneNumber.slice(1)}`
        : selectedOrder.customer.phoneNumber
      window.open(`https://wa.me/${phone}`, "_blank")
    }
  }

  const getPricePerLoad = (serviceType: string): number => {
    const match = (branchServices as any[]).find(s => s.code === serviceType)
    if (match) return match.price ?? match.basePrice ?? 50
    return (branchServices as any[])[0]?.price ?? 50
  }
  const getExtraWashPrice = (): number => {
    const code = selectedOrder?.serviceType === "wash_and_dry" ? "wash_and_dry" : "wash_only"
    return (branchServices as any[]).find(s => s.code === code)?.extraWashPrice ?? getPricePerLoad(code)
  }
  const getExtraDryPrice = (): number => {
    const code = selectedOrder?.serviceType === "wash_and_dry" ? "wash_and_dry" : "dry_only"
    return (branchServices as any[]).find(s => s.code === code)?.extraDryPrice ?? getPricePerLoad(code)
  }

  const numWeight = parseFloat(weight) || 0

// Cast to extended type to include Jarvis-specific optional fields
type OrderWithJarvisFields = typeof selectedOrder & {
  selectedServices?: Array<{ serviceId: string; serviceName: string; pricingType: string; unit: string; quantity: number; unitPrice: number; subtotal: number }>;
  scheduledPickupAt?: number;
  pickupAddress?: string;
  pickupCity?: string;
}
const order = selectedOrder as OrderWithJarvisFields

// If the order has selectedServices (Jarvis multi-service), use them for pricing
const hasMultiServices = order?.selectedServices && order.selectedServices.length > 0

  const getPricingBreakdown = () => {
    if (!selectedOrder || numWeight <= 0) {
      return { numberOfLoads: 0, totalLoads: 0, pricePerLoad: 0, basePrice: 0, deliveryFee: 0, extraWashCost: 0, extraDryCost: 0, total: selectedOrder?.finalPrice || 0 }
    }

    if (hasMultiServices) {
      // Multi-service: recalculate subtotals from the stored per-unit prices × actual weight/qty
      let servicesTotal = 0
      order.selectedServices.forEach((line: any) => {
        if (line.unit === "kg") {
          servicesTotal += line.unitPrice * numWeight
        } else {
          servicesTotal += line.subtotal
        }
      })
      const deliveryFee = selectedOrder.isDelivery && branchInfo ? branchInfo.deliveryFee : 0
      const extraWashCost = extraWashLoads * getExtraWashPrice()
      const extraDryCost = extraDryLoads * getExtraDryPrice()
      return { numberOfLoads: 0, totalLoads: 0, pricePerLoad: 0, basePrice: servicesTotal, deliveryFee, extraWashCost, extraDryCost, total: servicesTotal + extraWashCost + extraDryCost + deliveryFee }
    }

    // Legacy single-service path
    const serviceType = selectedOrder.serviceType || "wash_and_dry"
    const baseWashPrice = getPricePerLoad("wash_only")
    const dryPrice = getPricePerLoad("dry_only")
    const pricePerLoad = serviceType === "wash_and_dry" ? baseWashPrice + dryPrice
      : serviceType === "wash_only" ? baseWashPrice
      : serviceType === "dry_only" ? dryPrice
      : getPricePerLoad(serviceType)
    const numberOfLoads = Math.ceil(numWeight / KG_PER_LOAD)
    const totalLoads = numberOfLoads + (selectedOrder.whitesSeparate ? 0 : 0)
    const basePrice = totalLoads * pricePerLoad
    const extraWashCost = extraWashLoads * getExtraWashPrice()
    const extraDryCost = extraDryLoads * getExtraDryPrice()
    const deliveryFee = selectedOrder.isDelivery && branchInfo ? branchInfo.deliveryFee : 0
    return { numberOfLoads, totalLoads, pricePerLoad, basePrice, deliveryFee, extraWashCost, extraDryCost, total: basePrice + extraWashCost + extraDryCost + deliveryFee }
  }

  const pricing = getPricingBreakdown()

  const handleProceedToPayment = async () => {
    if (!selectedOrder || !stationToken) { toast.error("Please select an order"); return }
    if (numWeight <= 0) { toast.error("Please enter the actual weight"); return }
    if (!bagCardNumber) { toast.error("Please select a bag card number"); return }
    const takenNumbers = new Set(activeBagNumbers)
    if (takenNumbers.has(bagCardNumber)) { toast.error(`Bag number ${bagCardNumber} is already in use`); return }

    const orderId = selectedOrder._id
    try {
      if (selectedOrder.status !== "checked_in") {
        await (checkInOrder as any)({
          stationToken,
          orderId,
          actualWeight: numWeight,
          itemCount: laundryBags || 1,
          bagCardNumber,
          notes: notes || undefined,
          extraWashLoads: extraWashLoads > 0 ? extraWashLoads : undefined,
          extraDryLoads: extraDryLoads > 0 ? extraDryLoads : undefined,
        } as Parameters<typeof checkInOrder>[0])
      }
      toast.success("Proceeding to payment.")
      sessionStorage.setItem(`checkin_draft_${orderId}`, JSON.stringify({ weight: numWeight, laundryBags, bagCardNumber, notes }))
      setSelectedOrder(null)
      setMobileView("queue")
      router.push(`/washstation/payment?orderId=${orderId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check in order")
    }
  }

  const getTimeAgo = (timestamp: number) => {
    const diff = new Date().getTime() - timestamp
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    return `${Math.floor(minutes / 60)}h ago`
  }

  const getServiceName = (serviceType: string) => {
    const m: Record<string, string> = { wash_only: "Wash Only", wash_and_dry: "Wash & Dry", wash_and_fold: "Wash & Fold", dry_only: "Dry Only" }
    return m[serviceType] || serviceType.replace(/_/g, " ")
  }

  const takenNumbers = new Set(activeBagNumbers)
  const availableNumbers: string[] = []
  let num = 1
  while (availableNumbers.length < 5) {
    const bagNum = num.toString().padStart(3, "0")
    if (!takenNumbers.has(bagNum)) availableNumbers.push(bagNum)
    num++
    if (num > 999) break
  }

  const filteredOrders = pendingOrders.filter(order => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return order.orderNumber?.toLowerCase().includes(q) || order.customer?.name?.toLowerCase().includes(q) || order.customer?.phoneNumber?.includes(q)
  })

  if (!isSessionValid) return <LoadingSpinner text="Verifying session..." />

  // ── Queue Panel ──────────────────────────────────────────────────────────────
  const QueuePanel = (
    <div className={`${mobileView === "queue" ? "flex" : "hidden"} lg:flex w-full lg:w-72 border-r border-border bg-card flex-col flex-shrink-0 h-full`}>
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="text" placeholder="Search orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 text-sm" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {isLoadingOrders ? (
          <div className="p-8 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50 animate-pulse" />
            <p className="text-sm">Loading orders...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map(o => {
  const oo = o as any
  return (
    <button key={o._id} onClick={() => handleSelectOrder(o)} className={`w-full p-3 sm:p-4 text-left transition-colors ${selectedOrder?._id === o._id ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-muted/50"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-foreground text-sm truncate">{o.customer?.name || "Unknown"}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{getTimeAgo(o.createdAt)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-primary font-medium">#{o.orderNumber}</span>
        <span>·</span>
        {oo.selectedServices?.length > 0 ? (
          <span className="flex items-center gap-1 truncate">
            <Layers className="w-3 h-3 flex-shrink-0" />
            {oo.selectedServices.length} service{oo.selectedServices.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="truncate">{getServiceName(o.serviceType || "wash_and_fold")}</span>
        )}
        {o.isDelivery && <><span>·</span><span className="text-amber-500">Delivery</span></>}
        {oo.scheduledPickupAt && <><span>·</span><span className="text-blue-500">Scheduled</span></>}
        {o.finalPrice < o.totalPrice && <><span>·</span><span className="text-purple-500">🎁</span></>}
      </div>
    </button>
  )
})

        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No pending orders</p>
          </div>
        )}
      </div>
    </div>
  )

  // ── Detail Panel ─────────────────────────────────────────────────────────────
  const DetailPanel = selectedOrder ? (
    <div className={`${mobileView === "detail" ? "flex" : "hidden"} lg:flex flex-1 flex-col overflow-y-auto min-w-0`}>
      <div className="lg:hidden flex items-center gap-2 p-3 border-b border-border bg-card sticky top-0 z-10">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Queue
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-32">

        {/* Customer Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">{selectedOrder.customer?.name || "Unknown"}</h2>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{selectedOrder.customer?.phoneNumber || "N/A"}</span>
              {selectedOrder.customer?.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{selectedOrder.customer.email}</span>}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Order ID</p>
          <p className="font-bold text-foreground">#{selectedOrder.orderNumber}</p>
        </div>

        {/* Customer Order Details */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm text-foreground mb-3">Customer Order Details</h3>
          <div className="space-y-2 text-sm">

            {/* Multi-service breakdown (Jarvis) */}
            {hasMultiServices ? (
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Selected Services</span>
                </div>
                <div className="space-y-1.5">
                  {order.selectedServices.map((line: any) => (
                    <div key={line.serviceId} className="flex justify-between items-center px-2 py-1.5 bg-muted/50 rounded-lg">
                      <span className="font-medium text-foreground">{line.serviceName}</span>
                      <span className="text-muted-foreground text-xs">{line.quantity} {line.unit} × ₵{line.unitPrice.toFixed(2)} = <strong className="text-foreground">₵{line.subtotal.toFixed(2)}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium">{getServiceName(selectedOrder.serviceType || "wash_and_dry")}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. Weight</span>
              <span className="font-medium">{selectedOrder.estimatedWeight?.toFixed(1) || "0.0"} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item Count</span>
              <span className="font-medium">{selectedOrder.itemCount} item{selectedOrder.itemCount !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Type</span>
              <span className="font-medium">{selectedOrder.isDelivery ? "Delivery" : "Pickup"}</span>
            </div>

            {/* Pickup scheduling info (Jarvis) */}
            {order.scheduledPickupAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Scheduled Pickup</span>
                <span className="font-medium">{new Date(order.scheduledPickupAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
            )}
            {order.pickupAddress && (
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground flex items-center gap-1 flex-shrink-0"><MapPin className="w-3.5 h-3.5" /> Pickup Address</span>
                <span className="font-medium text-right max-w-xs">{order.pickupAddress}{order.pickupCity ? `, ${order.pickupCity}` : ""}</span>
              </div>
            )}

            {selectedOrder.isDelivery && selectedOrder.deliveryAddress && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Address</span>
                <span className="font-medium text-right max-w-xs">{selectedOrder.deliveryAddress}</span>
              </div>
            )}
            {selectedOrder.isDelivery && selectedOrder.deliveryHall && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hall/Hostel</span>
                <span className="font-medium">{selectedOrder.deliveryHall}{selectedOrder.deliveryRoom ? ", Rm " + selectedOrder.deliveryRoom : ""}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Quoted Price</span>
              <span className="font-semibold text-primary">GHS {selectedOrder.totalPrice?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Loyalty badge */}
        {selectedOrder.finalPrice < selectedOrder.totalPrice && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <span className="text-lg">🎁</span>
            <div>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">Loyalty Reward Applied</p>
              <p className="text-xs text-muted-foreground">Customer saved GHS {(selectedOrder.totalPrice - selectedOrder.finalPrice).toFixed(2)} — Total due: GHS {selectedOrder.finalPrice.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Weight Intake */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2"><Scale className="w-4 h-4" /> Weight Intake</h3>
            <span className="text-sm text-muted-foreground">Customer Estimate: <strong>{selectedOrder.estimatedWeight?.toFixed(1) || "0.0"} kg</strong></span>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center mb-3">
            <input type="number" step={0.1} min={0} value={weight === "0" ? "" : weight} onChange={e => setWeight(e.target.value)} placeholder="" className="text-5xl font-bold text-foreground text-center bg-transparent border-none outline-none w-full" />
            <p className="text-lg text-muted-foreground mt-1">kg</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeight(String((parseFloat(weight) || 0) + 0.5))} className="flex-1">+0.5 kg Bag Weight</Button>
            <Button variant="outline" size="sm" onClick={() => setWeight("")} className="flex-1">Reset Scale</Button>
          </div>
        </div>

        {/* Customer Instructions */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2 text-sm"><MessageSquare className="w-4 h-4 text-amber-500" />CUSTOMER INSTRUCTIONS</h3>
          <p className="text-sm text-muted-foreground italic">{selectedOrder.notes || selectedOrder.customerNotes || selectedOrder.specialInstructions || "No instructions from customer"}</p>
        </div>

        {/* Extra Loads — only for legacy single-service orders */}
        {!hasMultiServices && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3">Extra Loads</h3>
            <div className="space-y-3">
              {(selectedOrder.serviceType === "wash_and_dry" || selectedOrder.serviceType === "wash_only" || selectedOrder.serviceType === "wash_and_fold") && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Extra Wash</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExtraWashLoads(Math.max(0, extraWashLoads - 1))} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-sm font-bold hover:bg-muted/80">−</button>
                    <span className="text-sm font-bold w-5 text-center">{extraWashLoads}</span>
                    <button onClick={() => setExtraWashLoads(extraWashLoads + 1)} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold hover:bg-primary/90">+</button>
                  </div>
                </div>
              )}
              {(selectedOrder.serviceType === "wash_and_dry" || selectedOrder.serviceType === "dry_only") && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Extra Dry</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExtraDryLoads(Math.max(0, extraDryLoads - 1))} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-sm font-bold hover:bg-muted/80">−</button>
                    <span className="text-sm font-bold w-5 text-center">{extraDryLoads}</span>
                    <button onClick={() => setExtraDryLoads(extraDryLoads + 1)} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold hover:bg-primary/90">+</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bag Card Number */}
        <div>
          <Label className="text-sm font-semibold text-foreground mb-1 block">Bag Card Number <span className="text-destructive">*</span></Label>
          <p className="text-xs text-muted-foreground mb-3">Select the physical card placed inside the laundry bag.</p>
          <div className="grid grid-cols-5 gap-2">
            {availableNumbers.map(card => (
              <button key={card} onClick={() => setBagCardNumber(card)} className={`h-11 rounded-xl font-bold text-sm transition-all ${bagCardNumber === card ? "bg-primary text-primary-foreground ring-2 ring-primary/50" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>#{card}</button>
            ))}
          </div>
          {bagCardNumber && (
            <div className="mt-2 p-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">✓ Card #{bagCardNumber} selected — Give matching card to customer</p>
            </div>
          )}
        </div>

        {/* Service Override — only for legacy orders */}
        {!hasMultiServices && (branchServices as any[]).length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm text-foreground">Service Override <span className="text-xs font-normal text-muted-foreground">(attendant only)</span></h3>
              {overriddenServiceType && overriddenServiceType !== selectedOrder.serviceType && (
                <button onClick={() => setOverriddenServiceType(null)} className="text-xs text-destructive hover:underline">Revert</button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">Original: <strong>{getServiceName(selectedOrder.serviceType)}</strong></p>
            <div className="flex flex-wrap gap-2">
              {(branchServices as any[]).map((svc: any) => {
                const isActive = (overriddenServiceType || selectedOrder.serviceType) === svc.code
                return (
                  <button key={svc._id || svc.code} onClick={() => setOverriddenServiceType(svc.code === selectedOrder.serviceType ? null : svc.code)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                    {svc.name} · ₵{(svc.price ?? svc.basePrice ?? 0).toFixed(2)}
                    {!svc.showOnCustomerSide && <span className="ml-1 opacity-60">(staff)</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-foreground mb-3">Order Summary</h3>
          <div className="space-y-2.5 text-sm">

            {hasMultiServices ? (
              <>
                {numWeight > 0 && order.selectedServices.map((line: any) => (
                  <div key={line.serviceId} className="flex justify-between text-xs text-muted-foreground">
                    <span>{line.serviceName} — {line.unit === "kg" ? `${numWeight} kg × ₵${line.unitPrice.toFixed(2)}` : `${line.quantity} × ₵${line.unitPrice.toFixed(2)}`}</span>
                    <span>GHS {line.unit === "kg" ? (line.unitPrice * numWeight).toFixed(2) : line.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                {!numWeight && <p className="text-xs text-muted-foreground italic">Enter weight above to see breakdown</p>}
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{getServiceName(selectedOrder.serviceType || "wash_and_fold")}</span>
                </div>
                {numWeight > 0 && (
                  <div className="border-t border-border pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pricing.numberOfLoads} load{pricing.numberOfLoads !== 1 ? "s" : ""} × GHS {pricing.pricePerLoad.toFixed(2)}</span>
                      <span>GHS {(pricing.numberOfLoads * pricing.pricePerLoad).toFixed(2)}</span>
                    </div>
                    {extraWashLoads > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>+{extraWashLoads} extra wash × GHS {getExtraWashPrice().toFixed(2)}</span><span>GHS {pricing.extraWashCost.toFixed(2)}</span></div>}
                    {extraDryLoads > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>+{extraDryLoads} extra dry × GHS {getExtraDryPrice().toFixed(2)}</span><span>GHS {pricing.extraDryCost.toFixed(2)}</span></div>}
                  </div>
                )}
                {!numWeight && <p className="text-xs text-muted-foreground italic">Enter weight above to see breakdown</p>}
              </>
            )}

            {selectedOrder.isDelivery && pricing.deliveryFee > 0 && numWeight > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground"><span>Delivery Fee</span><span>GHS {pricing.deliveryFee.toFixed(2)}</span></div>
            )}
            {selectedOrder.finalPrice < selectedOrder.totalPrice && numWeight > 0 && (
              <div className="flex justify-between text-xs text-purple-600 font-medium"><span>🎁 Loyalty/Discount</span><span>-GHS {(selectedOrder.totalPrice - selectedOrder.finalPrice).toFixed(2)}</span></div>
            )}

            {numWeight > 0 && (
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-green-600">GHS {pricing.total.toFixed(2)}</span>
              </div>
            )}

            <button className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 pt-1" onClick={() => router.push('/washstation/orders/' + selectedOrder._id)}>
              View Order History
            </button>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 bg-card border-t border-border p-3 flex items-center justify-between gap-3 z-50">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={handleRejectClick}>
            <Trash2 className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline text-xs">Reject</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleContact} className="text-green-600 border-green-200">
            <Phone className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline text-xs">Call</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleWhatsApp} className="text-green-600 border-green-200">
            <MessageSquare className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline text-xs">WhatsApp</span>
          </Button>
        </div>
        <Button onClick={handleProceedToPayment} disabled={numWeight <= 0 || !bagCardNumber} className="bg-primary text-primary-foreground" size="sm">
          <span className="text-xs sm:text-sm">Proceed to Payment</span>
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    </div>
  ) : (
    <div className={`${mobileView === "detail" ? "flex" : "hidden"} lg:flex flex-1 items-center justify-center text-muted-foreground`}>
      <div className="text-center">
        <Package className="w-14 h-14 mx-auto mb-3 opacity-40" />
        <p className="text-base">Select an order from the queue</p>
        <p className="text-sm opacity-70">to start intake process</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">
      {QueuePanel}
      {DetailPanel}
      <ActionVerification
        open={showRejectVerification}
        onCancel={() => setShowRejectVerification(false)}
        onVerified={handleRejectConfirm}
        actionType="cancel_order"
        orderId={selectedOrder?._id}
      />
    </div>
  )
}