// src/main/ipc/label.ipc.ts
import { ipcMain } from 'electron'
import { LabelRepository } from '../database/repositories/label.repository'
import type { CreateLabelDto, IpcResponse } from '../../types/shared'

const repo = new LabelRepository()

export function registerLabelIpc(): void {
  ipcMain.handle('label:create', async (_, dto: CreateLabelDto): Promise<IpcResponse> => {
    try {
      const label = repo.create(dto)
      return { success: true, data: label }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('label:findAll', async (_, filters?: {
    search?: string
    model?: string
    dateFrom?: string
    dateTo?: string
    orderBy?: string
    orderDir?: 'ASC' | 'DESC'
    limit?: number
    offset?: number
  }): Promise<IpcResponse> => {
    try {
      const labels = repo.findAllWithProducts(filters)
      return { success: true, data: labels }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('label:findByProduct', async (_, productId: string): Promise<IpcResponse> => {
    try {
      const labels = repo.findByProductId(productId)
      return { success: true, data: labels }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('label:markPrinted', async (_, id: string): Promise<IpcResponse> => {
    try {
      repo.markPrinted(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('label:delete', async (_, id: string): Promise<IpcResponse> => {
    try {
      const deleted = repo.delete(id)
      return { success: deleted, error: deleted ? undefined : 'Label not found' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}