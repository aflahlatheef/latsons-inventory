// src/main/ipc/iphone.ipc.ts
import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

function findTool(name: string): string {
  if (process.platform !== 'win32') return name
  const exe = `${name}.exe`
  const candidateDirs: string[] = [
    join(process.env.USERPROFILE ?? 'C:\\Users\\latsons', 'AppData', 'Local', 'Programs', 'libimobiledevice'),
    join(process.env.USERPROFILE ?? 'C:\\Users\\latsons', 'AppData', 'Local', 'libimobiledevice'),
    join(process.env.USERPROFILE ?? 'C:\\Users\\latsons', 'scoop', 'shims'),
    join(process.env.USERPROFILE ?? 'C:\\Users\\latsons', 'scoop', 'apps', 'libimobiledevice', 'current'),
    'C:\\Program Files\\libimobiledevice',
    'C:\\Program Files (x86)\\libimobiledevice',
    'C:\\ProgramData\\chocolatey\\bin',
    'C:\\tools\\libimobiledevice',
  ]
  const pathDirs = (process.env.PATH ?? '').split(';').map(d => d.trim()).filter(Boolean)
  candidateDirs.push(...pathDirs)
  for (const dir of candidateDirs) {
    const full = join(dir, exe)
    if (existsSync(full)) {
      console.log(`[iphone] Resolved ${name} → ${full}`)
      return full
    }
  }
  console.warn(`[iphone] Could not find ${exe} in any known location, falling back to name-only`)
  return name
}

const TOOL_CACHE: Record<string, string> = {}
function tool(name: string): string {
  if (!TOOL_CACHE[name]) TOOL_CACHE[name] = findTool(name)
  return TOOL_CACHE[name]
}

const makeExecOpts = (timeoutMs = 10_000) => ({
  timeout: timeoutMs,
  env: process.env,
})

export interface IphoneDeviceInfo {
  imei: string | null
  imei2: string | null
  serial_number: string | null
  model_name: string | null
  model_identifier: string | null
  model_number: string | null
  storage_gb: number | null
  color: string | null
  ios_version: string | null
  battery_health: number | null
  device_name: string | null
  udid: string | null
  // ── NEW fields ──────────────────────────────────────────────────────────────
  activation_state: string | null   // e.g. "Activated"
  region_info: string | null        // e.g. "CH/A"
}

async function runIdeviceinfo(
  udid?: string,
  domain?: string,
): Promise<Record<string, string>> {
  const args: string[] = []
  if (udid) args.push('-u', udid)
  if (domain) args.push('-q', domain)
  try {
    const { stdout } = await execFileAsync(tool('ideviceinfo'), args, makeExecOpts())
    const result: Record<string, string> = {}
    for (const line of stdout.split('\n')) {
      const idx = line.indexOf(': ')
      if (idx > 0) {
        result[line.slice(0, idx).trim()] = line.slice(idx + 2).trim()
      }
    }
    return result
  } catch (err) {
    console.warn(`[iphone] ideviceinfo${domain ? ` -q ${domain}` : ''} failed:`, String(err))
    return {}
  }
}

async function getConnectedUdids(): Promise<string[]> {
  const ideviceIdPath = tool('idevice_id')
  if (ideviceIdPath !== 'idevice_id' || process.platform !== 'win32') {
    try {
      const { stdout } = await execFileAsync(ideviceIdPath, ['-l'], makeExecOpts(8_000))
      const udids = stdout.split('\n').map(s => s.trim()).filter(s => s.length > 0)
      if (udids.length > 0) return udids
    } catch { /* fall through */ }
  }
  try {
    const { stdout } = await execFileAsync(tool('ideviceinfo'), [], makeExecOpts(8_000))
    for (const line of stdout.split('\n')) {
      const idx = line.indexOf(': ')
      if (idx > 0) {
        const key = line.slice(0, idx).trim()
        const val = line.slice(idx + 2).trim()
        if (key === 'UniqueDeviceID' && val.length > 0) return [val]
      }
    }
    return []
  } catch {
    return []
  }
}

async function tryReadDeviceDirectly(): Promise<Record<string, string> | null> {
  try {
    const { stdout } = await execFileAsync(tool('ideviceinfo'), [], makeExecOpts(8_000))
    if (!stdout.trim()) return null
    const result: Record<string, string> = {}
    for (const line of stdout.split('\n')) {
      const idx = line.indexOf(': ')
      if (idx > 0) result[line.slice(0, idx).trim()] = line.slice(idx + 2).trim()
    }
    return result['UniqueDeviceID'] ? result : null
  } catch {
    return null
  }
}

