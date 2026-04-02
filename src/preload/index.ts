// src/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type {
  CreateProductDto,
  UpdateProductDto,
  ProductFilters,
  CreateLabelDto,
  IpcResponse,
} from "../types/shared";

interface IphoneStatus {
  available: boolean;
  connected: boolean;
  udids: string[];
}

interface IphoneDeviceInfo {
  imei: string | null;
  imei2: string | null;
  serial_number: string | null;
  model_name: string | null;
  model_identifier: string | null;
  model_number: string | null;
  storage_gb: number | null;
  color: string | null;
  ios_version: string | null;
  battery_health: number | null;
  device_name: string | null;
  udid: string | null;
  activation_state: string | null;
  region_info: string | null;
}

interface WindowApi {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  product: {
    create: (dto: CreateProductDto) => Promise<IpcResponse>;
    findAll: (filters?: ProductFilters) => Promise<IpcResponse>;
    findById: (id: string) => Promise<IpcResponse>;
    findByImei: (imei: string) => Promise<IpcResponse>;
    update: (id: string, dto: UpdateProductDto) => Promise<IpcResponse>;
    updateStatus: (imei: string, status: string) => Promise<IpcResponse>;
    delete: (id: string) => Promise<IpcResponse>;
    stats: () => Promise<IpcResponse>;
  };
  label: {
    create: (dto: CreateLabelDto) => Promise<IpcResponse>;
    findAll: (filters?: {
      search?: string;
      model?: string;
      dateFrom?: string;
      dateTo?: string;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      limit?: number;
      offset?: number;
    }) => Promise<IpcResponse>;
    findByProduct: (productId: string) => Promise<IpcResponse>;
    markPrinted: (id: string) => Promise<IpcResponse>;
    delete: (id: string) => Promise<IpcResponse>;
  };
  iphone: {
    checkStatus: () => Promise<{ success: boolean; data?: IphoneStatus; error?: string }>;
    readDevice: (udid?: string) => Promise<{ success: boolean; data?: IphoneDeviceInfo; error?: string }>;
    listDevices: () => Promise<{ success: boolean; data?: IphoneDeviceInfo[]; error?: string }>;
  };
}

declare global {
  interface Window {
    api: WindowApi;
  }
}

// Expose secure Electron API to renderer
contextBridge.exposeInMainWorld("electron", electronAPI);

// Expose typed IPC API
const api: WindowApi = {
  // Window controls
  window: {
    minimize: (): void => ipcRenderer.send("window:minimize"),
    maximize: (): void => ipcRenderer.send("window:maximize"),
    close: (): void => ipcRenderer.send("window:close"),
  },

  // Product operations
  product: {
    create: (dto: CreateProductDto): Promise<IpcResponse> =>
      ipcRenderer.invoke("product:create", dto),
    findAll: (filters?: ProductFilters): Promise<IpcResponse> =>
      ipcRenderer.invoke("product:findAll", filters),
    findById: (id: string): Promise<IpcResponse> =>
      ipcRenderer.invoke("product:findById", id),
    findByImei: (imei: string): Promise<IpcResponse> =>
      ipcRenderer.invoke("product:findByImei", imei),
    update: (id: string, dto: UpdateProductDto): Promise<IpcResponse> =>
      ipcRenderer.invoke("product:update", id, dto),
    updateStatus: (imei: string, status: string): Promise<IpcResponse> =>
      ipcRenderer.invoke("product:updateStatus", imei, status),
    delete: (id: string): Promise<IpcResponse> =>
      ipcRenderer.invoke("product:delete", id),
    stats: (): Promise<IpcResponse> => ipcRenderer.invoke("product:stats"),
  },

  // Label operations
  label: {
    create: (dto: CreateLabelDto): Promise<IpcResponse> =>
      ipcRenderer.invoke("label:create", dto),
    findAll: (filters?: {
      search?: string;
      model?: string;
      dateFrom?: string;
      dateTo?: string;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      limit?: number;
      offset?: number;
    }): Promise<IpcResponse> => ipcRenderer.invoke("label:findAll", filters),
    findByProduct: (productId: string): Promise<IpcResponse> =>
      ipcRenderer.invoke("label:findByProduct", productId),
    markPrinted: (id: string): Promise<IpcResponse> =>
      ipcRenderer.invoke("label:markPrinted", id),
    delete: (id: string): Promise<IpcResponse> =>
      ipcRenderer.invoke("label:delete", id),
  },

  // iPhone USB operations
  iphone: {
    checkStatus: () => ipcRenderer.invoke("iphone:checkStatus"),
    readDevice: (udid?: string) => ipcRenderer.invoke("iphone:readDevice", udid),
    listDevices: () => ipcRenderer.invoke("iphone:listDevices"),
  },

  
};

contextBridge.exposeInMainWorld("api", api);