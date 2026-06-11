'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStationSession } from "@/hooks/useStationSession"
import { useAttendantSession } from "@/hooks/use-attendant-session"
import { useQuery, useMutation } from "convex/react"
import { api } from "@jordan6699/washlab-backend/api"
import { Id } from "@jordan6699/washlab-backend/dataModel"

import {
  Phone,
  User,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Plus,
  Minus,
  Edit,
  Clock,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

type Step = "phone" | "customer-found" | "register" | "order"

function normaliseToLocalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("233")) return ("0" + digits.slice(3)).slice(0, 10)
  return digits.slice(0, 10)
}

function isPhoneComplete(phone: string): boolean {
  return phone.length === 10 && phone.startsWith("0")
}

/**
 * Canonical rapidwash placeholder email.
 * phone is always the local 10-digit format: "0XXXXXXXXX"
 * Result: "0XXXXXXXXX@washlab.app"  e.g. "0256971012@washlab.app"
 *
 * This MUST stay consistent with the migration script and any
 * other place in the codebase that generates placeholder emails.
 */
function phoneToPlaceholderEmail(localPhone: string): string {
  return `${localPhone}@washlab.app`
}

// --- Self-hosted Convex URL fixer --------------------------------------------
const fixConvexUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  return url.replace("convex-dashboard.washlab.app", "convex-backend.washlab.app")
}

// --- Service Image Resolver ---------------------------------------------------
const ServiceImageResolved = ({
  imageUrl,
  code,
  alt,
  className,
}: {
  imageUrl?: string
  code: string
  alt: string
  className: string
}) => {
  const isStorageId =
    !!imageUrl &&
    !imageUrl.startsWith("http") &&
    !imageUrl.startsWith("/") &&
    !imageUrl.startsWith("convex-storage:")

  const rawStorageUrl = useQuery(
    api.admin.getServiceImageUrl,
    isStorageId ? { storageId: imageUrl as any } : "skip"
  )

  const storageUrl = fixConvexUrl(rawStorageUrl ?? null)

  const fallbacks: Record<string, string> = {
    wash_and_dry:  "/assets/laundry-hero-1.jpg",
    wash_and_fold: "/assets/laundry-hero-1.jpg",
    wash_only:     "/assets/laundry-hero-2.jpg",
    dry_only:      "/assets/stacked-clothes.jpg",
  }
  const fallback = fallbacks[code] || "/assets/laundry-hero-1.jpg"

  const src = !imageUrl
    ? fallback
    : isStorageId
    ? (storageUrl ?? fallback)
    : fixConvexUrl(imageUrl) ?? imageUrl

  return <img src={src} alt={alt} className={className} />
}

