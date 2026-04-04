// src/renderer/src/label/LabelPrintArea.tsx
// ============================================================
// UNIFIED PRINT / PNG EXPORT WRAPPER
// ============================================================
// Import this wherever you need a ref-able area to pass to
// useReactToPrint or labelElementToBlob.
//
// Usage (single label):
//   const printRef = useRef<HTMLDivElement>(null)
//   <LabelPrintArea ref={printRef} label={label} />
//
// Usage (multiple labels for batch print):
//   const printRef = useRef<HTMLDivElement>(null)
//   <LabelPrintArea ref={printRef} labels={queue} />

import { forwardRef } from 'react'
import { LabelPreview } from './LabelPreview'
import { toFullProduct, extrasFromQrData } from './labelUtils'
import type { LabelWithProduct, Product } from '../../../types/shared'
import type { LabelExtras } from './LabelPreview'

// ─────────────────────────────────────────────────────────────────────────────

interface SingleProps {
  /** A LabelWithProduct (from the database) */
  label: LabelWithProduct
  /** A full Product + extras if you're coming from CreateLabel */
  product?: never
  extras?: never
  labels?: never
}

interface MultiProps {
  label?: never
  product?: never
  extras?: never
  /** Batch print: array of LabelWithProduct rows */
  labels: LabelWithProduct[]
}

interface ManualProps {
  label?: never
  /** A manually-constructed Product (e.g. from the create form) */
  product: Product
  extras: LabelExtras
  labels?: never
}

type LabelPrintAreaProps = SingleProps | MultiProps | ManualProps

// ─────────────────────────────────────────────────────────────────────────────

export const LabelPrintArea = forwardRef<HTMLDivElement, LabelPrintAreaProps>(
  function LabelPrintArea(props, ref) {

    // Batch print
    if ('labels' in props && props.labels) {
      return (
        <div
          ref={ref}
style={{
  position: 'absolute',
  top: 0,
  left: '-9999px',
  pointerEvents: 'none',
  zIndex: -1,
}}
        >
          {props.labels.map((lbl, i) => (
            <div
              key={lbl.id}
              className="label-print-wrapper"
              style={{ pageBreakAfter: i < props.labels!.length - 1 ? 'always' : 'auto' }}
            >
              <LabelPreview
                product={toFullProduct(lbl)}
                extras={extrasFromQrData(lbl.qr_data)}
                scale={1}
                showBorder={false}
              />
            </div>
          ))}
        </div>
      )
    }

    // Manual product (from create form)
    if ('product' in props && props.product) {
      return (
        <div
          ref={ref}
          className="label-print-wrapper"
style={{
  position: 'absolute',
  top: 0,
  left: '-9999px',
  pointerEvents: 'none',
  zIndex: -1,
}}
        >
          <LabelPreview
            product={props.product}
            extras={props.extras}
            scale={1}
            showBorder={false}
          />
        </div>
      )
    }

    // Single label from DB
    if ('label' in props && props.label) {
      return (
        <div
          ref={ref}
          className="label-print-wrapper"
          style={{
  position: 'absolute',
  top: 0,
  left: '-9999px',
  pointerEvents: 'none',
  zIndex: -1,
}}
        >
          <LabelPreview
            product={toFullProduct(props.label)}
            extras={extrasFromQrData(props.label.qr_data)}
            scale={1}
            showBorder={false}
          />
        </div>
      )
    }

    return null
  }
)