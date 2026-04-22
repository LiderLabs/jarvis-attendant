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
  Phone, User, ArrowRight, ArrowLeft, Check, X, Plus, Minus, Edit,
  Clock, CheckCircle, Layers, Tag, ShoppingCart,
} from "lucide-react"
import { toast } from "sonner"

type Step = "phone" | "customer-found" | "register" | "order"

interface SelectedServiceLine {
  serviceId: string
  serviceName: string
  serviceCode: string
  quantity: number
  unit: string
  unitPrice: number
  subtotal: number
}

function normaliseToLocalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("233")) return ("0" + digits.slice(3)).slice(0, 10)
  return digits.slice(0, 10)
}
function isPhoneComplete(phone: string): boolean {
  return phone.length === 10 && phone.startsWith("0")
}
function phoneToPlaceholderEmail(localPhone: string): string {
  return `${localPhone}@washlab.app`
}
const fixConvexUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  return url.replace("convex-dashboard.washlab.app", "convex-backend.washlab.app")
}

const ServiceImageResolved = ({ imageUrl, code, alt, className }: { imageUrl?: string; code: string; alt: string; className: string }) => {
  const isStorageId = !!imageUrl && !imageUrl.startsWith("http") && !imageUrl.startsWith("/") && !imageUrl.startsWith("convex-storage:")
  const rawStorageUrl = useQuery(api.admin.getServiceImageUrl, isStorageId ? { storageId: imageUrl as any } : "skip")
  const storageUrl = fixConvexUrl(rawStorageUrl ?? null)
  const fallbacks: Record<string, string> = { wash_and_dry: "/assets/laundry-hero-1.jpg", wash_and_fold: "/assets/laundry-hero-1.jpg", wash_only: "/assets/laundry-hero-2.jpg", dry_only: "/assets/stacked-clothes.jpg" }
  const fallback = fallbacks[code] || "/assets/laundry-hero-1.jpg"
  const src = !imageUrl ? fallback : isStorageId ? (storageUrl ?? fallback) : fixConvexUrl(imageUrl) ?? imageUrl
  return <img src={src} alt={alt} className={className} />
}

function pricingLabel(pricingType?: string, unit?: string): string {
  if (pricingType === "per_kg") return "/ kg"
  if (pricingType === "per_item") return `/ ${unit ?? "item"}`
  if (pricingType === "flat") return "flat"
  return "/ load"
}

function deriveServiceType(services: Map<string, SelectedServiceLine>): string {
  const codes = Array.from(services.values()).map(s => s.serviceCode)
  if (codes.length === 0) return "wash_only"
  if (codes.includes("wash_and_dry")) return "wash_and_dry"
  if (codes.includes("wash_only") && codes.includes("dry_only")) return "wash_and_dry"
  if (codes.includes("wash_only")) return "wash_only"
  if (codes.includes("dry_only")) return "dry_only"
  return codes[0]
}

