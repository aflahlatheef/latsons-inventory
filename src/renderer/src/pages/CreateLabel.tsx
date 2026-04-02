// src/renderer/src/pages/CreateLabel.tsx
// KEY CHANGES:
// 1. Added savedProductRef — useReactToPrint's onAfterPrint runs after state
//    updates are flushed, but relying on the state value inside the callback
//    can still capture a stale closure. A ref is always current.
// 2. persistData now sets BOTH savedProduct state and savedProductRef.current
// 3. handleSaveAndPrint uses the product returned directly from persistData
//    instead of reading from state (which may not have settled yet)

import { useState, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import {
  ScanLine,
  Printer,
  Save,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  BookmarkCheck,
} from "lucide-react";
import { LabelPreview } from "../components/label/LabelPreview";
import type { LabelExtras } from "../components/label/LabelPreview";
import { IphoneUSBConnect } from "../components/iphone/IphoneUSBConnect";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useProducts } from "../hooks/useProducts";
import { useLabels } from "../hooks/useLabels";
import {
  IPHONE_MODELS,
  IPHONE_STORAGE,
  IPHONE_COLORS,
  PRODUCT_STATUSES,
} from "../../../types/shared";
import type { Product } from "../../../types/shared";
import type { IphoneUSBData } from "../hooks/useIphoneUSB";

const MODEL_IDENTIFIER_MAP: Record<string, string> = {
  "iPhone1,1": "iPhone", "iPhone1,2": "iPhone 3G", "iPhone2,1": "iPhone 3GS",
  "iPhone3,1": "iPhone 4", "iPhone3,2": "iPhone 4", "iPhone3,3": "iPhone 4",
  "iPhone4,1": "iPhone 4S", "iPhone5,1": "iPhone 5", "iPhone5,2": "iPhone 5",
  "iPhone5,3": "iPhone 5C", "iPhone5,4": "iPhone 5C", "iPhone6,1": "iPhone 5S",
  "iPhone6,2": "iPhone 5S", "iPhone7,1": "iPhone 6 Plus", "iPhone7,2": "iPhone 6",
  "iPhone8,1": "iPhone 6s", "iPhone8,2": "iPhone 6s Plus",
  "iPhone8,4": "iPhone SE (1st gen)", "iPhone9,1": "iPhone 7", "iPhone9,2": "iPhone 7 Plus",
  "iPhone9,3": "iPhone 7", "iPhone9,4": "iPhone 7 Plus", "iPhone10,1": "iPhone 8",
  "iPhone10,2": "iPhone 8 Plus", "iPhone10,3": "iPhone X", "iPhone10,4": "iPhone 8",
  "iPhone10,5": "iPhone 8 Plus", "iPhone10,6": "iPhone X", "iPhone11,2": "iPhone XS",
  "iPhone11,4": "iPhone XS Max", "iPhone11,6": "iPhone XS Max", "iPhone11,8": "iPhone XR",
  "iPhone12,1": "iPhone 11", "iPhone12,3": "iPhone 11 Pro", "iPhone12,5": "iPhone 11 Pro Max",
  "iPhone12,8": "iPhone SE (2nd gen)", "iPhone13,1": "iPhone 12 mini",
  "iPhone13,2": "iPhone 12", "iPhone13,3": "iPhone 12 Pro", "iPhone13,4": "iPhone 12 Pro Max",
  "iPhone14,2": "iPhone 13 Pro", "iPhone14,3": "iPhone 13 Pro Max",
  "iPhone14,4": "iPhone 13 mini", "iPhone14,5": "iPhone 13",
  "iPhone14,6": "iPhone SE (3rd gen)", "iPhone14,7": "iPhone 14",
  "iPhone14,8": "iPhone 14 Plus", "iPhone15,2": "iPhone 14 Pro",
  "iPhone15,3": "iPhone 14 Pro Max", "iPhone15,4": "iPhone 15",
  "iPhone15,5": "iPhone 15 Plus", "iPhone16,1": "iPhone 15 Pro",
  "iPhone16,2": "iPhone 15 Pro Max", "iPhone17,1": "iPhone 16 Pro",
  "iPhone17,2": "iPhone 16 Pro Max", "iPhone17,3": "iPhone 16",
  "iPhone17,4": "iPhone 16 Plus", "iPhone17,5": "iPhone 16e",
  "iPhone18,1": "iPhone 17 Pro", "iPhone18,2": "iPhone 17 Pro Max",
  "iPhone18,3": "iPhone 17", "iPhone18,4": "iPhone Air",
};

