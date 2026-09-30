const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

let db;
let mainWindow;

function nowISO() {
  return new Date().toISOString();
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yearMonth() {
  return todayISO().slice(0, 7);
}

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function initDatabase() {
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "giro.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      sellerName TEXT NOT NULL,
      companyName TEXT NOT NULL,
      category TEXT NOT NULL,
      phone TEXT,
      monthlyGoal REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      razaoSocial TEXT NOT NULL,
      nomeFantasia TEXT NOT NULL,
      cnpjCpf TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      cep TEXT,
      street TEXT,
      number TEXT,
      complement TEXT,
      neighborhood TEXT,
      city TEXT,
      state TEXT,
      latitude REAL,
      longitude REAL,
      photoUri TEXT,
      observations TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT,
      category TEXT,
      unit TEXT NOT NULL DEFAULT 'UN',
      price1 REAL NOT NULL DEFAULT 0,
      price2 REAL,
      price3 REAL,
      stockCurrent INTEGER DEFAULT 0,
      stockMinimum INTEGER DEFAULT 0,
      photoUri TEXT,
      description TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      orderNumber INTEGER NOT NULL,
      clientId TEXT NOT NULL,
      subtotal REAL NOT NULL,
      totalDiscount REAL DEFAULT 0,
      total REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      installmentCount INTEGER DEFAULT 1,
      observations TEXT,
      signatureUri TEXT,
      status TEXT DEFAULT 'pendente',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      interestRate REAL DEFAULT 0,
      cardInstallments INTEGER DEFAULT 1,
      signatureData TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      quantity REAL NOT NULL,
      unitPrice REAL NOT NULL,
      discount REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      priceTable INTEGER DEFAULT 1,
      unit TEXT NOT NULL,
      FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS installments (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      clientId TEXT NOT NULL,
      installmentNumber INTEGER NOT NULL,
      dueDate TEXT NOT NULL,
      amount REAL NOT NULL,
      amountPaid REAL DEFAULT 0,
      status TEXT DEFAULT 'pendente',
      paymentDate TEXT,
      paymentMethod TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      clientId TEXT NOT NULL,
      checkInAt TEXT NOT NULL,
      checkOutAt TEXT,
      checkInLatitude REAL,
      checkInLongitude REAL,
      checkOutLatitude REAL,
      checkOutLongitude REAL,
      durationMinutes INTEGER,
      notes TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visit_plans (
      id TEXT PRIMARY KEY,
      clientId TEXT NOT NULL,
      plannedDate TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      visitId TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      photoUri TEXT,
      observations TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      yearMonth TEXT NOT NULL UNIQUE,
      targetAmount REAL NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clients_nomeFantasia ON clients(nomeFantasia);
    CREATE INDEX IF NOT EXISTS idx_clients_city ON clients(city);
    CREATE INDEX IF NOT EXISTS idx_clients_isActive ON clients(isActive);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_sales_clientId ON sales(clientId);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
    CREATE INDEX IF NOT EXISTS idx_sales_createdAt ON sales(createdAt);
    CREATE INDEX IF NOT EXISTS idx_sale_items_saleId ON sale_items(saleId);
    CREATE INDEX IF NOT EXISTS idx_sale_items_productId ON sale_items(productId);
    CREATE INDEX IF NOT EXISTS idx_installments_saleId ON installments(saleId);
    CREATE INDEX IF NOT EXISTS idx_installments_clientId ON installments(clientId);
    CREATE INDEX IF NOT EXISTS idx_installments_dueDate ON installments(dueDate);
    CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
    CREATE INDEX IF NOT EXISTS idx_visits_clientId ON visits(clientId);
    CREATE INDEX IF NOT EXISTS idx_visits_checkInAt ON visits(checkInAt);
    CREATE INDEX IF NOT EXISTS idx_visit_plans_date ON visit_plans(plannedDate);
    CREATE INDEX IF NOT EXISTS idx_visit_plans_clientId ON visit_plans(clientId);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_goals_yearMonth ON goals(yearMonth);
  `);

  db.prepare(`
    UPDATE installments
    SET status = 'vencida', updatedAt = ?
    WHERE status = 'pendente' AND dueDate < ?
  `).run(nowISO(), todayISO());

  return dbPath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: "#F7FAF8",
    icon: path.join(__dirname, "assets", "logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function configExists() {
  return !!db.prepare("SELECT id FROM config WHERE id=1").get();
}

function registerIpc() {
  ipcMain.handle("setup:status", () => ({ configured: configExists() }));

  ipcMain.handle("setup:save", (_, data) => {
    const now = nowISO();
    db.prepare(`
      INSERT OR REPLACE INTO config
      (id,sellerName,companyName,category,phone,monthlyGoal,createdAt,updatedAt)
      VALUES (1,?,?,?,?,0,?,?)
    `).run(
      data.sellerName.trim(),
      data.companyName.trim(),
      data.category || "Alimentos",
      data.phone?.trim() || null,
      now,
      now
    );
    return true;
  });

  ipcMain.handle("dashboard", () => {
    const today = todayISO();
    const ym = yearMonth();
    const config = db.prepare("SELECT sellerName, companyName FROM config WHERE id=1").get() || {};
    const todayStats = db.prepare(`
      SELECT COUNT(*) cnt, COALESCE(SUM(total),0) total
      FROM sales WHERE date(createdAt)=? AND status!='cancelado'
    `).get(today);
    const monthStats = db.prepare(`
      SELECT COUNT(*) cnt, COALESCE(SUM(total),0) total
      FROM sales WHERE createdAt>=? AND status!='cancelado'
    `).get(`${ym}-01`);
    const clients = db.prepare("SELECT COUNT(*) cnt FROM clients WHERE isActive=1").get();
    const overdue = db.prepare(`
      SELECT COUNT(*) cnt, COALESCE(SUM(amount-amountPaid),0) total
      FROM installments WHERE status='vencida'
    `).get();
    const low = db.prepare(`
      SELECT COUNT(*) cnt FROM products
      WHERE isActive=1 AND stockCurrent<=stockMinimum
    `).get();
    const goal = db.prepare("SELECT targetAmount FROM goals WHERE yearMonth=?").get(ym);

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const row = db.prepare(`
        SELECT COALESCE(SUM(total),0) total
        FROM sales WHERE date(createdAt)=? AND status!='cancelado'
      `).get(ds);
      days.push({ label: String(d.getDate()), total: row.total || 0 });
    }

    return {
      sellerName: config.sellerName || "Vendedor",
      companyName: config.companyName || "Giro Vendas",
      todaySales: todayStats.total || 0,
      todayCount: todayStats.cnt || 0,
      monthSales: monthStats.total || 0,
      monthCount: monthStats.cnt || 0,
      activeClients: clients.cnt || 0,
      overdueAmount: overdue.total || 0,
      overdueCount: overdue.cnt || 0,
      lowStockCount: low.cnt || 0,
      goalTarget: goal?.targetAmount || 0,
      goalCurrent: monthStats.total || 0,
      days
    };
  });

  ipcMain.handle("products:list", (_, search="") => {
    const s = `%${String(search).toLowerCase()}%`;
    return db.prepare(`
      SELECT * FROM products
      WHERE isActive=1 AND (lower(name) LIKE ? OR lower(COALESCE(barcode,'')) LIKE ?)
      ORDER BY name COLLATE NOCASE ASC
    `).all(s, s);
  });

  ipcMain.handle("products:get", (_, id) =>
    db.prepare("SELECT * FROM products WHERE id=?").get(id)
  );

  ipcMain.handle("products:save", (_, p) => {
    const now = nowISO();
    const id = p.id || uuid();
    db.prepare(`
      INSERT OR REPLACE INTO products
      (id,name,barcode,category,unit,price1,price2,price3,stockCurrent,stockMinimum,photoUri,description,isActive,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, p.name.trim(), p.barcode || null, p.category || null, p.unit || "UN",
      Number(p.price1)||0, p.price2 === "" ? null : (p.price2 == null ? null : Number(p.price2)),
      p.price3 === "" ? null : (p.price3 == null ? null : Number(p.price3)),
      Number(p.stockCurrent)||0, Number(p.stockMinimum)||0, p.photoUri || null,
      p.description || null, 1, p.createdAt || now, now
    );
    return id;
  });

  ipcMain.handle("products:delete", (_, id) => {
    db.prepare("UPDATE products SET isActive=0, updatedAt=? WHERE id=?").run(nowISO(), id);
    return true;
  });

  ipcMain.handle("clients:list", (_, search="") => {
    const s = `%${String(search).toLowerCase()}%`;
    return db.prepare(`
      SELECT * FROM clients
      WHERE isActive=1 AND (
        lower(nomeFantasia) LIKE ? OR lower(razaoSocial) LIKE ?
        OR lower(COALESCE(phone,'')) LIKE ? OR lower(COALESCE(cidade,'')) LIKE ?
      )
      ORDER BY nomeFantasia COLLATE NOCASE ASC
    `.replace("cidade","city"), s, s, s, s).all();
  });

  ipcMain.handle("clients:get", (_, id) => {
    const client = db.prepare("SELECT * FROM clients WHERE id=?").get(id);
    if (!client) return null;
    const sales = db.prepare(`
      SELECT s.*, c.nomeFantasia clientName
      FROM sales s LEFT JOIN clients c ON c.id=s.clientId
      WHERE s.clientId=? ORDER BY s.createdAt DESC LIMIT 30
    `).all(id);
    const installments = db.prepare(`
      SELECT * FROM installments WHERE clientId=? ORDER BY dueDate ASC
    `).all(id);
    const visits = db.prepare(`
      SELECT v.*, c.nomeFantasia clientName
      FROM visits v LEFT JOIN clients c ON c.id=v.clientId
      WHERE v.clientId=? ORDER BY v.checkInAt DESC LIMIT 30
    `).all(id);
    return { client, sales, installments, visits };
  });

  ipcMain.handle("clients:save", (_, c) => {
    const now = nowISO();
    const id = c.id || uuid();
    db.prepare(`
      INSERT OR REPLACE INTO clients
      (id,razaoSocial,nomeFantasia,cnpjCpf,phone,email,cep,street,number,complement,
       neighborhood,city,state,latitude,longitude,photoUri,observations,isActive,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, c.razaoSocial.trim(), c.nomeFantasia.trim(), c.cnpjCpf || null, c.phone.trim(),
      c.email || null, c.cep || null, c.street || null, c.number || null, c.complement || null,
      c.neighborhood || null, c.city || null, c.state || null,
      c.latitude == null ? null : Number(c.latitude),
      c.longitude == null ? null : Number(c.longitude),
      c.photoUri || null, c.observations || null, 1, c.createdAt || now, now
    );
    return id;
  });

  ipcMain.handle("clients:delete", (_, id) => {
    db.prepare("UPDATE clients SET isActive=0, updatedAt=? WHERE id=?").run(nowISO(), id);
    return true;
  });

  ipcMain.handle("sales:list", (_, filter={}) => {
    const q = `%${String(filter.search||"").toLowerCase()}%`;
    const status = filter.status && filter.status !== "all" ? filter.status : null;
    return db.prepare(`
      SELECT s.*, COALESCE(c.nomeFantasia,'Consumidor Avulso') clientName
      FROM sales s LEFT JOIN clients c ON c.id=s.clientId
      WHERE (? IS NULL OR s.status=?)
        AND (?='' OR lower(CAST(s.orderNumber AS TEXT)) LIKE ? OR lower(COALESCE(c.nomeFantasia,'')) LIKE ?)
      ORDER BY s.createdAt DESC
    `).all(status, status, String(filter.search||""), q, q);
  });

  ipcMain.handle("sales:get", (_, id) => {
    const sale = db.prepare(`
      SELECT s.*, COALESCE(c.nomeFantasia,'Consumidor Avulso') clientName
      FROM sales s LEFT JOIN clients c ON c.id=s.clientId
      WHERE s.id=?
    `).get(id);
    if (!sale) return null;
    const items = db.prepare("SELECT * FROM sale_items WHERE saleId=?").all(id);
    const installments = db.prepare("SELECT * FROM installments WHERE saleId=? ORDER BY installmentNumber").all(id);
    return { sale, items, installments };
  });

  ipcMain.handle("sales:create", (_, sale) => {
    const now = nowISO();
    const tx = db.transaction(() => {
      const max = db.prepare("SELECT COALESCE(MAX(orderNumber),0) maxNum FROM sales").get();
      const orderNumber = (max.maxNum || 0) + 1;
      const id = uuid();
      const subtotal = (sale.items||[]).reduce((sum,i) => sum + Number(i.quantity||0)*Number(i.unitPrice||0),0);
      const totalDiscount = (sale.items||[]).reduce((sum,i) => {
        const full = Number(i.quantity||0)*Number(i.unitPrice||0);
        return sum + (full - Number(i.subtotal||0));
      }, 0);
      const total = (sale.items||[]).reduce((sum,i) => sum + Number(i.subtotal||0),0);

      db.prepare(`
        INSERT INTO sales
        (id,orderNumber,clientId,subtotal,totalDiscount,total,paymentMethod,installmentCount,interestRate,cardInstallments,observations,status,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'pendente',?,?)
      `).run(
        id, orderNumber, sale.clientId || "avulso", subtotal, totalDiscount, total,
        sale.paymentMethod || "dinheiro", Number(sale.installmentCount)||1,
        Number(sale.interestRate)||0,
        sale.paymentMethod === "cartao" ? (Number(sale.installmentCount)||1) : 1,
        sale.observations || null, now, now
      );

      for (const item of sale.items || []) {
        db.prepare(`
          INSERT INTO sale_items
          (id,saleId,productId,productName,quantity,unitPrice,discount,subtotal,priceTable,unit)
          VALUES (?,?,?,?,?,?,?,?,?,?)
        `).run(
          uuid(), id, item.productId, item.productName, Number(item.quantity)||0,
          Number(item.unitPrice)||0, Number(item.discount)||0, Number(item.subtotal)||0,
          Number(item.priceTable)||1, item.unit || "UN"
        );
        db.prepare(`
          UPDATE products
          SET stockCurrent=MAX(0,stockCurrent-?), updatedAt=?
          WHERE id=?
        `).run(Number(item.quantity)||0, now, item.productId);
      }

      if (sale.paymentMethod === "prazo" && Number(sale.installmentCount||1) > 1) {
        const totalComJuros = total * (1 + (Number(sale.interestRate)||0) / 100);
        const installmentValue = totalComJuros / Number(sale.installmentCount);
        for (let i=0; i<Number(sale.installmentCount); i++) {
          db.prepare(`
            INSERT INTO installments
            (id,saleId,clientId,installmentNumber,dueDate,amount,amountPaid,status,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,0,'pendente',?,?)
          `).run(
            uuid(), id, sale.clientId || "avulso", i+1,
            addDays(todayISO(), 30*(i+1)),
            installmentValue, now, now
          );
        }
      }
      return { id, orderNumber, subtotal, totalDiscount, total };
    });
    return tx();
  });

  ipcMain.handle("sales:updateStatus", (_, {id,status}) => {
    const tx = db.transaction(() => {
      const current = db.prepare("SELECT status FROM sales WHERE id=?").get(id);
      if (!current) throw new Error("Pedido não encontrado");
      db.prepare("UPDATE sales SET status=?, updatedAt=? WHERE id=?").run(status, nowISO(), id);
      if (status === "cancelado" && current.status !== "cancelado") {
        const items = db.prepare("SELECT productId,quantity FROM sale_items WHERE saleId=?").all(id);
        for (const item of items) {
          db.prepare("UPDATE products SET stockCurrent=stockCurrent+?, updatedAt=? WHERE id=?")
            .run(Number(item.quantity)||0, nowISO(), item.productId);
        }
      }
      return true;
    });
    return tx();
  });

  ipcMain.handle("installments:list", (_, filter={}) => {
    db.prepare(`
      UPDATE installments SET status='vencida', updatedAt=?
      WHERE status='pendente' AND dueDate<?
    `).run(nowISO(), todayISO());

    let clause = "1=1";
    const params = [];
    if (filter.status && filter.status !== "all") { clause += " AND i.status=?"; params.push(filter.status); }
    if (filter.search) {
      clause += " AND lower(COALESCE(c.nomeFantasia,'')) LIKE ?";
      params.push(`%${String(filter.search).toLowerCase()}%`);
    }
    return db.prepare(`
      SELECT i.*, c.nomeFantasia clientName, s.orderNumber
      FROM installments i
      LEFT JOIN clients c ON c.id=i.clientId
      LEFT JOIN sales s ON s.id=i.saleId
      WHERE ${clause}
      ORDER BY i.dueDate ASC
    `).all(...params);
  });

  ipcMain.handle("installments:pay", (_, {id,paymentMethod}) => {
    const now = nowISO();
    db.prepare(`
      UPDATE installments
      SET status='paga', amountPaid=amount, paymentDate=?, paymentMethod=?, updatedAt=?
      WHERE id=?
    `).run(now, paymentMethod || "dinheiro", now, id);
    return true;
  });

  ipcMain.handle("expenses:list", () =>
    db.prepare("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC").all()
  );

  ipcMain.handle("expenses:save", (_, e) => {
    const now = nowISO();
    const id = e.id || uuid();
    db.prepare(`
      INSERT OR REPLACE INTO expenses
      (id,description,category,amount,date,photoUri,observations,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      id, e.description.trim(), e.category || "outros", Number(e.amount)||0,
      e.date || todayISO(), e.photoUri || null, e.observations || null, e.createdAt || now, now
    );
    return id;
  });

  ipcMain.handle("expenses:delete", (_, id) => {
    db.prepare("DELETE FROM expenses WHERE id=?").run(id);
    return true;
  });

  ipcMain.handle("reports", () => {
    const ym = yearMonth();
    const week = [];
    for (let i=6;i>=0;i--) {
      const d = new Date();
      d.setDate(d.getDate()-i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const r = db.prepare(`
        SELECT COALESCE(SUM(total),0) total FROM sales
        WHERE date(createdAt)=? AND status!='cancelado'
      `).get(ds);
      week.push({ label:String(d.getDate()), total:r.total||0 });
    }
    const topProducts = db.prepare(`
      SELECT si.productName name, SUM(si.subtotal) total
      FROM sale_items si JOIN sales s ON si.saleId=s.id
      WHERE s.status!='cancelado'
      GROUP BY si.productId ORDER BY total DESC LIMIT 5
    `).all();
    const topClients = db.prepare(`
      SELECT c.nomeFantasia name, SUM(s.total) total
      FROM sales s JOIN clients c ON s.clientId=c.id
      WHERE s.status!='cancelado'
      GROUP BY s.clientId ORDER BY total DESC LIMIT 5
    `).all();
    const monthSales = db.prepare(`
      SELECT COALESCE(SUM(total),0) total FROM sales
      WHERE createdAt>=? AND status!='cancelado'
    `).get(`${ym}-01`).total || 0;
    const monthGoal = db.prepare("SELECT targetAmount FROM goals WHERE yearMonth=?").get(ym)?.targetAmount || 0;
    const monthExpenses = db.prepare("SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE date LIKE ?").get(`${ym}%`).total || 0;
    return { week, topProducts, topClients, monthSales, monthGoal, monthExpenses };
  });

  ipcMain.handle("assistant", () => {
    const results = [];
    const inactive = db.prepare(`
      SELECT COUNT(*) cnt FROM clients c
      WHERE c.isActive=1
      AND c.id NOT IN (SELECT clientId FROM sales WHERE createdAt>=date('now','-30 days'))
    `).get().cnt || 0;
    if (inactive > 0) results.push({type:"warning",title:"Clientes Inativos",description:`${inactive} cliente(s) sem compras há mais de 30 dias`,page:"clients"});

    const low = db.prepare("SELECT COUNT(*) cnt FROM products WHERE isActive=1 AND stockCurrent<=stockMinimum").get().cnt || 0;
    if (low > 0) results.push({type:"danger",title:"Estoque Baixo",description:`${low} produto(s) com estoque abaixo do mínimo`,page:"products"});

    const overdue = db.prepare(`
      SELECT COUNT(*) cnt, COALESCE(SUM(amount-amountPaid),0) total
      FROM installments WHERE status='vencida'
    `).get();
    if ((overdue.cnt||0)>0) results.push({type:"danger",title:"Parcelas Vencidas",description:`${overdue.cnt} parcela(s) vencida(s)`,page:"financial"});

    const ym = yearMonth();
    const goal = db.prepare("SELECT targetAmount FROM goals WHERE yearMonth=?").get(ym)?.targetAmount || 0;
    const sales = db.prepare(`
      SELECT COALESCE(SUM(total),0) total FROM sales
      WHERE createdAt>=? AND status!='cancelado'
    `).get(`${ym}-01`).total || 0;
    if (goal > 0 && sales < goal) results.push({type:"success",title:"Meta do Mês",description:`Faltam R$ ${(goal-sales).toFixed(2).replace(".",",")} para atingir a meta`,page:"reports"});
    if (goal > 0 && sales >= goal) results.push({type:"success",title:"Meta Atingida!",description:"A meta do mês foi atingida."});
    const neverSold = db.prepare(`
      SELECT COUNT(*) cnt FROM products p
      WHERE p.isActive=1 AND p.id NOT IN (SELECT DISTINCT productId FROM sale_items)
    `).get().cnt || 0;
    if (neverSold > 0) results.push({type:"warning",title:"Produtos Parados",description:`${neverSold} produto(s) nunca foram vendidos`,page:"products"});

    return results;
  });

  ipcMain.handle("visits:today", () => {
    db.prepare(`
      UPDATE installments SET status='vencida',updatedAt=?
      WHERE status='pendente' AND dueDate<?
    `).run(nowISO(), todayISO());
    return db.prepare(`
      SELECT v.*, c.nomeFantasia clientName
      FROM visits v LEFT JOIN clients c ON c.id=v.clientId
      WHERE date(v.checkInAt)=? ORDER BY v.checkInAt DESC
    `).all(todayISO());
  });

  ipcMain.handle("visits:checkIn", (_, {clientId,latitude,longitude}) => {
    const now = nowISO();
    const id = uuid();
    db.prepare(`
      INSERT INTO visits (id,clientId,checkInAt,checkInLatitude,checkInLongitude,createdAt)
      VALUES (?,?,?,?,?,?)
    `).run(id, clientId, now, latitude ?? null, longitude ?? null, now);
    return id;
  });

  ipcMain.handle("visits:checkOut", (_, {id,notes}) => {
    const row = db.prepare("SELECT checkInAt FROM visits WHERE id=?").get(id);
    if (!row) throw new Error("Visita não encontrada");
    const checkout = new Date();
    const duration = Math.max(0, Math.round((checkout.getTime()-new Date(row.checkInAt).getTime())/60000));
    db.prepare(`
      UPDATE visits SET checkOutAt=?,durationMinutes=?,notes=? WHERE id=?
    `).run(checkout.toISOString(), duration, notes || null, id);
    return true;
  });

  ipcMain.handle("visits:plans", (_, {fromDate,toDate}) => {
    return db.prepare(`
      SELECT vp.*, c.nomeFantasia clientName
      FROM visit_plans vp LEFT JOIN clients c ON c.id=vp.clientId
      WHERE vp.plannedDate BETWEEN ? AND ?
      ORDER BY vp.plannedDate ASC, clientName ASC
    `).all(fromDate, toDate);
  });

  ipcMain.handle("visits:addPlan", (_, data) => {
    db.prepare(`
      INSERT INTO visit_plans (id,clientId,plannedDate,notes,status,createdAt)
      VALUES (?,?,?,?,?,?)
    `).run(uuid(),data.clientId,data.plannedDate,data.notes||null,"pendente",nowISO());
    return true;
  });

  ipcMain.handle("visits:cancelPlan", (_, id) => {
    db.prepare("UPDATE visit_plans SET status='cancelada' WHERE id=?").run(id);
    return true;
  });

  ipcMain.handle("visits:completePlan", (_, {planId,clientId,notes}) => {
    const tx = db.transaction(() => {
      const now = nowISO();
      const visitId = uuid();
      db.prepare(`
        INSERT INTO visits (id,clientId,checkInAt,notes,createdAt) VALUES (?,?,?,?,?)
      `).run(visitId,clientId,now,notes||null,now);
      db.prepare(`
        UPDATE visit_plans SET status='concluida',visitId=? WHERE id=?
      `).run(visitId,planId);
      return visitId;
    });
    return tx();
  });

  ipcMain.handle("settings:get", () => ({
    config: db.prepare("SELECT * FROM config WHERE id=1").get() || null,
    goal: db.prepare("SELECT targetAmount FROM goals WHERE yearMonth=?").get(yearMonth())?.targetAmount || 0
  }));

  ipcMain.handle("settings:saveProfile", (_, data) => {
    db.prepare(`
      UPDATE config SET sellerName=?,companyName=?,phone=?,updatedAt=? WHERE id=1
    `).run(data.sellerName.trim(),data.companyName.trim(),data.phone?.trim()||null,nowISO());
    return true;
  });

  ipcMain.handle("settings:saveGoal", (_, value) => {
    const ym = yearMonth();
    const now = nowISO();
    const val = Number(value)||0;
    const existing = db.prepare("SELECT id FROM goals WHERE yearMonth=?").get(ym);
    if (existing) db.prepare("UPDATE goals SET targetAmount=?,updatedAt=? WHERE yearMonth=?").run(val,now,ym);
    else db.prepare("INSERT INTO goals (id,yearMonth,targetAmount,createdAt,updatedAt) VALUES (?,?,?,?,?)").run(uuid(),ym,val,now,now);
    return true;
  });

  ipcMain.handle("backup:export", async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title:"Exportar backup completo",
      defaultPath:"giro_backup.json",
      filters:[{name:"JSON",extensions:["json"]}]
    });
    if (result.canceled || !result.filePath) return null;
    const tables = ["config","clients","products","sales","sale_items","installments","visits","visit_plans","expenses","goals"];
    const backup = { version: 2, exportedAt: nowISO() };
    for (const table of tables) backup[table] = db.prepare(`SELECT * FROM ${table}`).all();
    fs.writeFileSync(result.filePath, JSON.stringify(backup,null,2), "utf8");
    return result.filePath;
  });

  ipcMain.handle("backup:import", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title:"Importar backup do Giro Vendas",
      properties:["openFile"],
      filters:[{name:"JSON",extensions:["json"]}]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const raw = fs.readFileSync(result.filePaths[0],"utf8");
    const parsed = JSON.parse(raw);
    const tables = ["config","clients","products","sales","sale_items","installments","visits","visit_plans","expenses","goals"];
    const count = {tables:0,rows:0};
    const tx = db.transaction(() => {
      for (const table of tables) {
        const rows = Array.isArray(parsed?.[table]) ? parsed[table] : [];
        if (!rows.length) continue;
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => "?").join(",");
        const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`);
        for (const row of rows) {
          try { stmt.run(columns.map(c => row[c] ?? null)); count.rows++; }
          catch (e) { /* ignora registro incompatível */ }
        }
        count.tables++;
      }
    });
    tx();
    return count;
  });

  ipcMain.handle("settings:clearData", async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type:"warning",
      buttons:["Cancelar","Limpar tudo"],
      defaultId:0,
      cancelId:0,
      title:"Limpar todos os dados",
      message:"Esta ação é irreversível.",
      detail:"Todos os clientes, produtos, vendas, parcelas, visitas, despesas e metas serão removidos."
    });
    if (result.response !== 1) return false;

    const tx = db.transaction(() => {
      db.exec("DELETE FROM sale_items; DELETE FROM installments; DELETE FROM sales; DELETE FROM visits; DELETE FROM visit_plans; DELETE FROM expenses; DELETE FROM goals; DELETE FROM products; DELETE FROM clients; DELETE FROM config;");
    });
    tx();
    return true;
  });

  ipcMain.handle("order:pdf", async (_, saleId) => {
    const payload = db.prepare(`
      SELECT s.*, COALESCE(c.nomeFantasia,'Consumidor Avulso') clientName
      FROM sales s LEFT JOIN clients c ON c.id=s.clientId WHERE s.id=?
    `).get(saleId);
    if (!payload) throw new Error("Pedido não encontrado");
    const items = db.prepare("SELECT * FROM sale_items WHERE saleId=?").all(saleId);
    const config = db.prepare("SELECT companyName,sellerName FROM config WHERE id=1").get() || {};
    const money = n => "R$ " + Number(n||0).toFixed(2).replace(".",",").replace(/\B(?=(\d{3})+(?!\d))/g,".");
    const method = {
      dinheiro:"Dinheiro",cartao:"Cartão",boleto:"Boleto",pix:"PIX",prazo:"A Prazo"
    }[payload.paymentMethod] || payload.paymentMethod;
    let payment = method;
    if ((payload.paymentMethod==="cartao" || payload.paymentMethod==="prazo") && (payload.installmentCount||1)>1) payment += ` em ${payload.installmentCount}x`;
    if ((payload.interestRate||0)>0) payment += ` (com juros de ${payload.interestRate}%)`;
    const safe = s => String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m]));

    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:A4;margin:18mm}body{font-family:Arial;color:#1a1a1a}
      .header{background:#00C853;color:#fff;padding:22px;border-radius:10px}.header h1{margin:0}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0}
      .box{background:#f4f6f5;padding:12px;border-radius:8px}.label{font-size:11px;color:#666}.value{font-weight:700;margin-top:4px}
      table{width:100%;border-collapse:collapse}th{background:#00C853;color:white;text-align:left;padding:8px}td{padding:8px;border-bottom:1px solid #eee}
      .totals{margin-top:18px;text-align:right}.grand{font-size:20px;color:#00C853;font-weight:800}.footer{margin-top:35px;text-align:center;color:#888}
    </style></head><body>
      <div class="header"><h1>${safe(config.companyName||"Giro Vendas")}</h1><div>Vendedor: ${safe(config.sellerName||"")}</div></div>
      <div class="meta">
        <div class="box"><div class="label">Pedido</div><div class="value">#${String(payload.orderNumber||0).padStart(3,"0")}</div></div>
        <div class="box"><div class="label">Cliente</div><div class="value">${safe(payload.clientName)}</div></div>
        <div class="box"><div class="label">Data</div><div class="value">${new Date(payload.createdAt).toLocaleString("pt-BR")}</div></div>
      </div>
      <table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Desc.</th><th>Subtotal</th></tr></thead><tbody>
      ${items.map(i=>`<tr><td>${safe(i.productName)}</td><td>${i.quantity} ${safe(i.unit)}</td><td>${money(i.unitPrice)}</td><td>${i.discount||0}%</td><td>${money(i.subtotal)}</td></tr>`).join("")}
      </tbody></table>
      <div class="totals"><div>Subtotal: ${money(payload.subtotal)}</div><div>Desconto: -${money(payload.totalDiscount)}</div><div class="grand">Total: ${money(payload.total)}</div><div>Pagamento: ${safe(payment)}</div></div>
      <div class="footer"><b>Agradecemos a Preferência!</b><div>Documento gerado pelo Giro Vendas Desktop</div></div>
    </body></html>`;

    const pdfWindow = new BrowserWindow({ show:false, webPreferences:{sandbox:false} });
    await pdfWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const pdf = await pdfWindow.webContents.printToPDF({ printBackground:true, pageSize:"A4" });
    pdfWindow.close();

    const save = await dialog.showSaveDialog(mainWindow, {
      title:"Salvar PDF do pedido",
      defaultPath:`Pedido-${String(payload.orderNumber||0).padStart(3,"0")}.pdf`,
      filters:[{name:"PDF",extensions:["pdf"]}]
    });
    if (save.canceled || !save.filePath) return null;
    fs.writeFileSync(save.filePath,pdf);
    return save.filePath;
  });
}

app.whenReady().then(() => {
  initDatabase();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
