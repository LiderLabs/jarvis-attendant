'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@jordan6699/washlab-backend/api';
import { useStationSession } from '@/hooks/useStationSession';
import { ActionVerification } from '@/components/washstation/ActionVerification';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Lock, CheckCircle2, Loader2, Plus, X, Save, Wrench, Tag, ChevronRight, Clock } from 'lucide-react';

function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmt(n: number) { return `GHS ${n.toFixed(2)}`; }

interface FaultEntry {
  machineId: string
  machineName: string
  displayName: string       // friendly name — what attendant saw
  serialNumber?: string
  otherDetails?: string
  faultTypes: string[]
  description: string
}

function serializeFaults(faults: FaultEntry[]): string {
  return JSON.stringify(faults)
}

function deserializeFaults(raw: string | null | undefined): FaultEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      // Backfill displayName for older records that were saved without it
      return parsed.map((f: any) => ({
        ...f,
        displayName: f.displayName ?? f.machineName ?? f.machineId ?? '',
      }))
    }
  } catch {
    const lines = raw.split('\n').filter(Boolean)
    return lines.map((l: string) => {
      const match = l.match(/^\[(.+?)\]\s*(.*)$/)
      return match
        ? { machineId: match[1], machineName: match[1], displayName: match[1], faultTypes: [], description: match[2] }
        : { machineId: '', machineName: '', displayName: '', faultTypes: [], description: l }
    })
  }
  return []
}

function DailyReportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams?.get('date');
  const { stationToken, sessionData, isSessionValid } = useStationSession() as any;
  const branchId = sessionData?.branchId;
  const activeMachines = useQuery(
    (api as any).branchMachines.getActiveMachines,
    branchId ? { branchId } : "skip"
  ) ?? [];
  const reportFault = useMutation((api as any).maintenanceTickets.reportFault);
  const branchName = sessionData?.branchName;

  const autoData = useQuery(
    (api as any).dailyReports.getAutoData,
    branchId ? { branchId, date: dateParam || today(), stationToken: stationToken || undefined } : 'skip'
  );

  useEffect(() => {
    if (!autoData) return;
    setWasherTokens(autoData.washerTokensUsed ?? 0);
    setSoapUnits(autoData.washerTokensUsed ?? 0);
    setDryerTokens(autoData.dryerTokensUsed ?? 0);
    setCashAmount(autoData.cashAmount ?? 0);
    setMobileMoneyAmount(autoData.mobileMoneylAmount ?? 0);
    setCardAmount(autoData.cardAmount ?? 0);
    setPaystackAmount(autoData.paystackAmount ?? 0);
  }, [autoData]);

  const existingDraft = useQuery(
    (api as any).dailyReports.getDraft,
    branchId ? { branchId, date: dateParam || today() } : 'skip'
  );
  const pastReports = useQuery(
    (api as any).dailyReports.getByBranch,
    branchId ? { branchId, limit: 14, stationToken: stationToken || undefined } : 'skip'
  );
  const activeAttendances = useQuery(
    api.stations.getActiveStationAttendances,
    stationToken ? { stationToken } : 'skip'
  ) as Array<{ _id: any; attendant: { _id: any; name: string } | null }> | undefined;

  const saveDraftMutation = useMutation((api as any).dailyReports.saveDraft);
  const submitMutation = useMutation((api as any).dailyReports.submit);

  const [washerTokens, setWasherTokens] = useState(0);
  const [dryerTokens, setDryerTokens] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [mobileMoneyAmount, setMobileMoneyAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);
  const [paystackAmount, setPaystackAmount] = useState(0);
  const [soapUnits, setSoapUnits] = useState(0);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const QUICK_FAULTS = ["Not spinning", "Coin stuck", "Not rolling", "Door won't close", "Water leaking", "Not draining", "Noisy", "Not starting"];
  const [selectedFaultTypes, setSelectedFaultTypes] = useState<string[]>([]);
  const [faultDescription, setFaultDescription] = useState('');
  const [faults, setFaults] = useState<FaultEntry[]>([]);
  const [endOfDayComment, setEndOfDayComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [dateParam]);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [reportDateFilter, setReportDateFilter] = useState('');
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const DRAFT_KEY = `rapidwash_report_draft_${branchId || "unknown"}`;
  const isSubmitted = existingDraft?.status === 'submitted' || existingDraft?.status === 'submitted_with_outstanding';

  useEffect(() => {
    if (!loaded || isSubmitted || !branchId) return;
    const draft = {
      date: dateParam || today(),
      soapUnits,
      faults,
      endOfDayComment,
      savedAt: Date.now(),
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, [soapUnits, faults, endOfDayComment, loaded, isSubmitted, branchId]);

  useEffect(() => {
    if (!branchId) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.date && saved.date !== today()) {
        setDraftDate(saved.date);
        setShowDraftBanner(true);
      }
    } catch {}
  }, [branchId]);

  const handleRestoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.soapUnits !== undefined) setSoapUnits(saved.soapUnits);
      if (Array.isArray(saved.faults)) setFaults(deserializeFaults(JSON.stringify(saved.faults)));
      if (saved.endOfDayComment) setEndOfDayComment(saved.endOfDayComment);
      toast.success("Draft restored!");
    } catch {}
    setShowDraftBanner(false);
  };

  const handleDiscardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setShowDraftBanner(false);
  };

  const attendantNames: string[] = (autoData?.todayAttendantNames && autoData.todayAttendantNames.length > 0)
    ? autoData.todayAttendantNames
    : (activeAttendances?.map(a => a.attendant?.name).filter(Boolean) as string[] ?? []);

  useEffect(() => {
    if (existingDraft && existingDraft.status === 'submitted') { setLoaded(true); return; }
    if (existingDraft) {
      if (autoData) {
        setWasherTokens(autoData.washerTokensUsed ?? 0);
        setDryerTokens(autoData.dryerTokensUsed ?? 0);
        setCashAmount(autoData.cashAmount ?? 0);
        setMobileMoneyAmount(autoData.mobileMoneylAmount ?? 0);
        setCardAmount(autoData.cardAmount ?? 0);
        setPaystackAmount(autoData.paystackAmount ?? 0);
      }
      setSoapUnits(existingDraft.soapUnitsUsed ?? 0);
      setEndOfDayComment(existingDraft.notes ?? '');
      if (existingDraft.technicalFaultNotes) {
        setFaults(deserializeFaults(existingDraft.technicalFaultNotes));
      }
      setLoaded(true);
    } else if (autoData) {
      setWasherTokens(autoData.washerTokensUsed ?? 0);
      setDryerTokens(autoData.dryerTokensUsed ?? 0);
      setCashAmount(autoData.cashAmount ?? 0);
      setMobileMoneyAmount(autoData.mobileMoneylAmount ?? 0);
      setCardAmount(autoData.cardAmount ?? 0);
      setPaystackAmount(autoData.paystackAmount ?? 0);
      setLoaded(true);
    }
  }, [existingDraft, autoData, loaded]);

  const handleAddFault = () => {
    if (!selectedMachineId.trim() && !faultDescription.trim()) {
      toast.error('Select a machine and describe the fault'); return;
    }
    const machine = (activeMachines as any[]).find((m: any) => m._id === selectedMachineId);
    setFaults(prev => [...prev, {
      machineId:    selectedMachineId.trim(),
      machineName:  machine?.name        || selectedMachineId.trim(),
      displayName:  machine?.displayName || machine?.name || selectedMachineId.trim(),
      serialNumber: machine?.serialNumber || undefined,
      otherDetails: machine?.otherDetails || undefined,
      faultTypes:   selectedFaultTypes,
      description:  faultDescription.trim(),
    }]);
    setSelectedMachineId('');
    setSelectedFaultTypes([]);
    setFaultDescription('');
    toast.success('Fault added');
  };

  const buildPayload = () => ({
    branchId,
    date: dateParam || today(),
    attendantsOnShift: attendantNames,
    washerTokensUsed: washerTokens,
    dryerTokensUsed: dryerTokens,
    serviceBreakdown: autoData?.serviceBreakdown ?? [],
    cashAmount,
    mobileMoneylAmount: mobileMoneyAmount,
    cardAmount,
    paystackAmount,
    soapUnitsUsed: soapUnits,
    freeWashCount: autoData?.freeWashCount ?? 0,
    voucherBreakdown: autoData?.voucherBreakdown ?? [],
    washingPlanCount: 0,
    technicalFaultCount: faults.length,
    technicalFaultNotes: faults.length > 0 ? serializeFaults(faults) : undefined,
    notes: endOfDayComment || undefined,
    outstandingAmount: autoData?.outstandingAmount ?? 0,
    outstandingOrderCount: autoData?.outstandingOrderCount ?? 0,
    outstandingRecovered: autoData?.outstandingRecovered ?? 0,
    stationToken: stationToken || undefined,
  });

  const handleSaveDraft = async () => {
    if (!branchId) return;
    setIsSaving(true);
    try {
      await saveDraftMutation(buildPayload());
      toast.success('Draft saved!');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitConfirmed = async () => {
    if (!branchId) return;
    setIsSubmitting(true);
    try {
      await submitMutation(buildPayload());
      toast.success('Daily report submitted!');
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setTimeout(() => {
        setWasherTokens(0); setDryerTokens(0);
        setCashAmount(0); setMobileMoneyAmount(0); setCardAmount(0); setPaystackAmount(0);
        setSoapUnits(0); setFaults([]); setEndOfDayComment('');
        setLoaded(false);
      }, 2000);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalRecorded = cashAmount + mobileMoneyAmount + cardAmount + paystackAmount;
  const totalTokenRevenue = autoData?.paidTokenRevenue ?? autoData?.expectedRevenue ?? totalRecorded;
  const discrepancy = Math.round((totalRecorded - totalTokenRevenue) * 100) / 100;

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        {dateParam && (
          <button onClick={() => router.push('/washstation/reports')} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors mb-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to Today's Report
          </button>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Daily Report{branchName ? ` – ${branchName}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{fmtDate(dateParam || today())}</p>
          </div>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${existingDraft?.status === 'submitted_with_outstanding' ? 'bg-orange-100 text-orange-700' : isSubmitted ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${existingDraft?.status === 'submitted_with_outstanding' ? 'bg-orange-500' : isSubmitted ? 'bg-amber-500' : 'bg-green-500'}`} />
            {existingDraft?.status === 'submitted_with_outstanding' ? 'Outstanding' : isSubmitted ? 'Submitted' : 'Open'}
          </span>
        </div>

        {/* Draft restore banner */}
        {showDraftBanner && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Unsaved Draft Found</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">You have an unsaved report draft from {draftDate ? new Date(draftDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "a previous session"}. Would you like to restore it?</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleRestoreDraft} className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline">Restore</button>
              <button onClick={handleDiscardDraft} className="text-xs text-amber-600 dark:text-amber-500 underline">Discard</button>
            </div>
          </div>
        )}

        {/* Attendants on Duty */}
        {attendantNames.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-3">Attendants on Duty</h2>
            <div className="flex flex-wrap gap-2">
              {attendantNames.map((name, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sales Summary */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Sales Summary</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Washer Tokens</p>
              <p className="text-2xl font-bold text-foreground">{washerTokens}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(autoData?.washerTokenRevenue ?? 0)}</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Dryer Tokens</p>
              <p className="text-2xl font-bold text-foreground">{dryerTokens}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(autoData?.dryerTokenRevenue ?? 0)}</p>
            </div>
          </div>

          {(autoData?.freeWashCount ?? 0) > 0 && (
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-xl mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z"/><path d="M8 12l3 3 5-5"/></svg>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Free Washes Today</span>
              </div>
              <span className="text-lg font-bold text-green-700 dark:text-green-300">{autoData?.freeWashCount ?? 0}</span>
            </div>
          )}

          {(autoData?.voucherBreakdown ?? []).length > 0 && (
            <div className="bg-muted/30 border border-border rounded-xl p-3 mb-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discounts Used Today</p>
              </div>
              {(autoData?.voucherBreakdown ?? []).map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{v.count}×</p>
                    <p className="text-xs text-muted-foreground">
                      {v.discountType === "loyalty" ? fmt(v.totalDiscount) : `GHS ${v.totalDiscount.toFixed(2)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(autoData?.outstandingOrderCount ?? 0) > 0 && (
            <div className="flex items-start sm:items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl mb-3 gap-2">
              <div className="flex items-start sm:items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Outstanding Payments</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{autoData?.outstandingOrderCount} order{(autoData?.outstandingOrderCount ?? 0) > 1 ? 's' : ''} not yet paid</p>
                </div>
              </div>
              <span className="text-lg font-bold text-amber-700 dark:text-amber-300">GHS {(autoData?.outstandingAmount ?? 0).toFixed(2)}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl mb-3">
            <div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Tokens Used Value</span>
              <p className="text-xs text-blue-600 dark:text-blue-400">{(autoData?.washerTokensUsed ?? 0) + (autoData?.dryerTokensUsed ?? 0)} tokens · paid orders only</p>
            </div>
            <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt(totalTokenRevenue)}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-xl mb-5">
            <div>
              <span className="text-sm font-medium text-green-700 dark:text-green-300">Expected Revenue</span>
              <p className="text-xs text-green-600 dark:text-green-400">From paid orders excl. free washes</p>
            </div>
            <span className="text-lg font-bold text-green-700 dark:text-green-300">{fmt(autoData?.expectedRevenue ?? totalTokenRevenue)}</span>
          </div>

          <h3 className="font-semibold text-sm text-foreground mb-3">Payment Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Mobile Money', value: mobileMoneyAmount, color: 'border-l-blue-500' },
              { label: 'Card Payment', value: cardAmount + paystackAmount, color: 'border-l-violet-500' },
              { label: 'Cash Payment', value: cashAmount, color: 'border-l-green-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`border-l-4 ${color} pl-3 py-1 flex items-center justify-between`}>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground">{fmt(value)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="font-semibold text-foreground">Total Collected</span>
            <span className="text-xl font-bold text-foreground">{fmt(totalRecorded)}</span>
          </div>
        </div>

        {/* Manual Entries */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Manual Entries</h2>

          <div>
            <label className="text-sm text-muted-foreground font-medium block mb-1.5">Soap Used</label>
            <div className="relative">
              <Input type="number" min={0} value={soapUnits}
                onChange={e => setSoapUnits(parseFloat(e.target.value) || 0)}
                disabled={isSubmitted} className="pr-14" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Units</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Technical Faults</h3>
            {!isSubmitted && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Machine</label>
                  {(activeMachines as any[]).length > 0 ? (
                    <select value={selectedMachineId} onChange={e => setSelectedMachineId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">Select machine...</option>
                      {(activeMachines as any[]).map((m: any) => (
                        // Attendant only sees the friendly displayName
                        <option key={m._id} value={m._id}>
                          {m.displayName || m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input value={selectedMachineId} onChange={e => setSelectedMachineId(e.target.value)} placeholder="e.g. Big Washer" className="text-sm" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-2">Fault Type</label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_FAULTS.map(f => (
                      <button key={f} type="button"
                        onClick={() => setSelectedFaultTypes(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                        className={"px-3 py-1 rounded-full text-xs font-medium border transition-all " + (selectedFaultTypes.includes(f) ? "bg-destructive text-destructive-foreground border-destructive" : "bg-muted text-muted-foreground border-border hover:border-destructive/50")}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Additional Details</label>
                  <Textarea value={faultDescription} onChange={e => setFaultDescription(e.target.value)}
                    placeholder="Describe the issue in more detail..." rows={2} className="text-sm resize-none" />
                </div>
                <Button onClick={handleAddFault} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" /> Report Fault
                </Button>
              </div>
            )}

            {faults.length > 0 && (
              <div className="mt-3 space-y-2">
                {faults.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <Wrench className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {/* Attendant sees displayName on the fault card */}
                      <p className="text-xs font-semibold text-destructive">
                        {f.displayName || f.machineName || f.machineId || 'Unknown machine'}
                      </p>
                      {f.faultTypes && f.faultTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {f.faultTypes.map((ft: string) => (
                            <span key={ft} className="text-xs px-1.5 py-0.5 bg-destructive/10 text-destructive rounded">{ft}</span>
                          ))}
                        </div>
                      )}
                      {f.description && <p className="text-sm text-foreground mt-0.5">{f.description}</p>}
                    </div>
                    {!isSubmitted && (
                      <button onClick={() => setFaults(faults.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground font-medium block mb-1.5">End of Day Comment</label>
            <Textarea value={endOfDayComment} onChange={e => setEndOfDayComment(e.target.value)}
              placeholder="Any additional notes for the manager..." rows={3}
              disabled={isSubmitted} className="text-sm resize-none" />
          </div>
        </div>

        {!isSubmitted && (
          <div className="flex flex-col sm:flex-row gap-3 pb-6">
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving || isSubmitting} className="flex-1">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Draft
            </Button>
            <Button onClick={() => setVerifyOpen(true)} disabled={isSaving || isSubmitting} className="flex-1">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Close & Submit Day
            </Button>
          </div>
        )}

        {isSubmitted && (
          <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5" />
            {existingDraft?.status === 'submitted_with_outstanding'
              ? 'Report submitted with outstanding payments. Admin has been notified.'
              : 'Report submitted successfully.'}
          </div>
        )}

        {pastReports && pastReports.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h2 className="font-semibold text-foreground">Recent Reports</h2>
              <input
                type="date"
                value={reportDateFilter}
                onChange={e => setReportDateFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            {pastReports.filter((r) => r.status === 'open' || r.status === 'draft').length > 0 && (
              <div className="flex items-center gap-2 p-3 mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  You have {pastReports.filter((r) => r.status === 'open' || r.status === 'draft').length} unsubmitted report(s). Tap to open and submit.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {pastReports
                .filter((r) => !(r.date === today() && r.status !== 'open' && r.status !== 'draft'))
                .filter((r) => reportDateFilter ? r.date === reportDateFilter : true)
                .slice(0, 14)
                .map((r) => (
                  <div key={r._id}
                    className={"flex items-center justify-between p-3 rounded-xl border gap-2 cursor-pointer hover:bg-muted/50 transition-colors " + (r.status === 'open' || r.status === 'draft' ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800' : 'bg-muted/30 border-border')}
                    onClick={() => router.push("/washstation/reports?date=" + r.date)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{fmtDate(r.date)}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[140px] sm:max-w-none">{r.attendantsOnShift?.join(', ') || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">GHS {((r.cashAmount || 0) + (r.mobileMoneylAmount || 0) + (r.cardAmount || 0) + (r.paystackAmount || 0)).toFixed(2)}</p>
                        <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (r.status === 'submitted_with_outstanding' ? 'bg-orange-100 text-orange-700' : r.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                          {r.status === 'submitted_with_outstanding' ? 'Outstanding' : r.status === 'submitted' ? 'Submitted' : 'Draft'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              {pastReports.filter((r) => !(r.date === today() && r.status !== 'open')).filter((r) => reportDateFilter ? r.date === reportDateFilter : true).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No reports found{reportDateFilter ? ' for selected date' : ''}.</p>
              )}
            </div>
          </div>
        )}

        {verifyOpen && (
          <ActionVerification
            open={verifyOpen}
            onVerified={async () => {
              setVerifyOpen(false);
              await handleSubmitConfirmed();
            }}
            onCancel={() => setVerifyOpen(false)}
            actionType="Close & Submit Daily Report"
          />
        )}
      </div>
    </>
  );
}

export default function DailyReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <DailyReportPageInner />
    </Suspense>
  );
}