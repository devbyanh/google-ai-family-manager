// ============================================
// DATA MANAGER - localStorage CRUD
// ============================================

const DataManager = {
  KEYS: {
    ORDERS: 'gaf_orders',
    ACCOUNTS: 'gaf_accounts',
    PLATFORMS: 'gaf_platforms',
    PRODUCTS: 'gaf_products',
    EMAIL_TEMPLATE: 'gaf_email_template',
  },

  // --- Default Data ---
  getDefaultPlatforms() {
    return ['taphoammo', 'Zalo', 'datammo', 'shopmini'];
  },

  getDefaultProducts() {
    return [
      { id: 'chinchu_thang', name: 'Chính chủ/Tháng', price: 40000, color: '#8b5cf6', duration: 1 },
      { id: '3thang', name: '3 Tháng', price: 100000, color: '#ec4899', duration: 3 },
      { id: '6thang', name: '6 Tháng', price: 180000, color: '#4f46e5', duration: 6 },
      { id: '1nam', name: '1 Năm Add Farm', price: 300000, color: '#f97316', duration: 12 },
      { id: 'chinchu', name: 'Chính chủ', price: 50000, color: '#14b8a6', duration: 1 },
    ];
  },

  getDefaultEmailTemplate() {
    return `Shop xin thông báo rằng gói Google AI Pro [Ten_Goi] của Anh/Chị đã hết hạn sử dụng.
Để tránh việc bị cấm thay đổi nhóm gia đình trong vòng 12 tháng và gián đoạn quá trình học tập, làm việc hoặc sử dụng các tính năng AI nâng cao (Gemini Pro, 5TB lưu trữ, Antigravity…), Anh/Chị vui lòng liên hệ lại với shop nếu có nhu cầu gia hạn ạ.

Thông tin liên hệ hỗ trợ gia hạn:

Zalo: 0559629469
Telegram: @tuawn_anh

Shop sẽ hỗ trợ kiểm tra và gia hạn nhanh chóng trong thời gian sớm nhất.

Cảm ơn Anh/Chị đã tin tưởng và sử dụng dịch vụ.

Rất mong được tiếp tục đồng hành cùng Anh/Chị trong thời gian tới.

Trân trọng.`;
  },

  // --- Init ---
  init() {
    if (!localStorage.getItem(this.KEYS.PLATFORMS)) {
      this.savePlatforms(this.getDefaultPlatforms());
    }
    if (!localStorage.getItem(this.KEYS.PRODUCTS)) {
      this.saveProducts(this.getDefaultProducts());
    } else {
      // Migrate old conflicting colors
      let products = JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
      let migrated = false;
      
      const safeColors = ['#8b5cf6', '#ec4899', '#4f46e5', '#f97316', '#14b8a6', '#d946ef', '#7c3aed'];
      let colorIndex = 0;

      products.forEach(p => {
        const isConflicting = ['#10b981', '#0ea5e9', '#06b6d4', '#3b82f6', '#f59e0b', '#ef4444', '#059669', '#db2777'].includes(p.color);
        if (isConflicting) {
          p.color = safeColors[colorIndex % safeColors.length];
          colorIndex++;
          migrated = true;
        }
      });
      if (migrated) this.saveProducts(products);
    }
    if (!localStorage.getItem(this.KEYS.ORDERS)) {
      localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.ACCOUNTS)) {
      localStorage.setItem(this.KEYS.ACCOUNTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.EMAIL_TEMPLATE)) {
      localStorage.setItem(this.KEYS.EMAIL_TEMPLATE, this.getDefaultEmailTemplate());
    }
  },

  // ==========================================
  // ORDERS
  // ==========================================
  getOrders() {
    return JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
  },

  saveOrders(orders) {
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
  },

  addOrder(order) {
    const orders = this.getOrders();
    order._id = Utils.generateId();
    order.madon = order.madon || Utils.generateOrderId();
    order.createdAt = new Date().toISOString();
    order.history = order.history || [{
      type: 'new',
      date: new Date().toISOString(),
      price: order.price,
      product: order.product
    }];
    orders.unshift(order);
    this.saveOrders(orders);
    this._recalcSlots();
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.addRow('Đơn hàng', order));
    return order;
  },

  updateOrder(id, updates) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o._id === id);
    if (idx === -1) return null;
    orders[idx] = { ...orders[idx], ...updates };
    this.saveOrders(orders);
    this._recalcSlots();
    // Sync to Google Sheet
    const updatedOrder = orders[idx];
    SheetsAPI.queueSync(() => SheetsAPI.updateRow('Đơn hàng', id, updatedOrder));
    return updatedOrder;
  },

  deleteOrder(id) {
    let orders = this.getOrders();
    orders = orders.filter(o => o._id !== id);
    this.saveOrders(orders);
    this._recalcSlots();
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.deleteRow('Đơn hàng', id));
  },

  getOrdersByAccount(accId) {
    return this.getOrders().filter(o => String(o.accId) === String(accId));
  },

  // ==========================================
  // ACCOUNTS
  // ==========================================
  getAccounts() {
    return JSON.parse(localStorage.getItem(this.KEYS.ACCOUNTS) || '[]');
  },

  saveAccounts(accounts) {
    localStorage.setItem(this.KEYS.ACCOUNTS, JSON.stringify(accounts));
  },

  addAccount(account) {
    const accounts = this.getAccounts();
    account._id = Utils.generateId();
    account.accNumber = account.accNumber || (accounts.length > 0
      ? Math.max(...accounts.map(a => a.accNumber || 0)) + 1
      : 1);
    account.createdAt = new Date().toISOString();
    accounts.push(account);
    this.saveAccounts(accounts);
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.addRow('Acc mẹ', account));
    return account;
  },

  updateAccount(id, updates) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a._id === id);
    if (idx === -1) return null;
    accounts[idx] = { ...accounts[idx], ...updates };
    this.saveAccounts(accounts);
    // Sync to Google Sheet
    const updatedAcc = accounts[idx];
    SheetsAPI.queueSync(() => SheetsAPI.updateRow('Acc mẹ', id, updatedAcc));
    return updatedAcc;
  },

  deleteAccount(id) {
    let accounts = this.getAccounts();
    accounts = accounts.filter(a => a._id !== id);
    this.saveAccounts(accounts);
    // Also unassign orders from this account
    const orders = this.getOrders();
    orders.forEach(o => {
      if (o.accId === id) {
        o.accId = '';
        o.accNumber = '';
      }
    });
    this.saveOrders(orders);
    // Full sync both sheets (account deleted + orders modified)
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Acc mẹ', this.getAccounts()));
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Đơn hàng', this.getOrders()));
  },

  getAccountSlotCount(accId) {
    return this.getOrders().filter(o => String(o.accId) === String(accId)).length;
  },

  getAvailableAccounts() {
    const accounts = this.getAccounts();
    return accounts.filter(a => this.getAccountSlotCount(a._id) < 5);
  },

  _recalcSlots() {
    // Slot counts are computed dynamically, no stored field needed
  },

  // ==========================================
  // PLATFORMS
  // ==========================================
  getPlatforms() {
    return JSON.parse(localStorage.getItem(this.KEYS.PLATFORMS) || '[]');
  },

  savePlatforms(platforms) {
    localStorage.setItem(this.KEYS.PLATFORMS, JSON.stringify(platforms));
  },

  addPlatform(name) {
    const platforms = this.getPlatforms();
    if (platforms.includes(name)) return false;
    platforms.push(name);
    this.savePlatforms(platforms);
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Nền tảng', platforms.map(n => ({ name: n }))));
    return true;
  },

  removePlatform(name) {
    let platforms = this.getPlatforms();
    platforms = platforms.filter(p => p !== name);
    this.savePlatforms(platforms);
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Nền tảng', platforms.map(n => ({ name: n }))));
  },

  // ==========================================
  // PRODUCTS
  // ==========================================
  getProducts() {
    return JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
  },

  saveProducts(products) {
    localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products));
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Sản phẩm', products));
  },

  // ==========================================
  // EMAIL TEMPLATE
  // ==========================================
  getEmailTemplate() {
    return localStorage.getItem(this.KEYS.EMAIL_TEMPLATE) || this.getDefaultEmailTemplate();
  },

  saveEmailTemplate(template) {
    localStorage.setItem(this.KEYS.EMAIL_TEMPLATE, template);
  },

  getProductById(id) {
    return this.getProducts().find(p => p.id === id);
  },

  getProductByName(name) {
    return this.getProducts().find(p => p.name === name);
  },

  // ==========================================
  // STATS
  // ==========================================
  getStats() {
    const orders = this.getOrders();
    const accounts = this.getAccounts();
    const paidOrders = orders.filter(o => o.status === 'Đã thanh toán');

    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    const totalOrders = orders.length;
    const totalAccounts = accounts.length;
    const totalSlots = totalAccounts * 5;
    const usedSlots = orders.filter(o => o.accId).length;
    const freeSlots = totalSlots - usedSlots;
    const fullAccounts = accounts.filter(a => this.getAccountSlotCount(a._id) >= 5).length;

    // Revenue by month (last 6 months)
    const monthlyRevenue = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
      monthlyRevenue[key] = 0;
    }
    paidOrders.forEach(o => {
      const d = Utils.parseVietnameseDate(o.orderDate) || new Date(o.orderDate);
      if (d && !isNaN(d)) {
        const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
        if (key in monthlyRevenue) {
          monthlyRevenue[key] += Number(o.price) || 0;
        }
      }
    });

    // By platform
    const byPlatform = {};
    orders.forEach(o => {
      const p = o.platform || 'Khác';
      byPlatform[p] = (byPlatform[p] || 0) + 1;
    });

    // By product
    const byProduct = {};
    orders.forEach(o => {
      const p = o.product || 'Khác';
      byProduct[p] = (byProduct[p] || 0) + 1;
    });

    return {
      totalRevenue,
      totalOrders,
      totalAccounts,
      totalSlots,
      usedSlots,
      freeSlots,
      fullAccounts,
      monthlyRevenue,
      byPlatform,
      byProduct,
      paidOrders: paidOrders.length,
      unpaidOrders: orders.filter(o => o.status !== 'Đã thanh toán').length,
    };
  },

  // ==========================================
  // IMPORT FROM CSV (Google Sheet export)
  // ==========================================
  importOrdersFromCSV(rows) {
    const orders = this.getOrders();
    let imported = 0;

    rows.forEach(row => {
      // Map sheet columns to our data structure
      let madon = row['Username / Mã ĐH'] || row['Mã ĐH'] || row['Username'] || row['madon'] || '';
      let email = (row['Email'] || row['email'] || '').replace(/[\r\n\s]+/g, '').trim();
      const product = row['Sản phẩm'] || row['product'] || '';
      const status = row['Trạng thái thanh toán'] || row['status'] || 'Đã thanh toán';
      const orderDate = row['Ngày đặt hàng'] || row['orderDate'] || '';
      const priceStr = row['Giá'] || row['price'] || '0';
      const platform = row['Nền tảng bán hàng'] || row['platform'] || '';
      const accNumber = row['Acc'] || row['accNumber'] || '';
      const note = row['Ghi chú'] || row['note'] || '';

      // Skip rows that have neither email nor madon (likely empty or junk rows)
      if (!email && !madon) return;

      // Parse price (handle "40.000 đ" or "40000" formats)
      const price = Number(priceStr.replace(/[^\d]/g, '')) || 0;

      // Find matching account by accNumber
      let accId = '';
      if (accNumber) {
        const accounts = this.getAccounts();
        const acc = accounts.find(a => String(a.accNumber) === String(accNumber));
        if (acc) accId = acc._id;
      }

      // Check for existing duplicate to prevent double import.
      // Since 'Username / Mã ĐH' sometimes contains non-unique Names (like 'Trung Hậu')
      // instead of unique IDs, we check a combination of fields.
      const isDuplicate = orders.some(o => {
        const matchMadon = madon ? (o.madon === madon) : true;
        return matchMadon && 
               o.email === email && 
               o.product === product && 
               o.orderDate === orderDate && 
               o.accNumber === String(accNumber);
      });

      if (isDuplicate) return;

      // If madon is missing, generate one automatically
      madon = madon || Utils.generateOrderId();

      const order = {
        _id: Utils.generateId(),
        madon,
        email,
        product,
        status,
        orderDate,
        price,
        platform,
        accId,
        accNumber: String(accNumber),
        note,
        createdAt: new Date().toISOString(),
      };

      orders.push(order);
      imported++;
    });

    this.saveOrders(orders);
    return imported;
  },

  importAccountsFromCSV(rows) {
    const accounts = this.getAccounts();
    let imported = 0;

    rows.forEach(row => {
      const accNumber = Number(row['Acc'] || row['accNumber'] || 0);
      // Handle various header names and clean whitespace/newlines
      let email = (row['Mail'] || row['Email'] || row['email'] || '').replace(/[\r\n\s]+/g, '').trim();
      const plan = (row['Gói'] || row['plan'] || '').trim();
      const note = (row['Ghi chú'] || row['note'] || '').trim();

      if (!email) return;

      // Check for existing duplicate by email
      if (accounts.some(a => a.email === email)) return;

      const account = {
        _id: Utils.generateId(),
        accNumber,
        email,
        plan,
        note,
        createdAt: new Date().toISOString(),
      };

      accounts.push(account);
      imported++;
    });

    this.saveAccounts(accounts);
    return imported;
  },
};