const SIM_OPTIONS = ["1S1E", "2E", "2S"] as const;
const BATCH_PREFIXES = ["RET", "ISP", "FHP", "QAZ", "WSX", "EDC"] as const;
const BATTERY_TYPES = ["FB", "RB"] as const;
const REGION_BADGES = ["EU+", "DU+"] as const;

function getTodayParts(): { day: string; month: string } {
  const now = new Date();
  return { day: String(now.getDate()), month: String(now.getMonth() + 1) };
}

const todayParts = getTodayParts();

const DEFAULT_FORM = {
  imei: "", serial_number: "", model: "iPhone 13 Pro", storage: "256 GB",
  model_code: "", color: "BLACK", battery_health: 100, grade: "A++",
  face_id: "Working", sim_status: "1S1E" as string, test_status: "Fully",
  ios_version: "iOS 18.4", status: "available" as const, notes: "",
};

const DEFAULT_EXTRAS = {
  region_badge: "EU+" as "EU+" | "DU+", activation: "Yes", reg: "",
  batch_prefix: "RET" as string, batch_day: todayParts.day,
  batch_month: todayParts.month, batch_battery: "FB" as string,
};

interface ScanResult {
  type: "imei" | "eid" | "meid" | "serial" | "unknown";
  value: string;
}

function classifyScan(raw: string): ScanResult {
  const value = raw.trim();
  const cleaned = value.replace(/^\x1d|\]C1/g, "").trim();
  if (/^\d{32}$/.test(cleaned)) return { type: "eid", value: cleaned };
  if (/^\d{15}$/.test(cleaned)) return { type: "imei", value: cleaned };
  if (/^[0-9A-Fa-f]{14}$/.test(cleaned) && !/^\d{14}$/.test(cleaned))
    return { type: "meid", value: cleaned };
  const u = cleaned.toUpperCase();
  if ((u.length === 10 || u.length === 12) && /^[A-Z0-9]+$/.test(u) &&
      /[A-Z]/.test(u) && /[0-9]/.test(u) && /^[A-Z]/.test(u))
    return { type: "serial", value: u };
  if (cleaned.length >= 8) return { type: "unknown", value: cleaned };
  return { type: "unknown", value: cleaned };
}

function storageGbToDisplay(gb: number | null): string | null {
  if (!gb) return null;
  if (gb >= 1024) return `${gb / 1024} TB`;
  return `${gb} GB`;
}

function normalizeModelName(raw: string): string {
  return raw.toLowerCase().replace(/apple\s*/i, "").replace(/\s+/g, " ").trim();
}

