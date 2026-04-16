"use client"
import { useState, useCallback } from "react"
import { useStationOrderStatus, type OrderStatus } from "@/hooks/useStationOrderStatus"
import { ActionVerification } from "./ActionVerification"
import { Id } from "@jordan6699/washlab-backend/dataModel"
import { toast } from "sonner"
import { Play, CheckCircle, Loader2, CreditCard, MessageCircle, Truck } from "lucide-react"

interface OrderExpanderProps {
  order: {
    _id: Id<"orders"> | string
    orderNumber: string
    status: OrderStatus
    finalPrice: number
    customer?: { name: string; phoneNumber: string; email?: string } | null
    createdAt: number
  }
  stationToken: string | null
  unpaid?: boolean
  onCollectPayment?: () => void
}

const IN_PROGRESS_STATUSES = ["checked_in", "sorting", "washing", "drying", "folding"]

export function OrderRowExpander({ order, stationToken: tokenProp, unpaid, onCollectPayment }: OrderExpanderProps) {
  const stationToken = tokenProp || (typeof window !== "undefined" ? localStorage.getItem("station_token") : null)
  const [isMoving, setIsMoving] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [localStatus, setLocalStatus] = useState<OrderStatus | null>(null)
  const { changeStatus } = useStationOrderStatus(stationToken)

  const effectiveStatus = (localStatus ?? order.status) as OrderStatus

  const isTerminal = effectiveStatus === "completed" || effectiveStatus === "cancelled" || effectiveStatus === "delivered"
  const isNotStarted = effectiveStatus === "pending_dropoff" || effectiveStatus === "pending" || effectiveStatus === "checked_in" || effectiveStatus === "sorting"
  const isInProgress = IN_PROGRESS_STATUSES.includes(effectiveStatus as any)
  const isReady = effectiveStatus === "ready" || effectiveStatus === "ready_for_pickup"

  const moveToStatus = useCallback(async (status: OrderStatus, attendantId?: Id<"attendants">) => {
    setIsMoving(true)
    setLocalStatus(status)
    try {
      await changeStatus(order._id as Id<"orders">, status, undefined, attendantId)
      // Keep localStatus set so UI reflects change immediately
    } catch (e) {
      setLocalStatus(null) // Only reset on failure
      toast.error("Failed to update status")
    } finally {
      setIsMoving(false)
    }
  }, [order._id, changeStatus])

  const handleStart = async () => {
    setIsMoving(true)
    setLocalStatus("washing" as OrderStatus)
    try {
      await changeStatus(order._id as Id<"orders">, "washing" as OrderStatus)
      toast.success("Order started")
    } catch (e) {
      setLocalStatus(null)
      toast.error("Failed to check in order")
    } finally {
      setIsMoving(false)
    }
  }

  const handleDone = () => {
    setVerifyOpen(true)
  }

  const handleDeliver = async () => {
    setIsMoving(true)
    setLocalStatus("delivered" as OrderStatus)
    try {
      await changeStatus(order._id as Id<"orders">, "delivered" as OrderStatus)
      toast.success("Order marked as delivered")
      // localStatus stays as "delivered" - UI stays greyed out
    } catch (e) {
      setLocalStatus(null)
      toast.error("Failed to mark as delivered")
    } finally {
      setIsMoving(false)
    }
  }

  const sendWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!order.customer?.phoneNumber) return
    const p = order.customer.phoneNumber.startsWith("0")
      ? "233" + order.customer.phoneNumber.slice(1)
      : order.customer.phoneNumber
    const msg = encodeURIComponent(
      "Hi " + order.customer.name + ", your Jarvis order *#" + order.orderNumber + "* is ready for pickup! Please bring your bag card. Thank you! 🧺"
    )
    window.open("https://wa.me/" + p + "?text=" + msg, "_blank")
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap min-w-[120px]">
      {unpaid && onCollectPayment && (
        <button
          onClick={(e) => { e.stopPropagation(); onCollectPayment() }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
        >
          <CreditCard className="w-3 h-3" />
          Pay
        </button>
      )}

      {(isNotStarted || isInProgress || isReady) && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            isNotStarted ? handleStart() : handleDone()
          }}
          disabled={isMoving}
          className={"flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 " + (isNotStarted ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-green-600 text-white hover:bg-green-700")}
        >
          {isMoving ? <Loader2 className="w-3 h-3 animate-spin" /> : isNotStarted ? <Play className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
          {isNotStarted ? "Start" : "Done"}
        </button>
      )}

      {isTerminal && (
        <>
          {effectiveStatus === "delivered" ? (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold opacity-60">
              <Truck className="w-3 h-3" />
              Delivered
            </span>
          ) : effectiveStatus === "cancelled" ? (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold opacity-60">
              <CheckCircle className="w-3 h-3" />
              Cancelled
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold">
                <CheckCircle className="w-3 h-3" />
                Completed
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeliver() }}
                disabled={isMoving}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isMoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                Deliver
              </button>
            </>
          )}
          {order.customer?.phoneNumber && (
            <button
              onClick={sendWhatsApp}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </button>
          )}
        </>
      )}

      {verifyOpen && (
        <ActionVerification
          open={verifyOpen}
          onVerified={(attendantId) => {
            setVerifyOpen(false)
            moveToStatus("completed" as OrderStatus, attendantId)
          }}
          onCancel={() => setVerifyOpen(false)}
          actionType="Mark as Delivered"
          orderId={order._id as Id<"orders">}
        />
      )}
    </div>
  )
}
