// src/main/ipc/imei.ipc.ts
import { ipcMain, net } from 'electron'

interface TacLookupResult {
  manufacturer?: string
  model?: string
  network?: string
  model_code?: string
  blacklist_status: string
  raw?: Record<string, unknown>
}

function extractNetworkType(bands: string): string {
  const b = bands.toUpperCase()
  const types: string[] = []
  if (b.includes('GSM') || b.includes('GPRS') || b.includes('EDGE')) types.push('GSM')
  if (b.includes('UMTS') || b.includes('HSPA') || b.includes('WCDMA')) types.push('3G')
  if (b.includes('LTE')) types.push('LTE')
  if (b.includes('5G') || b.includes(' NR') || b.includes('NR ')) types.push('5G')
  return types.join('/') || 'GSM/LTE'
}

function mapAppleModel(raw: string): string {
  // Try to normalize Apple model names to our IPHONE_MODELS list
  const models: Record<string, string> = {
    'iphone 15 pro max': 'iPhone 15 Pro Max',
    'iphone 15 pro': 'iPhone 15 Pro',
    'iphone 15 plus': 'iPhone 15 Plus',
    'iphone 15': 'iPhone 15',
    'iphone 14 pro max': 'iPhone 14 Pro Max',
    'iphone 14 pro': 'iPhone 14 Pro',
    'iphone 14 plus': 'iPhone 14 Plus',
    'iphone 14': 'iPhone 14',
    'iphone 13 pro max': 'iPhone 13 Pro Max',
    'iphone 13 pro': 'iPhone 13 Pro',
    'iphone 13 mini': 'iPhone 13 mini',
    'iphone 13': 'iPhone 13',
    'iphone 12 pro max': 'iPhone 12 Pro Max',
    'iphone 12 pro': 'iPhone 12 Pro',
    'iphone 12 mini': 'iPhone 12 mini',
    'iphone 12': 'iPhone 12',
    'iphone 11 pro max': 'iPhone 11 Pro Max',
    'iphone 11 pro': 'iPhone 11 Pro',
    'iphone 11': 'iPhone 11',
    'iphone se (3': 'iPhone SE (3rd gen)',
    'iphone se (2': 'iPhone SE (2nd gen)',
  }

  const lower = raw.toLowerCase()
  for (const [key, val] of Object.entries(models)) {
    if (lower.includes(key)) return val
  }
  return raw
}

export function registerImeiIpc(): void {
  ipcMain.handle(
    'imei:lookupTac',
    async (_, imei: string): Promise<{ success: boolean; data?: TacLookupResult; error?: string }> => {
      if (!imei || imei.length < 8) {
        return { success: false, error: 'IMEI too short for TAC lookup' }
      }

      const tac = imei.slice(0, 8)

      try {
        // Primary: Osmocom public TAC DB (free, no key)
        const res = await net.fetch(`https://tacdb.osmocom.org/lookup/${tac}.json`, {
          headers: { Accept: 'application/json', 'User-Agent': 'LATSONS-Label-Manager/1.0' },
        })

        if (!res.ok) {
          return { success: false, error: `TAC DB returned ${res.status}` }
        }

        const raw = (await res.json()) as Record<string, unknown>

        // Osmocom returns array or object — handle both
        const entry: Record<string, unknown> = Array.isArray(raw) ? (raw[0] ?? {}) : raw

        const rawModel = ((entry.model ?? entry.Model ?? entry.name ?? '') as string).trim()
        const rawManufacturer = (
          (entry.manufacturer ?? entry.Manufacturer ?? entry.brand ?? '') as string
        ).trim()
        const rawBands = (
          (entry.bands ?? entry.band ?? entry.network ?? entry.connectivity ?? '') as string
        ).trim()

        const network = rawBands ? extractNetworkType(rawBands) : 'GSM/LTE/5G'
        const model = rawModel ? mapAppleModel(rawModel) : ''

        const result: TacLookupResult = {
          manufacturer: rawManufacturer || 'Apple',
          model: model,
          network: network,
          blacklist_status: 'Unknown',
          raw: entry,
        }

        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}