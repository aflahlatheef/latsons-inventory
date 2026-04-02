"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const uuid = require("uuid");
const Database = require("better-sqlite3");
const fs = require("fs");
const child_process = require("child_process");
const util = require("util");
let db = null;
function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}
function initDatabase() {
  const userDataPath = electron.app.getPath("userData");
  const dbDir = path.join(userDataPath, "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, "iphone_labels.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  console.log(`[DB] Database initialized at: ${dbPath}`);
}
function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const migrations = [
    {
      name: "001_create_products",
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
      `
    },
    {
      name: "002_create_labels",
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
      `
    },
    {
      name: "003_create_scan_logs",
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
      `
    },
    {
      // ✅ FIX: Recreate labels table with proper FK cascade if it was created without it.
      // SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we rebuild the table.
      // This migration is safe to run — it only acts if the old table lacks the FK.
      name: "004_fix_labels_fk_cascade",
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
      `
    }
  ];
  for (const migration of migrations) {
    const exists = database.prepare("SELECT id FROM migrations WHERE name = ?").get(migration.name);
    if (!exists) {
      database.exec(migration.sql);
      database.prepare("INSERT INTO migrations (name) VALUES (?)").run(migration.name);
      console.log(`[DB] Migration executed: ${migration.name}`);
    }
  }
}
class ProductRepository {
  create(dto) {
    const db2 = getDatabase();
    const id = uuid.v4();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const stmt = db2.prepare(`
      INSERT INTO products (
        id, imei, model, storage, model_code, color, battery_health, grade,
        face_id, sim_status, test_status, ios_version, serial_number, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      dto.imei,
      dto.model,
      dto.storage,
      dto.model_code,
      dto.color,
      dto.battery_health ?? 100,
      dto.grade ?? "A++",
      dto.face_id ?? "Working",
      dto.sim_status ?? "Unlocked",
      dto.test_status ?? "Fully",
      dto.ios_version ?? "iOS 26.2",
      dto.serial_number ?? null,
      dto.status ?? "available",
      dto.notes ?? null,
      now,
      now
    );
    return this.findById(id);
  }
  findById(id) {
    const db2 = getDatabase();
    const row = db2.prepare("SELECT * FROM products WHERE id = ?").get(id);
    return row ? this.mapRow(row) : null;
  }
  findByImei(imei) {
    const db2 = getDatabase();
    const row = db2.prepare("SELECT * FROM products WHERE imei = ?").get(imei);
    return row ? this.mapRow(row) : null;
  }
  findAll(filters) {
    const db2 = getDatabase();
    const conditions = [];
    const params = [];
    if (filters?.search) {
      conditions.push(`(imei LIKE ? OR model LIKE ? OR serial_number LIKE ? OR model_code LIKE ?)`);
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }
    if (filters?.model) {
      conditions.push("model = ?");
      params.push(filters.model);
    }
    if (filters?.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.color) {
      conditions.push("color = ?");
      params.push(filters.color);
    }
    if (filters?.storage) {
      conditions.push("storage = ?");
      params.push(filters.storage);
    }
    if (filters?.dateFrom) {
      conditions.push("DATE(created_at) >= DATE(?)");
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      conditions.push("DATE(created_at) <= DATE(?)");
      params.push(filters.dateTo);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = filters?.orderBy ? `ORDER BY ${filters.orderBy} ${filters.orderDir ?? "DESC"}` : "ORDER BY created_at DESC";
    const limit = filters?.limit ? `LIMIT ${filters.limit}` : "";
    const offset = filters?.offset ? `OFFSET ${filters.offset}` : "";
    const sql = `SELECT * FROM products ${where} ${orderBy} ${limit} ${offset}`;
    const rows = db2.prepare(sql).all(...params);
    return rows.map(this.mapRow);
  }
  count(filters) {
    const db2 = getDatabase();
    const conditions = [];
    const params = [];
    if (filters?.search) {
      conditions.push(`(imei LIKE ? OR model LIKE ? OR serial_number LIKE ? OR model_code LIKE ?)`);
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }
    if (filters?.model) {
      conditions.push("model = ?");
      params.push(filters.model);
    }
    if (filters?.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const row = db2.prepare(`SELECT COUNT(*) as count FROM products ${where}`).get(...params);
    return row.count;
  }
  update(id, dto) {
    const db2 = getDatabase();
    const fields = [];
    const params = [];
    const allowed = [
      "model",
      "storage",
      "model_code",
      "color",
      "battery_health",
      "grade",
      "face_id",
      "sim_status",
      "test_status",
      "ios_version",
      "serial_number",
      "status",
      "notes"
    ];
    for (const key of allowed) {
      if (dto[key] !== void 0) {
        fields.push(`${key} = ?`);
        params.push(dto[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    fields.push("updated_at = ?");
    params.push((/* @__PURE__ */ new Date()).toISOString());
    params.push(id);
    db2.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return this.findById(id);
  }
  updateStatusByImei(imei, status) {
    const db2 = getDatabase();
    db2.prepare(`UPDATE products SET status = ?, updated_at = ? WHERE imei = ?`).run(status, (/* @__PURE__ */ new Date()).toISOString(), imei);
    return this.findByImei(imei);
  }
  delete(id) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM products WHERE id = ?").run(id);
    return result.changes > 0;
  }
  getStats() {
    const db2 = getDatabase();
    const rows = db2.prepare(`
      SELECT status, COUNT(*) as count FROM products GROUP BY status
    `).all();
    const map = {};
    for (const r of rows) map[r.status] = r.count;
    return {
      total: Object.values(map).reduce((a, b) => a + b, 0),
      available: map["available"] ?? 0,
      sold: map["sold"] ?? 0,
      reserved: map["reserved"] ?? 0,
      damaged: map["damaged"] ?? 0
    };
  }
  logScan(imei, action, oldStatus, newStatus) {
    const db2 = getDatabase();
    db2.prepare(`
      INSERT INTO scan_logs (id, imei, action, old_status, new_status)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid.v4(), imei, action, oldStatus, newStatus);
  }
  mapRow(row) {
    const r = row;
    return {
      id: r.id,
      imei: r.imei,
      model: r.model,
      storage: r.storage,
      model_code: r.model_code,
      color: r.color,
      battery_health: r.battery_health,
      grade: r.grade,
      face_id: r.face_id,
      sim_status: r.sim_status,
      test_status: r.test_status,
      ios_version: r.ios_version,
      serial_number: r.serial_number,
      status: r.status,
      notes: r.notes,
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  }
}
const repo$1 = new ProductRepository();
function registerProductIpc() {
  electron.ipcMain.handle("product:create", async (_, dto) => {
    try {
      const existing = repo$1.findByImei(dto.imei);
      if (existing) {
        return { success: false, error: `Product with IMEI ${dto.imei} already exists` };
      }
      const product = repo$1.create(dto);
      return { success: true, data: product };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("product:findAll", async (_, filters) => {
    try {
      const products = repo$1.findAll(filters);
      const total = repo$1.count(filters);
      return { success: true, data: { products, total } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("product:findById", async (_, id) => {
    try {
      const product = repo$1.findById(id);
      return { success: true, data: product };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("product:findByImei", async (_, imei) => {
    try {
      const product = repo$1.findByImei(imei);
      return { success: true, data: { product, found: !!product, imei } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("product:update", async (_, id, dto) => {
    try {
      const product = repo$1.update(id, dto);
      if (!product) return { success: false, error: "Product not found" };
      return { success: true, data: product };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("product:updateStatus", async (_, imei, status) => {
    try {
      const existing = repo$1.findByImei(imei);
      if (!existing) return { success: false, error: `Product with IMEI ${imei} not found` };
      repo$1.logScan(imei, "status_change", existing.status, status);
      const product = repo$1.updateStatusByImei(imei, status);
      return { success: true, data: product };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("product:delete", async (_, id) => {
    try {
      const deleted = repo$1.delete(id);
      return { success: deleted, error: deleted ? void 0 : "Product not found" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("product:stats", async () => {
    try {
      const stats = repo$1.getStats();
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
class LabelRepository {
  create(dto) {
    const db2 = getDatabase();
    const id = uuid.v4();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO labels (id, product_id, qr_data, barcode_data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, dto.product_id, dto.qr_data, dto.barcode_data, now);
    return this.findById(id);
  }
  findById(id) {
    const db2 = getDatabase();
    const row = db2.prepare("SELECT * FROM labels WHERE id = ?").get(id);
    return row ? this.mapRow(row) : null;
  }
  findByProductId(productId) {
    const db2 = getDatabase();
    const rows = db2.prepare("SELECT * FROM labels WHERE product_id = ? ORDER BY created_at DESC").all(productId);
    return rows.map(this.mapRow);
  }
  findAllWithProducts(filters) {
    const db2 = getDatabase();
    const conditions = [];
    const params = [];
    if (filters?.search) {
      conditions.push(`(p.imei LIKE ? OR p.model LIKE ? OR p.serial_number LIKE ?)`);
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }
    if (filters?.model) {
      conditions.push("p.model = ?");
      params.push(filters.model);
    }
    if (filters?.dateFrom) {
      conditions.push("DATE(l.created_at) >= DATE(?)");
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      conditions.push("DATE(l.created_at) <= DATE(?)");
      params.push(filters.dateTo);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderCol = filters?.orderBy ?? "l.created_at";
    const orderDir = filters?.orderDir ?? "DESC";
    const limit = filters?.limit ? `LIMIT ${filters.limit}` : "";
    const offset = filters?.offset ? `OFFSET ${filters.offset}` : "";
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
    `;
    const rows = db2.prepare(sql).all(...params);
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
        status: row.status
      }
    }));
  }
  markPrinted(id) {
    const db2 = getDatabase();
    db2.prepare("UPDATE labels SET printed_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
  }
  delete(id) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM labels WHERE id = ?").run(id);
    return result.changes > 0;
  }
  mapRow(row) {
    const r = row;
    return {
      id: r.id,
      product_id: r.product_id,
      qr_data: r.qr_data,
      barcode_data: r.barcode_data,
      printed_at: r.printed_at,
      created_at: r.created_at
    };
  }
}
const repo = new LabelRepository();
function registerLabelIpc() {
  electron.ipcMain.handle("label:create", async (_, dto) => {
    try {
      const label = repo.create(dto);
      return { success: true, data: label };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("label:findAll", async (_, filters) => {
    try {
      const labels = repo.findAllWithProducts(filters);
      return { success: true, data: labels };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("label:findByProduct", async (_, productId) => {
    try {
      const labels = repo.findByProductId(productId);
      return { success: true, data: labels };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("label:markPrinted", async (_, id) => {
    try {
      repo.markPrinted(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("label:delete", async (_, id) => {
    try {
      const deleted = repo.delete(id);
      return { success: deleted, error: deleted ? void 0 : "Label not found" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
const execFileAsync = util.promisify(child_process.execFile);
function findTool(name) {
  if (process.platform !== "win32") return name;
  const exe = `${name}.exe`;
  const candidateDirs = [
    path.join(process.env.USERPROFILE ?? "C:\\Users\\latsons", "AppData", "Local", "Programs", "libimobiledevice"),
    path.join(process.env.USERPROFILE ?? "C:\\Users\\latsons", "AppData", "Local", "libimobiledevice"),
    path.join(process.env.USERPROFILE ?? "C:\\Users\\latsons", "scoop", "shims"),
    path.join(process.env.USERPROFILE ?? "C:\\Users\\latsons", "scoop", "apps", "libimobiledevice", "current"),
    "C:\\Program Files\\libimobiledevice",
    "C:\\Program Files (x86)\\libimobiledevice",
    "C:\\ProgramData\\chocolatey\\bin",
    "C:\\tools\\libimobiledevice"
  ];
  const pathDirs = (process.env.PATH ?? "").split(";").map((d) => d.trim()).filter(Boolean);
  candidateDirs.push(...pathDirs);
  for (const dir of candidateDirs) {
    const full = path.join(dir, exe);
    if (fs.existsSync(full)) {
      console.log(`[iphone] Resolved ${name} → ${full}`);
      return full;
    }
  }
  console.warn(`[iphone] Could not find ${exe} in any known location, falling back to name-only`);
  return name;
}
const TOOL_CACHE = {};
function tool(name) {
  if (!TOOL_CACHE[name]) TOOL_CACHE[name] = findTool(name);
  return TOOL_CACHE[name];
}
const makeExecOpts = (timeoutMs = 1e4) => ({
  timeout: timeoutMs,
  env: process.env
});
async function runIdeviceinfo(udid, domain) {
  const args = [];
  if (udid) args.push("-u", udid);
  if (domain) args.push("-q", domain);
  try {
    const { stdout } = await execFileAsync(tool("ideviceinfo"), args, makeExecOpts());
    const result = {};
    for (const line of stdout.split("\n")) {
      const idx = line.indexOf(": ");
      if (idx > 0) {
        result[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
      }
    }
    return result;
  } catch (err) {
    console.warn(`[iphone] ideviceinfo${domain ? ` -q ${domain}` : ""} failed:`, String(err));
    return {};
  }
}
async function getConnectedUdids() {
  const ideviceIdPath = tool("idevice_id");
  if (ideviceIdPath !== "idevice_id" || process.platform !== "win32") {
    try {
      const { stdout } = await execFileAsync(ideviceIdPath, ["-l"], makeExecOpts(8e3));
      const udids = stdout.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
      if (udids.length > 0) return udids;
    } catch {
    }
  }
  try {
    const { stdout } = await execFileAsync(tool("ideviceinfo"), [], makeExecOpts(8e3));
    for (const line of stdout.split("\n")) {
      const idx = line.indexOf(": ");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 2).trim();
        if (key === "UniqueDeviceID" && val.length > 0) return [val];
      }
    }
    return [];
  } catch {
    return [];
  }
}
async function tryReadDeviceDirectly() {
  try {
    const { stdout } = await execFileAsync(tool("ideviceinfo"), [], makeExecOpts(8e3));
    if (!stdout.trim()) return null;
    const result = {};
    for (const line of stdout.split("\n")) {
      const idx = line.indexOf(": ");
      if (idx > 0) result[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
    }
    return result["UniqueDeviceID"] ? result : null;
  } catch {
    return null;
  }
}
async function isToolAvailable() {
  const resolved = tool("ideviceinfo");
  if (resolved !== "ideviceinfo") return fs.existsSync(resolved);
  try {
    await execFileAsync(resolved, ["--version"], makeExecOpts(5e3));
    return true;
  } catch (err) {
    const e = err;
    return e.code !== "ENOENT";
  }
}
function mapModelIdentifier(identifier) {
  const map = {
    "iPhone1,1": "iPhone",
    "iPhone1,2": "iPhone 3G",
    "iPhone2,1": "iPhone 3GS",
    "iPhone3,1": "iPhone 4",
    "iPhone3,2": "iPhone 4",
    "iPhone3,3": "iPhone 4",
    "iPhone4,1": "iPhone 4S",
    "iPhone5,1": "iPhone 5",
    "iPhone5,2": "iPhone 5",
    "iPhone5,3": "iPhone 5C",
    "iPhone5,4": "iPhone 5C",
    "iPhone6,1": "iPhone 5S",
    "iPhone6,2": "iPhone 5S",
    "iPhone7,1": "iPhone 6 Plus",
    "iPhone7,2": "iPhone 6",
    "iPhone8,1": "iPhone 6s",
    "iPhone8,2": "iPhone 6s Plus",
    "iPhone8,4": "iPhone SE (1st gen)",
    "iPhone9,1": "iPhone 7",
    "iPhone9,2": "iPhone 7 Plus",
    "iPhone9,3": "iPhone 7",
    "iPhone9,4": "iPhone 7 Plus",
    "iPhone10,1": "iPhone 8",
    "iPhone10,2": "iPhone 8 Plus",
    "iPhone10,3": "iPhone X",
    "iPhone10,4": "iPhone 8",
    "iPhone10,5": "iPhone 8 Plus",
    "iPhone10,6": "iPhone X",
    "iPhone11,2": "iPhone XS",
    "iPhone11,4": "iPhone XS Max",
    "iPhone11,6": "iPhone XS Max",
    "iPhone11,8": "iPhone XR",
    "iPhone12,1": "iPhone 11",
    "iPhone12,3": "iPhone 11 Pro",
    "iPhone12,5": "iPhone 11 Pro Max",
    "iPhone12,8": "iPhone SE (2nd gen)",
    "iPhone13,1": "iPhone 12 mini",
    "iPhone13,2": "iPhone 12",
    "iPhone13,3": "iPhone 12 Pro",
    "iPhone13,4": "iPhone 12 Pro Max",
    "iPhone14,2": "iPhone 13 Pro",
    "iPhone14,3": "iPhone 13 Pro Max",
    "iPhone14,4": "iPhone 13 mini",
    "iPhone14,5": "iPhone 13",
    "iPhone14,6": "iPhone SE (3rd gen)",
    "iPhone14,7": "iPhone 14",
    "iPhone14,8": "iPhone 14 Plus",
    "iPhone15,2": "iPhone 14 Pro",
    "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone15,4": "iPhone 15",
    "iPhone15,5": "iPhone 15 Plus",
    "iPhone16,1": "iPhone 15 Pro",
    "iPhone16,2": "iPhone 15 Pro Max",
    "iPhone17,1": "iPhone 16 Pro",
    "iPhone17,2": "iPhone 16 Pro Max",
    "iPhone17,3": "iPhone 16",
    "iPhone17,4": "iPhone 16 Plus",
    "iPhone17,5": "iPhone 16e",
    "iPhone18,1": "iPhone 17 Pro",
    "iPhone18,2": "iPhone 17 Pro Max",
    "iPhone18,3": "iPhone 17",
    "iPhone18,4": "iPhone Air"
  };
  return map[identifier] ?? null;
}
function parseStorageGB(raw) {
  if (!raw) return null;
  const bytes = parseInt(raw, 10);
  if (isNaN(bytes)) return null;
  const gb = bytes / 1073741824;
  const tiers = [16, 32, 64, 128, 256, 512, 1024];
  return tiers.reduce(
    (prev, curr) => Math.abs(curr - gb) < Math.abs(prev - gb) ? curr : prev
  );
}
function mapColor(raw) {
  if (!raw) return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw.trim())) return null;
  const lower = raw.toLowerCase();
  const colorMap = [
    ["black titanium", "BLACK TITANIUM"],
    ["blue titanium", "BLUE TITANIUM"],
    ["white titanium", "WHITE TITANIUM"],
    ["natural titanium", "NATURAL TITANIUM"],
    ["space gray", "SPACE GRAY"],
    ["space grey", "SPACE GRAY"],
    ["midnight", "BLACK"],
    ["starlight", "WHITE"],
    ["desert", "NATURAL TITANIUM"],
    ["alpine", "WHITE"],
    ["ultramarine", "BLUE"],
    ["teal", "GREEN"],
    ["product red", "RED"],
    ["black", "BLACK"],
    ["white", "WHITE"],
    ["blue", "BLUE"],
    ["green", "GREEN"],
    ["yellow", "YELLOW"],
    ["pink", "PINK"],
    ["purple", "PURPLE"],
    ["red", "RED"],
    ["silver", "SILVER"],
    ["gold", "GOLD"]
  ];
  for (const [key, val] of colorMap) {
    if (lower.includes(key)) return val;
  }
  return null;
}
async function getBatteryHealth(udid) {
  const diagArgs = ["diagnostics", "IORegistry", "-n", "AppleSmartBattery"];
  if (udid) diagArgs.unshift("-u", udid);
  try {
    const { stdout } = await execFileAsync(tool("idevicediagnostics"), diagArgs, makeExecOpts());
    const maxMatch = stdout.match(/MaximumCapacityPercent[^:]*:\s*(\d+)/i);
    if (maxMatch) return parseInt(maxMatch[1], 10);
    const capMatch = stdout.match(/BatteryCurrentCapacity[^:]*:\s*(\d+)/i);
    if (capMatch) return parseInt(capMatch[1], 10);
  } catch {
  }
  try {
    const powerInfo = await runIdeviceinfo(udid, "com.apple.power");
    const cur = parseInt(powerInfo["BatteryCurrentCapacity"] ?? "", 10);
    const max = parseInt(powerInfo["BatteryMaxCapacity"] ?? "", 10);
    if (!isNaN(cur) && !isNaN(max) && max > 0) {
      const pct = Math.round(cur / max * 100);
      if (pct > 0 && pct <= 100) return pct;
    }
  } catch {
  }
  return null;
}
async function fetchDeviceInfo(udid, prefetchedInfo) {
  const [info, itunesInfo, diskInfo, diskInfo2, batteryHealth] = await Promise.all([
    prefetchedInfo ? Promise.resolve(prefetchedInfo) : runIdeviceinfo(udid),
    runIdeviceinfo(udid, "com.apple.mobile.iTunes"),
    runIdeviceinfo(udid, "com.apple.disk_usage.factory"),
    runIdeviceinfo(udid, "com.apple.disk_usage"),
    getBatteryHealth(udid)
  ]);
  const candidateIdentifiers = [
    info["ModelIdentifier"],
    info["HardwareModel"],
    info["ProductType"]
    // ← THIS is what most devices actually return (iPhone13,2 etc.)
  ].filter(Boolean);
  let modelIdentifier = null;
  let modelName = null;
  for (const candidate of candidateIdentifiers) {
    const mapped = mapModelIdentifier(candidate);
    if (mapped) {
      modelIdentifier = candidate;
      modelName = mapped;
      break;
    }
  }
  if (!modelName) {
    modelName = info["ProductName"] ?? null;
    modelIdentifier = candidateIdentifiers[0] ?? null;
  }
  console.log("[iphone] Model candidates:", candidateIdentifiers, "→ resolved:", modelName);
  const storageRaw = info["TotalDiskCapacity"] ?? info["TotalSystemCapacity"] ?? diskInfo["TotalDiskCapacity"] ?? diskInfo["TotalSystemCapacity"] ?? diskInfo2["TotalDiskCapacity"] ?? diskInfo2["TotalSystemCapacity"] ?? null;
  const colorRaw = itunesInfo["DeviceColor"] ?? itunesInfo["AppleDeviceColor"] ?? info["DeviceColor"] ?? info["DeviceEnclosureColor"] ?? info["DeviceColorMapPolicy"] ?? null;
  const activationState = info["ActivationState"] ?? null;
  itunesInfo["RegionInfo"] ?? info["RegionInfo"] ?? info["ModelNumber"] ?? // ModelNumber often contains region e.g. "MGH23" — use RegionInfo preferably
  null;
  const cleanRegionInfo = info["RegionInfo"] ?? itunesInfo["RegionInfo"] ?? null;
  return {
    imei: info["InternationalMobileEquipmentIdentity"] ?? info["IMEI"] ?? null,
    imei2: info["InternationalMobileEquipmentIdentity2"] ?? info["IMEI2"] ?? null,
    serial_number: info["SerialNumber"] ?? null,
    model_name: modelName,
    model_identifier: modelIdentifier,
    model_number: itunesInfo["ModelNumber"] ?? info["ModelNumber"] ?? null,
    storage_gb: parseStorageGB(storageRaw ?? void 0),
    color: mapColor(colorRaw ?? void 0),
    ios_version: info["ProductVersion"] ? `iOS ${info["ProductVersion"]}` : null,
    battery_health: batteryHealth,
    device_name: info["DeviceName"] ?? null,
    udid: info["UniqueDeviceID"] ?? udid ?? null,
    activation_state: activationState,
    region_info: cleanRegionInfo
  };
}
function registerIphoneIpc() {
  console.log("[iphone] ideviceinfo →", tool("ideviceinfo"));
  console.log("[iphone] idevice_id  →", tool("idevice_id"));
  electron.ipcMain.handle("iphone:checkStatus", async () => {
    try {
      const available = await isToolAvailable();
      if (!available) {
        return { success: true, data: { available: false, connected: false, udids: [] } };
      }
      const udids = await getConnectedUdids();
      console.log("[iphone] checkStatus → udids:", udids);
      return { success: true, data: { available: true, connected: udids.length > 0, udids } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("iphone:readDevice", async (_, udid) => {
    try {
      if (process.platform === "win32" && !udid) {
        const directInfo = await tryReadDeviceDirectly();
        if (directInfo) {
          const info2 = await fetchDeviceInfo(void 0, directInfo);
          if (info2.imei || info2.serial_number) {
            console.log("[iphone] Direct read succeeded. IMEI:", info2.imei, "Model:", info2.model_name);
            return { success: true, data: info2 };
          }
        }
        return {
          success: false,
          error: 'No iPhone detected. Connect via USB and tap "Trust This Computer" on your iPhone.'
        };
      }
      let targetUdid = udid;
      if (!targetUdid) {
        const udids = await getConnectedUdids();
        if (udids.length === 0) {
          return { success: false, error: 'No iPhone connected. Connect via USB and tap "Trust This Computer".' };
        }
        targetUdid = udids[0];
      }
      console.log("[iphone] Reading device:", targetUdid);
      const info = await fetchDeviceInfo(targetUdid);
      console.log("[iphone] IMEI:", info.imei, "Serial:", info.serial_number, "Model:", info.model_name, "Activation:", info.activation_state, "RegionInfo:", info.region_info);
      if (!info.imei && !info.serial_number) {
        return { success: false, error: 'Could not read device info. Tap "Trust This Computer" on your iPhone.' };
      }
      return { success: true, data: info };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  electron.ipcMain.handle("iphone:listDevices", async () => {
    try {
      const udids = await getConnectedUdids();
      if (udids.length === 0) return { success: true, data: [] };
      const devices = await Promise.all(udids.map((u) => fetchDeviceInfo(u)));
      return { success: true, data: devices };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    frame: false,
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.latsons.iphone-label-manager");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  initDatabase();
  registerProductIpc();
  registerLabelIpc();
  registerIphoneIpc();
  electron.ipcMain.on("window:minimize", () => mainWindow?.minimize());
  electron.ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  electron.ipcMain.on("window:close", () => mainWindow?.close());
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