export function NewOrderContent() {
  const router = useRouter()
  const { stationToken, isSessionValid, sessionData } = useStationSession()
  const { attendantId: loggedInAttendantId } = useAttendantSession()

  const branchId = (sessionData as any)?.branchId
  const branchServicesRaw = useQuery(
    (api as any).admin.getBranchServices,
    branchId ? { branchId } : "skip"
  ) ?? []
  const branchServices = branchServicesRaw
  const activeMachines = useQuery(
    (api as any).branchMachines.getActiveMachines,
    branchId ? { branchId } : "skip"
  ) ?? []

  const dbServices = branchServices.map((s: any) => ({
    _id: s._id,
    code: s.code,
    name: s.name,
    basePrice: s.price ?? s.pricingPerKg ?? s.basePrice ?? 50,
    extraWashPrice: s.extraWashPrice,
    extraDryPrice: s.extraDryPrice,
    pricingType: s.pricingType ?? "per_load",
    imageUrl: s.imageUrl,
    isActive: s.isActive,
  }))
  const serviceOrder = ['wash_and_dry', 'dry_only', 'wash_only'];
  dbServices.sort((a: any, b: any) => {
    const ai = serviceOrder.indexOf(a.code) === -1 ? 99 : serviceOrder.indexOf(a.code);
    const bi = serviceOrder.indexOf(b.code) === -1 ? 99 : serviceOrder.indexOf(b.code);
    return ai - bi;
  });

  const formatPhoneForBackend = (phone: string): string => {
    const clean = phone.replace(/\D/g, '')
    const stripped = clean.startsWith("0") ? clean.slice(1) : clean
    return `+233${stripped}`
  }

  const [phone, setPhone] = useState("")

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, '')
    const normalised = normaliseToLocalDigits(raw)
    setPhone(normalised)
    hasNavigatedFromPhoneRef.current = false
  }

  const formattedPhone = isPhoneComplete(phone) ? formatPhoneForBackend(phone) : ""
  const getCustomerByPhone = useQuery(
    api.customers.getByPhone,
    formattedPhone ? { phoneNumber: formattedPhone } : "skip"
  )
  const createGuestCustomer = useMutation(api.customers.createGuest)
  const createWalkInOrder = useMutation(api.stations.createWalkInOrder)

  const [step, setStep] = useState<Step>("phone")
  const [stepHistory, setStepHistory] = useState<Step[]>([])

  const goToStep = (newStep: Step) => {
    setStepHistory((prev) => {
      if (prev[prev.length - 1] === step) return prev
      return [...prev, step]
    })
    setStep(newStep)
  }

  const goBack = () => {
    if (stepHistory.length === 0) return
    const history = [...stepHistory]
    const lastStep = history.pop()!
    setStepHistory(history)
    setStep(lastStep)
  }

  const [foundCustomer, setFoundCustomer] = useState<any>(null)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [skipEmail, setSkipEmail] = useState(false)

  const [serviceType, setServiceType] = useState<string>("")
  const [weight, setWeight] = useState(8.0)
  const [itemCount, setItemCount] = useState(0)
  const [orderNotes, setOrderNotes] = useState<string[]>([])
  const [customNote, setCustomNote] = useState("")
  const [bagCardNumber, setBagCardNumber] = useState("")
  const [extraWashLoads, setExtraWashLoads] = useState(0)
  const [extraDryLoads, setExtraDryLoads] = useState(0)
  const [isDelivery, setIsDelivery] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryHall, setDeliveryHall] = useState("")
  const [deliveryRoom, setDeliveryRoom] = useState("")
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)

  const activeBagNumbers =
    useQuery(
      api.stations.getActiveBagNumbers,
      stationToken && isSessionValid ? { stationToken } : "skip"
    ) ?? []
  const branchInfo = useQuery((api as any).stations.getStationInfo, stationToken ? { stationToken } : "skip")
  const deliveryFee = isDelivery ? ((branchInfo as any)?.deliveryFee ?? 0) : 0

  const [orderId] = useState(
    () => `ORD-${Math.floor(Math.random() * 9000) + 1000}`
  )

  const hasNavigatedFromPhoneRef = useRef(false)

  useEffect(() => {
    const prefilledData = sessionStorage.getItem('rapidwash_prefilledCustomer')
    if (prefilledData) {
      try {
        const customerData = JSON.parse(prefilledData)
        if (customerData.skipPhone && customerData.id && customerData.name) {
          setFoundCustomer({
            _id: customerData.id,
            name: customerData.name,
            phoneNumber: customerData.phone || customerData.phoneNumber || '',
            email: customerData.email,
          })
          const rawPhone = customerData.phone ?? customerData.phoneNumber ?? ''
          if (typeof rawPhone === 'string') setPhone(normaliseToLocalDigits(rawPhone))
          setStepHistory(["phone"])
          setStep('order')
          sessionStorage.removeItem('rapidwash_prefilledCustomer')
          toast.success(`Customer ${customerData.name} loaded`)
        }
      } catch (error) {
        console.error('Error parsing prefilled customer data:', error)
      }
    } else {
      const activeCustomer = sessionStorage.getItem('rapidwash_activeCustomer')
      if (activeCustomer) {
        try {
          const customerData = JSON.parse(activeCustomer)
          setFoundCustomer(customerData)
          const rawPhone = customerData.phoneNumber || customerData.phone || ''
          setPhone(normaliseToLocalDigits(rawPhone))
        } catch (error) {
          console.error('Error parsing active customer data:', error)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (dbServices.length > 0 && !serviceType && !selectedMachineId) setServiceType(dbServices[0].code)
  }, [dbServices, serviceType, selectedMachineId])

  const quickNotes = ["Rush Service", "Stains", "Delicate", "No Softener"]

  useEffect(() => {
    if (step !== "phone") return
    if (!isPhoneComplete(phone)) { hasNavigatedFromPhoneRef.current = false; return }
    if (getCustomerByPhone === undefined) return
    if (hasNavigatedFromPhoneRef.current) return
    hasNavigatedFromPhoneRef.current = true
    if (getCustomerByPhone) {
      setFoundCustomer(getCustomerByPhone)
      goToStep("customer-found")
    } else {
      goToStep("register")
    }
  }, [step, phone, getCustomerByPhone])

  const handleConfirmCustomer = () => goToStep("order")

  const handleRegisterNewCustomer = async () => {
    if (!newName.trim()) { toast.error("Please enter customer name"); return }

    const placeholderEmail = phoneToPlaceholderEmail(phone)
    const finalEmail = skipEmail
      ? placeholderEmail
      : (newEmail.trim() ? newEmail.trim() : placeholderEmail)

    try {
      const customerId = await createGuestCustomer({
        name: newName,
        phoneNumber: formatPhoneForBackend(phone),
        ...(finalEmail ? { email: finalEmail } : {}),
         ...(branchId ? { branchId } : {}),
      } as any)
      const customer = await getCustomerByPhone
      setFoundCustomer(customer || {
        _id: customerId,
        name: newName,
        phoneNumber: formatPhoneForBackend(phone),
        email: finalEmail,
      })
      toast.success(`Profile created for ${newName}`)
      goToStep("order")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create customer")
    }
  }

  const handleProceedToPayment = async () => {
    if (!stationToken || !isSessionValid) { toast.error("Station session expired. Please login again."); return }
    if (!serviceType && !selectedMachineId) { toast.error("Please select a service or machine"); return }
    if (dbServices.length === 0) { toast.error("No services available. Please contact admin."); return }
    if (!foundCustomer?._id) { toast.error("Customer not found. Please register customer first."); return }
    if (weight <= 0.1) { toast.error("Please enter a valid weight"); return }
    if (!bagCardNumber) { toast.error("Please select a bag card number"); return }
    try {
      const result = await (createWalkInOrder as any)({
        stationToken,
        customerId: foundCustomer._id as Id<"users">,
        customerName: foundCustomer.name || newName,
        customerPhone: foundCustomer.phoneNumber || formatPhoneForBackend(phone),
        customerEmail: foundCustomer.email || newEmail || undefined,
        serviceType: (serviceType || "wash_only") as "wash_only" | "wash_and_dry" | "dry_only",
        weight: weight,
        itemCount: itemCount || 1,
        bagCardNumber,
        notes: [customNote, ...orderNotes, extraWashLoads > 0 ? extraWashLoads + ' extra wash load(s)' : '', extraDryLoads > 0 ? extraDryLoads + ' extra dry load(s)' : ''].filter(Boolean).join(', ') || undefined,
        extraWashLoads: extraWashLoads > 0 ? extraWashLoads : undefined,
        extraDryLoads: extraDryLoads > 0 ? extraDryLoads : undefined,
        machineId: selectedMachineId ?? undefined,
        attendantId: loggedInAttendantId ?? undefined,
        isDelivery,
        deliveryAddress: isDelivery && deliveryAddress ? deliveryAddress : undefined,
        deliveryHall: isDelivery && deliveryHall ? deliveryHall : undefined,
        deliveryRoom: isDelivery && deliveryRoom ? deliveryRoom : undefined,
      })
      toast.success(`Order created successfully! Bag #${result.bagCardNumber}`)
      router.push(`/washstation/payment?orderId=${result.orderId}&return=order`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create order")
    }
  }

  const handleSaveAsDraft = () => {
    if (!foundCustomer?._id) { toast.error("No customer selected"); return }
    const draft = {
      customerId: foundCustomer._id,
      customerName: foundCustomer.name,
      customerPhone: foundCustomer.phoneNumber,
      customerEmail: foundCustomer.email,
      serviceType,
      weight,
      itemCount,
      bagCardNumber,
      orderNotes,
      extraWashLoads,
      extraDryLoads,
      savedAt: new Date().toISOString(),
    }
    sessionStorage.setItem("rapidwash_order_draft", JSON.stringify(draft))
    toast.success("Draft saved! You can resume it from the dashboard.")
    router.push("/washstation/dashboard")
  }

  const toggleNote = (note: string) => {
    setOrderNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note]
    )
  }

  const selectedService = dbServices.find((s: any) => s.code === serviceType)
  const washService  = dbServices.find((s: any) => s.code === "wash_only")
  const dryService   = dbServices.find((s: any) => s.code === "dry_only")
  const baseWashPrice = washService?.basePrice ?? selectedService?.basePrice ?? 0
  const dryPrice      = dryService?.basePrice  ?? selectedService?.basePrice ?? 0
  const extraWashUnitPrice = selectedService?.extraWashPrice ?? (serviceType === "wash_and_dry" ? dbServices.find((s:any) => s.code === "wash_and_dry") : washService)?.extraWashPrice ?? baseWashPrice
  const extraDryUnitPrice  = selectedService?.extraDryPrice ?? (serviceType === "wash_and_dry" ? dbServices.find((s:any) => s.code === "wash_and_dry") : dryService)?.extraDryPrice ?? dryPrice
  const selectedMachine = (activeMachines as any[]).find((m: any) => m._id === selectedMachineId) ?? null
  const standardCodes = ['wash_and_dry', 'wash_only', 'dry_only'];
  const isStandardService = standardCodes.includes(serviceType);
  const effectiveWashPrice = isStandardService ? baseWashPrice : (selectedService?.basePrice ?? baseWashPrice)
  const effectiveExtraDryPrice = dryPrice

  const calculatePrice = () => {
    if (!selectedService && !selectedMachineId) return { basePrice: 0, subtotal: 0, total: 0, totalPrice: 0 }
    const loads = Math.ceil(weight / 8)
    const basePrice = serviceType === "wash_and_dry"
      ? loads * (effectiveWashPrice + dryPrice)
      : serviceType === "wash_only"
      ? loads * effectiveWashPrice
      : serviceType === "dry_only"
      ? loads * dryPrice
      : loads * (selectedService?.basePrice ?? effectiveWashPrice)
    const extraWashCost = extraWashLoads * extraWashUnitPrice
    const extraDryCost  = extraDryLoads  * extraDryUnitPrice
    const total = Math.round((basePrice + extraWashCost + extraDryCost) * 100) / 100
    return { basePrice: total, subtotal: total, total, totalPrice: total }
  }

  const pricing    = calculatePrice()
  const rushFee    = orderNotes.includes("Rush Service") ? 5 : 0
  const finalTotal = pricing.total + rushFee + deliveryFee

  const services = dbServices.map((s: any) => ({
    id:       s.code,
    name:     s.name,
    price:    "?" + s.basePrice.toFixed(2) + " / load",
    imageUrl: s.imageUrl,
  }))

  const formatPhoneDisplay = (p: string): string => {
    if (!p) return ""
    if (p.length <= 3) return p
    if (p.length <= 6) return `${p.slice(0, 3)} ${p.slice(3)}`
    return `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`
  }

  // Email is considered "resolved" if they've either typed one or clicked No Email
  const emailResolved = skipEmail || newEmail.trim().length > 0

  const NumberPad = ({
    onDigit, onClear, onBackspace,
  }: {
    onDigit: (d: string) => void
    onClear: () => void
    onBackspace: () => void
  }) => (
    <div className='grid grid-cols-3 gap-2 sm:gap-3'>
      {["1","2","3","4","5","6","7","8","9"].map((digit) => (
        <button
          key={digit}
          onClick={() => onDigit(digit)}
          className='h-12 sm:h-14 rounded-xl bg-muted text-lg sm:text-xl font-semibold text-foreground hover:bg-muted/80 transition-colors'
        >
          {digit}
        </button>
      ))}
      <button
        onClick={onClear}
        className='h-12 sm:h-14 rounded-xl bg-destructive/10 text-lg sm:text-xl font-semibold text-destructive hover:bg-destructive/20 transition-colors'
      >
        <X className='w-4 h-4 sm:w-5 sm:h-5 mx-auto' />
      </button>
      <button
        onClick={() => onDigit("0")}
        className='h-12 sm:h-14 rounded-xl bg-muted text-lg sm:text-xl font-semibold text-foreground hover:bg-muted/80 transition-colors'
      >
        0
      </button>
      <button
        onClick={onBackspace}
        className='h-12 sm:h-14 rounded-xl bg-muted text-lg sm:text-xl font-semibold text-foreground hover:bg-muted/80 transition-colors'
      >
        ?
      </button>
    </div>
  )

  return (
    <>
      {/* -- Phone Entry Step ----------------------------------------------- */}
      {step === "phone" && (
        <div className='max-w-6xl mx-auto'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8'>
            <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8'>
              <h2 className='text-xl sm:text-2xl font-bold text-foreground mb-2'>Customer Phone</h2>
              <p className='text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6'>
                Enter mobile number to find or create profile
              </p>
              <div className='relative mb-6'>
                <Input
                  type='tel'
                  inputMode='numeric'
                  value={formatPhoneDisplay(phone)}
                  onChange={handlePhoneInputChange}
                  placeholder='024 XXX XXXX'
                  className='h-12 sm:h-14 text-xl sm:text-2xl font-semibold bg-muted border-0 rounded-xl px-3 sm:px-4 pr-10 text-foreground'
                  autoComplete='off'
                />
                <Phone className='absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground pointer-events-none' />
              </div>
            </div>
            <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8'>
              <NumberPad
                onDigit={(d) => {
                  setPhone((prev) => {
                    const next = prev + d
                    return next.length <= 10 ? next : prev
                  })
                  hasNavigatedFromPhoneRef.current = false
                }}
                onClear={() => { setPhone(""); hasNavigatedFromPhoneRef.current = false }}
                onBackspace={() => { setPhone((prev) => prev.slice(0, -1)); hasNavigatedFromPhoneRef.current = false }}
              />
            </div>
          </div>
        </div>
      )}

      {/* -- Customer Found Step -------------------------------------------- */}
      {step === "customer-found" && foundCustomer && (
        <div className='max-w-2xl mx-auto'>
          <button
            onClick={goBack}
            className='flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 sm:mb-6 text-sm sm:text-base'
          >
            <ArrowLeft className='w-4 h-4' /> Back to Phone Entry
          </button>
          <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center'>
            <div className='w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-success/10 mx-auto mb-4 flex items-center justify-center'>
              <CheckCircle className='w-6 h-6 sm:w-8 sm:h-8 text-success' />
            </div>
            <h2 className='text-lg sm:text-xl font-bold text-foreground mb-2'>Customer Match Found</h2>
            <p className='text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6'>
              Is this the customer you are looking for?
            </p>
            <div className='w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center'>
              <User className='w-8 h-8 sm:w-10 sm:h-10 text-primary' />
            </div>
            <h3 className='text-lg sm:text-xl font-bold text-foreground'>{foundCustomer.name}</h3>
            <p className='text-primary flex items-center justify-center gap-1.5 mb-4 text-sm sm:text-base'>
              <Phone className='w-4 h-4' /> {foundCustomer.phoneNumber || foundCustomer.phone}
            </p>
            <div className='grid grid-cols-1 gap-3 sm:gap-4 mb-4'>
              <div className='bg-muted/50 rounded-xl p-3 sm:p-4'>
                <p className='text-xs text-muted-foreground'>LAST VISIT</p>
                <p className='font-semibold text-foreground text-sm sm:text-base'>
                  {foundCustomer.lastVisit || foundCustomer.lastOrderDate
                    ? new Date(foundCustomer.lastVisit || foundCustomer.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No previous visit'}
                </p>
              </div>
            </div>
            <Button onClick={handleConfirmCustomer} className='w-full h-11 sm:h-12 bg-primary text-primary-foreground rounded-xl font-semibold mb-3'>
              <Check className='w-4 h-4 mr-2' /> Confirm & Start Order
            </Button>
            <Button
              onClick={() => { setFoundCustomer(null); goToStep("register") }}
              variant='outline'
              className='w-full h-11 sm:h-12 rounded-xl'
            >
              <User className='w-4 h-4 mr-2' /> No, Register New Customer
            </Button>
          </div>
        </div>
      )}

      {/* -- Register New Customer Step ------------------------------------- */}
      {step === "register" && (
        <div className='max-w-2xl mx-auto'>
          <div className='flex items-center gap-2 text-xs sm:text-sm mb-6 sm:mb-8 flex-wrap'>
            <span className='flex items-center gap-1.5 text-success'>
              <CheckCircle className='w-3 h-3 sm:w-4 sm:h-4' /> Phone Lookup
            </span>
            <span className='text-muted-foreground'>/</span>
            <span className='flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded font-medium text-xs sm:text-sm'>
              ? Registration
            </span>
            <span className='text-muted-foreground'>/</span>
            <span className='text-muted-foreground'>Order Details</span>
          </div>
          <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8'>
            <h2 className='text-xl sm:text-2xl font-bold text-foreground mb-2'>New Customer</h2>
            <p className='text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6'>
              Create profile for order processing.
            </p>

            {/* Phone */}
            <div className='mb-4'>
              <label className='text-xs font-medium text-muted-foreground mb-2 block'>MOBILE NUMBER</label>
              <div className='flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted rounded-xl'>
                <Phone className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                <span className='text-foreground font-medium text-sm sm:text-base truncate'>
                  {formatPhoneDisplay(phone)}
                </span>
                <span className='ml-auto text-muted-foreground flex-shrink-0'>??</span>
              </div>
            </div>

            {/* Name */}
            <div className='mb-4'>
              <label className='text-xs font-medium text-muted-foreground mb-2 block'>
                FULL NAME <span className='text-destructive'>*</span>
              </label>
              <div className='relative'>
                <Input
                  type='text'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder='e.g. Jane Doe'
                  className='w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border-2 border-primary rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-0 text-sm sm:text-base'
                />
                <Edit className='absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary' />
              </div>
              <p className='text-xs text-muted-foreground mt-1'>Enter the customer&apos;s first and last name.</p>
            </div>

            {/* Email */}
            <div className='mb-6 sm:mb-8'>
              <div className='flex items-center justify-between mb-2'>
                <label className='text-xs font-medium text-muted-foreground'>
                  EMAIL ADDRESS <span className='text-destructive'>*</span>
                </label>
                {!emailResolved && (
                  <span className='text-xs text-destructive font-medium'>
                    Enter email or tap "No Email"
                  </span>
                )}
              </div>
              <Input
                type='email'
                value={skipEmail ? phoneToPlaceholderEmail(phone) : newEmail}
                onChange={(e) => { setSkipEmail(false); setNewEmail(e.target.value); }}
                placeholder='name@example.com'
                disabled={skipEmail}
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-2 rounded-xl text-foreground placeholder:text-muted-foreground text-sm sm:text-base disabled:opacity-70 transition-colors ${
                  skipEmail
                    ? 'border-primary/40'
                    : newEmail.trim()
                    ? 'border-success/60'
                    : 'border-destructive/40'
                }`}
              />
              <div className='flex items-center justify-between mt-2'>
                <p className='text-xs text-muted-foreground'>
                  {skipEmail
                    ? `? Using: ${phoneToPlaceholderEmail(phone)}`
                    : newEmail.trim()
                    ? '? Email entered'
                    : 'No email? Tap the button ?'}
                </p>
                <button
                  type="button"
                  onClick={() => { setSkipEmail(!skipEmail); setNewEmail(""); }}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${
                    skipEmail
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground hover:text-foreground border-border hover:border-muted-foreground"
                  }`}
                >
                  {skipEmail ? "? No Email" : "No Email"}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className='flex flex-col sm:flex-row gap-3'>
              <Button type="button" onClick={goBack} variant='outline' className='flex-1 h-11 sm:h-12 rounded-xl'>
                <ArrowLeft className='w-4 h-4 mr-2' /> Back
              </Button>
              <Button
                type="button"
                onClick={handleRegisterNewCustomer}
                disabled={!newName.trim() || !emailResolved}
                className='flex-1 h-11 sm:h-12 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50 disabled:pointer-events-none'
              >
                Create & Continue <ArrowRight className='w-4 h-4 ml-2' />
              </Button>
            </div>
          </div>
          <div className='flex items-center justify-center gap-2 mt-4 text-xs sm:text-sm text-muted-foreground'>
            <div className='w-2 h-2 rounded-full bg-success' />
            <span>STATUS</span>
            <span className='text-success font-medium'>? ONLINE</span>
          </div>
        </div>
      )}

      {/* -- Order Details Step --------------------------------------------- */}
      {step === "order" && (
        <div className='max-w-7xl mx-auto'>
          <button onClick={goBack} className='flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm'>
            <ArrowLeft className='w-4 h-4' /> Back
          </button>

          <div className='flex flex-col lg:flex-row gap-4 sm:gap-6'>
            <div className='flex-1 space-y-4 sm:space-y-6 min-w-0'>

              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0'>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2 sm:gap-3 flex-wrap'>
                    <h2 className='text-xl sm:text-2xl font-bold text-foreground truncate'>New Order #{orderId}</h2>
                    <span className='px-2 py-1 bg-warning/10 text-warning text-xs font-medium rounded whitespace-nowrap'>PENDING</span>
                  </div>
                  <p className='text-sm sm:text-base text-muted-foreground mt-1 truncate'>
                    <User className='w-3 h-3 sm:w-4 sm:h-4 inline mr-1' />
                    Customer: {foundCustomer?.name || newName}
                  </p>
                </div>
                <div className='text-left sm:text-right text-xs sm:text-sm text-muted-foreground flex-shrink-0'>
                  <p>Date</p>
                  <p className='font-medium text-foreground'>
                    {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {/* 1. Select Service */}
              <div>
                <h3 className='font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base'>
                  <span className='w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0'>1</span>
                  Select Service
                </h3>
                {dbServices.length === 0 ? (
                  <div className='text-center py-8 bg-muted/50 rounded-xl border border-border'>
                    <p className='text-sm text-muted-foreground'>No services available. Please contact admin.</p>
                  </div>
                ) : (
                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4'>
                    {services.map((service: any) => (
                      <button
                        key={service.id}
                        onClick={() => { setServiceType(service.id); }}
                        className={`rounded-xl overflow-hidden border-2 transition-all ${serviceType === service.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/30"}`}
                      >
                        <div className='aspect-video bg-muted relative overflow-hidden'>
                          <ServiceImageResolved
                            imageUrl={service.imageUrl}
                            code={service.id}
                            alt={service.name}
                            className="w-full h-full object-cover"
                          />
                          {serviceType === service.id && (
                            <div className='absolute top-2 right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10'>
                              <Check className='w-3 h-3 sm:w-4 sm:h-4' />
                            </div>
                          )}
                        </div>
                        <div className={`p-3 text-left ${serviceType === service.id ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                          <p className='font-semibold text-sm sm:text-base'>{service.name}</p>
                          <p className={`text-xs sm:text-sm ${serviceType === service.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{service.price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Weight */}
              <div>
                <h3 className='font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base'>
                  <span className='w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0'>2</span>
                  Weight
                </h3>
                <div className='flex items-center gap-3 sm:gap-4'>
                  <button onClick={() => setWeight(Math.max(0.5, weight - 0.5))} className='w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0'>
                    <Minus className='w-5 h-5 sm:w-6 sm:h-6' />
                  </button>
                  <div className='flex-1 text-center min-w-0'>
                    <Input type="number" step={0.1} min={0.5} value={weight === 0 ? "" : weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} className='text-4xl sm:text-5xl font-bold text-foreground text-center border-0 bg-transparent focus:ring-0' />
                    <p className='text-xs sm:text-sm text-muted-foreground'>KILOGRAMS</p>
                  </div>
                  <button onClick={() => setWeight(weight + 0.5)} className='w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 flex-shrink-0'>
                    <Plus className='w-5 h-5 sm:w-6 sm:h-6' />
                  </button>
                </div>
                <div className='flex gap-2 mt-3 sm:mt-4 justify-center flex-wrap'>
                  <button onClick={() => setWeight(weight + 1)} className='px-3 sm:px-4 py-2 bg-muted rounded-lg text-xs sm:text-sm hover:bg-muted/80'>+ 1kg</button>
                  <button onClick={() => setWeight(weight + 5)} className='px-3 sm:px-4 py-2 bg-muted rounded-lg text-xs sm:text-sm hover:bg-muted/80'>+ 5kg</button>
                  <button onClick={() => setWeight(20)} className='px-3 sm:px-4 py-2 bg-muted rounded-lg text-xs sm:text-sm hover:bg-muted/80'>Max</button>
                </div>
              </div>

              {/* 3. Item Count */}
              <div>
                <h3 className='font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base'>
                  <span className='w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center flex-shrink-0'>3</span>
                  Item Count
                </h3>
                <div className='flex items-center gap-3 sm:gap-4'>
                  <button onClick={() => setItemCount(Math.max(0, itemCount - 1))} className='w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0'>
                    <Minus className='w-4 h-4 sm:w-5 sm:h-5' />
                  </button>
                  <div className='flex-1 text-center min-w-0'>
                    <Input type="number" min={0} step={1} value={itemCount === 0 ? "" : itemCount} onChange={(e) => setItemCount(parseInt(e.target.value) || 0)} className='text-2xl sm:text-3xl font-bold text-foreground text-center border-0 bg-transparent focus:ring-0' />
                    <p className='text-xs text-muted-foreground'>PIECES</p>
                  </div>
                  <button onClick={() => setItemCount(itemCount + 1)} className='w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0'>
                    <Plus className='w-4 h-4 sm:w-5 sm:h-5' />
                  </button>
                </div>
                <p className='text-xs text-muted-foreground text-center mt-2'>Use for tracking individual expensive items like comforters or jackets.</p>
              </div>

              {/* 4. Bag Card Number */}
              <div>
                <h3 className='font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base'>
                  <span className='w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0'>4</span>
                  Bag Card Number <span className='text-destructive'>*</span>
                </h3>
                <p className='text-xs sm:text-sm text-muted-foreground mb-3'>Select the physical card placed inside the laundry bag. Customer gets the matching card.</p>
                {(() => {
                  const taken = new Set(activeBagNumbers)
                  const available: string[] = []
                  let n = 1
                  while (available.length < 5) {
                    const bn = n.toString().padStart(3, "0")
                    if (!taken.has(bn)) available.push(bn)
                    n++
                  }
                  return (
                    <div className='grid grid-cols-5 gap-2'>
                      {available.map((card) => (
                        <button
                          key={card}
                          onClick={() => setBagCardNumber(card)}
                          className={`h-10 sm:h-12 rounded-xl font-bold text-base sm:text-lg transition-all ${bagCardNumber === card ? "bg-primary text-primary-foreground ring-2 ring-primary/50" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        >
                          #{card}
                        </button>
                      ))}
                    </div>
                  )
                })()}
                {bagCardNumber && (
                  <div className='mt-3 p-3 bg-success/10 border border-success/20 rounded-xl'>
                    <p className='text-xs sm:text-sm text-success font-medium'>? Card #{bagCardNumber} selected - Give matching card to customer</p>
                  </div>
                )}
              </div>

              {/* 5. Order Notes */}
              <div>
                <h3 className='font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base'>
                  <span className='w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center flex-shrink-0'>5</span>
                  Order Notes
                </h3>
                <div className='flex flex-wrap gap-2 mb-3'>
                  {quickNotes.map((note) => (
                    <button
                      key={note}
                      onClick={() => toggleNote(note)}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${orderNotes.includes(note) ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      {orderNotes.includes(note) && <Check className='w-3 h-3 sm:w-4 sm:h-4 inline mr-1' />}
                      {note}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Order Summary */}
            <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full lg:w-80 lg:flex-shrink-0'>
              <h3 className='font-semibold text-foreground mb-4 text-sm sm:text-base'>Order Summary</h3>

              {(serviceType || selectedMachineId) && (
                <div className='mb-4 p-3 bg-muted/50 rounded-xl border border-border'>
                  <p className='text-xs font-semibold text-muted-foreground mb-2'>EXTRA LOADS</p>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <span className='text-xs text-foreground'>Extra Wash</span>
                        {extraWashLoads > 0 && <span className='text-[10px] text-muted-foreground ml-1'>+?{(extraWashUnitPrice * extraWashLoads).toFixed(2)}</span>}
                      </div>
                      <div className='flex items-center gap-1'>
                        <button onClick={() => setExtraWashLoads(Math.max(0, extraWashLoads - 1))} className='w-5 h-5 rounded bg-muted flex items-center justify-center text-xs font-bold hover:bg-muted/80'>-</button>
                        <span className='text-xs font-bold w-4 text-center'>{extraWashLoads}</span>
                        <button onClick={() => setExtraWashLoads(extraWashLoads + 1)} className='w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold'>+</button>
                      </div>
                    </div>
                    <div className='flex items-center justify-between'>
                      <div>
                        <span className='text-xs text-foreground'>Extra Dry</span>
                        {extraDryLoads > 0 && <span className='text-[10px] text-muted-foreground ml-1'>+?{(extraDryUnitPrice * extraDryLoads).toFixed(2)}</span>}
                      </div>
                      <div className='flex items-center gap-1'>
                        <button onClick={() => setExtraDryLoads(Math.max(0, extraDryLoads - 1))} className='w-5 h-5 rounded bg-muted flex items-center justify-center text-xs font-bold hover:bg-muted/80'>-</button>
                        <span className='text-xs font-bold w-4 text-center'>{extraDryLoads}</span>
                        <button onClick={() => setExtraDryLoads(extraDryLoads + 1)} className='w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold'>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className='space-y-3 pb-4 border-b border-border'>
                <div className='flex justify-between items-start gap-2'>
                  <span className='text-foreground text-sm sm:text-base truncate'>
                    {selectedMachine
                      ? selectedMachine.name
                      : selectedService?.name || services.find((s: any) => s.id === serviceType)?.name || "No service selected"}
                  </span>
                  <span className='font-semibold text-foreground text-sm sm:text-base flex-shrink-0'>?{(pricing?.totalPrice || 0).toFixed(2)}</span>
                </div>
                <div className='text-xs sm:text-sm text-muted-foreground pl-2'>
                  {selectedMachine ? (
                    <>{Math.ceil(weight / 8)} load{Math.ceil(weight / 8) !== 1 ? "s" : ""} × ?{selectedMachine.washPrice} wash
                      {extraWashLoads > 0 && <span className='block text-primary'>+{extraWashLoads} extra wash × ?{extraWashUnitPrice.toFixed(2)}</span>}
                      {extraDryLoads > 0 && <span className='block text-primary'>+{extraDryLoads} extra dry × ?{extraDryUnitPrice.toFixed(2)}</span>}
                    </>
                  ) : selectedService ? (
                    <>{Math.ceil(weight / 8)} load{Math.ceil(weight / 8) !== 1 ? "s" : ""} × ?{selectedService.basePrice.toFixed(2)}
                      {extraWashLoads > 0 && <span className='block text-primary'>+{extraWashLoads} extra wash × ?{effectiveWashPrice.toFixed(2)}</span>}
                      {extraDryLoads > 0 && <span className='block text-primary'>+{extraDryLoads} extra dry × ?{extraDryUnitPrice.toFixed(2)}</span>}
                    </>
                  ) : null}
                </div>
                {isDelivery && deliveryFee > 0 && (
                  <div className='flex justify-between'>
                    <span className='text-foreground flex items-center gap-1 text-sm sm:text-base'>?? Delivery Fee</span>
                    <span className='text-foreground text-sm sm:text-base'>?{deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                {orderNotes.includes("Rush Service") && (
                  <div className='flex justify-between'>
                    <span className='text-foreground flex items-center gap-1 text-sm sm:text-base'>Rush Fee <Clock className='w-3 h-3 sm:w-4 sm:h-4' /></span>
                    <span className='text-foreground text-sm sm:text-base'>?{rushFee.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {rushFee > 0 && (
                <div className='py-4 border-b border-border'>
                  <div className='flex justify-between text-xs sm:text-sm'>
                    <span className='text-muted-foreground'>Service Subtotal</span>
                    <span className='text-foreground'>?{(pricing?.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className='flex justify-between text-xs sm:text-sm mt-1'>
                    <span className='text-muted-foreground'>Rush Fee</span>
                    <span className='text-foreground'>?{rushFee.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className='flex justify-between items-center py-4'>
                <span className='font-medium text-foreground text-sm sm:text-base'>Total</span>
                <span className='text-2xl sm:text-3xl font-bold text-primary'>?{finalTotal.toFixed(2)}</span>
              </div>
              <Button
                onClick={handleProceedToPayment}
                disabled={weight < 0.1 || !bagCardNumber.trim() || (isDelivery && !deliveryHall && !deliveryAddress)}
                className='w-full h-11 sm:h-12 bg-primary text-primary-foreground rounded-xl font-semibold mb-3 text-sm sm:text-base disabled:opacity-50 disabled:pointer-events-none'
              >
                Proceed to Payment <ArrowRight className='w-4 h-4 ml-2' />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}




