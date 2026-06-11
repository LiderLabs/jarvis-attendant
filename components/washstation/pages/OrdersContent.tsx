'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@jordan6699/washlab-backend/api'
import { useStationSession } from '@/hooks/useStationSession'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/washstation/LoadingSpinner'
import { DeliveryHandoffCard } from '@/components/washstation/DeliveryHandoffCard'
import { Id } from '@jordan6699/washlab-backend/dataModel'
import {
  Search, Package, Truck, User, Phone, Clock,
  ChevronRight, MapPin, CheckCircle2, ArrowLeft, Filter,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = {
  pending_dropoff: 'Pending', pending: 'Pending',
  checked_in: 'Checked In', sorting: 'Sorting',
  washing: 'Washing', drying: 'Drying', folding: 'Folding',
  ready: 'Ready', ready_for_pickup: 'Ready',
  in_progress: 'In Progress', completed: 'Completed',
  delivered: 'Delivered', cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  pending_dropoff: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  checked_in: 'bg-blue-100 text-blue-700 border-blue-200',
  sorting: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  washing: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  drying: 'bg-sky-100 text-sky-700 border-sky-200',
  folding: 'bg-teal-100 text-teal-700 border-teal-200',
  ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ready_for_pickup: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  delivered: 'bg-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

const DRIVER_STATUS_LABELS: Record<string, string> = {
  pending_pickup: '? Awaiting Driver',
  picked_up: '?? In Transit',
  delivered: '? Delivered',
}

export function OrdersContent() {
  const router = useRouter()
  const { stationToken, isSessionValid } = useStationSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  const allOrders = useQuery(
    (api as any).stations.getStationOrders,
    stationToken ? { stationToken, orderType: 'all' as any } : 'skip'
  )

  const orders = allOrders?.results ?? allOrders ?? []
  const isLoading = allOrders === undefined

  const filteredOrders = (orders as any[]).filter((order: any) => {
    const matchesSearch = !searchQuery ||
      order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerPhoneNumber?.includes(searchQuery)
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'delivery' ? order.isDelivery : order.status === statusFilter)
    return matchesSearch && matchesStatus
  }).sort((a: any, b: any) => b.createdAt - a.createdAt)

  const handleSelectOrder = (order: any) => {
    setSelectedOrder(order)
    setMobileView('detail')
  }

  const handleBack = () => {
    setSelectedOrder(null)
    setMobileView('list')
  }

  const getServiceLabel = (code: string) => {
    const m: Record<string, string> = {
      wash_only: 'Wash Only', wash_and_dry: 'Wash & Dry', dry_only: 'Dry Only',
    }
    return m[code] || code?.replace(/_/g, ' ')
  }

  if (!isSessionValid) return <LoadingSpinner text="Verifying session..." />

  // -- List Panel ------------------------------------------------------
  const ListPanel = (
    <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 border-r border-border bg-card flex-col flex-shrink-0 h-full`}>
      {/* Search */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'delivery', label: '?? Delivery' },
            { key: 'ready', label: 'Ready' },
            { key: 'completed', label: 'Done' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                statusFilter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-border hover:border-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50 animate-pulse" />
            <p className="text-sm">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No orders found</p>
          </div>
        ) : filteredOrders.map((order: any) => (
          <button
            key={order._id}
            onClick={() => handleSelectOrder(order)}
            className={`w-full p-3 text-left transition-colors ${
              selectedOrder?._id === order._id
                ? 'bg-primary/10 border-l-4 border-primary'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm truncate">
                {order.customer?.name || order.customerPhoneNumber || 'Unknown'}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-primary font-medium">#{order.orderNumber}</span>
              <span>·</span>
              <span>{getServiceLabel(order.serviceType)}</span>
              {order.isDelivery && (
                <>
                  <span>·</span>
                  <span className={`font-medium ${
                    (order as any).driverStatus === 'delivered' ? 'text-green-600' :
                    (order as any).driverStatus === 'picked_up' ? 'text-orange-500' :
                    'text-amber-500'
                  }`}>
                    {(order as any).driverStatus
                      ? DRIVER_STATUS_LABELS[(order as any).driverStatus]
                      : '?? Delivery'}
                  </span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // -- Detail Panel ----------------------------------------------------
  const DetailPanel = selectedOrder ? (
    <div className={`${mobileView === 'detail' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col overflow-y-auto min-w-0`}>
      {/* Mobile back */}
      <div className="lg:hidden flex items-center gap-2 p-3 border-b border-border bg-card sticky top-0 z-10">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-20">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-bold">#{selectedOrder.orderNumber}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[selectedOrder.status] || 'bg-muted'}`}>
                {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
              </span>
              {selectedOrder.isDelivery && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200 font-medium flex items-center gap-1">
                  <Truck className="w-3 h-3" />
                  {{
                    dropoff_delivery: 'Drop-off + Delivery',
                    pickup_self: 'Pickup + Self Collect',
                    full_service: 'Full Service',
                    dropoff_self: 'Self Service',
                  }[(selectedOrder as any).deliveryOption as string] || 'Delivery'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(selectedOrder.createdAt), 'd MMM yyyy, h:mm a')}
            </p>
          </div>
          <span className="text-xl font-bold text-primary">
            ?{(selectedOrder.finalPrice ?? 0).toFixed(2)}
          </span>
        </div>

        {/* Customer */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-sm">Customer</h3>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>{selectedOrder.customer?.name || 'Unknown'}</span>
          </div>
          {selectedOrder.customer?.phoneNumber && (
            <a href={`tel:${selectedOrder.customer.phoneNumber}`} className="flex items-center gap-2 text-sm text-primary">
              <Phone className="w-4 h-4" />
              {selectedOrder.customer.phoneNumber}
            </a>
          )}
        </div>

        {/* Order details */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-sm">
          <h3 className="font-semibold mb-2">Order Details</h3>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium">{getServiceLabel(selectedOrder.serviceType)}</span>
          </div>
          {selectedOrder.actualWeight && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actual Weight</span>
              <span className="font-medium">{selectedOrder.actualWeight} kg</span>
            </div>
          )}
          {selectedOrder.bagCardNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bag Card</span>
              <span className="font-medium">#{selectedOrder.bagCardNumber}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment</span>
            <span className={`font-medium ${selectedOrder.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
              {selectedOrder.paymentStatus === 'paid' ? '? Paid' : 'Pending'}
            </span>
          </div>
          {selectedOrder.notes && (
            <div className="pt-2 border-t border-border">
              <p className="text-muted-foreground text-xs mb-1">Notes</p>
              <p className="text-sm">{selectedOrder.notes}</p>
            </div>
          )}
        </div>

        {/* Delivery section */}
        {selectedOrder.isDelivery && (
          <>
            {/* Driver status timeline */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Delivery Progress
              </h3>
              <div className="flex items-center gap-2">
                {[
                  { key: 'pending_pickup', label: 'Preparing' },
                  { key: 'picked_up', label: 'In Transit' },
                  { key: 'delivered', label: 'Delivered' },
                ].map((stage, i) => {
                  const driverStatus = selectedOrder.driverStatus
                  const stages = ['pending_pickup', 'picked_up', 'delivered']
                  const currentIdx = stages.indexOf(driverStatus ?? '')
                  const stageIdx = stages.indexOf(stage.key)
                  const isActive = stageIdx <= currentIdx
                  const isCurrent = stageIdx === currentIdx
                  return (
                    <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCurrent ? 'bg-orange-500 text-white scale-110' :
                        isActive ? 'bg-green-500 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {isActive ? '?' : i + 1}
                      </div>
                      <p className={`text-xs text-center ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {stage.label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Delivery handoff card */}
            {stationToken && (
              selectedOrder.status !== 'delivered' &&
              selectedOrder.driverStatus !== 'delivered'
            ) && (
              <DeliveryHandoffCard
                orderId={selectedOrder._id as Id<'orders'>}
                stationToken={stationToken}
                deliveryAddress={selectedOrder.deliveryAddress}
                deliveryHall={selectedOrder.deliveryHall}
                deliveryRoom={selectedOrder.deliveryRoom}
                customerPhone={selectedOrder.customer?.phoneNumber || selectedOrder.customerPhoneNumber}
                orderStatus={selectedOrder.status}
                driverStatus={selectedOrder.driverStatus}
                assignedDriverId={selectedOrder.assignedDriverId}
              />
            )}
          </>
        )}
      </div>
    </div>
  ) : (
    <div className={`${mobileView === 'detail' ? 'flex' : 'hidden'} lg:flex flex-1 items-center justify-center text-muted-foreground`}>
      <div className="text-center">
        <Package className="w-14 h-14 mx-auto mb-3 opacity-40" />
        <p className="text-base">Select an order to view details</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">
      {ListPanel}
      {DetailPanel}
    </div>
  )
}
