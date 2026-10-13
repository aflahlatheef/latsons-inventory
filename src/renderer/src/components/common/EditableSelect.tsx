// src/renderer/src/components/common/EditableSelect.tsx
// A "select or type" combobox: click it and you see the full list of
// options (just like a native <select>), but you can also type any
// custom value that isn't in the list.
import { useState, useRef, useEffect } from 'react'

interface EditableSelectProps {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

export function EditableSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  style,
}: EditableSelectProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // If the current value matches one of the presets exactly, or is empty,
  // show the FULL list (like a native select). Otherwise filter by what's
  // typed so far, so custom typing still narrows things down.
  const isExactMatch = options.includes(value)
  const filtered =
    value.trim().length === 0 || isExactMatch
      ? options
      : options.filter((opt) => opt.toLowerCase().includes(value.trim().toLowerCase()))

  const visibleOptions = filtered.length > 0 ? filtered : options

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectOption = (opt: string) => {
    onChange(opt)
    setOpen(false)
    setHighlightIndex(-1)
  }

  return (
    <div ref={wrapperRef} className="relative" style={{ width: '100%' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setHighlightIndex((i) => Math.min(i + 1, visibleOptions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightIndex((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            if (open && highlightIndex >= 0 && visibleOptions[highlightIndex]) {
              e.preventDefault()
              selectOption(visibleOptions[highlightIndex])
            } else {
              setOpen(false)
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        className={className}
        style={{ ...style, paddingRight: 26 }}
        autoComplete="off"
      />

      {/* Visual dropdown arrow — click toggles the list open/closed */}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => {
          e.preventDefault()
          setOpen((o) => !o)
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
      >
        ▾
      </button>

      {open && visibleOptions.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg border shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
        >
          {visibleOptions.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                selectOption(opt)
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center justify-between"
              style={{
                color: 'var(--color-text)',
                background: i === highlightIndex ? 'rgba(99,102,241,0.15)' : 'transparent',
              }}
            >
              <span>{opt}</span>
              {opt === value && <span style={{ color: '#10b981' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}