async function isToolAvailable(): Promise<boolean> {
  const resolved = tool('ideviceinfo')
  if (resolved !== 'ideviceinfo') return existsSync(resolved)
  try {
    await execFileAsync(resolved, ['--version'], makeExecOpts(5_000))
    return true
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    return e.code !== 'ENOENT'
  }
}

// ─── COMPLETE model identifier map ───────────────────────────────────────────
// ProductType from ideviceinfo (e.g. iPhone13,2 = iPhone 12)
function mapModelIdentifier(identifier: string): string | null {
  const map: Record<string, string> = {
    'iPhone1,1':  'iPhone',
    'iPhone1,2':  'iPhone 3G',
    'iPhone2,1':  'iPhone 3GS',
    'iPhone3,1':  'iPhone 4',
    'iPhone3,2':  'iPhone 4',
    'iPhone3,3':  'iPhone 4',
    'iPhone4,1':  'iPhone 4S',
    'iPhone5,1':  'iPhone 5',
    'iPhone5,2':  'iPhone 5',
    'iPhone5,3':  'iPhone 5C',
    'iPhone5,4':  'iPhone 5C',
    'iPhone6,1':  'iPhone 5S',
    'iPhone6,2':  'iPhone 5S',
    'iPhone7,1':  'iPhone 6 Plus',
    'iPhone7,2':  'iPhone 6',
    'iPhone8,1':  'iPhone 6s',
    'iPhone8,2':  'iPhone 6s Plus',
    'iPhone8,4':  'iPhone SE (1st gen)',
    'iPhone9,1':  'iPhone 7',
    'iPhone9,2':  'iPhone 7 Plus',
    'iPhone9,3':  'iPhone 7',
    'iPhone9,4':  'iPhone 7 Plus',
    'iPhone10,1': 'iPhone 8',
    'iPhone10,2': 'iPhone 8 Plus',
    'iPhone10,3': 'iPhone X',
    'iPhone10,4': 'iPhone 8',
    'iPhone10,5': 'iPhone 8 Plus',
    'iPhone10,6': 'iPhone X',
    'iPhone11,2': 'iPhone XS',
    'iPhone11,4': 'iPhone XS Max',
    'iPhone11,6': 'iPhone XS Max',
    'iPhone11,8': 'iPhone XR',
    'iPhone12,1': 'iPhone 11',
    'iPhone12,3': 'iPhone 11 Pro',
    'iPhone12,5': 'iPhone 11 Pro Max',
    'iPhone12,8': 'iPhone SE (2nd gen)',
    'iPhone13,1': 'iPhone 12 mini',
    'iPhone13,2': 'iPhone 12',
    'iPhone13,3': 'iPhone 12 Pro',
    'iPhone13,4': 'iPhone 12 Pro Max',
    'iPhone14,2': 'iPhone 13 Pro',
    'iPhone14,3': 'iPhone 13 Pro Max',
    'iPhone14,4': 'iPhone 13 mini',
    'iPhone14,5': 'iPhone 13',
    'iPhone14,6': 'iPhone SE (3rd gen)',
    'iPhone14,7': 'iPhone 14',
    'iPhone14,8': 'iPhone 14 Plus',
    'iPhone15,2': 'iPhone 14 Pro',
    'iPhone15,3': 'iPhone 14 Pro Max',
    'iPhone15,4': 'iPhone 15',
    'iPhone15,5': 'iPhone 15 Plus',
    'iPhone16,1': 'iPhone 15 Pro',
    'iPhone16,2': 'iPhone 15 Pro Max',
    'iPhone17,1': 'iPhone 16 Pro',
    'iPhone17,2': 'iPhone 16 Pro Max',
    'iPhone17,3': 'iPhone 16',
    'iPhone17,4': 'iPhone 16 Plus',
    'iPhone17,5': 'iPhone 16e',
    'iPhone18,1': 'iPhone 17 Pro',
    'iPhone18,2': 'iPhone 17 Pro Max',
    'iPhone18,3': 'iPhone 17',
    'iPhone18,4': 'iPhone Air',
  }
  return map[identifier] ?? null
}

function parseStorageGB(raw: string | undefined): number | null {
  if (!raw) return null
  const bytes = parseInt(raw, 10)
  if (isNaN(bytes)) return null
  const gb = bytes / 1_073_741_824
  const tiers = [16, 32, 64, 128, 256, 512, 1024]
  return tiers.reduce((prev, curr) =>
    Math.abs(curr - gb) < Math.abs(prev - gb) ? curr : prev,
  )
}

