// Customer Profile
export interface CustomerProfile {
  phone: string
  name: string
  hall: string
  room: string
  loyaltyPoints: number
  createdAt: Date
}

// Order Status
export type OrderStatus =
  | "pending_dropoff"
  | "checked_in"
  | "sorting"
  | "washing"
  | "drying"
  | "folding"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  // Legacy statuses for backward compatibility
  | "pending"
  | "in_progress"
  | "ready_for_pickup"
  | "delivered"

// Service Type
export type ServiceType = "wash_and_dry" | "wash_only" | "dry_only"

// Payment Method
export type PaymentMethod = "ussd" | "mobile_money" | "cash"

// Order
export interface Order {
  id: string
  code: string
  branchId: string
  customerPhone: string
  bagCardNumber?: string
  status: OrderStatus
  serviceType: ServiceType
  clothesCount: number
  hasWhites: boolean
  washWhitesSeparately: boolean
  weight?: number
  loads?: number
  totalPrice?: number
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// Order Item Category
export interface OrderItem {
  id: string
  orderId: string
  category: string
  quantity: number
}

// Payment
export interface Payment {
  id: string
  orderId: string
  method: PaymentMethod
  amount: number
  staffId: string
  timestamp: Date
  branchId: string
}

// Branch
export interface Branch {
  id: string
  name: string
  location: string
  pricePerLoad: number
  deliveryFee: number
  isActive: boolean
}

// Staff
export interface Staff {
  id: string
  name: string
  branchId: string
  role: "receptionist" | "admin"
  faceId?: string
  isActive: boolean
}

// Attendance Log
export interface AttendanceLog {
  id: string
  staffId: string
  action: "sign_in" | "sign_out"
  timestamp: Date
  branchId: string
}

// Voucher
export interface Voucher {
  id: string
  code: string
  phone?: string
  branchId?: string
  discountType: "percentage" | "fixed" | "free_wash"
  discountValue: number
  usageLimit: number
  usedCount: number
  validFrom: Date
  validTo: Date
  isActive: boolean
}

// Status stage info - Rapid Wash colors
export const ORDER_STAGES: {
  status: OrderStatus
  label: string
  color: string
}[] = [
  {
    status: "pending_dropoff",
    label: "Pending Drop-off",
    color: "bg-wash-orange",
  },
  { status: "checked_in", label: "Checked In", color: "bg-wash-blue" },
  { status: "sorting", label: "Sorting", color: "bg-purple-500" },
  { status: "washing", label: "Washing", color: "bg-blue-500" },
  { status: "drying", label: "Drying", color: "bg-cyan-500" },
  { status: "folding", label: "Folding", color: "bg-pink-500" },
  { status: "ready", label: "Ready", color: "bg-success" },
  {
    status: "out_for_delivery",
    label: "Out for Delivery",
    color: "bg-amber-500",
  },
  { status: "completed", label: "Completed", color: "bg-muted-foreground" },
]

// Item categories for receipts
export const ITEM_CATEGORIES = [
  "Shirts",
  "T-Shirts",
  "Shorts",
  "Trousers",
  "Jeans",
  "Dresses",
  "Skirts",
  "Underwear",
  "Bras",
  "Socks",
  "Towels",
  "Bedsheets",
  "Jackets",
  "Hoodies",
  "Other",
]

export interface BiometricData {
  captureType: "face" | "hand"
  features: string
  measurements: string
  livenessData: string
  angles: string[]
  captureQuality: number
  deviceInfo?: string
}
