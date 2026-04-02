"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
const api = {
  // Window controls
  window: {
    minimize: () => electron.ipcRenderer.send("window:minimize"),
    maximize: () => electron.ipcRenderer.send("window:maximize"),
    close: () => electron.ipcRenderer.send("window:close")
  },
  // Product operations
  product: {
    create: (dto) => electron.ipcRenderer.invoke("product:create", dto),
    findAll: (filters) => electron.ipcRenderer.invoke("product:findAll", filters),
    findById: (id) => electron.ipcRenderer.invoke("product:findById", id),
    findByImei: (imei) => electron.ipcRenderer.invoke("product:findByImei", imei),
    update: (id, dto) => electron.ipcRenderer.invoke("product:update", id, dto),
    updateStatus: (imei, status) => electron.ipcRenderer.invoke("product:updateStatus", imei, status),
    delete: (id) => electron.ipcRenderer.invoke("product:delete", id),
    stats: () => electron.ipcRenderer.invoke("product:stats")
  },
  // Label operations
  label: {
    create: (dto) => electron.ipcRenderer.invoke("label:create", dto),
    findAll: (filters) => electron.ipcRenderer.invoke("label:findAll", filters),
    findByProduct: (productId) => electron.ipcRenderer.invoke("label:findByProduct", productId),
    markPrinted: (id) => electron.ipcRenderer.invoke("label:markPrinted", id),
    delete: (id) => electron.ipcRenderer.invoke("label:delete", id)
  },
  // iPhone USB operations
  iphone: {
    checkStatus: () => electron.ipcRenderer.invoke("iphone:checkStatus"),
    readDevice: (udid) => electron.ipcRenderer.invoke("iphone:readDevice", udid),
    listDevices: () => electron.ipcRenderer.invoke("iphone:listDevices")
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
