'use client';

import { useState } from 'react';
import { useQuery } from "convex/react"
import { api } from "@jordan6699/washlab-backend/api"
import { WashStationLayout } from '@/components/washstation/WashStationLayout';
import { useStationSession } from '@/hooks/useStationSession';
import { useStationOrders, type OrderStatus } from '@/hooks/useStationOrders';
import { OrdersTable } from "@/components/washstation/OrdersTable"
import { LoadingSpinner } from "@/components/washstation/LoadingSpinner"
import { EmptyState } from "@/components/washstation/EmptyState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Filter, RefreshCw } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

const statusOptions: { value: OrderStatus | "all" | "completed"; label: string }[] = [
  { value: "all", label: "Orders" },
  { value: "completed", label: "Completed" },
]

export default function OrdersPage() {
  const { stationToken, isSessionValid, sessionData } = useStationSession()
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "all" | "completed">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  const branchId = sessionData?.branchId
  const branchServicesRaw = useQuery((api as any).admin.getBranchServices, branchId ? { branchId } : 'skip')
  const branchServices = branchServicesRaw ?? []

  const { orders: allOrders, isLoading, loadMore, hasMore } = useStationOrders(stationToken, {
    ...(selectedStatus !== "all" && selectedStatus !== "completed" ? { status: selectedStatus as OrderStatus } : {}),
    search: searchQuery || undefined,
  })

  const filteredOrders = allOrders?.filter((order) => {
    if (order.orderType === "online") {
      const allProcessingStatuses = ["checked_in","sorting","washing","drying","folding","ready","completed","in_progress","ready_for_pickup","delivered"]
      if (!allProcessingStatuses.includes(order.status) && order.status !== "cancelled") return false
    }
    if (selectedStatus === "all") {
      if (["completed","delivered","cancelled"].includes(order.status)) return false
    } else if (selectedStatus === "completed") {
      if (!["completed","delivered"].includes(order.status)) return false
    } else {
      if (order.status !== selectedStatus) return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return order.orderNumber.toLowerCase().includes(query) ||
        order.customer?.name?.toLowerCase().includes(query) ||
        order.customer?.phoneNumber?.includes(query) ||
        (order as any).bagCardNumber?.toLowerCase().includes(query)
    }
    return true
  })

  if (!isSessionValid) {
    return <WashStationLayout title="Orders"><LoadingSpinner text="Verifying session..." /></WashStationLayout>
  }

  return (
    <WashStationLayout title="Orders">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <CardTitle>All Orders</CardTitle>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:flex-initial">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search by order number, customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full md:w-64" />
                </div>
                <Button variant="outline" size="icon" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4" /></Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="flex gap-2 bg-muted rounded-xl p-1">
          {statusOptions.map((option) => (
            <button key={option.value} onClick={() => setSelectedStatus(option.value as OrderStatus | "all" | "completed")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedStatus === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {isLoading ? <LoadingSpinner text="Loading orders..." /> : filteredOrders && filteredOrders.length > 0 ? (
            <>
              <OrdersTable orders={filteredOrders} stationToken={stationToken} branchServices={branchServices} onOrderClick={(orderId) => router.push(`/washstation/orders/${orderId}`)} onCollectPayment={(orderId) => router.push(`/washstation/payment?orderId=${orderId}`)} />

            </>
          ) : (
            <EmptyState icon={Filter} title="No orders found" description={searchQuery ? "Try adjusting your search query" : "Orders will appear here once they are created"} />
          )}
        </div>
      </div>
    </WashStationLayout>
  )
}
