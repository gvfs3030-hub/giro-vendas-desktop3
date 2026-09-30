const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("giro", {
  app: {
    version: "1.2.0"
  },
  setup: {
    status: () => ipcRenderer.invoke("setup:status"),
    save: (data) => ipcRenderer.invoke("setup:save", data)
  },
  dashboard: () => ipcRenderer.invoke("dashboard"),
  products: {
    list: (search) => ipcRenderer.invoke("products:list", search || ""),
    get: (id) => ipcRenderer.invoke("products:get", id),
    save: (data) => ipcRenderer.invoke("products:save", data),
    delete: (id) => ipcRenderer.invoke("products:delete", id)
  },
  clients: {
    list: (search) => ipcRenderer.invoke("clients:list", search || ""),
    get: (id) => ipcRenderer.invoke("clients:get", id),
    save: (data) => ipcRenderer.invoke("clients:save", data),
    delete: (id) => ipcRenderer.invoke("clients:delete", id)
  },
  sales: {
    list: (filter) => ipcRenderer.invoke("sales:list", filter || {}),
    get: (id) => ipcRenderer.invoke("sales:get", id),
    create: (data) => ipcRenderer.invoke("sales:create", data),
    updateStatus: (id, status) => ipcRenderer.invoke("sales:updateStatus", { id, status })
  },
  installments: {
    list: (filter) => ipcRenderer.invoke("installments:list", filter || {}),
    pay: (id, paymentMethod) => ipcRenderer.invoke("installments:pay", { id, paymentMethod })
  },
  expenses: {
    list: () => ipcRenderer.invoke("expenses:list"),
    save: (data) => ipcRenderer.invoke("expenses:save", data),
    delete: (id) => ipcRenderer.invoke("expenses:delete", id)
  },
  visits: {
    today: () => ipcRenderer.invoke("visits:today"),
    checkIn: (clientId, latitude, longitude) => ipcRenderer.invoke("visits:checkIn", { clientId, latitude, longitude }),
    checkOut: (id, notes) => ipcRenderer.invoke("visits:checkOut", { id, notes }),
    plans: (fromDate, toDate) => ipcRenderer.invoke("visits:plans", { fromDate, toDate }),
    addPlan: (data) => ipcRenderer.invoke("visits:addPlan", data),
    cancelPlan: (id) => ipcRenderer.invoke("visits:cancelPlan", id),
    completePlan: (planId, clientId, notes) => ipcRenderer.invoke("visits:completePlan", { planId, clientId, notes })
  },
  reports: () => ipcRenderer.invoke("reports"),
  assistant: () => ipcRenderer.invoke("assistant"),
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    saveProfile: (data) => ipcRenderer.invoke("settings:saveProfile", data),
    saveGoal: (value) => ipcRenderer.invoke("settings:saveGoal", value),
    exportBackup: () => ipcRenderer.invoke("backup:export"),
    importBackup: () => ipcRenderer.invoke("backup:import"),
    clearData: () => ipcRenderer.invoke("settings:clearData")
  },
  orderPdf: (saleId) => ipcRenderer.invoke("order:pdf", saleId)
});
