// ============================================
// APP - Main Application Controller
// ============================================

const App = {
  currentPage: 'dashboard',

  init() {
    DataManager.init();
    this._bindNavigation();
    this._bindGlobalEvents();
    this._handleHash();
    this.updateBadges();
    this._initSheetSync();
  },

  // --- Google Sheets auto-sync on startup ---
  async _initSheetSync() {
    if (!SheetsAPI.isConnected()) {
      SheetsAPI._updateSyncUI('idle');
      return;
    }
    try {
      SheetsAPI._updateSyncUI('syncing');
      await SheetsAPI.fullPull();
      SheetsAPI._updateSyncUI('connected');
      // Re-render current page with fresh data
      this._renderPage(this.currentPage);
      this.updateBadges();
    } catch (err) {
      console.error('Auto-sync failed:', err);
      SheetsAPI._updateSyncUI('error');
    }
  },

  // --- Navigation ---
  navigate(page) {
    this.currentPage = page;
    window.location.hash = page;

    // Update nav active state
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Show/hide pages
    document.querySelectorAll('.page-section').forEach(el => {
      el.classList.toggle('active', el.id === `page-${page}`);
    });

    // Update title
    const titles = {
      dashboard: '📊 Tổng quan',
      orders: '📋 Quản lý đơn hàng',
      accounts: '👤 Quản lý Acc mẹ',
      settings: '⚙️ Cài đặt',
    };
    document.getElementById('page-title').textContent = titles[page] || '';

    // Render page
    this._renderPage(page);

    // Close mobile sidebar
    document.querySelector('.sidebar')?.classList.remove('open');
  },

  _renderPage(page) {
    switch (page) {
      case 'dashboard':
        Dashboard.render();
        break;
      case 'orders':
        Orders.render();
        break;
      case 'accounts':
        Accounts.render();
        break;
      case 'settings':
        this._renderSettings();
        break;
    }
  },

  _handleHash() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    this.navigate(hash);
  },

  _bindNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(el.dataset.page);
      });
    });

    window.addEventListener('hashchange', () => this._handleHash());
  },

  _bindGlobalEvents() {
    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
      });
    }

    // Close sidebar on overlay click (mobile)
    document.addEventListener('click', (e) => {
      const sidebar = document.querySelector('.sidebar');
      const menuBtn = document.getElementById('menu-toggle');
      if (sidebar?.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !menuBtn?.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });

    // Modal close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
          m.classList.remove('active');
        });
      }
    });

    // Global search
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = globalSearch.value.trim();
          if (q) {
            this.navigate('orders');
            setTimeout(() => {
              const orderSearch = document.getElementById('order-search');
              if (orderSearch) {
                orderSearch.value = q;
                orderSearch.dispatchEvent(new Event('input'));
              }
            }, 100);
          }
        }
      });
    }
  },

  updateBadges() {
    const stats = DataManager.getStats();
    const ordersBadge = document.getElementById('badge-orders');
    const accBadge = document.getElementById('badge-accounts');

    if (ordersBadge) {
      ordersBadge.textContent = stats.totalOrders;
      ordersBadge.style.display = stats.totalOrders > 0 ? '' : 'none';
    }
    if (accBadge) {
      accBadge.textContent = stats.freeSlots;
      accBadge.style.display = stats.freeSlots > 0 ? '' : 'none';
    }
  },

  // --- Settings Page ---
  _renderSettings() {
    const container = document.getElementById('page-settings');
    const platforms = DataManager.getPlatforms();
    const products = DataManager.getProducts();

    const sheetsUrl = SheetsAPI.getUrl();
    const isConnected = SheetsAPI.isConnected();

    container.innerHTML = `
      <!-- Google Sheets Connection -->
      <div class="card mb-4" style="border-color: rgba(59, 130, 246, 0.3)">
        <div class="card-header">
          <div class="card-title">🔗 Kết nối Google Sheet (Database)</div>
          <span id="settings-sync-status" class="sync-indicator ${isConnected ? 'sync-success' : 'sync-idle'}">${isConnected ? '🟢 Đã kết nối' : '⏸ Chưa kết nối'}</span>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Dán URL Web App từ Google Apps Script để lưu dữ liệu lên Google Sheet. Dữ liệu sẽ tự động đồng bộ mỗi khi bạn thêm/sửa/xoá.</p>
          
          <div class="form-group">
            <label class="form-label">URL Google Apps Script Web App</label>
            <div style="display:flex;gap:8px">
              <input type="text" class="form-control" id="f-sheets-url" value="${Utils.escapeHtml(sheetsUrl)}" placeholder="https://script.google.com/macros/s/.../exec" style="flex:1">
              <button class="btn btn-primary" onclick="App.saveSheetUrl()">💾 Lưu</button>
              <button class="btn btn-secondary" onclick="App.testSheetConnection()">🔌 Test</button>
            </div>
            <div class="form-hint">Xem file <strong>google-apps-script.js</strong> trong thư mục dự án để lấy hướng dẫn deploy</div>
          </div>

          ${isConnected ? `
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            <button class="btn btn-success" onclick="App.pullFromSheet()" id="btn-pull">
              📥 Kéo dữ liệu từ Sheet
            </button>
            <button class="btn btn-primary" onclick="App.pushToSheet()" id="btn-push">
              📤 Đẩy dữ liệu lên Sheet
            </button>
            <button class="btn btn-secondary" onclick="App.fullSync()" id="btn-full-sync">
              🔄 Đồng bộ 2 chiều
            </button>
          </div>
          <p class="text-muted mt-2" style="font-size:11px">💡 <strong>Kéo từ Sheet</strong>: Lấy dữ liệu mới nhất từ Google Sheet về app. <strong>Đẩy lên Sheet</strong>: Ghi đè dữ liệu trên Sheet bằng dữ liệu trong app.</p>
          ` : `
          <div style="margin-top:16px;padding:16px;background:rgba(245,158,11,0.08);border-radius:var(--radius-md);border:1px solid rgba(245,158,11,0.2)">
            <p style="font-size:13px;color:#fbbf24;margin:0">⚠️ Chưa kết nối. Hãy dán URL Web App và nhấn <strong>Lưu</strong> → <strong>Test</strong> để kiểm tra kết nối.</p>
          </div>
          `}
        </div>
      </div>

      <!-- Platform Management -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">🏪 Quản lý nền tảng bán hàng</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Thêm hoặc xoá các nền tảng bán hàng. Danh sách này sẽ hiển thị trong form đơn hàng.</p>
          <div class="tag-list" id="platform-tags">
            ${platforms.map(p => `
              <div class="tag-item">
                ${Utils.escapeHtml(p)}
                <button class="tag-remove" onclick="App.removePlatform('${Utils.escapeHtml(p)}')" title="Xoá">✕</button>
              </div>
            `).join('')}
            <button class="tag-add" onclick="App.addPlatformPrompt()">+ Thêm nền tảng</button>
          </div>
        </div>
      </div>

      <!-- Product Management -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">📦 Quản lý sản phẩm & giá</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Cấu hình các gói sản phẩm và mức giá tương ứng.</p>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tên sản phẩm</th>
                  <th>Giá</th>
                  <th>Thời hạn (tháng)</th>
                  <th>Màu</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody id="products-tbody">
                ${products.map((p, i) => `
                  <tr>
                    <td><strong>${Utils.escapeHtml(p.name)}</strong></td>
                    <td>${Utils.formatCurrency(p.price)}</td>
                    <td>${p.duration} tháng</td>
                    <td><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${p.color};vertical-align:middle"></span></td>
                    <td>
                      <button class="btn-icon" title="Sửa" onclick="App.editProduct(${i})">✏️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="mt-4">
            <button class="btn btn-secondary" onclick="App.addProductPrompt()">➕ Thêm sản phẩm</button>
          </div>
        </div>
      </div>

      <!-- Import/Export -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">📥 Import dữ liệu từ CSV</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Import dữ liệu từ Google Sheet (xuất dạng CSV). Hỗ trợ import đơn hàng và acc mẹ.</p>

          <div class="form-row mb-4">
            <div>
              <div class="settings-title">📋 Import đơn hàng</div>
              <div class="import-area" onclick="document.getElementById('import-orders-file').click()">
                <div class="import-icon">📄</div>
                <div class="import-text">Click để chọn file CSV đơn hàng</div>
                <div class="import-hint">Headers: Username / Mã ĐH, Email, Sản phẩm, Trạng thái thanh toán, Ngày đặt hàng, Giá, Nền tảng bán hàng, Acc, Ghi chú</div>
              </div>
              <input type="file" id="import-orders-file" accept=".csv" style="display:none" onchange="App.importOrdersCSV(event)">
            </div>
            <div>
              <div class="settings-title">👤 Import acc mẹ</div>
              <div class="import-area" onclick="document.getElementById('import-accounts-file').click()">
                <div class="import-icon">📄</div>
                <div class="import-text">Click để chọn file CSV acc mẹ</div>
                <div class="import-hint">Headers: Acc, Mail, Gói, Ghi chú</div>
              </div>
              <input type="file" id="import-accounts-file" accept=".csv" style="display:none" onchange="App.importAccountsCSV(event)">
            </div>
          </div>
        </div>
      </div>

      <!-- Backup -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">💾 Sao lưu & Khôi phục</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Xuất toàn bộ dữ liệu ra file JSON để sao lưu, hoặc khôi phục từ file backup.</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="DataManager.exportBackup(); Utils.showToast('Đã xuất file backup', 'success')">📤 Xuất Backup (JSON)</button>
            <button class="btn btn-secondary" onclick="document.getElementById('restore-file-input2').click()">📥 Khôi phục từ Backup</button>
            <input type="file" id="restore-file-input2" accept=".json" style="display:none" onchange="App.restoreBackup(event)">
          </div>
        </div>
      </div>
    `;
  },

  // --- Platform management ---
  addPlatformPrompt() {
    const name = prompt('Nhập tên nền tảng bán hàng mới:');
    if (!name || !name.trim()) return;
    if (DataManager.addPlatform(name.trim())) {
      Utils.showToast(`Đã thêm nền tảng "${name.trim()}"`, 'success');
      this._renderSettings();
    } else {
      Utils.showToast('Nền tảng này đã tồn tại', 'warning');
    }
  },

  removePlatform(name) {
    DataManager.removePlatform(name);
    Utils.showToast(`Đã xoá nền tảng "${name}"`, 'success');
    this._renderSettings();
  },

  // --- Product management ---
  editProduct(index) {
    const products = DataManager.getProducts();
    const p = products[index];
    if (!p) return;

    const newPrice = prompt(`Nhập giá mới cho "${p.name}" (VNĐ):`, p.price);
    if (newPrice === null) return;
    products[index].price = Number(newPrice) || p.price;
    DataManager.saveProducts(products);
    Utils.showToast('Đã cập nhật giá sản phẩm', 'success');
    this._renderSettings();
  },

  addProductPrompt() {
    const name = prompt('Tên sản phẩm:');
    if (!name) return;
    const price = prompt('Giá (VNĐ):', '40000');
    if (price === null) return;
    const duration = prompt('Thời hạn (tháng):', '1');
    if (duration === null) return;

    const colors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];
    const products = DataManager.getProducts();
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    products.push({
      id,
      name: name.trim(),
      price: Number(price) || 0,
      color: colors[products.length % colors.length],
      duration: Number(duration) || 1,
    });

    DataManager.saveProducts(products);
    Utils.showToast(`Đã thêm sản phẩm "${name}"`, 'success');
    this._renderSettings();
  },

  // --- Import CSV ---
  async importOrdersCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await Utils.readFile(file);
      const rows = Utils.parseCSV(text);
      const count = DataManager.importOrdersFromCSV(rows);
      Utils.showToast(`Đã import ${count} đơn hàng mới`, 'success');
      this.updateBadges();
      // Sync imported data to Google Sheet
      if (SheetsAPI.isConnected() && count > 0) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Đơn hàng', DataManager.getOrders()));
      }
    } catch (err) {
      Utils.showToast('Lỗi đọc file CSV: ' + err.message, 'error');
    }
    event.target.value = '';
  },

  async importAccountsCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await Utils.readFile(file);
      const rows = Utils.parseCSV(text);
      const count = DataManager.importAccountsFromCSV(rows);
      Utils.showToast(`Đã import ${count} acc mẹ mới`, 'success');
      this.updateBadges();
      // Sync imported data to Google Sheet
      if (SheetsAPI.isConnected() && count > 0) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Acc mẹ', DataManager.getAccounts()));
      }
    } catch (err) {
      Utils.showToast('Lỗi đọc file CSV: ' + err.message, 'error');
    }
    event.target.value = '';
  },

  // ==========================================
  // GOOGLE SHEETS CONNECTION
  // ==========================================
  saveSheetUrl() {
    const url = document.getElementById('f-sheets-url').value.trim();
    SheetsAPI.setUrl(url);
    if (url) {
      Utils.showToast('Đã lưu URL Google Apps Script', 'success');
    } else {
      Utils.showToast('Đã xoá kết nối Google Sheet', 'info');
      SheetsAPI._updateSyncUI('idle');
    }
    this._renderSettings();
  },

  async testSheetConnection() {
    const url = document.getElementById('f-sheets-url').value.trim();
    if (!url) {
      Utils.showToast('Vui lòng nhập URL trước', 'error');
      return;
    }

    SheetsAPI.setUrl(url);
    Utils.showToast('Đang kiểm tra kết nối...', 'info');

    try {
      await SheetsAPI.testConnection();
      Utils.showToast('✅ Kết nối thành công! Dữ liệu sẽ tự động đồng bộ.', 'success');
      this._renderSettings();
    } catch (err) {
      Utils.showToast('❌ Không kết nối được: ' + err.message, 'error');
    }
  },

  async pullFromSheet() {
    try {
      Utils.showToast('Đang kéo dữ liệu từ Google Sheet...', 'info');
      await SheetsAPI.fullPull();
      Utils.showToast('✅ Đã cập nhật dữ liệu từ Google Sheet', 'success');
      this._renderPage(this.currentPage);
      this.updateBadges();
    } catch (err) {
      Utils.showToast('❌ Lỗi: ' + err.message, 'error');
    }
  },

  async pushToSheet() {
    try {
      Utils.showToast('Đang đẩy dữ liệu lên Google Sheet...', 'info');
      await SheetsAPI.fullSync();
      Utils.showToast('✅ Đã đẩy dữ liệu lên Google Sheet', 'success');
    } catch (err) {
      Utils.showToast('❌ Lỗi: ' + err.message, 'error');
    }
  },

  async fullSync() {
    try {
      Utils.showToast('Đang đồng bộ 2 chiều...', 'info');
      // Pull first, then push to merge
      await SheetsAPI.fullPull();
      await SheetsAPI.fullSync();
      Utils.showToast('✅ Đồng bộ thành công', 'success');
      this._renderPage(this.currentPage);
      this.updateBadges();
    } catch (err) {
      Utils.showToast('❌ Lỗi: ' + err.message, 'error');
    }
  },
};

// --- Initialize on DOM ready ---
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
