// ============================================
// APP - Main Application Controller
// ============================================

const App = {
  currentPage: 'dashboard',
  editingProductIndex: null,

  init() {
    DataManager.init();
    
    // Load Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = '☀️';
    }

    this._bindNavigation();
    this._bindGlobalEvents();
    
    // Check Authentication state
    if (SheetsAPI.isConnected()) {
      this._showApp();
    } else {
      this._showLogin();
    }
  },

  _showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-layout').style.display = 'flex';
    this._handleHash();
    this.updateBadges();
    this._initSheetSync();
  },

  _showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-layout').style.display = 'none';
  },

  async handleLogin() {
    const urlInput = document.getElementById('login-url-input');
    const btnText = document.querySelector('#login-submit-btn .btn-text');
    const btnLoader = document.querySelector('#login-submit-btn .btn-loader');
    const errorMsg = document.getElementById('login-error');
    const url = urlInput.value.trim();

    if (!url) {
      errorMsg.textContent = 'Vui lòng nhập khoá kết nối!';
      errorMsg.style.display = 'block';
      this._shakeLogin();
      return;
    }

    // UI Loading state
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    errorMsg.style.display = 'none';
    document.getElementById('login-submit-btn').disabled = true;

    // Save temporarily to test
    SheetsAPI.setUrl(url);

    try {
      await SheetsAPI.testConnection();
      // Success
      Utils.showToast('✅ Xác thực thành công!', 'success');
      this._showApp();
    } catch (err) {
      SheetsAPI.setUrl(''); // Clear if failed
      errorMsg.textContent = '❌ Lỗi kết nối: Khoá không hợp lệ hoặc Database lỗi.';
      errorMsg.style.display = 'block';
      this._shakeLogin();
    } finally {
      // Reset UI
      btnText.style.display = 'inline-block';
      btnLoader.style.display = 'none';
      document.getElementById('login-submit-btn').disabled = false;
    }
  },

  _shakeLogin() {
    const card = document.querySelector('.login-card');
    card.classList.remove('shake');
    void card.offsetWidth; // trigger reflow
    card.classList.add('shake');
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    const btn = document.getElementById('theme-toggle');
    
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      btn.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      btn.textContent = '🌙';
    }
    
    localStorage.setItem('theme', newTheme);
  },

  handleLogout() {
    if (confirm('Bạn có chắc chắn muốn ngắt kết nối và đăng xuất? (Sẽ cần nhập lại Khoá kết nối)')) {
      SheetsAPI.setUrl(''); // Remove URL
      Utils.showToast('Đã đăng xuất an toàn', 'info');
      document.getElementById('login-url-input').value = '';
      this._showLogin();
    }
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
      accounts: '👤 Tài khoản Quản lý',
      renewals: '⏳ Quản lý gia hạn',
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
      case 'renewals':
        Renewals.render();
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

    // Command Menu (Ctrl + K)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        App.openCommandMenu();
      }
    });

    const cmdInput = document.getElementById('cmd-search-input');
    if (cmdInput) {
      cmdInput.addEventListener('input', (e) => {
        App.handleCommandSearch(e.target.value.trim());
      });
    }
  },

  openCommandMenu() {
    const modal = document.getElementById('cmd-modal');
    const input = document.getElementById('cmd-search-input');
    modal.classList.add('active');
    input.value = '';
    this.handleCommandSearch('');
    setTimeout(() => input.focus(), 100);
  },

  handleCommandSearch(query) {
    const resultsContainer = document.getElementById('cmd-search-results');
    if (!query) {
      resultsContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">Gõ từ khoá để tìm kiếm siêu tốc (Tên, Email, Mã đơn...)</div>';
      return;
    }

    const q = query.toLowerCase();
    const orders = DataManager.getOrders();
    const accounts = DataManager.getAccounts();
    let resultsHtml = '';

    // Search Orders
    const matchedOrders = orders.filter(o => 
      o.email.toLowerCase().includes(q) || 
      o.madon.toLowerCase().includes(q) || 
      (o.note && o.note.toLowerCase().includes(q))
    ).slice(0, 5);

    if (matchedOrders.length > 0) {
      resultsHtml += '<div style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin: 8px 8px 4px 8px;">Đơn hàng</div>';
      matchedOrders.forEach(o => {
        resultsHtml += `
          <div onclick="App.jumpToOrder('${o._id}')" style="padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;" onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background='transparent'">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 18px;">📄</span>
              <div>
                <div style="color: var(--text-primary); font-weight: 500;">${Utils.escapeHtml(o.email)}</div>
                <div style="color: var(--text-muted); font-size: 12px;">${o.madon} • ${o.product}</div>
              </div>
            </div>
            <span style="font-size: 12px; background: var(--bg-input); padding: 4px 8px; border-radius: 4px;">Đi tới ➡️</span>
          </div>
        `;
      });
    }

    // Search Accounts
    const matchedAccounts = accounts.filter(a => 
      a.email.toLowerCase().includes(q) || 
      (a.note && a.note.toLowerCase().includes(q))
    ).slice(0, 3);

    if (matchedAccounts.length > 0) {
      resultsHtml += '<div style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin: 16px 8px 4px 8px;">TK Quản lý</div>';
      matchedAccounts.forEach(a => {
        resultsHtml += `
          <div onclick="App.jumpToAccount('${a._id}')" style="padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;" onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background='transparent'">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 18px;">👤</span>
              <div>
                <div style="color: var(--text-primary); font-weight: 500;">${Utils.escapeHtml(a.email)}</div>
                <div style="color: var(--text-muted); font-size: 12px;">Plan: ${a.plan || 'N/A'}</div>
              </div>
            </div>
            <span style="font-size: 12px; background: var(--bg-input); padding: 4px 8px; border-radius: 4px;">Đi tới ➡️</span>
          </div>
        `;
      });
    }

    if (!matchedOrders.length && !matchedAccounts.length) {
      resultsHtml = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">Không tìm thấy kết quả nào cho "' + Utils.escapeHtml(query) + '"</div>';
    }

    resultsContainer.innerHTML = resultsHtml;
  },

  jumpToOrder(id) {
    document.getElementById('cmd-modal').classList.remove('active');
    this.navigate('orders');
    setTimeout(() => {
      const orderSearch = document.getElementById('order-search');
      if (orderSearch) {
        const order = DataManager.getOrders().find(o => o._id === id);
        if (order) {
          orderSearch.value = order.email; // Use email to filter in orders page
          orderSearch.dispatchEvent(new Event('input'));
        }
      }
    }, 100);
  },

  jumpToAccount(id) {
    document.getElementById('cmd-modal').classList.remove('active');
    this.navigate('accounts');
    setTimeout(() => {
      const accSearch = document.getElementById('acc-search');
      if (accSearch) {
        const acc = DataManager.getAccounts().find(a => a._id === id);
        if (acc) {
          accSearch.value = acc.email;
          accSearch.dispatchEvent(new Event('input'));
        }
      }
    }, 100);
  },

  updateBadges() {
    const stats = DataManager.getStats();
    const ordersBadge = document.getElementById('badge-orders');
    const accBadge = document.getElementById('badge-accounts');
    const renewalsBadge = document.getElementById('badge-renewals');

    if (ordersBadge) {
      ordersBadge.textContent = stats.totalOrders;
      ordersBadge.style.display = stats.totalOrders > 0 ? '' : 'none';
    }
    if (accBadge) {
      accBadge.textContent = stats.freeSlots;
      accBadge.style.display = stats.freeSlots > 0 ? '' : 'none';
    }
    if (renewalsBadge) {
      // Calculate expiring orders (<= 7 days)
      const orders = DataManager.getOrders();
      const products = DataManager.getProducts();
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let expiringCount = 0;

      orders.forEach(o => {
        if (!o.email || !o.orderDate || o.status !== 'Đã thanh toán') return;
        const orderDate = Utils.parseVietnameseDate(o.orderDate);
        if (!orderDate || isNaN(orderDate)) return;
        const product = products.find(p => p.name === o.product);
        const durationMonths = product ? (product.duration || 1) : 1;
        const expDate = new Date(orderDate);
        expDate.setMonth(expDate.getMonth() + durationMonths);
        const diffTime = expDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          expiringCount++;
        }
      });

      renewalsBadge.textContent = expiringCount;
      renewalsBadge.style.display = expiringCount > 0 ? '' : 'none';
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
          <div class="card-title">🔗 Trạng thái Database</div>
          <span id="settings-sync-status" class="sync-indicator ${isConnected ? 'sync-success' : 'sync-idle'}">${isConnected ? '🟢 Đã kết nối' : '⏸ Chưa kết nối'}</span>
        </div>
        <div class="card-body">
          ${isConnected ? `
          <div style="padding: 16px; background: rgba(16, 185, 129, 0.08); border-radius: var(--radius-md); border: 1px solid rgba(16, 185, 129, 0.2); margin-bottom: 20px;">
            <p style="font-size: 14px; color: #10b981; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>✅</span>Hệ thống đang được kết nối an toàn tới Google Sheets Database.
            </p>
          </div>
          <p class="text-muted mb-3" style="font-size:12px">Đồng bộ thủ công nếu cần thiết (Hệ thống vốn đã tự động đồng bộ khi bạn thêm/sửa/xoá dữ liệu):</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
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
          ` : `
          <div style="margin-top:16px;padding:16px;background:rgba(245,158,11,0.08);border-radius:var(--radius-md);border:1px solid rgba(245,158,11,0.2)">
            <p style="font-size:13px;color:#fbbf24;margin:0">⚠️ Bị ngắt kết nối. Vui lòng tải lại trang và Đăng nhập lại.</p>
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
          <div class="mt-4" style="padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05)">
            <p class="text-muted mb-2" style="font-size:12px">Nếu bạn có dữ liệu cũ bị sai khác chữ hoa chữ thường (vd: "datammo" và "Datammo"), hãy bấm nút dưới đây để đồng nhất toàn bộ về viết hoa chữ cái đầu.</p>
            <button class="btn btn-secondary" onclick="App.normalizePlatforms()">✨ Chuẩn hoá toàn bộ Nền tảng</button>
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
                      <button class="btn-icon text-danger" title="Xoá" onclick="App.deleteProduct(${i})">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="mt-4">
            <button class="btn btn-secondary" onclick="App.openProductModal()">➕ Thêm sản phẩm</button>
          </div>
        </div>
      </div>

      <!-- Email Template -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">✉️ Mẫu Email nhắc gia hạn</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Tuỳ chỉnh mẫu Email để gửi thông báo nhắc gia hạn. Sử dụng biến <code>[Ten_Goi]</code> để hệ thống tự động điền "1 Tháng", "6 Tháng"...</p>
          <div class="form-group">
            <textarea class="form-control" id="settings-email-template" rows="12" style="font-family: monospace; font-size: 13px;">${Utils.escapeHtml(DataManager.getEmailTemplate())}</textarea>
          </div>
          <div class="mt-2">
            <button class="btn btn-primary" onclick="App.saveEmailTemplate()">💾 Lưu mẫu Email</button>
          </div>
        </div>
      </div>

      <!-- Import/Export -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">📥 Import dữ liệu từ CSV</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Import dữ liệu từ Google Sheet (xuất dạng CSV). Hỗ trợ import đơn hàng và Tài khoản Quản lý.</p>

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
              <div class="settings-title">👤 Import Tài khoản Quản lý</div>
              <div class="import-area" onclick="document.getElementById('import-accounts-file').click()">
                <div class="import-icon">📄</div>
                <div class="import-text">Click để chọn file CSV Tài khoản Quản lý</div>
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
  openProductModal(index = null) {
    this.editingProductIndex = index;
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const nameInput = document.getElementById('product-name');
    const priceInput = document.getElementById('product-price');
    const durationInput = document.getElementById('product-duration');

    if (index !== null) {
      const products = DataManager.getProducts();
      const p = products[index];
      title.textContent = 'Sửa thông tin sản phẩm';
      nameInput.value = p.name;
      priceInput.value = p.price;
      durationInput.value = p.duration;
    } else {
      title.textContent = 'Thêm sản phẩm mới';
      document.getElementById('product-form').reset();
      priceInput.value = '40000';
      durationInput.value = '1';
    }

    modal.classList.add('active');
  },

  closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
    this.editingProductIndex = null;
  },

  saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    const price = document.getElementById('product-price').value;
    const duration = document.getElementById('product-duration').value;

    if (!name || !price || !duration) {
      Utils.showToast('Vui lòng điền đủ thông tin', 'warning');
      return;
    }

    const products = DataManager.getProducts();

    if (this.editingProductIndex !== null) {
      // Edit mode
      const oldName = products[this.editingProductIndex].name;

      products[this.editingProductIndex].name = name;
      products[this.editingProductIndex].price = Number(price);
      products[this.editingProductIndex].duration = Number(duration);

      // Update all existing orders if product name changed
      if (oldName !== name) {
        const orders = DataManager.getOrders();
        let changed = false;
        orders.forEach(o => {
          if (o.product === oldName) {
            o.product = name;
            changed = true;
          }
        });
        if (changed) {
          DataManager.saveOrders(orders);
          if (SheetsAPI.isConnected()) {
            SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Đơn hàng', orders));
          }
        }
      }

      Utils.showToast('Đã cập nhật sản phẩm', 'success');
    } else {
      // Add mode
      const colors = ['#8b5cf6', '#ec4899', '#4f46e5', '#f97316', '#14b8a6', '#d946ef', '#7c3aed'];
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      products.push({
        id,
        name: name,
        price: Number(price),
        color: colors[products.length % colors.length],
        duration: Number(duration),
      });
      Utils.showToast(`Đã thêm sản phẩm "${name}"`, 'success');
    }

    DataManager.saveProducts(products);
    if (SheetsAPI.isConnected()) {
      SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Sản phẩm', products));
    }
    this.closeProductModal();
    this._renderSettings();
  },

  editProduct(index) {
    this.openProductModal(index);
  },

  deleteProduct(index) {
    const products = DataManager.getProducts();
    const p = products[index];
    if (!p) return;

    if (confirm(`Bạn có chắc chắn muốn xoá sản phẩm "${p.name}"?`)) {
      products.splice(index, 1);
      DataManager.saveProducts(products);
      if (SheetsAPI.isConnected()) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Sản phẩm', products));
      }
      Utils.showToast(`Đã xoá sản phẩm "${p.name}"`, 'success');
      this._renderSettings();
    }
  },

  // --- Email Template ---
  saveEmailTemplate() {
    const el = document.getElementById('settings-email-template');
    if (el) {
      DataManager.saveEmailTemplate(el.value);
      if (SheetsAPI.isConnected()) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Cài đặt', [{ key: 'emailTemplate', value: el.value }]));
      }
      Utils.showToast('Đã lưu mẫu Email', 'success');
    }
  },

  // --- Advanced Tools ---
  normalizePlatforms() {
    const orders = DataManager.getOrders();
    let changed = 0;
    
    orders.forEach(o => {
      if (o.platform) {
        // Capitalize first letter, lower the rest (datammo -> Datammo)
        const normalized = o.platform.charAt(0).toUpperCase() + o.platform.slice(1).toLowerCase();
        if (o.platform !== normalized) {
          o.platform = normalized;
          changed++;
        }
      }
    });

    if (changed > 0) {
      DataManager.saveOrders(orders);
      if (SheetsAPI.isConnected()) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Đơn hàng', orders));
      }
      Utils.showToast(`Đã chuẩn hoá thành công ${changed} đơn hàng`, 'success');
      this.updateBadges();
    } else {
      Utils.showToast('Tất cả nền tảng đã chuẩn, không cần thay đổi', 'info');
    }
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
      Utils.showToast(`Đã import ${count} TK Quản lý mới`, 'success');
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
