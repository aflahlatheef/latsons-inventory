// src/main/ipc/product.ipc.ts
import { ipcMain } from 'electron'
import { ProductRepository } from '../database/repositories/product.repository'
import type { CreateProductDto, UpdateProductDto, ProductFilters, IpcResponse } from '../../types/shared'

const repo = new ProductRepository()

export function registerProductIpc(): void {
  ipcMain.handle('product:create', async (_, dto: CreateProductDto): Promise<IpcResponse> => {
    try {
      const existing = repo.findByImei(dto.imei)
      if (existing) {
        return { success: false, error: `Product with IMEI ${dto.imei} already exists` }
      }
      const product = repo.create(dto)
      return { success: true, data: product }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('product:findAll', async (_, filters?: ProductFilters): Promise<IpcResponse> => {
    try {
      const products = repo.findAll(filters)
      const total = repo.count(filters)
      return { success: true, data: { products, total } }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('product:findById', async (_, id: string): Promise<IpcResponse> => {
    try {
      const product = repo.findById(id)
      return { success: true, data: product }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('product:findByImei', async (_, imei: string): Promise<IpcResponse> => {
    try {
      const product = repo.findByImei(imei)
      return { success: true, data: { product, found: !!product, imei } }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('product:update', async (_, id: string, dto: UpdateProductDto): Promise<IpcResponse> => {
    try {
      const product = repo.update(id, dto)
      if (!product) return { success: false, error: 'Product not found' }
      return { success: true, data: product }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('product:updateStatus', async (_, imei: string, status: string): Promise<IpcResponse> => {
    try {
      const existing = repo.findByImei(imei)
      if (!existing) return { success: false, error: `Product with IMEI ${imei} not found` }

      repo.logScan(imei, 'status_change', existing.status, status)
      const product = repo.updateStatusByImei(imei, status)
      return { success: true, data: product }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('product:delete', async (_, id: string): Promise<IpcResponse> => {
    try {
      const deleted = repo.delete(id)
      return { success: deleted, error: deleted ? undefined : 'Product not found' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('product:stats', async (): Promise<IpcResponse> => {
    try {
      const stats = repo.getStats()
      return { success: true, data: stats }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}