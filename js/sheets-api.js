// ============================================
// SHEETS API - Communication with Google Apps Script
// ============================================

const SheetsAPI = {
  URL_KEY: 'gaf_sheets_url',

  // --- Get/Set Web App URL ---
  getUrl() {
    return localStorage.getItem(this.URL_KEY) || '';
  },

  setUrl(url) {
    localStorage.setItem(this.URL_KEY, url.trim());
  },

  isConnected() {
    return !!this.getUrl();
  },

  // --- HTTP Helpers ---
  async _get(params = {}) {
    const url = this.getUrl();
    if (!url) throw new Error('Chưa cấu hình URL Google Apps Script');

    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    const response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  async _post(body) {
    const url = this.getUrl();
    if (!url) throw new Error('Chưa cấu hình URL Google Apps Script');

    const response = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  // ==========================================
  // DATA OPERATIONS
  // ==========================================

  // Pull all data from Google Sheet
  async pullAll() {
    const result = await this._get({ action: 'getData' });
    if (result.error) throw new Error(result.error);
    return result.data;
  },

  // Push all data to Google Sheet (full sync)
  async pushAll(data) {
    const result = await this._post({
      action: 'syncAll',
      data: data,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // Sync a single sheet
  async syncSheet(sheetName, dataArray) {
    const result = await this._post({
      action: 'syncSheet',
      sheet: sheetName,
      data: dataArray,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // Add a single row
  async addRow(sheetName, rowData) {
    const result = await this._post({
      action: 'addRow',
      sheet: sheetName,
      row: rowData,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // Update a single row by _id
  async updateRow(sheetName, id, rowData) {
    const result = await this._post({
      action: 'updateRow',
      sheet: sheetName,
      id: id,
      row: rowData,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // Delete a single row by _id
  async deleteRow(sheetName, id) {
    const result = await this._post({
      action: 'deleteRow',
      sheet: sheetName,
      id: id,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  async sendEmails(emails) {
    const result = await this._post({
      action: 'sendEmails',
      emails: emails,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // ==========================================
  // SYNC MANAGER
  // ==========================================

  _syncStatus: 'idle', // 'idle', 'syncing', 'success', 'error'
  _syncQueue: [],
  _syncTimer: null,

  getSyncStatus() {
    return this._syncStatus;
  },

  _setSyncStatus(status) {
    this._syncStatus = status;
    this._updateSyncUI(status);
  },

  _updateSyncUI(status) {
    const indicator = document.getElementById('sync-status');
    if (!indicator) return;

    const states = {
      idle: { text: '⏸ Chưa kết nối', class: 'sync-idle' },
      syncing: { text: '🔄 Đang đồng bộ...', class: 'sync-syncing' },
      success: { text: '✅ Đã đồng bộ', class: 'sync-success' },
      error: { text: '❌ Lỗi đồng bộ', class: 'sync-error' },
      connected: { text: '🟢 Đã kết nối', class: 'sync-success' },
    };

    const state = states[status] || states.idle;
    indicator.textContent = state.text;
    indicator.className = `sync-indicator ${state.class}`;
  },

  // Queue a background sync operation
  queueSync(operation) {
    if (!this.isConnected()) return;

    this._syncQueue.push(operation);

    // Debounce: wait 500ms before processing queue
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => this._processQueue(), 500);
  },

  async _processQueue() {
    if (this._syncQueue.length === 0) return;

    // Take all queued operations
    const operations = [...this._syncQueue];
    this._syncQueue = [];

    this._setSyncStatus('syncing');

    try {
      // If there are many operations, do a full sync instead
      if (operations.length > 3) {
        await this.fullSync();
      } else {
        // Process operations individually
        for (const op of operations) {
          await op();
        }
      }
      this._setSyncStatus('success');
    } catch (err) {
      console.error('Sync error:', err);
      this._setSyncStatus('error');
      // Don't show toast for every sync error, just update UI
    }
  },

  // Full sync: push all local data to Google Sheet
  async fullSync() {
    if (!this.isConnected()) {
      throw new Error('Chưa kết nối Google Sheet');
    }

    this._setSyncStatus('syncing');

    try {
      const data = {
        orders: DataManager.getOrders(),
        accounts: DataManager.getAccounts(),
        platforms: DataManager.getPlatforms(),
        products: DataManager.getProducts(),
        settings: [
          { key: 'emailTemplate', value: DataManager.getEmailTemplate() }
        ]
      };

      await this.pushAll(data);
      this._setSyncStatus('success');
      return true;
    } catch (err) {
      this._setSyncStatus('error');
      throw err;
    }
  },

  // Full pull: get all data from Google Sheet → update localStorage
  async fullPull() {
    if (!this.isConnected()) {
      throw new Error('Chưa kết nối Google Sheet');
    }

    this._setSyncStatus('syncing');

    try {
      const sheetData = await this.pullAll();

      // Map sheet names to localStorage keys
      if (sheetData['Đơn hàng']) {
        const orders = sheetData['Đơn hàng'].map(row => {
          let history = [];
          if (row.history) {
            try {
              history = JSON.parse(row.history);
            } catch (e) {
              console.warn('Failed to parse history for order', row._id);
            }
          }
          return {
            ...row,
            price: Number(row.price) || 0,
            history: history,
          };
        });
        DataManager.saveOrders(orders);
      }

      if (sheetData['Acc mẹ']) {
        const accounts = sheetData['Acc mẹ'].map(row => ({
          ...row,
          accNumber: Number(row.accNumber) || 0,
        }));
        DataManager.saveAccounts(accounts);
      }

      if (sheetData['Nền tảng']) {
        const platforms = sheetData['Nền tảng'].map(row => row.name).filter(n => n);
        if (platforms.length > 0) DataManager.savePlatforms(platforms);
      }

      if (sheetData['Sản phẩm']) {
        const products = sheetData['Sản phẩm'].map(row => ({
          ...row,
          price: Number(row.price) || 0,
          duration: Number(row.duration) || 1,
        }));
        if (products.length > 0) DataManager.saveProducts(products);
      }

      if (sheetData['Cài đặt']) {
        const settingsMap = {};
        sheetData['Cài đặt'].forEach(row => {
          if (row.key) settingsMap[row.key] = row.value || '';
        });
        
        if (settingsMap['emailTemplate']) {
          DataManager.saveEmailTemplate(settingsMap['emailTemplate']);
        }
      }

      this._setSyncStatus('success');
      return true;
    } catch (err) {
      this._setSyncStatus('error');
      throw err;
    }
  },

  // Test connection
  async testConnection() {
    try {
      this._setSyncStatus('syncing');
      const result = await this._get({ action: 'getData' });
      if (result.error) throw new Error(result.error);
      this._setSyncStatus('connected');
      return true;
    } catch (err) {
      this._setSyncStatus('error');
      throw err;
    }
  },
};
