'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { Id } from '@jordan6699/washlab-backend/dataModel'
import { Truck, Phone, MapPin, CheckCircle2, Clock, Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface DeliveryHandoffCardProps {
  orderId: Id<'orders'>
  stationToken: string
  deliveryAddress?: string
  deliveryHall?: string
  deliveryRoom?: string
  customerPhone?: string
  orderStatus?: string
  driverStatus?: string
  assignedDriverId?: string
}

export function DeliveryHandoffCard({
  orderId,
  stationToken,
  deliveryAddress,
  deliveryHall,
  deliveryRoom,
  customerPhone,
  orderStatus,
  driverStatus,
  assignedDriverId,
}: DeliveryHandoffCardProps) {
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(false)

  const markReady = useMutation((api as any).drivers.markReadyForDelivery)

  // Get assigned driver info if exists
  const driver = useQuery(
    (api as any).drivers.getDriverInfo,
    assignedDriverId ? { driverId: assignedDriverId } : 'skip'
  )

  const isAlreadyReady =
    marked ||
    orderStatus === 'ready' ||
    orderStatus === 'ready_for_pickup' ||
    driverStatus === 'pending_pickup' ||
    driverStatus === 'picked_up' ||
    driverStatus === 'delivered'

  const isPickedUp = driverStatus === 'picked_up'
  const isDelivered = driverStatus === 'delivered' || orderStatus === 'delivered'

  const addressLine = deliveryHall
    ? `${deliveryHall}${deliveryRoom ? ', Room ' + deliveryRoom : ''}`
    : deliveryAddress || 'Address on file'

  const handleMarkReady = async () => {
    setMarking(true)
    try {
      await markReady({ orderId, stationToken })
      setMarked(true)
      toast.success('Order marked ready — driver will be notified')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to mark ready')
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto mb-4">
      {/* Header */}
      <div className={`rounded-t-2xl px-5 py-3 flex items-center gap-3 ${
        isDelivered
          ? 'bg-green-500'
          : isPickedUp
          ? 'bg-blue-500'
          : isAlreadyReady
          ? 'bg-amber-500'
          : 'bg-primary'
      }`}>
        <Truck className="w-5 h-5 text-white" />
        <span className="font-semibold text-white text-sm">
          {isDelivered
            ? 'Delivered ✓'
            : isPickedUp
            ? 'Driver Picked Up'
            : isAlreadyReady
            ? 'Waiting for Driver'
            : 'Delivery Order'}
        </span>
        {isAlreadyReady && !isDelivered && (
          <span className="ml-auto flex items-center gap-1 text-white/80 text-xs">
            <Clock className="w-3 h-3" /> Pending pickup
          </span>
        )}
      </div>

      {/* Body */}
      <div className="bg-card border border-border border-t-0 rounded-b-2xl p-5 space-y-4">

        {/* Address */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Delivery to</p>
            <p className="font-semibold text-foreground text-sm">{addressLine}</p>
          </div>
        </div>

        {/* Driver info if assigned */}
        {assignedDriverId && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Assigned Driver</p>
              <p className="font-semibold text-foreground text-sm truncate">
                {(driver as any)?.name || 'Loading...'}
              </p>
            </div>
            {(driver as any)?.phoneNumber && (
              <a
                href={`tel:${(driver as any).phoneNumber}`}
                className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0"
              >
                <Phone className="w-4 h-4 text-white" />
              </a>
            )}
          </div>
        )}

        {/* Status or action */}
        {isDelivered ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Order delivered successfully</p>
          </div>
        ) : isAlreadyReady ? (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              In the delivery queue — driver will collect
            </p>
          </div>
        ) : (
          <Button
            onClick={handleMarkReady}
            disabled={marking}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold"
          >
            {marking ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Marking Ready...</>
            ) : (
              <><Truck className="w-4 h-4 mr-2" /> Mark Ready for Delivery</>
            )}
          </Button>
        )}

        {/* Customer contact */}
        {customerPhone && (
          <a
            href={`tel:${customerPhone}`}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Phone className="w-3 h-3" />
            Contact customer: {customerPhone}
          </a>
        )}
      </div>
    </div>
  )
}