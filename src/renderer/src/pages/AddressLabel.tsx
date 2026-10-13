// src/renderer/src/pages/AddressLabel.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
    MapPin, Phone, User, Hash, Landmark, Printer, Save,
    Eye, RotateCcw, CheckCircle, AlertCircle, Plus, Trash2,
    X, Edit2, Package,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface AddressEntry {
    id: string
    name: string
    place: string
    pincode: string
    phone: string
    landmark: string
    created_at: string
}

// ── Saved addresses key (localStorage via window.api storage or localStorage) ─
const STORAGE_KEY = 'address_label_entries'

function loadEntries(): AddressEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function saveEntries(entries: AddressEntry[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

// ── My (sender) details — Fasil's address ───────────────────────────────────
const MY_ADDRESS: Omit<AddressEntry, 'id' | 'created_at'> = {
    name: 'Aflah latheef',
    place: 'Areekode',
    pincode: '673639',
    phone: '8592958049',
    landmark: '',
}

// ── Label dimensions (matching iphone label exactly) ────────────────────────
const LABEL_W = 420
const LABEL_H = 170

// ── Address Label Preview Component ─────────────────────────────────────────

interface AddressLabelViewProps {
    from: Omit<AddressEntry, 'id' | 'created_at'>
    to: Omit<AddressEntry, 'id' | 'created_at'>
    showBorder?: boolean
}

function AddressLabelView({ from, to, showBorder = true }: AddressLabelViewProps) {
    return (
        <div
            className="label-print-target"
            style={{
                width: LABEL_W,
                height: LABEL_H,
                background: '#fff',
                border: showBorder ? '1px solid #d0d0d0' : 'none',
                borderRadius: showBorder ? 6 : 0,
                boxShadow: showBorder ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                fontFamily: "'Space Grotesk', Arial, sans-serif",
                boxSizing: 'border-box',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                padding: '8px 10px 8px 10px',
                color: '#000000',
            }}
        >
            {/* Body: FROM + TO side by side */}
            <div style={{ display: 'flex', flex: 1, gap: 8, minHeight: 0 }}>

                {/* FROM */}
                <div style={{ flex: 1, borderRight: '1px dashed #aaa', paddingRight: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#000000', textTransform: 'uppercase', marginBottom: 4 }}>
                        From
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#000000', lineHeight: 1.25, marginBottom: 2 }}>{from.name || '—'}</div>
                    {from.place && <div style={{ fontSize: 12, color: '#000000', lineHeight: 1.3 }}>{from.place}{from.pincode ? ` - ${from.pincode}` : ''}</div>}
                    {from.phone && <div style={{ fontSize: 12, color: '#000000', marginTop: 2 }}>📞 {from.phone}</div>}
                    {from.phone && <div style={{ fontSize: 12, color: '#000000', marginTop: 2 }}>📞 8592958005</div>}
                    {from.landmark && <div style={{ fontSize: 12, color: '#000000', marginTop: 1, fontStyle: 'italic' }}>Near: {from.landmark}</div>}
                </div>

                {/* TO */}
                <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#000000', textTransform: 'uppercase', marginBottom: 4 }}>To</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#000000', lineHeight: 1.2, marginBottom: 3 }}>{to.name || '—'}</div>
                    {to.place && <div style={{ fontSize: 13, color: '#000000', lineHeight: 1.3, fontWeight: 600 }}>{to.place}</div>}
                    {to.pincode && (
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#000000', letterSpacing: 2, marginTop: 2 }}>
                            PIN: {to.pincode}
                        </div>
                    )}
                    {to.phone && <div style={{ fontSize: 12, color: '#000000', marginTop: 2, fontWeight: 600 }}>📞 {to.phone}</div>}
                    {to.landmark && <div style={{ fontSize: 10, color: '#000000', marginTop: 2, fontWeight: 500 }}>Near: {to.landmark}</div>}
                </div>
            </div>
        </div>
    )
}

// ── Field with suggestion ────────────────────────────────────────────────────

interface FieldWithSuggestProps {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    icon?: React.ReactNode
    suggestions?: string[]
    mono?: boolean
    type?: string
}

function FieldWithSuggest({ label, value, onChange, placeholder, icon, suggestions = [], mono, type = 'text' }: FieldWithSuggestProps) {
    const [showSuggestions, setShowSuggestions] = useState(false)
    const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase() && value.length > 0)

    const inputStyle = {
        background: 'var(--color-surface-2)',
        borderColor: value ? 'rgba(16,185,129,0.4)' : 'var(--color-border)',
        color: 'var(--color-text)',
    }

    return (
        <div className="space-y-1.5 relative">
            <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                {icon}{label}
            </label>
            <div className="relative">
                <input
                    type={type}
                    value={value}
                    onChange={e => { onChange(e.target.value); setShowSuggestions(true) }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ ...inputStyle, fontFamily: mono ? 'monospace' : undefined }}
                />
                {showSuggestions && filtered.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl z-50 overflow-hidden"
                        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
                        {filtered.map((s, i) => (
                            <button key={i} type="button"
                                onMouseDown={() => { onChange(s); setShowSuggestions(false) }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--color-text)' }}>
                                <span style={{ color: 'var(--color-primary)' }}>→</span> {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_ADDRESS = (): Omit<AddressEntry, 'id' | 'created_at'> => ({
    name: '', place: '', pincode: '', phone: '', landmark: '',
})

export function AddressLabel() {
    const [toForm, setToForm] = useState(EMPTY_ADDRESS())
    const [fromForm, setFromForm] = useState({ ...MY_ADDRESS })
    const [editingFrom, setEditingFrom] = useState(false)

    const [savedEntries, setSavedEntries] = useState<AddressEntry[]>(loadEntries)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

    // Print
    const printRef = useRef<HTMLDivElement>(null)
    const [printData, setPrintData] = useState<{ from: typeof fromForm; to: typeof toForm } | null>(null)
    const pendingPrint = useRef(false)

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Address-${toForm.name || 'label'}`,
        onAfterPrint: () => { showToast('success', 'Printed successfully!') },
    })

    useEffect(() => {
        if (pendingPrint.current && printData) {
            pendingPrint.current = false
            const t = setTimeout(() => handlePrint(), 80)
            return () => clearTimeout(t)
        }
    }, [printData])

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message })
        setTimeout(() => setToast(null), 3000)
    }

    // Build suggestion list from saved entries + MY_ADDRESS
    const allNames = [MY_ADDRESS.name, ...savedEntries.map(e => e.name)].filter(Boolean)
    const allPlaces = [MY_ADDRESS.place, ...savedEntries.map(e => e.place)].filter(Boolean)
    const allPincodes = [MY_ADDRESS.pincode, ...savedEntries.map(e => e.pincode)].filter(Boolean)
    const allPhones = [...savedEntries.map(e => e.phone)].filter(Boolean)
    const allLandmarks = [...savedEntries.map(e => e.landmark)].filter(Boolean)

    // When name typed and matches a saved entry → suggest rest
    const handleToNameChange = (name: string) => {
        setToForm(prev => ({ ...prev, name }))
        // Auto-fill other fields if exact match found (but only suggest, not force)
        const match = savedEntries.find(e => e.name.toLowerCase() === name.toLowerCase())
        if (match) {
            setToForm({ name, place: match.place, pincode: match.pincode, phone: match.phone, landmark: match.landmark })
        }
        // Also check if it's "Fasil"
        if (name.toLowerCase() === MY_ADDRESS.name.toLowerCase()) {
            setToForm({ name, place: MY_ADDRESS.place, pincode: MY_ADDRESS.pincode, phone: MY_ADDRESS.phone, landmark: MY_ADDRESS.landmark })
        }
    }

    const setTo = (key: keyof typeof toForm, value: string) =>
        setToForm(prev => ({ ...prev, [key]: value }))
    const setFrom = (key: keyof typeof fromForm, value: string) =>
        setFromForm(prev => ({ ...prev, [key]: value }))

    const handleSave = () => {
        if (!toForm.name || !toForm.place) {
            showToast('error', 'Name and Place are required')
            return
        }
        // Check if already saved (same name + phone)
        const exists = savedEntries.find(e => e.name === toForm.name && e.phone === toForm.phone)
        if (exists) {
            // Update
            const updated = savedEntries.map(e => e.id === exists.id ? { ...e, ...toForm } : e)
            setSavedEntries(updated)
            saveEntries(updated)
            showToast('success', 'Address updated!')
        } else {
            const entry: AddressEntry = { id: crypto.randomUUID(), ...toForm, created_at: new Date().toISOString() }
            const updated = [entry, ...savedEntries]
            setSavedEntries(updated)
            saveEntries(updated)
            showToast('success', 'Address saved!')
        }
    }

    const handleSaveAndPrint = () => {
        if (!toForm.name) { showToast('error', 'Name is required'); return }
        handleSave()
        setPrintData({ from: { ...fromForm }, to: { ...toForm } })
        pendingPrint.current = true
        setPrintData(d => d ? { ...d } : { from: { ...fromForm }, to: { ...toForm } })
    }

    const handlePrintNow = () => {
        if (!toForm.name) { showToast('error', 'Name is required'); return }
        pendingPrint.current = true
        setPrintData({ from: { ...fromForm }, to: { ...toForm } })
    }

    const loadEntry = (entry: AddressEntry) => {
        setToForm({ name: entry.name, place: entry.place, pincode: entry.pincode, phone: entry.phone, landmark: entry.landmark })
    }

    const deleteEntry = (id: string) => {
        const updated = savedEntries.filter(e => e.id !== id)
        setSavedEntries(updated)
        saveEntries(updated)
        setConfirmDelete(null)
        showToast('success', 'Address deleted')
    }

    const handleReset = () => {
        setToForm(EMPTY_ADDRESS())
        showToast('success', 'Form cleared')
    }

    const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none"
    const inputStyle = { background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }

    return (
        <div className="animate-fade-in max-w-6xl">

            {/* Toast */}
            {toast && (
                <div className="fixed top-14 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg"
                    style={{
                        background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        borderColor: toast.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
                        color: toast.type === 'success' ? '#10b981' : '#ef4444',
                    }}>
                    {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Address Label</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Print 100mm × 45mm address labels — same size as iPhone labels
                    </p>
                </div>
                <button onClick={handleReset}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <RotateCcw size={14} /> Reset
                </button>
            </div>

            <div className="grid grid-cols-[1fr_360px] gap-6">

                {/* ── Left: Form ───────────────────────────────────────────────── */}
                <div className="space-y-5">

                    {/* FROM section */}
                    <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-faint)' }}>
                                From (Sender)
                            </h2>
                            <button onClick={() => setEditingFrom(v => !v)}
                                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-white/5"
                                style={{ borderColor: 'rgba(99,102,241,0.3)', color: '#818cf8' }}>
                                <Edit2 size={11} />{editingFrom ? 'Done' : 'Edit'}
                            </button>
                        </div>

                        {editingFrom ? (
                            <div className="grid grid-cols-2 gap-3">
                                <FieldWithSuggest label="Name" value={fromForm.name} onChange={v => setFrom('name', v)}
                                    placeholder="Sender name" icon={<User size={11} />} suggestions={allNames} />
                                <FieldWithSuggest label="Place" value={fromForm.place} onChange={v => setFrom('place', v)}
                                    placeholder="City / Town" icon={<MapPin size={11} />} suggestions={allPlaces} />
                                <FieldWithSuggest label="Pincode" value={fromForm.pincode} onChange={v => setFrom('pincode', v)}
                                    placeholder="6-digit PIN" icon={<Hash size={11} />} suggestions={allPincodes} mono />
                                <FieldWithSuggest label="Phone" value={fromForm.phone} onChange={v => setFrom('phone', v)}
                                    placeholder="10-digit number" icon={<Phone size={11} />} suggestions={allPhones} mono />
                                <div className="col-span-2">
                                    <FieldWithSuggest label="Landmark" value={fromForm.landmark} onChange={v => setFrom('landmark', v)}
                                        placeholder="Near hospital / mosque..." icon={<Landmark size={11} />} suggestions={allLandmarks} />
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm space-y-1" style={{ color: 'var(--color-text)' }}>
                                <div className="font-bold text-base">{fromForm.name || '—'}</div>
                                <div style={{ color: 'var(--color-text-muted)' }}>
                                    {fromForm.place}{fromForm.pincode ? ` - ${fromForm.pincode}` : ''}
                                </div>
                                {fromForm.phone && <div style={{ color: 'var(--color-text-muted)' }}>📞 {fromForm.phone}</div>}
                                {fromForm.landmark && <div style={{ color: 'var(--color-text-faint)', fontSize: 12, fontStyle: 'italic' }}>Near: {fromForm.landmark}</div>}
                            </div>
                        )}
                    </div>

                    {/* TO section */}
                    <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-faint)' }}>
                                To (Recipient)
                            </h2>
                            <div className="text-xs px-2 py-1 rounded-md border"
                                style={{ borderColor: 'rgba(99,102,241,0.3)', color: '#818cf8', background: 'rgba(99,102,241,0.08)' }}>
                                💡 Type name to get suggestions
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <FieldWithSuggest label="Name *" value={toForm.name} onChange={handleToNameChange}
                                placeholder='e.g. "fasil" to autofill' icon={<User size={11} />} suggestions={allNames} />
                            <FieldWithSuggest label="Place *" value={toForm.place} onChange={v => setTo('place', v)}
                                placeholder="City / Town / District" icon={<MapPin size={11} />} suggestions={allPlaces} />
                            <FieldWithSuggest label="Pincode" value={toForm.pincode} onChange={v => setTo('pincode', v)}
                                placeholder="6-digit PIN code" icon={<Hash size={11} />} suggestions={allPincodes} mono />
                            <FieldWithSuggest label="Phone" value={toForm.phone} onChange={v => setTo('phone', v)}
                                placeholder="10-digit mobile" icon={<Phone size={11} />} suggestions={allPhones} mono />
                            <div className="col-span-2">
                                <FieldWithSuggest label="Landmark" value={toForm.landmark} onChange={v => setTo('landmark', v)}
                                    placeholder="Near mosque / school / bus stand..." icon={<Landmark size={11} />} suggestions={allLandmarks} />
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => setPreviewOpen(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border transition-all hover:bg-white/5"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                            <Eye size={15} />Preview
                        </button>
                        <button onClick={handleSave}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border transition-all hover:bg-white/5"
                            style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#10b981' }}>
                            <Save size={15} />Save
                        </button>
                        <button onClick={handlePrintNow}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border transition-all hover:bg-white/5"
                            style={{ borderColor: 'rgba(99,102,241,0.4)', color: '#818cf8' }}>
                            <Printer size={15} />Print
                        </button>
                        <button onClick={handleSaveAndPrint}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
                            style={{ background: 'var(--color-primary)', color: 'white' }}>
                            <Save size={15} />Save & Print
                        </button>
                    </div>
                </div>

                {/* ── Right: Preview + Saved Addresses ─────────────────────────── */}
                <div className="space-y-4">

                    {/* Live preview card */}
                    <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                        <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-faint)' }}>
                            Label Preview
                        </h3>
                        <div className="rounded-lg overflow-hidden" style={{ background: '#e8e8e8', padding: 6 }}>
                            <div style={{ zoom: 0.68 } as React.CSSProperties}>
                                <AddressLabelView from={fromForm} to={toForm} showBorder={false} />
                            </div>
                        </div>
                        <p className="text-xs mt-3 text-center" style={{ color: 'var(--color-text-faint)' }}>
                            Preview scaled · print output is full size
                        </p>
                    </div>

                    {/* Saved addresses */}
                    <div className="rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-faint)' }}>
                                Saved Addresses
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full border"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-faint)' }}>
                                {savedEntries.length}
                            </span>
                        </div>

                        {savedEntries.length === 0 ? (
                            <div className="py-8 text-center text-xs" style={{ color: 'var(--color-text-faint)' }}>
                                <Package size={24} className="mx-auto mb-2 opacity-30" />
                                No saved addresses yet
                            </div>
                        ) : (
                            <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--color-border)' }}>
                                {savedEntries.map(entry => (
                                    <div key={entry.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/5 transition-colors group">
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadEntry(entry)}>
                                            <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{entry.name}</div>
                                            <div className="text-xs truncate" style={{ color: 'var(--color-text-faint)' }}>
                                                {entry.place}{entry.pincode ? ` · ${entry.pincode}` : ''}{entry.phone ? ` · ${entry.phone}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => loadEntry(entry)} title="Load"
                                                className="p-1.5 rounded hover:bg-indigo-500/15" style={{ color: '#818cf8' }}>
                                                <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => {
                                                loadEntry(entry)
                                                setTimeout(() => { pendingPrint.current = true; setPrintData({ from: { ...fromForm }, to: entry }) }, 50)
                                            }} title="Print"
                                                className="p-1.5 rounded hover:bg-indigo-500/15" style={{ color: '#818cf8' }}>
                                                <Printer size={12} />
                                            </button>
                                            <button onClick={() => setConfirmDelete(entry.id)} title="Delete"
                                                className="p-1.5 rounded hover:bg-red-500/15" style={{ color: '#ef4444' }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Hidden print target (always mounted) ────────────────────────── */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
                <div ref={printRef} style={{ background: 'white' }}>
                    {printData && (
                        <div className="label-print-wrapper">
                            <AddressLabelView from={printData.from} to={printData.to} showBorder={false} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Preview Modal ────────────────────────────────────────────────── */}
            {previewOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setPreviewOpen(false) }}
                >
                    <div className="relative rounded-2xl border shadow-2xl overflow-hidden"
                        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', maxWidth: 560, width: '95vw' }}>
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                                Label Preview — {toForm.name || 'No name'} → {fromForm.name}
                            </div>
                            <button onClick={() => setPreviewOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
                                style={{ color: 'var(--color-text-muted)' }}>
                                <X size={15} />
                            </button>
                        </div>
                        <div className="p-6 flex justify-center" style={{ background: '#e8e8e8' }}>
                            <div style={{ background: 'white', padding: 12, borderRadius: 6 }}>
                                <AddressLabelView from={fromForm} to={toForm} showBorder={false} />
                            </div>
                        </div>
                        <div className="px-5 py-4 flex gap-3">
                            <button onClick={() => { setPreviewOpen(false); handlePrintNow() }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                                style={{ background: 'var(--color-primary)', color: 'white' }}>
                                <Printer size={14} />Print
                            </button>
                            <button onClick={() => { setPreviewOpen(false); handleSaveAndPrint() }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5"
                                style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#10b981' }}>
                                <Save size={14} />Save & Print
                            </button>
                            <button onClick={() => setPreviewOpen(false)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5 ml-auto"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete confirm ───────────────────────────────────────────────── */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="rounded-xl border p-6 w-72 space-y-4"
                        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
                        <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Delete this address?</div>
                        <div className="flex gap-3">
                            <button onClick={() => deleteEntry(confirmDelete)}
                                className="flex-1 py-2 rounded-lg text-sm font-medium"
                                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                                Delete
                            </button>
                            <button onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-2 rounded-lg text-sm font-medium border"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}