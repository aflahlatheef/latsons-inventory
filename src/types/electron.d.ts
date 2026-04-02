import type {
  Product,
  CreateProductDto,
  UpdateProductDto,
  ProductFilters,
  ProductStats,
  IpcResponse
} from "./shared"

export interface ElectronAPI {
  product: {
    findAll: (filters?: ProductFilters) => Promise<IpcResponse<{ products: Product[]; total: number }>>
    stats: () => Promise<IpcResponse<ProductStats>>
    create: (dto: CreateProductDto) => Promise<IpcResponse<Product>>
    update: (id: string, dto: UpdateProductDto) => Promise<IpcResponse<Product>>
    updateStatus: (imei: string, status: string) => Promise<IpcResponse<Product>>
    delete: (id: string) => Promise<IpcResponse<boolean>>
    findByImei: (imei: string) => Promise<IpcResponse<{ product: Product | null }>>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}