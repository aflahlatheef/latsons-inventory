// src/main/database/repositories/product.repository.ts
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db'
import type { Product, CreateProductDto, UpdateProductDto, ProductFilters, ProductStatus } from '../../../types/shared'

export class ProductRepository {
  create(dto: CreateProductDto): Product {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO products (
        id, imei, model, storage, model_code, color, battery_health, grade,
        face_id, sim_status, test_status, ios_version, serial_number, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      dto.imei,
      dto.model,
      dto.storage,
      dto.model_code,
      dto.color,
      dto.battery_health ?? 100,
      dto.grade ?? 'A++',
      dto.face_id ?? 'Working',
      dto.sim_status ?? 'Unlocked',
      dto.test_status ?? 'Fully',
      dto.ios_version ?? 'iOS 26.2',
      dto.serial_number ?? null,
      dto.status ?? 'available',
      dto.notes ?? null,
      now,
      now
    )

    return this.findById(id)!
  }

  findById(id: string): Product | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    return row ? this.mapRow(row) : null
  }

  findByImei(imei: string): Product | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM products WHERE imei = ?').get(imei)
    return row ? this.mapRow(row) : null
  }

  findAll(filters?: ProductFilters): Product[] {
    const db = getDatabase()
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (filters?.search) {
      conditions.push(`(imei LIKE ? OR model LIKE ? OR serial_number LIKE ? OR model_code LIKE ?)`)
      const term = `%${filters.search}%`
      params.push(term, term, term, term)
    }
    if (filters?.model) {
      conditions.push('model = ?')
      params.push(filters.model)
    }
    if (filters?.status) {
      conditions.push('status = ?')
      params.push(filters.status)
    }
    if (filters?.color) {
      conditions.push('color = ?')
      params.push(filters.color)
    }
    if (filters?.storage) {
      conditions.push('storage = ?')
      params.push(filters.storage)
    }
    if (filters?.dateFrom) {
      conditions.push('DATE(created_at) >= DATE(?)')
      params.push(filters.dateFrom)
    }
    if (filters?.dateTo) {
      conditions.push('DATE(created_at) <= DATE(?)')
      params.push(filters.dateTo)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const orderBy = filters?.orderBy
      ? `ORDER BY ${filters.orderBy} ${filters.orderDir ?? 'DESC'}`
      : 'ORDER BY created_at DESC'
    const limit = filters?.limit ? `LIMIT ${filters.limit}` : ''
    const offset = filters?.offset ? `OFFSET ${filters.offset}` : ''

    const sql = `SELECT * FROM products ${where} ${orderBy} ${limit} ${offset}`
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map(this.mapRow)
  }

  count(filters?: ProductFilters): number {
    const db = getDatabase()
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (filters?.search) {
      conditions.push(`(imei LIKE ? OR model LIKE ? OR serial_number LIKE ? OR model_code LIKE ?)`)
      const term = `%${filters.search}%`
      params.push(term, term, term, term)
    }
    if (filters?.model) { conditions.push('model = ?'); params.push(filters.model) }
    if (filters?.status) { conditions.push('status = ?'); params.push(filters.status) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const row = db.prepare(`SELECT COUNT(*) as count FROM products ${where}`).get(...params) as { count: number }
    return row.count
  }

  update(id: string, dto: UpdateProductDto): Product | null {
    const db = getDatabase()
    const fields: string[] = []
    const params: (string | number | null)[] = []

    const allowed: (keyof UpdateProductDto)[] = [
      'model', 'storage', 'model_code', 'color', 'battery_health',
      'grade', 'face_id', 'sim_status', 'test_status', 'ios_version',
      'serial_number', 'status', 'notes'
    ]

    for (const key of allowed) {
      if (dto[key] !== undefined) {
        fields.push(`${key} = ?`)
        params.push(dto[key] as string | number | null)
      }
    }

    if (fields.length === 0) return this.findById(id)

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())
    params.push(id)

    db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params)
    return this.findById(id)
  }

  updateStatusByImei(imei: string, status: string): Product | null {
    const db = getDatabase()
    db.prepare(`UPDATE products SET status = ?, updated_at = ? WHERE imei = ?`)
      .run(status, new Date().toISOString(), imei)
    return this.findByImei(imei)
  }

  delete(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(id)
    return result.changes > 0
  }

  getStats(): { total: number; available: number; sold: number; reserved: number; damaged: number } {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT status, COUNT(*) as count FROM products GROUP BY status
    `).all() as { status: string; count: number }[]

    const map: Record<string, number> = {}
    for (const r of rows) map[r.status] = r.count

    return {
      total: Object.values(map).reduce((a, b) => a + b, 0),
      available: map['available'] ?? 0,
      sold: map['sold'] ?? 0,
      reserved: map['reserved'] ?? 0,
      damaged: map['damaged'] ?? 0,
    }
  }

  logScan(imei: string, action: string, oldStatus: string | null, newStatus: string | null): void {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO scan_logs (id, imei, action, old_status, new_status)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), imei, action, oldStatus, newStatus)
  }

  private mapRow(row: unknown): Product {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      imei: r.imei as string,
      model: r.model as string,
      storage: r.storage as string,
      model_code: r.model_code as string,
      color: r.color as string,
      battery_health: r.battery_health as number,
      grade: r.grade as string,
      face_id: r.face_id as string,
      sim_status: r.sim_status as string,
      test_status: r.test_status as string,
      ios_version: r.ios_version as string,
      serial_number: r.serial_number as string | null,
      status: r.status as ProductStatus,
      notes: r.notes as string | null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
    }
  }
}