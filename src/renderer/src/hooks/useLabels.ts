// src/renderer/src/hooks/useLabels.ts
import { useState, useCallback } from 'react'
import type { Label, CreateLabelDto, LabelWithProduct } from '../../../types/shared'

interface LabelFilters {
  search?: string
  model?: string
  dateFrom?: string
  dateTo?: string
  orderBy?: string
  orderDir?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

interface UseLabelsReturn {
  labels: LabelWithProduct[]
  loading: boolean
  error: string | null
  fetchLabels: (filters?: LabelFilters) => Promise<void>
  createLabel: (dto: CreateLabelDto) => Promise<Label | null>
  markPrinted: (id: string) => Promise<void>
  deleteLabel: (id: string) => Promise<boolean>
}

export function useLabels(): UseLabelsReturn {
  const [labels, setLabels] = useState<LabelWithProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLabels = useCallback(async (filters?: LabelFilters) => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.label.findAll(filters)
      if (res.success && res.data) {
        setLabels(res.data as LabelWithProduct[])
      } else {
        setError(res.error ?? 'Failed to fetch labels')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const createLabel = useCallback(async (dto: CreateLabelDto): Promise<Label | null> => {
    const res = await window.api.label.create(dto)
    if (res.success && res.data) return res.data as Label
    throw new Error(res.error ?? 'Failed to create label')
  }, [])

  const markPrinted = useCallback(async (id: string) => {
    await window.api.label.markPrinted(id)
  }, [])

  const deleteLabel = useCallback(async (id: string): Promise<boolean> => {
    const res = await window.api.label.delete(id)
    return res.success
  }, [])

  return { labels, loading, error, fetchLabels, createLabel, markPrinted, deleteLabel }
}