// src/main/database/repositories/label.repository.ts
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db'
import type { Label, CreateLabelDto } from '../../../types/shared'

export class LabelRepository {
  create(dto: CreateLabelDto): Label {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO labels (id, product_id, qr_data, barcode_data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, dto.product_id, dto.qr_data, dto.barcode_data, now)

    return this.findById(id)!
  }

  findById(id: string): Label | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM labels WHERE id = ?').get(id)
    return row ? this.mapRow(row) : null
  }

  findByProductId(productId: string): Label[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM labels WHERE product_id = ? ORDER BY created_at DESC')
      .all(productId) as Record<string, unknown>[]
    return rows.map(this.mapRow)
  }

  findAllWithProducts(filters?: {
    search?: string
    model?: string
    dateFrom?: string
    dateTo?: string
    orderBy?: string
    orderDir?: 'ASC' | 'DESC'
    limit?: number
    offset?: number
  }): (Label & { product: Record<string, unknown> })[] {
    const db = getDatabase()
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (filters?.search) {
      conditions.push(`(p.imei LIKE ? OR p.model LIKE ? OR p.serial_number LIKE ?)`)
      const term = `%${filters.search}%`
      params.push(term, term, term)
    }
    if (filters?.model) {
      conditions.push('p.model = ?')
      params.push(filters.model)
    }
    if (filters?.dateFrom) {
      conditions.push('DATE(l.created_at) >= DATE(?)')
      params.push(filters.dateFrom)
    }
    if (filters?.dateTo) {
      conditions.push('DATE(l.created_at) <= DATE(?)')
      params.push(filters.dateTo)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const orderCol = filters?.orderBy ?? 'l.created_at'
    const orderDir = filters?.orderDir ?? 'DESC'
    const limit = filters?.limit ? `LIMIT ${filters.limit}` : ''
    const offset = filters?.offset ? `OFFSET ${filters.offset}` : ''

    // ✅ FIX: Removed p.blacklist_status and p.network — those columns don't exist
    // in the products table (they were referenced but never added via migration)
    const sql = `
      SELECT
        l.*,
        p.imei, p.model, p.storage, p.model_code, p.color,
        p.battery_health, p.grade, p.face_id, p.sim_status,
        p.test_status, p.ios_version, p.serial_number, p.status
      FROM labels l
      JOIN products p ON l.product_id = p.id
      ${where}
      ORDER BY ${orderCol} ${orderDir}
      ${limit} ${offset}
    `

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map((row) => ({
      ...this.mapRow(row),
      product: {
        imei: row.imei,
        model: row.model,
        storage: row.storage,
        model_code: row.model_code,
        color: row.color,
        battery_health: row.battery_health,
        grade: row.grade,
        face_id: row.face_id,
        sim_status: row.sim_status,
        test_status: row.test_status,
        ios_version: row.ios_version,
        serial_number: row.serial_number,
        status: row.status,
      },
    }))
  }

  markPrinted(id: string): void {
    const db = getDatabase()
    db.prepare('UPDATE labels SET printed_at = ? WHERE id = ?').run(new Date().toISOString(), id)
  }

  delete(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM labels WHERE id = ?').run(id)
    return result.changes > 0
  }

  private mapRow(row: unknown): Label {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      product_id: r.product_id as string,
      qr_data: r.qr_data as string,
      barcode_data: r.barcode_data as string,
      printed_at: r.printed_at as string | null,
      created_at: r.created_at as string,
    }
  }
}