export function NewOrderContent() {
  const router = useRouter()
  const { stationToken, isSessionValid, sessionData } = useStationSession()
  const { attendantId: loggedInAttendantId } = useAttendantSession()

  const branchId = (sessionData as any)?.branchId
  const branchServicesRaw = useQuery((api as any).admin.getBranchServices, branchId ? { branchId } : "skip") ?? []
  const dbServices: any[] = branchServicesRaw

  const coreServices = dbServices.filter((s: any) => !s.category || s.category === "core")
  const addonServices = dbServices.filter((s: any) => s.category === "addon")
  const logisticsServices = dbServices.filter((s: any) => s.category === "logistics")

  const serviceOrder = ['wash_and_dry', 'dry_only', 'wash_only']
  coreServices.sort((a: any, b: any) => {
    const ai = serviceOrder.indexOf(a.code) === -1 ? 99 : serviceOrder.indexOf(a.code)
    const bi = serviceOrder.indexOf(b.code) === -1 ? 99 : serviceOrder.indexOf(b.code)
    return ai - bi
  })

  const formatPhoneForBackend = (phone: string): string => {
    const clean = phone.replace(/\D/g, '')
    const stripped = clean.startsWith("0") ? clean.slice(1) : clean
    return `+233${stripped}`
  }

  const [phone, setPhone] = useState("")
  const hasNavigatedFromPhoneRef = useRef(false)

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, '')
    setPhone(normaliseToLocalDigits(raw))
    hasNavigatedFromPhoneRef.current = false
  }

  const formattedPhone = isPhoneComplete(phone) ? formatPhoneForBackend(phone) : ""
  const getCustomerByPhone = useQuery(api.customers.getByPhone, formattedPhone ? { phoneNumber: formattedPhone } : "skip")
  const createGuestCustomer = useMutation(api.customers.createGuest)
  const createWalkInOrder = useMutation(api.stations.createWalkInOrder)

  const [step, setStep] = useState<Step>("phone")
  const [stepHistory, setStepHistory] = useState<Step[]>([])
  const goToStep = (newStep: Step) => {
    setStepHistory(prev => prev[prev.length - 1] === step ? prev : [...prev, step])
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

  // ── Multi-service state ────────────────────────────────────────────────────
  const [selectedServices, setSelectedServices] = useState<Map<string, SelectedServiceLine>>(new Map())

  const toggleService = (svc: any) => {
    setSelectedServices(prev => {
      const next = new Map(prev)
      if (next.has(svc._id)) {
        next.delete(svc._id)
      } else {
        const pricingType = svc.pricingType ?? "per_load"
        const unit = svc.unit ?? (pricingType === "per_kg" ? "kg" : pricingType === "per_item" ? "item" : "load")
        const qty = pricingType === "per_kg" ? weight : 1
        const price = svc.price ?? svc.basePrice ?? 0
        next.set(svc._id, {
          serviceId: svc._id, serviceName: svc.name, serviceCode: svc.code,
          quantity: qty, unit, unitPrice: price,
          subtotal: Math.round(price * qty * 100) / 100,
        })
      }
      return next
    })
  }

  const updateServiceQty = (serviceId: string, qty: number) => {
    setSelectedServices(prev => {
      const next = new Map(prev)
      const line = next.get(serviceId)
      if (!line) return prev
      const newQty = Math.max(0.5, qty)
      next.set(serviceId, { ...line, quantity: newQty, subtotal: Math.round(line.unitPrice * newQty * 100) / 100 })
      return next
    })
  }

  const [weight, setWeight] = useState(8.0)
  const [itemCount, setItemCount] = useState(0)
  const [orderNotes, setOrderNotes] = useState<string[]>([])
  const [customNote, setCustomNote] = useState("")
  const [bagCardNumber, setBagCardNumber] = useState("")
  const [extraWashLoads, setExtraWashLoads] = useState(0)
  const [extraDryLoads, setExtraDryLoads] = useState(0)

  // Keep per_kg service quantities in sync with weight
  useEffect(() => {
    setSelectedServices(prev => {
      let changed = false
      const next = new Map(prev)
      next.forEach((line, id) => {
        if (line.unit === "kg" && line.quantity !== weight) {
          changed = true
          next.set(id, { ...line, quantity: weight, subtotal: Math.round(line.unitPrice * weight * 100) / 100 })
        }
      })
      return changed ? next : prev
    })
  }, [weight])

  const activeBagNumbers = useQuery(
    api.stations.getActiveBagNumbers,
    stationToken && isSessionValid ? { stationToken } : "skip"
  ) ?? []

  const [orderId] = useState(() => `ORD-${Math.floor(Math.random() * 9000) + 1000}`)

  // Load from sessionStorage
  useEffect(() => {
    const prefilledData = sessionStorage.getItem('washlab_prefilledCustomer')
    if (prefilledData) {
      try {
        const d = JSON.parse(prefilledData)
        if (d.skipPhone && d.id && d.name) {
          setFoundCustomer({ _id: d.id, name: d.name, phoneNumber: d.phone || d.phoneNumber || '', email: d.email })
          const rawPhone = d.phone ?? d.phoneNumber ?? ''
          if (typeof rawPhone === 'string') setPhone(normaliseToLocalDigits(rawPhone))
          setStepHistory(["phone"])
          setStep('order')
          sessionStorage.removeItem('washlab_prefilledCustomer')
          toast.success(`Customer ${d.name} loaded`)
        }
      } catch {}
    } else {
      const activeCustomer = sessionStorage.getItem('washlab_activeCustomer')
      if (activeCustomer) {
        try {
          const d = JSON.parse(activeCustomer)
          setFoundCustomer(d)
          setPhone(normaliseToLocalDigits(d.phoneNumber || d.phone || ''))
        } catch {}
      }
    }
  }, [])

  // Auto-select first core service
  useEffect(() => {
    if (coreServices.length > 0 && selectedServices.size === 0) {
      const first = coreServices[0]
      const pricingType = first.pricingType ?? "per_load"
      const unit = first.unit ?? (pricingType === "per_kg" ? "kg" : "load")
      const qty = pricingType === "per_kg" ? weight : 1
      const price = first.price ?? first.basePrice ?? 0
      setSelectedServices(new Map([[first._id, {
        serviceId: first._id, serviceName: first.name, serviceCode: first.code,
        quantity: qty, unit, unitPrice: price,
        subtotal: Math.round(price * qty * 100) / 100,
      }]]))
    }
  }, [dbServices.length])

  const quickNotes = ["Rush Service", "Stains", "Delicate", "No Softener"]

  useEffect(() => {
    if (step !== "phone") return
    if (!isPhoneComplete(phone)) { hasNavigatedFromPhoneRef.current = false; return }
    if (getCustomerByPhone === undefined) return
    if (hasNavigatedFromPhoneRef.current) return
    hasNavigatedFromPhoneRef.current = true
    if (getCustomerByPhone) { setFoundCustomer(getCustomerByPhone); goToStep("customer-found") }
    else { goToStep("register") }
  }, [step, phone, getCustomerByPhone])

  const handleConfirmCustomer = () => goToStep("order")

  const handleRegisterNewCustomer = async () => {
    if (!newName.trim()) { toast.error("Please enter customer name"); return }
    const placeholderEmail = phoneToPlaceholderEmail(phone)
    const finalEmail = skipEmail ? placeholderEmail : (newEmail.trim() ? newEmail.trim() : placeholderEmail)
    try {
      const customerId = await createGuestCustomer({ name: newName, phoneNumber: formatPhoneForBackend(phone), ...(finalEmail ? { email: finalEmail } : {}) } as any)
      setFoundCustomer(getCustomerByPhone || { _id: customerId, name: newName, phoneNumber: formatPhoneForBackend(phone), email: finalEmail })
      toast.success(`Profile created for ${newName}`)
      goToStep("order")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create customer")
    }
  }

  const handleProceedToPayment = async () => {
    if (!stationToken || !isSessionValid) { toast.error("Station session expired"); return }
    if (selectedServices.size === 0) { toast.error("Please select at least one service"); return }
    if (!foundCustomer?._id) { toast.error("Customer not found"); return }
    if (weight <= 0.1) { toast.error("Please enter a valid weight"); return }
    if (!bagCardNumber) { toast.error("Please select a bag card number"); return }

    const servicesArray = Array.from(selectedServices.values())
    try {
      const result = await (createWalkInOrder as any)({
        stationToken,
        customerId: foundCustomer._id as Id<"users">,
        customerName: foundCustomer.name || newName,
        customerPhone: foundCustomer.phoneNumber || formatPhoneForBackend(phone),
        customerEmail: foundCustomer.email || newEmail || undefined,
        serviceType: deriveServiceType(selectedServices),
        weight,
        itemCount: itemCount || 1,
        bagCardNumber,
        notes: [customNote, ...orderNotes, extraWashLoads > 0 ? extraWashLoads + ' extra wash load(s)' : '', extraDryLoads > 0 ? extraDryLoads + ' extra dry load(s)' : ''].filter(Boolean).join(', ') || undefined,
        isDelivery: false,
        extraWashLoads: extraWashLoads > 0 ? extraWashLoads : undefined,
        extraDryLoads: extraDryLoads > 0 ? extraDryLoads : undefined,
        attendantId: loggedInAttendantId ?? undefined,
        selectedServices: servicesArray,
      })
      toast.success(`Order created! Bag #${result.bagCardNumber}`)
      router.push(`/washstation/payment?orderId=${result.orderId}&return=order`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create order")
    }
  }

  const toggleNote = (note: string) => setOrderNotes(prev => prev.includes(note) ? prev.filter(n => n !== note) : [...prev, note])

  const servicesTotal = Array.from(selectedServices.values()).reduce((sum, s) => sum + s.subtotal, 0)
  const rushFee = orderNotes.includes("Rush Service") ? 5 : 0
  const finalTotal = Math.round((servicesTotal + rushFee) * 100) / 100

  const formatPhoneDisplay = (p: string): string => {
    if (!p) return ""
    if (p.length <= 3) return p
    if (p.length <= 6) return `${p.slice(0, 3)} ${p.slice(3)}`
    return `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`
  }
  const emailResolved = skipEmail || newEmail.trim().length > 0

  const NumberPad = ({ onDigit, onClear, onBackspace }: { onDigit: (d: string) => void; onClear: () => void; onBackspace: () => void }) => (
    <div className='grid grid-cols-3 gap-2 sm:gap-3'>
      {["1","2","3","4","5","6","7","8","9"].map(digit => (
        <button key={digit} onClick={() => onDigit(digit)} className='h-12 sm:h-14 rounded-xl bg-muted text-lg sm:text-xl font-semibold text-foreground hover:bg-muted/80 transition-colors'>{digit}</button>
      ))}
      <button onClick={onClear} className='h-12 sm:h-14 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors'><X className='w-4 h-4 sm:w-5 sm:h-5 mx-auto' /></button>
      <button onClick={() => onDigit("0")} className='h-12 sm:h-14 rounded-xl bg-muted text-lg sm:text-xl font-semibold text-foreground hover:bg-muted/80 transition-colors'>0</button>
      <button onClick={onBackspace} className='h-12 sm:h-14 rounded-xl bg-muted text-lg sm:text-xl font-semibold text-foreground hover:bg-muted/80 transition-colors'>←</button>
    </div>
  )

  const renderServiceGroup = (services: any[], label: string, icon: React.ReactNode) => {
    if (services.length === 0) return null
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3'>
          {services.map((svc: any) => {
            const isSelected = selectedServices.has(svc._id)
            const line = selectedServices.get(svc._id)
            const pricingType = svc.pricingType ?? "per_load"
            const price = svc.price ?? svc.basePrice ?? 0
            return (
              <div key={svc._id} className={`rounded-xl border-2 overflow-hidden transition-all ${isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/30"}`}>
                {(!svc.category || svc.category === "core") && (
                  <div className='aspect-video bg-muted relative overflow-hidden'>
                    <ServiceImageResolved imageUrl={svc.imageUrl} code={svc.code} alt={svc.name} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className='absolute top-2 right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10'>
                        <Check className='w-3 h-3 sm:w-4 sm:h-4' />
                      </div>
                    )}
                  </div>
                )}
                <div className={`p-3 ${isSelected ? "bg-primary/5" : "bg-card"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className='font-semibold text-sm text-foreground truncate'>{svc.name}</p>
                      <p className='text-xs text-muted-foreground mt-0.5'>₵{price.toFixed(2)}<span className="opacity-60"> {pricingLabel(pricingType, svc.unit)}</span></p>
                    </div>
                    <button onClick={() => toggleService(svc)} className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {isSelected && line && line.unit !== "kg" && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground flex-1">Qty</span>
                      <button onClick={() => updateServiceQty(svc._id, line.quantity - 1)} className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-bold hover:bg-muted/80">−</button>
                      <span className="text-xs font-bold w-6 text-center">{line.quantity}</span>
                      <button onClick={() => updateServiceQty(svc._id, line.quantity + 1)} className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">+</button>
                      <span className="text-xs text-muted-foreground ml-1">₵{line.subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {isSelected && line && line.unit === "kg" && (
                    <p className="text-xs text-muted-foreground mt-1.5 border-t border-border pt-1.5">
                      {weight} kg × ₵{price.toFixed(2)} = <strong className="text-foreground">₵{line.subtotal.toFixed(2)}</strong>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Phone ─────────────────────────────────────────────────────────── */}
      {step === "phone" && (
        <div className='max-w-6xl mx-auto'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8'>
            <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8'>
              <h2 className='text-xl sm:text-2xl font-bold text-foreground mb-2'>Customer Phone</h2>
              <p className='text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6'>Enter mobile number to find or create profile</p>
              <div className='relative mb-6'>
                <Input type='tel' inputMode='numeric' value={formatPhoneDisplay(phone)} onChange={handlePhoneInputChange} placeholder='024 XXX XXXX' className='h-12 sm:h-14 text-xl sm:text-2xl font-semibold bg-muted border-0 rounded-xl px-3 sm:px-4 pr-10 text-foreground' autoComplete='off' />
                <Phone className='absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground pointer-events-none' />
              </div>
            </div>
            <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8'>
              <NumberPad
                onDigit={d => { setPhone(prev => { const next = prev + d; return next.length <= 10 ? next : prev }); hasNavigatedFromPhoneRef.current = false }}
                onClear={() => { setPhone(""); hasNavigatedFromPhoneRef.current = false }}
                onBackspace={() => { setPhone(prev => prev.slice(0, -1)); hasNavigatedFromPhoneRef.current = false }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Customer Found ────────────────────────────────────────────────── */}
      {step === "customer-found" && foundCustomer && (
        <div className='max-w-2xl mx-auto'>
          <button onClick={goBack} className='flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 sm:mb-6 text-sm sm:text-base'><ArrowLeft className='w-4 h-4' /> Back</button>
          <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center'>
            <div className='w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-success/10 mx-auto mb-4 flex items-center justify-center'><CheckCircle className='w-6 h-6 sm:w-8 sm:h-8 text-success' /></div>
            <h2 className='text-lg sm:text-xl font-bold text-foreground mb-2'>Customer Match Found</h2>
            <p className='text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6'>Is this the customer you are looking for?</p>
            <div className='w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center'><User className='w-8 h-8 sm:w-10 sm:h-10 text-primary' /></div>
            <h3 className='text-lg sm:text-xl font-bold text-foreground'>{foundCustomer.name}</h3>
            <p className='text-primary flex items-center justify-center gap-1.5 mb-4 text-sm sm:text-base'><Phone className='w-4 h-4' /> {foundCustomer.phoneNumber || foundCustomer.phone}</p>
            <div className='bg-muted/50 rounded-xl p-3 sm:p-4 mb-4'>
              <p className='text-xs text-muted-foreground'>LAST VISIT</p>
              <p className='font-semibold text-foreground text-sm sm:text-base'>
                {foundCustomer.lastVisit || foundCustomer.lastOrderDate ? new Date(foundCustomer.lastVisit || foundCustomer.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No previous visit'}
              </p>
            </div>
            <Button onClick={handleConfirmCustomer} className='w-full h-11 sm:h-12 bg-primary text-primary-foreground rounded-xl font-semibold mb-3'><Check className='w-4 h-4 mr-2' /> Confirm & Start Order</Button>
            <Button onClick={() => { setFoundCustomer(null); goToStep("register") }} variant='outline' className='w-full h-11 sm:h-12 rounded-xl'><User className='w-4 h-4 mr-2' /> No, Register New Customer</Button>
          </div>
        </div>
      )}

      {/* ── Register ─────────────────────────────────────────────────────── */}
      {step === "register" && (
        <div className='max-w-2xl mx-auto'>
          <div className='flex items-center gap-2 text-xs sm:text-sm mb-6 sm:mb-8 flex-wrap'>
            <span className='flex items-center gap-1.5 text-success'><CheckCircle className='w-3 h-3 sm:w-4 sm:h-4' /> Phone Lookup</span>
            <span className='text-muted-foreground'>/</span>
            <span className='flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded font-medium text-xs sm:text-sm'>✦ Registration</span>
            <span className='text-muted-foreground'>/</span>
            <span className='text-muted-foreground'>Order Details</span>
          </div>
          <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8'>
            <h2 className='text-xl sm:text-2xl font-bold text-foreground mb-2'>New Customer</h2>
            <p className='text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6'>Create profile for order processing.</p>
            <div className='mb-4'>
              <label className='text-xs font-medium text-muted-foreground mb-2 block'>MOBILE NUMBER</label>
              <div className='flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted rounded-xl'>
                <Phone className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                <span className='text-foreground font-medium text-sm sm:text-base truncate'>{formatPhoneDisplay(phone)}</span>
                <span className='ml-auto text-muted-foreground flex-shrink-0'>🔒</span>
              </div>
            </div>
            <div className='mb-4'>
              <label className='text-xs font-medium text-muted-foreground mb-2 block'>FULL NAME <span className='text-destructive'>*</span></label>
              <div className='relative'>
                <Input type='text' value={newName} onChange={e => setNewName(e.target.value)} placeholder='e.g. Jane Doe' className='w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-background border-2 border-primary rounded-xl text-foreground text-sm sm:text-base' />
                <Edit className='absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary' />
              </div>
            </div>
            <div className='mb-6 sm:mb-8'>
              <div className='flex items-center justify-between mb-2'>
                <label className='text-xs font-medium text-muted-foreground'>EMAIL ADDRESS <span className='text-destructive'>*</span></label>
                {!emailResolved && <span className='text-xs text-destructive font-medium'>Enter email or tap "No Email"</span>}
              </div>
              <Input type='email' value={skipEmail ? phoneToPlaceholderEmail(phone) : newEmail} onChange={e => { setSkipEmail(false); setNewEmail(e.target.value) }} placeholder='name@example.com' disabled={skipEmail}
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-muted border-2 rounded-xl text-foreground text-sm sm:text-base disabled:opacity-70 transition-colors ${skipEmail ? 'border-primary/40' : newEmail.trim() ? 'border-success/60' : 'border-destructive/40'}`}
              />
              <div className='flex items-center justify-between mt-2'>
                <p className='text-xs text-muted-foreground'>{skipEmail ? `✓ Using: ${phoneToPlaceholderEmail(phone)}` : newEmail.trim() ? '✓ Email entered' : 'No email? Tap the button →'}</p>
                <button type="button" onClick={() => { setSkipEmail(!skipEmail); setNewEmail("") }} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${skipEmail ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                  {skipEmail ? "✓ No Email" : "No Email"}
                </button>
              </div>
            </div>
            <div className='flex flex-col sm:flex-row gap-3'>
              <Button type="button" onClick={goBack} variant='outline' className='flex-1 h-11 sm:h-12 rounded-xl'><ArrowLeft className='w-4 h-4 mr-2' /> Back</Button>
              <Button type="button" onClick={handleRegisterNewCustomer} disabled={!newName.trim() || !emailResolved} className='flex-1 h-11 sm:h-12 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50 disabled:pointer-events-none'>
                Create & Continue <ArrowRight className='w-4 h-4 ml-2' />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order Details ─────────────────────────────────────────────────── */}
      {step === "order" && (
        <div className='max-w-7xl mx-auto'>
          <button onClick={goBack} className='flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm'><ArrowLeft className='w-4 h-4' /> Back</button>

          <div className='flex flex-col lg:flex-row gap-4 sm:gap-6'>
            <div className='flex-1 space-y-4 sm:space-y-6 min-w-0'>

              {/* Header */}
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0'>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2 sm:gap-3 flex-wrap'>
                    <h2 className='text-xl sm:text-2xl font-bold text-foreground truncate'>New Order #{orderId}</h2>
                    <span className='px-2 py-1 bg-warning/10 text-warning text-xs font-medium rounded whitespace-nowrap'>PENDING</span>
                  </div>
                  <p className='text-sm sm:text-base text-muted-foreground mt-1 truncate'>
                    <User className='w-3 h-3 sm:w-4 sm:h-4 inline mr-1' />Customer: {foundCustomer?.name || newName}
                  </p>
                </div>
                <div className='text-left sm:text-right text-xs sm:text-sm text-muted-foreground flex-shrink-0'>
                  <p>Date</p>
                  <p className='font-medium text-foreground'>
                    {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {/* 1. Services */}
              <div>
                <h3 className='font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base'>
                  <span className='w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0'>1</span>
                  Select Services
                  {selectedServices.size > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">{selectedServices.size} selected</span>
                  )}
                </h3>
                {dbServices.length === 0 ? (
                  <div className='text-center py-8 bg-muted/50 rounded-xl border border-border'>
                    <p className='text-sm text-muted-foreground'>No services available. Please contact admin.</p>
                  </div>
                ) : (
                  <>
                    {renderServiceGroup(coreServices, "Core Services", <Layers className="w-3.5 h-3.5 text-emerald-600" />)}
                    {renderServiceGroup(addonServices, "Add-ons", <Tag className="w-3.5 h-3.5 text-amber-600" />)}
                    {renderServiceGroup(logisticsServices, "Pickup & Delivery", <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />)}
                  </>
                )}
                {selectedServices.size > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from(selectedServices.values()).map(line => (
                      <div key={line.serviceId} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        <span>{line.serviceName}</span>
                        <span className="opacity-70">₵{line.subtotal.toFixed(2)}</span>
                        <button onClick={() => setSelectedServices(prev => { const n = new Map(prev); n.delete(line.serviceId); return n })} className="w-3.5 h-3.5 rounded-full hover:bg-primary/20 flex items-center justify-center">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
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
                  <button onClick={() => setWeight(Math.max(0.5, weight - 0.5))} className='w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0'><Minus className='w-5 h-5 sm:w-6 sm:h-6' /></button>
                  <div className='flex-1 text-center min-w-0'>
                    <Input type="number" step={0.1} min={0.5} value={weight === 0 ? "" : weight} onChange={e => setWeight(parseFloat(e.target.value) || 0)} className='text-4xl sm:text-5xl font-bold text-foreground text-center border-0 bg-transparent focus:ring-0' />
                    <p className='text-xs sm:text-sm text-muted-foreground'>KILOGRAMS</p>
                  </div>
                  <button onClick={() => setWeight(weight + 0.5)} className='w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 flex-shrink-0'><Plus className='w-5 h-5 sm:w-6 sm:h-6' /></button>
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
                  <button onClick={() => setItemCount(Math.max(0, itemCount - 1))} className='w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0'><Minus className='w-4 h-4 sm:w-5 sm:h-5' /></button>
                  <div className='flex-1 text-center min-w-0'>
                    <Input type="number" min={0} step={1} value={itemCount === 0 ? "" : itemCount} onChange={e => setItemCount(parseInt(e.target.value) || 0)} className='text-2xl sm:text-3xl font-bold text-foreground text-center border-0 bg-transparent focus:ring-0' />
                    <p className='text-xs text-muted-foreground'>PIECES</p>
                  </div>
                  <button onClick={() => setItemCount(itemCount + 1)} className='w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0'><Plus className='w-4 h-4 sm:w-5 sm:h-5' /></button>
                </div>
                <p className='text-xs text-muted-foreground text-center mt-2'>Use for tracking individual expensive items like comforters or jackets.</p>
              </div>

              {/* 4. Bag Card */}
              <div>
                <h3 className='font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base'>
                  <span className='w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0'>4</span>
                  Bag Card Number <span className='text-destructive'>*</span>
                </h3>
                <p className='text-xs sm:text-sm text-muted-foreground mb-3'>Select the physical card placed inside the laundry bag.</p>
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
                      {available.map(card => (
                        <button key={card} onClick={() => setBagCardNumber(card)} className={`h-10 sm:h-12 rounded-xl font-bold text-base sm:text-lg transition-all ${bagCardNumber === card ? "bg-primary text-primary-foreground ring-2 ring-primary/50" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>#{card}</button>
                      ))}
                    </div>
                  )
                })()}
                {bagCardNumber && (
                  <div className='mt-3 p-3 bg-success/10 border border-success/20 rounded-xl'>
                    <p className='text-xs sm:text-sm text-success font-medium'>✓ Card #{bagCardNumber} selected — Give matching card to customer</p>
                  </div>
                )}
              </div>

              {/* 5. Notes */}
              <div>
                <h3 className='font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base'>
                  <span className='w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center flex-shrink-0'>5</span>
                  Order Notes
                </h3>
                <div className='flex flex-wrap gap-2 mb-3'>
                  {quickNotes.map(note => (
                    <button key={note} onClick={() => toggleNote(note)} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${orderNotes.includes(note) ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {orderNotes.includes(note) && <Check className='w-3 h-3 sm:w-4 sm:h-4 inline mr-1' />}{note}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — Summary */}
            <div className='bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full lg:w-80 lg:flex-shrink-0'>
              <h3 className='font-semibold text-foreground mb-4 text-sm sm:text-base'>Order Summary</h3>

              <div className='space-y-2 pb-4 border-b border-border'>
                {selectedServices.size === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No services selected</p>
                ) : (
                  Array.from(selectedServices.values()).map(line => (
                    <div key={line.serviceId} className='flex justify-between items-start gap-2'>
                      <div className="min-w-0">
                        <span className='text-foreground text-sm truncate block'>{line.serviceName}</span>
                        <span className='text-xs text-muted-foreground'>{line.quantity} {line.unit} × ₵{line.unitPrice.toFixed(2)}</span>
                      </div>
                      <span className='font-semibold text-foreground text-sm flex-shrink-0'>₵{line.subtotal.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              {orderNotes.includes("Rush Service") && (
                <div className='py-3 border-b border-border'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-foreground flex items-center gap-1'>Rush Fee <Clock className='w-3 h-3' /></span>
                    <span className='text-foreground'>₵5.00</span>
                  </div>
                </div>
              )}

              <div className='flex justify-between items-center py-4'>
                <span className='font-medium text-foreground text-sm sm:text-base'>Total</span>
                <span className='text-2xl sm:text-3xl font-bold text-primary'>₵{finalTotal.toFixed(2)}</span>
              </div>

              <Button
                onClick={handleProceedToPayment}
                disabled={selectedServices.size === 0 || weight < 0.1 || !bagCardNumber.trim()}
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