function mapUsbDataToForm(data: IphoneUSBData): Partial<typeof DEFAULT_FORM> {
  const updates: Partial<typeof DEFAULT_FORM> = {};
  if (data.imei) updates.imei = data.imei;
  if (data.serial_number) updates.serial_number = data.serial_number;
  if (data.ios_version) updates.ios_version = data.ios_version;
  if (data.battery_health !== null && data.battery_health !== undefined)
    updates.battery_health = data.battery_health;

  let resolvedModel: string | undefined;
  const rawModelName = data.model_name?.trim() ?? "";
  if (rawModelName) {
    const n = normalizeModelName(rawModelName);
    resolvedModel = (IPHONE_MODELS as readonly string[]).find((m) => normalizeModelName(m) === n);
    if (!resolvedModel)
      resolvedModel = (IPHONE_MODELS as readonly string[]).find((m) => {
        const ml = normalizeModelName(m);
        return n.includes(ml) || ml.includes(n);
      });
  }
  if (!resolvedModel && data.model_identifier) {
    const fi = MODEL_IDENTIFIER_MAP[data.model_identifier];
    if (fi) {
      const nfi = normalizeModelName(fi);
      resolvedModel = (IPHONE_MODELS as readonly string[]).find((m) => normalizeModelName(m) === nfi);
      if (!resolvedModel)
        resolvedModel = (IPHONE_MODELS as readonly string[]).find((m) => {
          const ml = normalizeModelName(m);
          return nfi.includes(ml) || ml.includes(nfi);
        });
    }
  }
  if (resolvedModel) updates.model = resolvedModel;

  if (data.storage_gb) {
    const s = storageGbToDisplay(data.storage_gb);
    if (s) {
      const sm = (IPHONE_STORAGE as readonly string[]).find((x) => x === s) ??
        (IPHONE_STORAGE as readonly string[]).find((x) => parseInt(x.replace(/\s*(GB|TB)/i, ""), 10) === data.storage_gb);
      if (sm) updates.storage = sm;
    }
  }
  if (data.color) {
    const cu = data.color.trim().toUpperCase();
    const fc = (IPHONE_COLORS as readonly string[]).find((c) => c === cu) ??
      (IPHONE_COLORS as readonly string[]).find((c) => cu.includes(c) || c.includes(cu));
    if (fc) updates.color = fc;
  }
  if (data.model_number) updates.model_code = data.model_number.trim().toUpperCase();
  return updates;
}

function mapUsbDataToExtras(data: IphoneUSBData): Partial<typeof DEFAULT_EXTRAS> {
  const updates: Partial<typeof DEFAULT_EXTRAS> = {};
  if (data.activation_state)
    updates.activation = data.activation_state === "Activated" ? "Yes" : "No";
  // region_info comes directly from ideviceinfo's "RegionInfo" field (e.g. "CH/A")
  const reg = data.region_info?.trim();
  if (reg) updates.reg = reg;
  return updates;
}

function buildBatchNo(prefix: string, day: string, month: string, battery: string): string {
  return `${prefix}${day.padStart(2, "0")}${month.padStart(2, "0")}${battery}`;
}

