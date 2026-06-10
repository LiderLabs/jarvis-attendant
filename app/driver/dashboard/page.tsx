'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { useRouter } from 'next/navigation'
import { MapPin, Phone, Package, CheckCircle2, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/Logo'
import { toast } from 'sonner'

function getActionLabel(deliveryOption: string, stage: 'ready' | 'collected') {
  if (stage === 'ready') {
    if (deliveryOption === 'pickup_self' || deliveryOption === 'full_service') return 'Pick Up from Customer'
    return 'Collect from Station'
  } else {
    if (deliveryOption === 'pickup_self') return 'Drop Off at Station'
    return 'Deliver to Customer'
  }
}

function getServiceLabel(deliveryOption: string) {
  if (deliveryOption === 'dropoff_delivery') return 'Drop-off + Delivery'
  if (deliveryOption === 'pickup_self') return 'Pickup + Self Pick'
  if (deliveryOption === 'full_service') return 'Full Service'
  return 'Delivery'
}

export default function DriverDashboard() {
  const router = useRouter()
  const [driverToken, setDriverToken] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('')
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('driver_token')
    const name = localStorage.getItem('driver_name') || ''
    if (!token) { router.push('/driver-login'); return }
    setDriverToken(token)
    setDriverName(name)
  }, [router])

  const deliveryData = useQuery(
    (api as any).drivers.getDeliveryOrders,
    driverToken ? { driverToken } : 'skip'
  )

  const markDelivered = useMutation((api as any).drivers.markDelivered)
  const markCollected = useMutation((api as any).drivers.markCollectedFromCustomer)
  const logoutMutation = useMutation((api as any).drivers.logoutDriver)

  const handleAction = async (orderId: string, stage: 'ready' | 'collected') => {
    if (!driverToken) return
    setLoadingOrderId(orderId)
    try {
      if (stage === 'ready') await markCollected({ orderId: orderId as any, driverToken })
      else await markDelivered({ orderId: orderId as any, driverToken })
      toast.success('Order updated')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update order')
    } finally {
      setLoadingOrderId(null)
    }
  }

  const handleLogout = async () => {
    if (driverToken) { try { await logoutMutation({ driverToken }) } catch {} }
    localStorage.removeItem('driver_token')
    localStorage.removeItem('driver_id')
    localStorage.removeItem('driver_name')
    localStorage.removeItem('driver_branch_id')
    router.push('/driver-login')
  }

  const openMaps = (lat: any, lng: any, address: any) => {
    if (lat && lng) window.open('https://maps.google.com/?q=' + lat + ',' + lng, '_blank')
    else if (address) window.open('https://maps.google.com/?q=' + encodeURIComponent(address), '_blank')
  }

  if (!driverToken) return null

  const pending = (deliveryData?.readyForPickup ?? []) as any[]
  const collected = (deliveryData?.pickedUp ?? []) as any[]
  const totalCount = pending.length + collected.length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="xs" />
            <div className="w-px h-6 bg-border" />
            <div>
              <p className="font-semibold text-sm leading-tight">Driver Portal</p>
              {driverName && <p className="text-xs text-muted-foreground">{driverName}</p>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground gap-1.5">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-primary/5 border-b px-4 py-2">
        <div className="max-w-lg mx-auto">
          <p className="text-sm font-medium text-primary">
            {totalCount === 0 ? 'No pending deliveries' : `${totalCount} order${totalCount !== 1 ? 's' : ''} to action`}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-5 max-w-lg mx-auto">
        {deliveryData === undefined && (
          <div className="text-center py-20 text-muted-foreground">
            <Loader2 className="h-7 w-7 mx-auto mb-3 animate-spin opacity-40" />
            <p className="text-sm">Loading orders...</p>
          </div>
        )}

        {deliveryData !== undefined && totalCount === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p className="font-semibold">All clear</p>
            <p className="text-sm mt-1 opacity-70">No deliveries right now</p>
          </div>
        )}

        {pending.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Action Required</span>
              <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">{pending.length}</span>
            </div>
            {pending.map((order: any) => (
              <OrderCard
                key={order._id}
                order={order}
                actionLabel={getActionLabel(order.deliveryOption, 'ready')}
                serviceLabel={getServiceLabel(order.deliveryOption)}
                onAction={() => handleAction(order._id, 'ready')}
                onOpenMaps={() => openMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
                loading={loadingOrderId === order._id}
              />
            ))}
          </section>
        )}

        {collected.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">In Progress</span>
              <span className="bg-muted text-muted-foreground text-xs font-bold rounded-full px-2 py-0.5">{collected.length}</span>
            </div>
            {collected.map((order: any) => (
              <OrderCard
                key={order._id}
                order={order}
                actionLabel={getActionLabel(order.deliveryOption, 'collected')}
                serviceLabel={getServiceLabel(order.deliveryOption)}
                onAction={() => handleAction(order._id, 'collected')}
                onOpenMaps={() => openMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
                loading={loadingOrderId === order._id}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function OrderCard({ order, actionLabel, serviceLabel, onAction, onOpenMaps, loading }: {
  order: any
  actionLabel: string
  serviceLabel: string
  onAction: () => void
  onOpenMaps: () => void
  loading: boolean
}) {
  const hasLocation = order.deliveryLat || order.deliveryLng || order.deliveryAddress
  const address = order.deliveryAddress
    || (order.deliveryHall ? `${order.deliveryHall}${order.deliveryRoom ? ', Room ' + order.deliveryRoom : ''}` : null)
  const phone = order.deliveryPhoneNumber || order.customerPhoneNumber

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">#{order.orderNumber}</p>
          <p className="text-sm text-muted-foreground">{order.customerName || 'Customer'}</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">{serviceLabel}</Badge>
      </div>

      {/* Address */}
      {address && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 leading-snug">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
          {address}
        </p>
      )}

      {/* Phone */}
      {phone && (
        <a href={'tel:' + phone} className="flex items-center gap-2 text-sm text-primary font-medium">
          <Phone className="h-3.5 w-3.5" />
          {phone}
        </a>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {hasLocation && (
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={onOpenMaps}>
            <MapPin className="h-3.5 w-3.5" />
            Maps
          </Button>
        )}
        <Button
          size="sm"
          className="flex-1 rounded-xl gap-1.5 font-semibold"
          onClick={onAction}
          disabled={loading}
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <CheckCircle2 className="h-3.5 w-3.5" />}
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}
