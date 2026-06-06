'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Truck, Package, CheckCircle2, MapPin, Phone,
  LogOut, ChevronDown, ChevronUp, Loader2,
  Navigation, Clock, User, Home, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

function getServiceLabel(code: string) {
  const m: Record<string, string> = {
    wash_only: 'Wash Only',
    wash_and_dry: 'Wash & Dry',
    dry_only: 'Dry Only',
  }
  return m[code] || code.replace(/_/g, ' ')
}

function OrderCard({
  order,
  queue,
  onPickUp,
  onDeliver,
  pickingUp,
  delivering,
}: {
  order: any
  queue: 'ready' | 'pickedUp' | 'delivered'
  onPickUp?: (id: string) => void
  onDeliver?: (id: string, collectCash: boolean) => void
  pickingUp: boolean
  delivering: boolean
}) {
  const [expanded, setExpanded] = useState(queue !== 'delivered')
  const [showCashConfirm, setShowCashConfirm] = useState(false)

  const deliveryLabel = [
    order.deliveryHall,
    order.deliveryRoom ? `Room ${order.deliveryRoom}` : null,
    order.deliveryAddress,
  ].filter(Boolean).join(', ')

  const mapsUrl = deliveryLabel
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryLabel)}`
    : null

  const borderColor =
    queue === 'delivered' ? 'border-green-200' :
    queue === 'pickedUp' ? 'border-orange-300' :
    'border-blue-300'

  const headerBg =
    queue === 'delivered' ? 'bg-green-50 dark:bg-green-950/20' :
    queue === 'pickedUp' ? 'bg-orange-50 dark:bg-orange-950/20' :
    'bg-blue-50 dark:bg-blue-950/20'

  return (
    <div className={`border-2 ${borderColor} rounded-xl overflow-hidden bg-card shadow-sm`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${headerBg} text-left`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">#{order.orderNumber}</span>
            {queue === 'delivered' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                Delivered
              </span>
            )}
            {queue === 'pickedUp' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                In Transit
              </span>
            )}
            {queue === 'ready' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                Ready for Pickup
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {order.customerName || order.customerPhoneNumber} · {getServiceLabel(order.serviceType)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-bold text-sm">₵{(order.finalPrice ?? 0).toFixed(2)}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 py-4 space-y-3 border-t border-border bg-background">

          {/* Customer info */}
          <div className="flex items-start gap-3 text-sm">
            <User className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{order.customerName || '—'}</p>
              <p className="text-muted-foreground">{order.customerPhoneNumber}</p>
            </div>
            {order.customerPhoneNumber && (
              <a
                href={`tel:${order.customerPhoneNumber}`}
                className="ml-auto flex-shrink-0 p-2 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Delivery address */}
          <div className="flex items-start gap-3 text-sm">
            <Home className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Delivery Address</p>
              <p className="text-muted-foreground">{deliveryLabel || 'No address provided'}</p>
            </div>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold"
              >
                <Navigation className="w-3.5 h-3.5" />
                Maps
              </a>
            )}
          </div>

          {/* Payment status */}
          <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-muted/40 border border-border">
            <span className="text-muted-foreground">Payment</span>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                {order.paymentStatus === 'paid' ? '✓ Paid' : '⚠ Collect on delivery'}
              </span>
              <span className="font-bold">₵{(order.finalPrice ?? 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800">{order.notes}</p>
            </div>
          )}

          {/* Time */}
          <p className="text-xs text-muted-foreground">
            <Clock className="w-3 h-3 inline mr-1" />
            {format(new Date(order.createdAt), 'd MMM yyyy, h:mm a')}
          </p>

          {/* Actions */}
          {queue === 'ready' && onPickUp && (
            <Button
              onClick={() => onPickUp(order._id)}
              disabled={pickingUp}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              {pickingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Pick Up Order
            </Button>
          )}

          {queue === 'pickedUp' && onDeliver && (
            <>
              {!showCashConfirm ? (
                <Button
                  onClick={() => {
                    if (order.paymentStatus !== 'paid') {
                      setShowCashConfirm(true)
                    } else {
                      onDeliver(order._id, false)
                    }
                  }}
                  disabled={delivering}
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {delivering ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark as Delivered
                </Button>
              ) : (
                <div className="space-y-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-sm font-semibold text-orange-800">Did you collect ₵{(order.finalPrice ?? 0).toFixed(2)} cash?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => { onDeliver(order._id, true); setShowCashConfirm(false) }}
                      disabled={delivering}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      Yes, collected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { onDeliver(order._id, false); setShowCashConfirm(false) }}
                      disabled={delivering}
                      className="flex-1"
                    >
                      No / Already paid
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function DriverDashboard() {
  const router = useRouter()
  const [driverToken, setDriverToken] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('')
  const [pickingUpId, setPickingUpId] = useState<string | null>(null)
  const [deliveringId, setDeliveringId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'ready' | 'pickedUp' | 'delivered'>('ready')

  useEffect(() => {
    const token = localStorage.getItem('driver_token')
    const name = localStorage.getItem('driver_name') || 'Driver'
    if (!token) { router.push('/driver/login'); return }
    setDriverToken(token)
    setDriverName(name)
  }, [router])

  const orders = useQuery(
    (api as any).drivers.getDeliveryOrders,
    driverToken ? { driverToken } : 'skip'
  )

  const markPickedUp = useMutation((api as any).drivers.markPickedUp)
  const markDelivered = useMutation((api as any).drivers.markDelivered)
  const logoutDriver = useMutation((api as any).drivers.logoutDriver)

  const handlePickUp = async (orderId: string) => {
    if (!driverToken) return
    setPickingUpId(orderId)
    try {
      await markPickedUp({ driverToken, orderId: orderId as any })
      toast.success('Order picked up!')
      setActiveTab('pickedUp')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setPickingUpId(null)
    }
  }

  const handleDeliver = async (orderId: string, collectCash: boolean) => {
    if (!driverToken) return
    setDeliveringId(orderId)
    try {
      await markDelivered({ driverToken, orderId: orderId as any, collectedCash: collectCash })
      toast.success('Delivery confirmed!')
      setActiveTab('delivered')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setDeliveringId(null)
    }
  }

  const handleLogout = async () => {
    if (driverToken) {
      try { await logoutDriver({ driverToken }) } catch {}
    }
    localStorage.removeItem('driver_token')
    localStorage.removeItem('driver_id')
    localStorage.removeItem('driver_name')
    localStorage.removeItem('driver_branch_id')
    router.push('/driver/login')
  }

  const readyOrders = orders?.readyForPickup ?? []
  const pickedUpOrders = orders?.pickedUp ?? []
  const deliveredOrders = orders?.delivered ?? []

  const tabs = [
    { key: 'ready' as const, label: 'Ready', count: readyOrders.length, color: 'blue' },
    { key: 'pickedUp' as const, label: 'In Transit', count: pickedUpOrders.length, color: 'orange' },
    { key: 'delivered' as const, label: 'Delivered', count: deliveredOrders.length, color: 'green' },
  ]

  const currentOrders =
    activeTab === 'ready' ? readyOrders :
    activeTab === 'pickedUp' ? pickedUpOrders :
    deliveredOrders

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-orange-600 text-white px-4 py-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-base leading-tight">{driverName}</p>
              <p className="text-orange-100 text-xs">Driver Portal</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white hover:bg-white/20 gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {tabs.map(tab => (
            <Card key={tab.key} className={`p-4 cursor-pointer transition-all ${activeTab === tab.key ? 'ring-2 ring-orange-500' : ''}`} onClick={() => setActiveTab(tab.key)}>
              <p className="text-2xl font-bold">{tab.count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tab.label}</p>
            </Card>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-orange-600 text-white'
                  : 'bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key ? 'bg-white/20' : 'bg-muted'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {orders === undefined ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No {activeTab === 'ready' ? 'orders ready for pickup' : activeTab === 'pickedUp' ? 'orders in transit' : 'delivered orders today'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentOrders.map((order: any) => (
              <OrderCard
                key={order._id}
                order={order}
                queue={activeTab}
                onPickUp={activeTab === 'ready' ? handlePickUp : undefined}
                onDeliver={activeTab === 'pickedUp' ? handleDeliver : undefined}
                pickingUp={pickingUpId === order._id}
                delivering={deliveringId === order._id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