function mapColor(raw: string | undefined): string | null {
  if (!raw) return null
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw.trim())) return null
  const lower = raw.toLowerCase()
  const colorMap: [string, string][] = [
    ['black titanium', 'BLACK TITANIUM'],
    ['blue titanium', 'BLUE TITANIUM'],
    ['white titanium', 'WHITE TITANIUM'],
    ['natural titanium', 'NATURAL TITANIUM'],
    ['space gray', 'SPACE GRAY'],
    ['space grey', 'SPACE GRAY'],
    ['midnight', 'BLACK'],
    ['starlight', 'WHITE'],
    ['desert', 'NATURAL TITANIUM'],
    ['alpine', 'WHITE'],
    ['ultramarine', 'BLUE'],
    ['teal', 'GREEN'],
    ['product red', 'RED'],
    ['black', 'BLACK'],
    ['white', 'WHITE'],
    ['blue', 'BLUE'],
    ['green', 'GREEN'],
    ['yellow', 'YELLOW'],
    ['pink', 'PINK'],
    ['purple', 'PURPLE'],
    ['red', 'RED'],
    ['silver', 'SILVER'],
    ['gold', 'GOLD'],
  ]
  for (const [key, val] of colorMap) {
    if (lower.includes(key)) return val
  }
  return null
}

async function getBatteryHealth(udid?: string): Promise<number | null> {
  const diagArgs = ['diagnostics', 'IORegistry', '-n', 'AppleSmartBattery']
  if (udid) diagArgs.unshift('-u', udid)
  try {
    const { stdout } = await execFileAsync(tool('idevicediagnostics'), diagArgs, makeExecOpts())
    const maxMatch = stdout.match(/MaximumCapacityPercent[^:]*:\s*(\d+)/i)
    if (maxMatch) return parseInt(maxMatch[1], 10)
    const capMatch = stdout.match(/BatteryCurrentCapacity[^:]*:\s*(\d+)/i)
    if (capMatch) return parseInt(capMatch[1], 10)
  } catch { /* not available */ }

  try {
    const powerInfo = await runIdeviceinfo(udid, 'com.apple.power')
    const cur = parseInt(powerInfo['BatteryCurrentCapacity'] ?? '', 10)
    const max = parseInt(powerInfo['BatteryMaxCapacity'] ?? '', 10)
    if (!isNaN(cur) && !isNaN(max) && max > 0) {
      const pct = Math.round((cur / max) * 100)
      if (pct > 0 && pct <= 100) return pct
    }
  } catch { /* not available */ }

  return null
}

