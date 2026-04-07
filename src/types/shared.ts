// src/types/shared.ts
export interface Product {
  id: string
  imei: string
  model: string
  storage: string
  model_code: string
  color: string
  battery_health: number
  grade: string
  face_id: string
  sim_status: string
  test_status: string
  ios_version: string
  serial_number: string | null
  status: ProductStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProductStatus = 'available' | 'sold' | 'reserved' | 'damaged' | 'returned'

export interface CreateProductDto {
  imei: string
  model: string
  storage: string
  model_code: string
  color: string
  battery_health?: number
  grade?: string
  face_id?: string
  sim_status?: string
  test_status?: string
  ios_version?: string
  serial_number?: string
  status?: ProductStatus
  notes?: string
}

export type UpdateProductDto = Partial<Omit<CreateProductDto, 'imei'>>

export interface ProductFilters {
  search?: string
  model?: string
  status?: ProductStatus
  color?: string
  storage?: string
  dateFrom?: string
  dateTo?: string
  orderBy?: string
  orderDir?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface Label {
  id: string
  product_id: string
  qr_data: string
  barcode_data: string
  printed_at: string | null
  created_at: string
}

export interface CreateLabelDto {
  product_id: string
  qr_data: string
  barcode_data: string
}

export interface LabelWithProduct extends Label {
  product: Omit<Product, 'id' | 'notes' | 'created_at' | 'updated_at'>
}

export interface ProductStats {
  total: number
  available: number
  sold: number
  reserved: number
  damaged: number
}

export interface ScanResult {
  product: Product | null
  found: boolean
  imei: string
}

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export const IPHONE_MODELS = [
  // iPhone 16 series (added — iphone.ipc.ts maps iPhone17,x → these names)
  'iPhone 16 Pro Max',
  'iPhone 16 Pro',
  'iPhone 16 Plus',
  'iPhone 16',
  // iPhone 15 series
  'iPhone 15 Pro Max',
  'iPhone 15 Pro',
  'iPhone 15 Plus',
  'iPhone 15',
  // iPhone 14 series
  'iPhone 14 Pro Max',
  'iPhone 14 Pro',
  'iPhone 14 Plus',
  'iPhone 14',
  // iPhone 13 series
  'iPhone 13 Pro Max',
  'iPhone 13 Pro',
  'iPhone 13',
  'iPhone 13 mini',
  // iPhone 12 series
  'iPhone 12 Pro Max',
  'iPhone 12 Pro',
  'iPhone 12',
  'iPhone 12 mini',
  // iPhone 11 series
  'iPhone 11 Pro Max',
  'iPhone 11 Pro',
  'iPhone 11',
  // iPhone SE
  'iPhone SE (3rd gen)',
  'iPhone SE (2nd gen)',
] as const

export const IPHONE_STORAGE = ['64 GB', '128 GB', '256 GB', '512 GB', '1 TB'] as const

export const IPHONE_COLORS = [
  'BLACK',
  'WHITE',
  'BLUE',
  'GREEN',
  'YELLOW',
  'PINK',
  'PURPLE',
  'RED',
  'SILVER',
  'GOLD',
  'SPACE GRAY',
  'NATURAL',
  'BLUE',
  'WHITE',
  'GRAPHITE'
] as const

export const PRODUCT_STATUSES: ProductStatus[] = [
  'available',
  'sold',
  'reserved',
  'damaged',
  'returned',
]