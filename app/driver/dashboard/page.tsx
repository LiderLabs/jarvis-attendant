'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { useRouter } from 'next/navigation'
import { MapPin, Phone, Package, CheckCircle2, Loader2, LogOut, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/Logo'
import { toast } from 'sonner'

type Tab = 'active' | 'transit' | 'completed'

function getActiveLabel(deliveryOption: string) {
  if (deliveryOption === 'dropoff_delivery') return 'Collect from Station'
  return 'Pick Up from Customer' // pickup_self, full_service
}

function getTransitLabel(deliveryOption: string) {
  if (deliveryOption === 'dropoff_delivery') return 'Delivered to Customer'
  if (deliveryOption === 'pickup_self') return 'Dropped Off at Station'
  return 'Dropped Off at Station' // full_service leg 1; backend re-queues for leg 2
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
  const [activeTab, setActiveTab] = useState<Tab>('active')
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

  const markPickedUp = useMutation((api as any).drivers.markPickedUp)
  const markDelivered = useMutation((api as any).drivers.markDelivered)
  const logoutMutation = useMutation((api as any).drivers.logoutDriver)

  const handleActive = async (orderId: string) => {
    if (!driverToken) return
    setLoadingOrderId(orderId)
    try {
      await markPickedUp({ orderId: orderId as any, driverToken })
      toast.success('Order moved to In Transit')
      setActiveTab('transit')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update order')
    } finally {
      setLoadingOrderId(null)
    }
  }

  const handleTransit = async (orderId: string) => {
    if (!driverToken) return
    setLoadingOrderId(orderId)
    try {
      await markDelivered({ orderId: orderId as any, driverToken })
      toast.success('Order completed')
      setActiveTab('completed')
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

  const active = (deliveryData?.readyForPickup ?? []) as any[]
  const transit = (deliveryData?.pickedUp ?? []) as any[]
  const completed = (deliveryData?.delivered ?? []) as any[]

  const tabCounts = { active: active.length, transit: transit.length, completed: completed.length }
  const currentOrders = activeTab === 'active' ? active : activeTab === 'transit' ? transit : completed

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'transit', label: 'In Transit' },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-background border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="xs" />
            <div className="w-px h-5 bg-border" />
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

      {/* Tabs */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium relative transition-colors ${
                activeTab === tab.key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {tabCounts[tab.key]}
                  </span>
                )}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-3">
        {deliveryData === undefined && (
          <div className="text-center py-20 text-muted-foreground">
            <Loader2 className="h-7 w-7 mx-auto mb-3 animate-spin opacity-40" />
            <p className="text-sm">Loading orders...</p>
          </div>
        )}

        {deliveryData !== undefined && currentOrders.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p className="font-semibold">Nothing here</p>
            <p className="text-sm mt-1 opacity-70">
              {activeTab === 'active' && 'No orders waiting for pickup'}
              {activeTab === 'transit' && 'No orders currently in transit'}
              {activeTab === 'completed' && 'No completed deliveries yet'}
            </p>
          </div>
        )}

        {currentOrders.map((order: any) => (
          <OrderCard
            key={order._id}
            order={order}
            tab={activeTab}
            actionLabel={
              activeTab === 'active'
                ? getActiveLabel(order.deliveryOption)
                : activeTab === 'transit'
                ? getTransitLabel(order.deliveryOption)
                : null
            }
            serviceLabel={getServiceLabel(order.deliveryOption)}
            onAction={
              activeTab === 'active'
                ? () => handleActive(order._id)
                : activeTab === 'transit'
                ? () => handleTransit(order._id)
                : undefined
            }
            onOpenMaps={() => openMaps(order.deliveryLat, order.deliveryLng, order.deliveryAddress)}
            loading={loadingOrderId === order._id}
          />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order, tab, actionLabel, serviceLabel, onAction, onOpenMaps, loading }: {
  order: any
  tab: Tab
  actionLabel: string | null
  serviceLabel: string
  onAction?: () => void
  onOpenMaps: () => void
  loading: boolean
}) {
  const hasLocation = order.deliveryLat || order.deliveryLng || order.deliveryAddress
  const address = order.deliveryAddress
    || (order.deliveryHall ? `${order.deliveryHall}${order.deliveryRoom ? ', Room ' + order.deliveryRoom : ''}` : null)
  const phone = order.deliveryPhoneNumber || order.customerPhoneNumber

  return (
    <div className={`rounded-2xl border bg-card p-4 space-y-3 shadow-sm ${tab === 'completed' ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">#{order.orderNumber}</p>
          <p className="text-sm text-muted-foreground">{order.customerName || 'Customer'}</p>
        </div>
        <Badge variant={tab === 'completed' ? 'secondary' : 'outline'} className="text-xs shrink-0">
          {serviceLabel}
        </Badge>
      </div>

      {address && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 leading-snug">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
          {address}
        </p>
      )}

      {phone && (
        <a href={'tel:' + phone} className="flex items-center gap-2 text-sm text-primary font-medium">
          <Phone className="h-3.5 w-3.5" />
          {phone}
        </a>
      )}

      {tab !== 'completed' && (
        <div className="flex gap-2 pt-1">
          {hasLocation && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={onOpenMaps}>
              <MapPin className="h-3.5 w-3.5" />
              Maps
            </Button>
          )}
          {actionLabel && onAction && (
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
          )}
        </div>
      )}

      {tab === 'completed' && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          Completed
        </div>
      )}
    </div>
  )
}