export function CreateLabel() {
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [extras, setExtras] = useState({ ...DEFAULT_EXTRAS });
  const [scanMode, setScanMode] = useState(false);
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  // ── FIX 1: ref so onAfterPrint never has a stale closure ──
  const savedProductRef = useRef<Product | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const imeiInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const extrasRef = useRef(extras);
  extrasRef.current = extras;

  const { createProduct } = useProducts();
  const { createLabel } = useLabels();

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const batchNo = buildBatchNo(extras.batch_prefix, extras.batch_day, extras.batch_month, extras.batch_battery);

  const labelExtras: LabelExtras = {
    region_badge: extras.region_badge,
    activation: extras.activation,
    reg: extras.reg || form.model_code,
    batch_no: batchNo,
  };

  const handleUsbData = useCallback((data: IphoneUSBData) => {
    const fu = mapUsbDataToForm(data);
    setForm((prev) => ({ ...prev, ...fu }));
    const eu = mapUsbDataToExtras(data as any);
    setExtras((prev) => ({ ...prev, ...eu }));
    const filled = [
      fu.imei && "IMEI", fu.serial_number && "Serial", fu.model && "Model",
      fu.storage && "Storage", fu.color && "Color",
      fu.battery_health !== undefined && "Battery", fu.model_code && "Model Code",
      fu.ios_version && "iOS", eu.activation && "Activation", eu.reg && "REG",
    ].filter(Boolean) as string[];
    if (filled.length > 0) showToast("success", `Auto-filled: ${filled.join(", ")}`);
    else showToast("error", "Device connected but no data could be read.");
  }, []);

  const handleScan = useCallback((value: string) => {
    const result = classifyScan(value);
    switch (result.type) {
      case "imei":
        setForm((prev) => ({ ...prev, imei: result.value }));
        showToast("success", `IMEI scanned: ${result.value}`);
        break;
      case "eid":
        showToast("error", "EID scanned — scan IMEI barcode instead.");
        break;
      case "meid":
        setForm((prev) => ({ ...prev, imei: result.value }));
        showToast("success", `MEID scanned: ${result.value}`);
        break;
      case "serial":
        setForm((prev) => ({ ...prev, serial_number: result.value }));
        showToast("success", `Serial scanned: ${result.value}`);
        break;
      default:
        if (!formRef.current.imei) {
          setForm((prev) => ({ ...prev, imei: result.value }));
          showToast("success", `Scanned to IMEI: ${result.value}`);
        } else showToast("error", "Unrecognised barcode");
    }
  }, []);

  const { startListening, stopListening } = useBarcodeScanner(scanMode ? handleScan : undefined);

  const toggleScanMode = () => {
    if (scanMode) { stopListening(); setScanMode(false); }
    else { setScanMode(true); startListening(); imeiInputRef.current?.focus(); }
  };

  const handleField = (key: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const handleExtra = (key: keyof typeof extras, value: string) =>
    setExtras((prev) => ({ ...prev, [key]: value }));

  // ── FIX 2: use savedProductRef so the callback always captures the right product ──
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Label-${form.imei || "unknown"}`,
    onAfterPrint: async () => {
      if (savedProductRef.current) {
        await window.api.label.markPrinted(savedProductRef.current.id);
        showToast("success", "Label printed and marked as printed!");
      }
    },
  });

  const persistData = async (): Promise<Product | null> => {
    if (!form.imei) { showToast("error", "IMEI is required"); return null; }
    if (!form.model_code) { showToast("error", "Model code is required"); return null; }
    setIsSaving(true);

    const ce = extrasRef.current;
    const currentBatchNo = buildBatchNo(ce.batch_prefix, ce.batch_day, ce.batch_month, ce.batch_battery);

    try {
      const product = await createProduct({
        imei: form.imei, model: form.model, storage: form.storage,
        model_code: form.model_code, color: form.color,
        battery_health: form.battery_health, grade: form.grade,
        face_id: form.face_id, sim_status: form.sim_status,
        test_status: form.test_status, ios_version: form.ios_version,
        serial_number: form.serial_number || undefined,
        status: form.status, notes: form.notes || undefined,
      });
      if (!product) throw new Error("Product creation returned null");

      // ── FIX 3: set both state (for UI) and ref (for print callback) ──
      setSavedProduct(product);
      savedProductRef.current = product;

      const qrData = JSON.stringify({
  reg: ce.reg || '',
  activation: ce.activation,
  badge: ce.region_badge,
  batch: currentBatchNo,
})

      await createLabel({ product_id: product.id, qr_data: qrData, barcode_data: product.imei });
      return product;
    } catch (err) {
      showToast("error", String(err));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    const product = await persistData();
    if (product) showToast("success", "Product & label saved successfully!");
  };

  // ── FIX 4: product from persistData is used directly, no stale state timing issue ──
  const handleSaveAndPrint = async () => {
    const product = await persistData();
    if (product) {
      showToast("success", "Product saved! Printing...");
      // savedProductRef.current is already set inside persistData above
      setTimeout(() => handlePrint(), 400);
    }
  };

  const handleReset = () => {
    const fresh = getTodayParts();
    setForm({ ...DEFAULT_FORM });
    setExtras({ ...DEFAULT_EXTRAS, batch_day: fresh.day, batch_month: fresh.month });
    setSavedProduct(null);
    savedProductRef.current = null;
    setScanMode(false);
    stopListening();
  };

  const previewProduct: Product = {
    id: "preview", ...form,
    serial_number: form.serial_number || null,
    notes: form.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm outline-none";
  const inputStyle = {
    background: "var(--color-surface-2)",
    borderColor: "var(--color-border)",
    color: "var(--color-text)",
  };

  return (
    <div className="animate-fade-in max-w-6xl">
      {toast && (
        <div className="fixed top-14 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg"
          style={{
            background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            borderColor: toast.type === "success" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)",
            color: toast.type === "success" ? "#10b981" : "#ef4444",
          }}>
          {toast.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>Create Label</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            Plug in iPhone via USB or scan barcodes to auto-fill
          </p>
        </div>
        <button onClick={handleReset}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors hover:bg-white/5"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="mb-5">
        <IphoneUSBConnect onDataRead={handleUsbData} />
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="rounded-xl border p-6 space-y-5"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-faint)" }}>
              Device Information
            </h2>
            <div className="text-xs px-2 py-1 rounded-md border"
              style={{ borderColor: "rgba(99,102,241,0.3)", color: "#818cf8", background: "rgba(99,102,241,0.08)" }}>
              💡 Plug iPhone or scan barcode to auto-fill
            </div>
          </div>

          {/* IMEI */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              IMEI <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div className="flex gap-2">
              <input ref={imeiInputRef} type="text" value={form.imei}
                onChange={(e) => handleField("imei", e.target.value)}
                placeholder={scanMode ? "🔴 Scan any barcode now..." : "Enter or scan IMEI (15 digits)"}
                className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono outline-none"
                style={{
                  background: scanMode ? "rgba(99,102,241,0.08)" : "var(--color-surface-2)",
                  borderColor: scanMode ? "rgba(99,102,241,0.5)" : form.imei ? "rgba(16,185,129,0.4)" : "var(--color-border)",
                  color: "var(--color-text)",
                }}
                data-scanner-target="true" />
              <button onClick={toggleScanMode}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                style={{
                  background: scanMode ? "rgba(99,102,241,0.2)" : "var(--color-surface-2)",
                  borderColor: scanMode ? "rgba(99,102,241,0.5)" : "var(--color-border)",
                  color: scanMode ? "#818cf8" : "var(--color-text-muted)",
                }}>
                <ScanLine size={14} />{scanMode ? "Stop" : "Scan"}
              </button>
            </div>
          </div>

          {/* Serial Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Serial Number</label>
            <input type="text" value={form.serial_number}
              onChange={(e) => handleField("serial_number", e.target.value)}
              placeholder="e.g. FFXDV1EW0DYV"
              className={inputCls}
              style={{ ...inputStyle, borderColor: form.serial_number ? "rgba(16,185,129,0.4)" : "var(--color-border)", fontFamily: "monospace" }} />
          </div>

          {/* Model + Storage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Model *</label>
              <select value={form.model} onChange={(e) => handleField("model", e.target.value)} className={inputCls} style={inputStyle}>
                {(IPHONE_MODELS as readonly string[]).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Storage *</label>
              <select value={form.storage} onChange={(e) => handleField("storage", e.target.value)} className={inputCls} style={inputStyle}>
                {(IPHONE_STORAGE as readonly string[]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Model Code + REG */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Model Code <span style={{ color: "#ef4444" }}>*</span>
                <span className="ml-1 text-xs opacity-60">(e.g. MGH23)</span>
              </label>
              <input type="text" value={form.model_code}
                onChange={(e) => handleField("model_code", e.target.value.toUpperCase())}
                placeholder="MGH23" className={inputCls}
                style={{ ...inputStyle, borderColor: form.model_code ? "rgba(16,185,129,0.4)" : "var(--color-border)", fontFamily: "monospace" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                REG <span className="opacity-60">(RegionInfo, e.g. CH/A)</span>
              </label>
              <input type="text" value={extras.reg}
                onChange={(e) => handleExtra("reg", e.target.value.toUpperCase())}
                placeholder="CH/A" className={inputCls}
                style={{ ...inputStyle, borderColor: extras.reg ? "rgba(16,185,129,0.4)" : "var(--color-border)", fontFamily: "monospace" }} />
            </div>
          </div>

          {/* Color + Battery */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Color *</label>
              <select value={form.color} onChange={(e) => handleField("color", e.target.value)} className={inputCls} style={inputStyle}>
                {(IPHONE_COLORS as readonly string[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Battery: <strong style={{ color: form.battery_health >= 85 ? "#10b981" : form.battery_health >= 70 ? "#f59e0b" : "#ef4444" }}>
                  {form.battery_health}%
                </strong>
              </label>
              <input type="range" min={0} max={100} value={form.battery_health}
                onChange={(e) => handleField("battery_health", Number(e.target.value))} className="w-full" />
            </div>
          </div>

          {/* Grade + iOS */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Grade</label>
              <select value={form.grade} onChange={(e) => handleField("grade", e.target.value)} className={inputCls} style={inputStyle}>
                {["A+++", "A++", "A+", "A", "B", "C"].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>iOS Version</label>
              <input type="text" value={form.ios_version} onChange={(e) => handleField("ios_version", e.target.value)}
                placeholder="iOS 18.4" className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Face ID + SIM + Tested */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Face ID</label>
              <select value={form.face_id} onChange={(e) => handleField("face_id", e.target.value)} className={inputCls} style={inputStyle}>
                <option>Working</option><option>Not Working</option><option>N/A</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>SIM Type</label>
              <div className="flex gap-1">
                {SIM_OPTIONS.map((opt) => (
                  <button key={opt} type="button" onClick={() => handleField("sim_status", opt)}
                    className="flex-1 py-2 rounded-lg border text-xs font-bold transition-all"
                    style={{
                      background: form.sim_status === opt ? "rgba(99,102,241,0.2)" : "var(--color-surface-2)",
                      borderColor: form.sim_status === opt ? "rgba(99,102,241,0.5)" : "var(--color-border)",
                      color: form.sim_status === opt ? "#818cf8" : "var(--color-text-muted)",
                    }}>{opt}
                  </button>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                {form.sim_status === "1S1E" ? "1 Physical + 1 eSIM" : form.sim_status === "2E" ? "2 eSIMs" : "2 Physical SIMs"}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Tested</label>
              <select value={form.test_status} onChange={(e) => handleField("test_status", e.target.value)} className={inputCls} style={inputStyle}>
                <option>Fully</option><option>Partially</option><option>Not Tested</option>
              </select>
            </div>
          </div>

          {/* ── Label Extras ── */}
          <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--color-text-faint)" }}>
              Label Extras
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Region Badge</label>
                <div className="flex gap-2">
                  {REGION_BADGES.map((b) => (
                    <button key={b} type="button" onClick={() => handleExtra("region_badge", b)}
                      className="flex-1 py-2 rounded-lg text-sm font-black transition-all"
                      style={{
                        background: "var(--color-surface-2)",
                        border: extras.region_badge === b ? "2px solid var(--color-text)" : "1px solid var(--color-border)",
                        color: extras.region_badge === b ? "var(--color-text)" : "var(--color-text-muted)",
                        fontWeight: extras.region_badge === b ? 900 : 600,
                      }}>{b}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Activation Status <span className="opacity-60">(auto from USB)</span>
                </label>
                <div className="flex gap-2">
                  {["Yes", "No"].map((v) => (
                    <button key={v} type="button" onClick={() => handleExtra("activation", v)}
                      className="flex-1 py-2 rounded-lg border text-sm font-semibold transition-all"
                      style={{
                        background: extras.activation === v ? (v === "Yes" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)") : "var(--color-surface-2)",
                        borderColor: extras.activation === v ? (v === "Yes" ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)") : "var(--color-border)",
                        color: extras.activation === v ? (v === "Yes" ? "#10b981" : "#ef4444") : "var(--color-text-muted)",
                      }}>{v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Batch Number Builder */}
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Batch Number (B.NO) — <span className="font-mono" style={{ color: "#818cf8" }}>{batchNo || "—"}</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>Service Center</span>
                  <select value={extras.batch_prefix} onChange={(e) => handleExtra("batch_prefix", e.target.value)}
                    className={inputCls} style={inputStyle}>
                    {BATCH_PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>Day (auto)</span>
                  <input type="number" min={1} max={31} value={extras.batch_day}
                    onChange={(e) => handleExtra("batch_day", e.target.value)}
                    className={inputCls} style={{ ...inputStyle, fontFamily: "monospace" }} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>Month (auto)</span>
                  <input type="number" min={1} max={12} value={extras.batch_month}
                    onChange={(e) => handleExtra("batch_month", e.target.value)}
                    className={inputCls} style={{ ...inputStyle, fontFamily: "monospace" }} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>Battery</span>
                  <div className="flex gap-1">
                    {BATTERY_TYPES.map((bt) => (
                      <button key={bt} type="button" onClick={() => handleExtra("batch_battery", bt)}
                        className="flex-1 py-2 rounded-lg border text-xs font-bold transition-all"
                        style={{
                          background: extras.batch_battery === bt ? "rgba(99,102,241,0.2)" : "var(--color-surface-2)",
                          borderColor: extras.batch_battery === bt ? "rgba(99,102,241,0.5)" : "var(--color-border)",
                          color: extras.batch_battery === bt ? "#818cf8" : "var(--color-text-muted)",
                        }}>{bt}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    {extras.batch_battery === "FB" ? "Full battery" : "Removed battery"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Status</label>
              <select value={form.status} onChange={(e) => handleField("status", e.target.value)} className={inputCls} style={inputStyle}>
                {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Notes</label>
              <input type="text" value={form.notes} onChange={(e) => handleField("notes", e.target.value)}
                placeholder="Optional notes" className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Action buttons */}
{/* Action buttons */}
<div className="flex flex-wrap gap-3 pt-2">
  <button onClick={handleSaveOnly} disabled={isSaving}
    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border transition-all hover:bg-white/5 disabled:opacity-50"
    style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
    <BookmarkCheck size={15} />{isSaving ? "Saving..." : "Save Only"}
  </button>
  <button onClick={handleSaveAndPrint} disabled={isSaving}
    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
    style={{ background: "var(--color-primary)", color: "white" }}>
    <Save size={15} />{isSaving ? "Saving..." : "Save & Print Label"}
  </button>
  <button onClick={() => handlePrint()}
    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border transition-all hover:bg-white/5"
    style={{ borderColor: "rgba(99,102,241,0.4)", color: "#818cf8" }}>
    <Printer size={15} />Print
  </button>
</div>

          {savedProduct && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border"
              style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)", color: "#10b981" }}>
              <CheckCircle size={13} />
              Saved · IMEI: <span className="font-mono">{savedProduct.imei}</span>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-3">
          <div className="rounded-xl border p-4"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--color-text-faint)" }}>
              Label Preview
            </h3>
            <div className="rounded-lg overflow-hidden" style={{ background: "#e8e8e8", padding: "6px" }}>
              <div style={{ zoom: 0.68 } as React.CSSProperties}>
                <LabelPreview product={previewProduct} extras={labelExtras} showBorder={false} />
              </div>
            </div>
            <p className="text-xs mt-3 text-center" style={{ color: "var(--color-text-faint)" }}>
              Preview scaled · print output is full size
            </p>
          </div>

          <div className="rounded-xl border p-4 space-y-2"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-faint)" }}>
              Auto-fill Status
            </div>
            {([
              { label: "IMEI", value: form.imei, required: true },
              { label: "Serial", value: form.serial_number, required: false },
              { label: "Model", value: form.model, required: true },
              { label: "Storage", value: form.storage, required: true },
              { label: "Model Code", value: form.model_code, required: true },
              { label: "REG", value: extras.reg, required: false },
              { label: "Color", value: form.color, required: true },
              { label: "Battery", value: form.battery_health !== 100 ? `${form.battery_health}%` : null, required: false },
              { label: "Activation", value: extras.activation, required: false },
              { label: "iOS", value: form.ios_version, required: false },
              { label: "B.NO", value: batchNo.length > 4 ? batchNo : null, required: false },
            ] as { label: string; value: string | null; required: boolean }[]).map(({ label, value, required }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--color-text-muted)" }}>
                  {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
                </span>
                <span className="font-mono truncate max-w-[150px] text-right"
                  style={{ color: value ? "#10b981" : "var(--color-text-faint)" }}
                  title={value ?? "—"}>
                  {value || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Off-screen print target */}
      <div ref={printRef} className="label-print-wrapper"
        style={{ position: "fixed", left: "-9999px", top: 0, background: "white" }}>
        <LabelPreview product={previewProduct} extras={labelExtras} showBorder={false} />
      </div>
    </div>
  );
}