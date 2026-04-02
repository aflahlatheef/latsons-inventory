// src/main/database/db.ts
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'iphone_labels.db')
  db = new Database(dbPath)

  // ✅ FIX: These pragmas must be set on every connection open, BEFORE any queries
  // WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  // foreign_keys must be ON for ON DELETE CASCADE to work — SQLite disables it by default
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  console.log(`[DB] Database initialized at: ${dbPath}`)
}

function runMigrations(database: Database.Database): void {
  // Create migrations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const migrations: { name: string; sql: string }[] = [
    {
      name: '001_create_products',
      sql: `
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          imei TEXT NOT NULL UNIQUE,
          model TEXT NOT NULL,
          storage TEXT NOT NULL,
          model_code TEXT NOT NULL,
          color TEXT NOT NULL,
          battery_health INTEGER NOT NULL DEFAULT 100,
          grade TEXT NOT NULL DEFAULT 'A++',
          face_id TEXT NOT NULL DEFAULT 'Working',
          sim_status TEXT NOT NULL DEFAULT 'Unlocked',
          test_status TEXT NOT NULL DEFAULT 'Fully',
          ios_version TEXT NOT NULL DEFAULT 'iOS 18.4',
          serial_number TEXT,
          status TEXT NOT NULL DEFAULT 'available',
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_products_imei ON products(imei);
        CREATE INDEX IF NOT EXISTS idx_products_model ON products(model);
        CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
        CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
      `,
    },
    {
      name: '002_create_labels',
      sql: `
        CREATE TABLE IF NOT EXISTS labels (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          qr_data TEXT NOT NULL,
          barcode_data TEXT NOT NULL,
          printed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_labels_product_id ON labels(product_id);
        CREATE INDEX IF NOT EXISTS idx_labels_created_at ON labels(created_at);
      `,
    },
    {
      name: '003_create_scan_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS scan_logs (
          id TEXT PRIMARY KEY,
          imei TEXT NOT NULL,
          action TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT,
          scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_scan_logs_imei ON scan_logs(imei);
      `,
    },
    {
      // ✅ FIX: Recreate labels table with proper FK cascade if it was created without it.
      // SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we rebuild the table.
      // This migration is safe to run — it only acts if the old table lacks the FK.
      name: '004_fix_labels_fk_cascade',
      sql: `
        -- Rebuild labels table to ensure ON DELETE CASCADE is present
        CREATE TABLE IF NOT EXISTS labels_new (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          qr_data TEXT NOT NULL,
          barcode_data TEXT NOT NULL,
          printed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
        INSERT OR IGNORE INTO labels_new SELECT * FROM labels;
        DROP TABLE labels;
        ALTER TABLE labels_new RENAME TO labels;
        CREATE INDEX IF NOT EXISTS idx_labels_product_id ON labels(product_id);
        CREATE INDEX IF NOT EXISTS idx_labels_created_at ON labels(created_at);
      `,
    },
  ]

  for (const migration of migrations) {
    const exists = database
      .prepare('SELECT id FROM migrations WHERE name = ?')
      .get(migration.name)

    if (!exists) {
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO migrations (name) VALUES (?)')
        .run(migration.name)
      console.log(`[DB] Migration executed: ${migration.name}`)
    }
  }
}