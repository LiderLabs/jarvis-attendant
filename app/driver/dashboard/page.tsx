'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { useRouter } from 'next/navigation'
import { MapPin, Phone, Package, CheckCircle2, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function DriverDashboard() {
  const router = useRouter()
  const [driverToken, setDriverToken] = useState<string | null>(null)
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null)

  useEffect(() => {
    const token = sessionStorage.getItem('driverToken')
    if (!token) {
      router.push('/driver-login')
      return
    }
    setDriverToken(token)
  }, [router])

  // getDeliveryOrders returns { readyForPickup, pickedUp, delivered, all }
  const deliveryData = useQuery(
    (api as any).drivers.getDeliveryOrders,
    driverToken ? { driverToken } : 'skip'
  )

  const markDelivered = useMutation((api as any).drivers.markDelivered)
  const markCollected = useMutation((api as any).drivers.markCollectedFromCustomer)
  const logoutMutation = useMutation((api as any).drivers.logoutDriver)

  const handleMarkDelivered = async (orderId: string) => {
    if (!driverToken) return
    setLoadingOrderId(orderId)
    try {
      await markDelivered({ orderId: orderId as any, driverToken })
      toast.success('Order marked as delivered')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update order')
    } finally {
      setLoadingOrderId(null)
    }
  }

  const handleMarkCollected = async (orderId: string) => {
    if (!driverToken) return
    setLoadingOrderId(orderId)
    try {
      await markCollected({ orderId: orderId as any, driverToken })
      toast.success('Collected from customer')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update order')
    } finally {
      setLoadingOrderId(null)
    }
  }

  const handleLogout = async () => {
    if (driverToken) {
      try { await logoutMutation({ driverToken }) } catch {}
    }
    sessionStorage.removeItem('driverToken')
    router.push('/driver-login')
  }

  const openMaps = (lat: any, lng: any, address: any) => {
    if (lat && lng) {
      window.open('https://maps.google.com/?q=' + lat + ',' + lng, '_blank')
    } else if (address) {
      window.open('https://maps.google.com/?q=' + encodeURIComponent(address), '_blank')
    }
  }

  if (!driverToken) return null

  const pending = (deliveryData?.readyForPickup ?? []) as any[]
  const collected = (deliveryData?.pickedUp ?? []) as any[]
  const totalCount = pending.length + collected.length

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">Deliveries</h1>
          <p className="text-xs text-muted-foreground">{totalCount} order{totalCount !== 1 ? 's' : ''} pending</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" />
          Logout
        </Button>
      </div>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {deliveryData === undefined && (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-40" />
            <p className="text-sm">Loading...</p>
          </div>
        )}

        {deliveryData !== undefined && totalCount === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No deliveries right now</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Ready to Collect</p>
            {pending.map((order: any) => (
              <OrderCard
                key={order._id}
                order={order}
                actionLabel="Collected from Station"
                onAction={() => handleMarkCollected(order._id)}
                onOpenMaps={() => openMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
                loading={loadingOrderId === order._id}
              />
            ))}
          </div>
        )}

        {collected.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Out for Delivery</p>
            {collected.map((order: any) => (
              <OrderCard
                key={order._id}
                order={order}
                actionLabel="Mark Delivered"
                actionVariant="default"
                onAction={() => handleMarkDelivered(order._id)}
                onOpenMaps={() => openMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
                loading={loadingOrderId === order._id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderCard({
  order,
  actionLabel,
  actionVariant = 'outline',
  onAction,
  onOpenMaps,
  loading,
}: {
  order: any
  actionLabel: string
  actionVariant?: 'default' | 'outline'
  onAction: () => void
  onOpenMaps: () => void
  loading: boolean
}) {
  const hasLocation = order.deliveryLat || order.deliveryLng || order.deliveryAddress
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">#{order.orderNumber}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{order.customerName || 'Customer'}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {order.serviceType?.replace(/_/g, ' ') || 'Laundry'}
        </Badge>
      </div>
      {order.customerPhoneNumber && (
        <a href={'tel:' + order.customerPhoneNumber} className="flex items-center gap-2 text-sm text-primary">
          <Phone className="h-3.5 w-3.5" />
          {order.customerPhoneNumber}
        </a>
      )}
      <div className="flex gap-2 pt-1">
        {hasLocation && (
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onOpenMaps}>
            <MapPin className="h-3.5 w-3.5" />
            Open in Maps
          </Button>
        )}
        <Button variant={actionVariant} size="sm" className="flex-1 gap-1.5" onClick={onAction} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {' '}{actionLabel}
        </Button>
      </div>
    </div>
  )
}