async function fetchDeviceInfo(udid?: string, prefetchedInfo?: Record<string, string>): Promise<IphoneDeviceInfo> {
  const [info, itunesInfo, diskInfo, diskInfo2, batteryHealth] = await Promise.all([
    prefetchedInfo ? Promise.resolve(prefetchedInfo) : runIdeviceinfo(udid),
    runIdeviceinfo(udid, 'com.apple.mobile.iTunes'),
    runIdeviceinfo(udid, 'com.apple.disk_usage.factory'),
    runIdeviceinfo(udid, 'com.apple.disk_usage'),
    getBatteryHealth(udid),
  ])

  // ── Model resolution: try ModelIdentifier → HardwareModel → ProductType ──
  // ideviceinfo commonly returns ProductType (e.g. "iPhone13,2") as the most
  // reliable identifier. ModelIdentifier may be a hardware board string like
  // "D53gAP" which is less useful. We try all three and pick the first that
  // maps to a known model name.
  const candidateIdentifiers = [
    info['ModelIdentifier'],
    info['HardwareModel'],
    info['ProductType'],   // ← THIS is what most devices actually return (iPhone13,2 etc.)
  ].filter(Boolean) as string[]

  let modelIdentifier: string | null = null
  let modelName: string | null = null

  for (const candidate of candidateIdentifiers) {
    const mapped = mapModelIdentifier(candidate)
    if (mapped) {
      modelIdentifier = candidate
      modelName = mapped
      break
    }
  }

  // If nothing mapped, fall back to ProductName or the raw ProductType
  if (!modelName) {
    modelName = info['ProductName'] ?? null
    modelIdentifier = candidateIdentifiers[0] ?? null
  }

  console.log('[iphone] Model candidates:', candidateIdentifiers, '→ resolved:', modelName)

  const storageRaw =
    info['TotalDiskCapacity'] ??
    info['TotalSystemCapacity'] ??
    diskInfo['TotalDiskCapacity'] ??
    diskInfo['TotalSystemCapacity'] ??
    diskInfo2['TotalDiskCapacity'] ??
    diskInfo2['TotalSystemCapacity'] ??
    null

  const colorRaw =
    itunesInfo['DeviceColor'] ??
    itunesInfo['AppleDeviceColor'] ??
    info['DeviceColor'] ??
    info['DeviceEnclosureColor'] ??
    info['DeviceColorMapPolicy'] ??
    null

  // ── ActivationState & RegionInfo ─────────────────────────────────────────
  const activationState = info['ActivationState'] ?? null   // "Activated" | "Unactivated"
  const regionInfo =
    itunesInfo['RegionInfo'] ??
    info['RegionInfo'] ??
    info['ModelNumber'] ??   // ModelNumber often contains region e.g. "MGH23" — use RegionInfo preferably
    null

  // RegionInfo from ideviceinfo is the clean "CH/A" style string
  // ModelNumber is the part number like "MGH23" — keep them separate
  const cleanRegionInfo = info['RegionInfo'] ?? itunesInfo['RegionInfo'] ?? null

  return {
    imei: info['InternationalMobileEquipmentIdentity'] ?? info['IMEI'] ?? null,
    imei2: info['InternationalMobileEquipmentIdentity2'] ?? info['IMEI2'] ?? null,
    serial_number: info['SerialNumber'] ?? null,
    model_name: modelName,
    model_identifier: modelIdentifier,
    model_number: itunesInfo['ModelNumber'] ?? info['ModelNumber'] ?? null,
    storage_gb: parseStorageGB(storageRaw ?? undefined),
    color: mapColor(colorRaw ?? undefined),
    ios_version: info['ProductVersion'] ? `iOS ${info['ProductVersion']}` : null,
    battery_health: batteryHealth,
    device_name: info['DeviceName'] ?? null,
    udid: info['UniqueDeviceID'] ?? udid ?? null,
    activation_state: activationState,
    region_info: cleanRegionInfo,
  }
}

export function registerIphoneIpc(): void {
  console.log('[iphone] ideviceinfo →', tool('ideviceinfo'))
  console.log('[iphone] idevice_id  →', tool('idevice_id'))

  ipcMain.handle('iphone:checkStatus', async () => {
    try {
      const available = await isToolAvailable()
      if (!available) {
        return { success: true, data: { available: false, connected: false, udids: [] } }
      }
      const udids = await getConnectedUdids()
      console.log('[iphone] checkStatus → udids:', udids)
      return { success: true, data: { available: true, connected: udids.length > 0, udids } }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('iphone:readDevice', async (_, udid?: string) => {
    try {
      if (process.platform === 'win32' && !udid) {
        const directInfo = await tryReadDeviceDirectly()
        if (directInfo) {
          const info = await fetchDeviceInfo(undefined, directInfo)
          if (info.imei || info.serial_number) {
            console.log('[iphone] Direct read succeeded. IMEI:', info.imei, 'Model:', info.model_name)
            return { success: true, data: info }
          }
        }
        return {
          success: false,
          error: 'No iPhone detected. Connect via USB and tap "Trust This Computer" on your iPhone.',
        }
      }

      let targetUdid = udid
      if (!targetUdid) {
        const udids = await getConnectedUdids()
        if (udids.length === 0) {
          return { success: false, error: 'No iPhone connected. Connect via USB and tap "Trust This Computer".' }
        }
        targetUdid = udids[0]
      }

      console.log('[iphone] Reading device:', targetUdid)
      const info = await fetchDeviceInfo(targetUdid)
      console.log('[iphone] IMEI:', info.imei, 'Serial:', info.serial_number, 'Model:', info.model_name, 'Activation:', info.activation_state, 'RegionInfo:', info.region_info)

      if (!info.imei && !info.serial_number) {
        return { success: false, error: 'Could not read device info. Tap "Trust This Computer" on your iPhone.' }
      }
      return { success: true, data: info }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('iphone:listDevices', async () => {
    try {
      const udids = await getConnectedUdids()
      if (udids.length === 0) return { success: true, data: [] }
      const devices = await Promise.all(udids.map(u => fetchDeviceInfo(u)))
      return { success: true, data: devices }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}