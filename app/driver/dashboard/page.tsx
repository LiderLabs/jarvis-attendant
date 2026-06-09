'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Truck, Package, CheckCircle2, MapPin, Phone,
  LogOut, ChevronDown, ChevronUp, Loader2,
  Navigation, Clock, User, Home, AlertCircle,
  Settings, Lock, Eye, EyeOff, ArrowLeft, ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

function getServiceLabel(code: string) {
  const m: Record<string, string> = {
    wash_only: 'Wash Only',
    wash_and_dry: 'Wash & Dry',
    dry_only: 'Dry Only',
    wash_and_fold: 'Wash & Fold',
  }
  return m[code] || code.replace(/_/g, ' ')
}

function getDeliveryOptionLabel(option?: string) {
  const m: Record<string, string> = {
    dropoff_self: 'Drop-off + Self Pickup',
    dropoff_delivery: 'Drop-off + Delivery',
    pickup_self: 'Pickup + Self Collect',
    full_service: 'Full Service',
  }
  return option ? (m[option] || option) : 'Delivery'
}

function getDeliveryOptionColor(option?: string) {
  if (option === 'pickup_self') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
  if (option === 'full_service') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800'
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
}

function OrderCard({
  order, queue, onPickUp, onCollectFromCustomer, onDeliver, pickingUp, collecting, delivering,
}: {
  order: any
  queue: 'ready' | 'inTransit' | 'delivered'
  onPickUp?: (id: string) => void
  onCollectFromCustomer?: (id: string) => void
  onDeliver?: (id: string, collectCash: boolean) => void
  pickingUp: boolean
  collecting: boolean
  delivering: boolean
}) {
  const [expanded, setExpanded] = useState(queue !== 'delivered')
  const [showCashConfirm, setShowCashConfirm] = useState(false)

  const isPickupSelf = order.deliveryOption === 'pickup_self' || order.deliveryOption === 'full_service'

  const addressLabel = [
    order.deliveryHall,
    order.deliveryRoom ? `Room ${order.deliveryRoom}` : null,
    order.deliveryAddress,
  ].filter(Boolean).join(', ')

  const mapsUrl = addressLabel
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLabel)}`
    : null

  const cfg = queue === 'delivered'
    ? { border: 'border-green-200 dark:border-green-800', headerBg: 'bg-green-50 dark:bg-green-950/30', badge: 'bg-green-100 text-green-700 border-green-200', label: isPickupSelf ? 'At Branch' : 'Delivered' }
    : queue === 'inTransit'
    ? { border: 'border-primary/40', headerBg: 'bg-primary/5', badge: 'bg-primary/10 text-primary border-primary/30', label: isPickupSelf ? 'Collected — En Route to Branch' : 'In Transit' }
    : { border: 'border-border', headerBg: 'bg-muted/30', badge: 'bg-muted text-muted-foreground border-border', label: isPickupSelf ? 'Go Collect from Customer' : 'Ready for Pickup' }

  return (
    <div className={`border ${cfg.border} rounded-2xl overflow-hidden bg-card shadow-sm`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 ${cfg.headerBg} text-left`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm font-mono">#{order.orderNumber}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getDeliveryOptionColor(order.deliveryOption)}`}>
              {isPickupSelf ? '⬆ Collect' : '⬇ Deliver'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {order.customerName || order.customerPhoneNumber} · {getServiceLabel(order.serviceType)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-bold text-sm">₵{(order.finalPrice ?? 0).toFixed(2)}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-3 border-t border-border">
          {/* Delivery type banner */}
          <div className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium ${getDeliveryOptionColor(order.deliveryOption)}`}>
            {isPickupSelf ? <ArrowDown className="w-3.5 h-3.5 flex-shrink-0" /> : <Truck className="w-3.5 h-3.5 flex-shrink-0" />}
            <div>
              <span className="font-semibold">{getDeliveryOptionLabel(order.deliveryOption)}</span>
              {isPickupSelf
                ? <span className="ml-1 opacity-80">— Go to customer, collect laundry, bring to branch</span>
                : <span className="ml-1 opacity-80">— Collect from branch, deliver to customer</span>
              }
            </div>
          </div>

          {/* Customer */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{order.customerName || '—'}</p>
              <p className="text-xs text-muted-foreground">{order.customerPhoneNumber}</p>
            </div>
            {order.customerPhoneNumber && (
              <a href={`tel:${order.customerPhoneNumber}`}
                className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center justify-center text-green-700 hover:bg-green-100 flex-shrink-0">
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Address */}
          {addressLabel ? (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border">
              <Home className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">
                  {isPickupSelf ? 'Collect from' : 'Deliver to'}
                </p>
                <p className="font-medium text-sm">{addressLabel}</p>
              </div>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs font-semibold">
                  <Navigation className="w-3 h-3" />
                  Maps
                </a>
              )}
            </div>
          ) : null}

          {/* Payment */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-sm">
            <span className="text-muted-foreground">Payment</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                order.paymentStatus === 'paid'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {order.paymentStatus === 'paid' ? '✓ Paid' : isPickupSelf ? 'Pay at branch' : 'Collect on delivery'}
              </span>
              <span className="font-bold">₵{(order.finalPrice ?? 0).toFixed(2)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-300 text-xs">{order.notes}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(order.createdAt), 'd MMM yyyy, h:mm a')}
          </p>

          {/* Actions */}
          {queue === 'ready' && (
            (order.deliveryOption === 'pickup_self' || order.deliveryOption === 'full_service') ? (
              // pickup_self / full_service: driver goes to customer to collect
              onCollectFromCustomer && (
                <Button onClick={() => onCollectFromCustomer(order._id)} disabled={collecting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11 rounded-xl font-semibold">
                  {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />}
                  {order.deliveryOption === 'full_service' ? 'Go Collect from Customer' : 'Go Collect from Customer'}
                </Button>
              )
            ) : (
              // dropoff_delivery / dropoff_self: laundry already at branch, pick up and deliver
              onPickUp && (
                <Button onClick={() => onPickUp(order._id)} disabled={pickingUp}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-11 rounded-xl font-semibold">
                  {pickingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  Pick Up from Branch
                </Button>
              )
            )
          )}

          {queue === 'inTransit' && onDeliver && (
            (order.deliveryOption === 'pickup_self' || order.deliveryOption === 'full_service') ? (
              // pickup_self / full_service in transit = collected from customer, heading to branch
              <Button onClick={() => onDeliver(order._id, false)} disabled={delivering}
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-11 rounded-xl font-semibold">
                {delivering ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Arrived at Branch
              </Button>
            ) : (
              !showCashConfirm ? (
                <Button
                  onClick={() => order.paymentStatus !== 'paid' ? setShowCashConfirm(true) : onDeliver(order._id, false)}
                  disabled={delivering}
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-11 rounded-xl font-semibold">
                  {delivering ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark as Delivered
                </Button>
              ) : (
                <div className="space-y-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Did you collect ₵{(order.finalPrice ?? 0).toFixed(2)} cash?
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { onDeliver(order._id, true); setShowCashConfirm(false) }}
                      disabled={delivering} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                      Yes, collected
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { onDeliver(order._id, false); setShowCashConfirm(false) }}
                      disabled={delivering} className="flex-1 rounded-lg">
                      No / Already paid
                    </Button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  )
}

function ProfileTab({ driverToken, driverName, branchName, onBack }: {
  driverToken: string; driverName: string; branchName: string; onBack: () => void
}) {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const changePin = useMutation((api as any).drivers.changeDriverPin)

  const handleChangePin = async () => {
    if (!currentPin || currentPin.length < 4) { toast.error('Enter your current PIN'); return }
    if (!newPin || newPin.length < 4) { toast.error('New PIN must be at least 4 digits'); return }
    if (newPin !== confirmPin) { toast.error('New PINs do not match'); return }
    setSaving(true)
    try {
      await changePin({ driverToken, currentPin, newPin })
      toast.success('PIN changed successfully!')
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to change PIN')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </button>
      <div className="p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-bold text-lg">{driverName}</p>
            <p className="text-sm text-muted-foreground">{branchName || 'Driver'}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/40 border border-border">
          Contact your branch manager to update your name or phone number.
        </p>
      </div>
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Change PIN</h3>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Current PIN</Label>
          <div className="relative">
            <Input type={showCurrent ? 'text' : 'password'} inputMode="numeric"
              value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Enter current PIN" className="pr-10 rounded-xl h-11" />
            <button onClick={() => setShowCurrent(v => !v)} type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">New PIN</Label>
          <div className="relative">
            <Input type={showNew ? 'text' : 'password'} inputMode="numeric"
              value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Min 4 digits" className="pr-10 rounded-xl h-11" />
            <button onClick={() => setShowNew(v => !v)} type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Confirm New PIN</Label>
          <Input type="password" inputMode="numeric"
            value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Repeat new PIN" className="rounded-xl h-11" />
          {newPin && confirmPin && newPin !== confirmPin && (
            <p className="text-xs text-destructive">PINs do not match</p>
          )}
        </div>
        <Button onClick={handleChangePin} disabled={saving || !currentPin || !newPin || !confirmPin || newPin !== confirmPin}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 font-semibold">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Change PIN'}
        </Button>
      </div>
    </div>
  )
}

export default function DriverDashboard() {
  const router = useRouter()
  const [driverToken, setDriverToken] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('')
  const [pickingUpId, setPickingUpId] = useState<string | null>(null)
  const [collectingId, setCollectingId] = useState<string | null>(null)
  const [deliveringId, setDeliveringId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'ready' | 'inTransit' | 'delivered' | 'profile'>('ready')

  useEffect(() => {
    const token = localStorage.getItem('driver_token')
    const name = localStorage.getItem('driver_name') || 'Driver'
    if (!token) { router.push('/driver-login'); return }
    setDriverToken(token)
    setDriverName(name)
  }, [router])

  const orders = useQuery(
    (api as any).drivers.getDeliveryOrders,
    driverToken ? { driverToken } : 'skip'
  )

  const session = useQuery(
    (api as any).drivers.verifyDriverSession,
    driverToken ? { driverToken } : 'skip'
  )

  const markPickedUp = useMutation((api as any).drivers.markPickedUp)
  const markCollectedFromCustomer = useMutation((api as any).drivers.markCollectedFromCustomer)
  const markDelivered = useMutation((api as any).drivers.markDelivered)
  const logoutDriver = useMutation((api as any).drivers.logoutDriver)

  const handlePickUp = async (orderId: string) => {
    if (!driverToken) return
    setPickingUpId(orderId)
    try {
      await markPickedUp({ driverToken, orderId: orderId as any })
      toast.success('Order picked up — en route to customer!')
      setActiveTab('inTransit')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally { setPickingUpId(null) }
  }

  const handleCollectFromCustomer = async (orderId: string) => {
    if (!driverToken) return
    setCollectingId(orderId)
    try {
      await markCollectedFromCustomer({ driverToken, orderId: orderId as any })
      toast.success('Laundry collected — bring to branch!')
      setActiveTab('inTransit')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally { setCollectingId(null) }
  }

  const handleDeliver = async (orderId: string, collectCash: boolean) => {
    if (!driverToken) return
    setDeliveringId(orderId)
    try {
      await markDelivered({ driverToken, orderId: orderId as any, collectedCash: collectCash })
      toast.success('Done!')
      setActiveTab('delivered')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally { setDeliveringId(null) }
  }

  const handleLogout = async () => {
    if (driverToken) { try { await logoutDriver({ driverToken }) } catch {} }
    localStorage.removeItem('driver_token')
    localStorage.removeItem('driver_id')
    localStorage.removeItem('driver_name')
    localStorage.removeItem('driver_branch_id')
    router.push('/driver-login')
  }

  const readyOrders = orders?.readyForPickup ?? []
  const inTransitOrders = orders?.pickedUp ?? []
  const deliveredOrders = orders?.delivered ?? []
  const branchName = (session as any)?.branchName ?? ''

  // Split ready orders: deliveries (go to customer) vs pickups (collect from customer)
  const readyDeliveries = readyOrders.filter((o: any) => o.deliveryOption !== 'pickup_self')
  const readyPickups = readyOrders.filter((o: any) => o.deliveryOption === 'pickup_self')

  const orderTabs = [
    { key: 'ready' as const, label: 'Ready', count: readyOrders.length },
    { key: 'inTransit' as const, label: 'In Transit', count: inTransitOrders.length },
    { key: 'delivered' as const, label: 'Done', count: deliveredOrders.length },
  ]

  const currentOrders =
    activeTab === 'ready' ? readyOrders :
    activeTab === 'inTransit' ? inTransitOrders :
    deliveredOrders

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground sticky top-0 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Image src="/assets/Rapid.png" alt="Rapid Wash" width={36} height={36} className="object-contain" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">{driverName}</p>
              <p className="text-primary-foreground/60 text-xs truncate">{branchName || 'Driver Portal'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setActiveTab('profile')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'profile' ? 'bg-primary-foreground/30' : 'hover:bg-primary-foreground/20'
              }`}>
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={handleLogout}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-primary-foreground/20 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {activeTab === 'profile' ? (
          <ProfileTab
            driverToken={driverToken!}
            driverName={driverName}
            branchName={branchName}
            onBack={() => setActiveTab('ready')}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {orderTabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}>
                  <p className="text-2xl font-bold leading-none mb-1">{tab.count}</p>
                  <p className={`text-xs ${activeTab === tab.key ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {tab.label}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex rounded-2xl border border-border overflow-hidden bg-card">
              {orderTabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                      activeTab === tab.key ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                    }`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {orders === undefined ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeTab === 'ready' && readyOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No jobs right now</p>
              </div>
            ) : activeTab === 'ready' ? (
              <div className="space-y-5 pb-8">
                {readyDeliveries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                      <Truck className="w-3.5 h-3.5" />
                      Deliver to Customer ({readyDeliveries.length})
                    </div>
                    {readyDeliveries.map((order: any) => (
                      <OrderCard key={order._id} order={order} queue="ready"
                        onPickUp={handlePickUp}
                        onCollectFromCustomer={handleCollectFromCustomer}
                        pickingUp={pickingUpId === order._id}
                        collecting={collectingId === order._id}
                        delivering={deliveringId === order._id}
                      />
                    ))}
                  </div>
                )}
                {readyPickups.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                      <ArrowDown className="w-3.5 h-3.5" />
                      Collect from Customer ({readyPickups.length})
                    </div>
                    {readyPickups.map((order: any) => (
                      <OrderCard key={order._id} order={order} queue="ready"
                        onPickUp={handlePickUp}
                        onCollectFromCustomer={handleCollectFromCustomer}
                        pickingUp={pickingUpId === order._id}
                        collecting={collectingId === order._id}
                        delivering={deliveringId === order._id}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : currentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {activeTab === 'inTransit' ? 'No orders in transit' : 'No completed orders today'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {currentOrders.map((order: any) => (
                  <OrderCard key={order._id} order={order} queue={activeTab as any}
                    onPickUp={activeTab === 'inTransit' ? undefined : handlePickUp}
                    onCollectFromCustomer={activeTab === 'inTransit' ? undefined : handleCollectFromCustomer}
                    onDeliver={activeTab === 'inTransit' ? handleDeliver : undefined}
                    pickingUp={pickingUpId === order._id}
                    collecting={collectingId === order._id}
                    delivering={deliveringId === order._id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
