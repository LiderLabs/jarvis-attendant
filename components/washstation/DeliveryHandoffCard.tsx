'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { Id } from '@jordan6699/washlab-backend/dataModel'
import { Phone, CheckCircle2, Clock, Loader2 } from 'lucide-react'
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
}: DeliveryHandoffCardProps) {
  const [marking, setMarking] = useState(false)
  const [marked, setMarked] = useState(false)

  const markReady = useMutation((api as any).drivers.markReadyForDelivery)

  const isAlreadyReady =
    marked ||
    orderStatus === 'ready' ||
    orderStatus === 'ready_for_pickup' ||
    driverStatus === 'pending_pickup' ||
    driverStatus === 'picked_up' ||
    driverStatus === 'delivered'

  const isDelivered = driverStatus === 'delivered' || orderStatus === 'delivered'

  const handleMarkReady = async () => {
    setMarking(true)
    try {
      await markReady({ orderId, stationToken })
      setMarked(true)
      toast.success('Order added to driver queue')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to mark ready')
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto mb-4">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        {isDelivered ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Order delivered successfully</p>
          </div>
        ) : isAlreadyReady ? (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <Clock className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">In the delivery queue — driver will collect</p>
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
              'Hand to Driver'
            )}
          </Button>
        )}

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
