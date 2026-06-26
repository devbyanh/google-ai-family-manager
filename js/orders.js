// ============================================
// ORDERS PAGE
// ============================================

const Orders = {
  currentPage: 1,
  perPage: 15,
  filters: {
    search: '',
    product: '',
    status: '',
    platform: '',
    sort: 'newest'
  },
  editingId: null,

  render() {
    const products = DataManager.getProducts();
    const platforms = DataManager.getPlatforms();

    const container = document.getElementById('page-orders');
    container.innerHTML = `
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="text" class="form-control search-input" placeholder="🔍 Tìm theo mã ĐH, email..." id="order-search" value="${this.filters.search}">
          <select class="form-control" id="filter-product" style="min-width:160px">
            <option value="">Tất cả sản phẩm</option>
            ${products.map(p => `<option value="${p.name}" ${this.filters.product === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
          <select class="form-control" id="filter-status" style="min-width:160px">
            <option value="">Tất cả trạng thái</option>
            <option value="Đã thanh toán" ${this.filters.status === 'Đã thanh toán' ? 'selected' : ''}>Đã thanh toán</option>
            <option value="Chưa thanh toán" ${this.filters.status === 'Chưa thanh toán' ? 'selected' : ''}>Chưa thanh toán</option>
          </select>
          <select class="form-control" id="filter-platform" style="min-width:140px">
            <option value="">Tất cả nền tảng</option>
            ${platforms.map(p => `<option value="${p}" ${this.filters.platform === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <select class="form-control" id="filter-sort" style="min-width:140px">
            <option value="newest" ${this.filters.sort === 'newest' ? 'selected' : ''}>Mới nhất trước</option>
            <option value="oldest" ${this.filters.sort === 'oldest' ? 'selected' : ''}>Cũ nhất trước</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Orders.openModal()">➕ Thêm đơn hàng</button>
        </div>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="card-body no-padding">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mã ĐH</th>
                  <th>Email</th>
                  <th>Sản phẩm</th>
                  <th>Trạng thái</th>
                  <th>Ngày đặt</th>
                  <th>Giá</th>
                  <th>Nền tảng</th>
                  <th>Acc</th>
                  <th>Ghi chú</th>
                  <th style="width:90px">Thao tác</th>
                </tr>
              </thead>
              <tbody id="orders-tbody">
              </tbody>
            </table>
          </div>
          <div class="pagination" id="orders-pagination"></div>
        </div>
      </div>
    `;

    this._bindFilters();
    this._renderTable();
  },

  _getFilteredOrders() {
    let orders = DataManager.getOrders();

    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      orders = orders.filter(o =>
        (o.madon || '').toLowerCase().includes(q) ||
        (o.email || '').toLowerCase().includes(q)
      );
    }
    if (this.filters.product) {
      orders = orders.filter(o => o.product === this.filters.product);
    }
    if (this.filters.status) {
      orders = orders.filter(o => o.status === this.filters.status);
    }
    if (this.filters.platform) {
      orders = orders.filter(o => o.platform === this.filters.platform);
    }

    if (this.filters.sort === 'oldest') {
      orders.sort((a, b) => {
        const da = Utils.parseVietnameseDate(a.orderDate) || new Date(0);
        const db = Utils.parseVietnameseDate(b.orderDate) || new Date(0);
        return da - db;
      });
    } else {
      orders.sort((a, b) => {
        const da = Utils.parseVietnameseDate(a.orderDate) || new Date(0);
        const db = Utils.parseVietnameseDate(b.orderDate) || new Date(0);
        return db - da;
      });
    }

    return orders;
  },

  _renderTable() {
    const orders = this._getFilteredOrders();
    const totalPages = Math.ceil(orders.length / this.perPage) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const start = (this.currentPage - 1) * this.perPage;
    const pageOrders = orders.slice(start, start + this.perPage);
    const products = DataManager.getProducts();
    const accounts = DataManager.getAccounts();

    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    if (pageOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:50px">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">Chưa có đơn hàng</div>
          <div class="empty-desc">Nhấn "Thêm đơn hàng" để tạo đơn mới</div>
        </div>
      </td></tr>`;
    } else {
      tbody.innerHTML = pageOrders.map(o => {
        const product = products.find(p => p.name === o.product);
        const acc = accounts.find(a => a._id === o.accId);
        const accDisplay = acc ? `#${acc.accNumber}` : (o.accNumber || '—');

        return `
          <tr>
            <td><strong>${Utils.escapeHtml(o.madon || '')}</strong></td>
            <td class="truncate" title="${Utils.escapeHtml(o.email || '')}">${Utils.escapeHtml(o.email || '')}</td>
            <td><span class="badge badge-purple" style="${product ? `border-color:${product.color}40; color:${product.color}; background:${product.color}15` : ''}">${Utils.escapeHtml(o.product || '')}</span></td>
            <td><span class="badge ${o.status === 'Đã thanh toán' ? 'badge-success' : 'badge-warning'}">${Utils.escapeHtml(o.status || '')}</span></td>
            <td>${Utils.escapeHtml(o.orderDate || '')}</td>
            <td style="font-weight:600">${Utils.formatCurrency(o.price || 0)}</td>
            <td><span class="badge badge-info">${Utils.escapeHtml(o.platform || '')}</span></td>
            <td><span class="badge badge-blue">${Utils.escapeHtml(accDisplay)}</span></td>
            <td class="truncate" title="${Utils.escapeHtml(o.note || '')}">${Utils.escapeHtml(o.note || '')}</td>
            <td>
              <div style="display:flex;gap:2px">
                <button class="btn-icon" title="Sửa" onclick="Orders.openModal('${o._id}')">✏️</button>
                <button class="btn-icon danger" title="Xoá" onclick="Orders.deleteOrder('${o._id}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Pagination
    this._renderPagination(orders.length, totalPages);
  },

  _renderPagination(total, totalPages) {
    const pag = document.getElementById('orders-pagination');
    if (!pag) return;

    pag.innerHTML = `
      <div class="pagination-info">Hiển thị ${Math.min((this.currentPage - 1) * this.perPage + 1, total)}-${Math.min(this.currentPage * this.perPage, total)} / ${total} đơn hàng</div>
      <div class="pagination-buttons">
        <button ${this.currentPage <= 1 ? 'disabled' : ''} onclick="Orders.goPage(${this.currentPage - 1})">‹</button>
        ${Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let page;
          if (totalPages <= 7) {
            page = i + 1;
          } else if (this.currentPage <= 4) {
            page = i + 1;
          } else if (this.currentPage >= totalPages - 3) {
            page = totalPages - 6 + i;
          } else {
            page = this.currentPage - 3 + i;
          }
          return `<button class="${page === this.currentPage ? 'active' : ''}" onclick="Orders.goPage(${page})">${page}</button>`;
        }).join('')}
        <button ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="Orders.goPage(${this.currentPage + 1})">›</button>
      </div>
    `;
  },

  goPage(page) {
    this.currentPage = page;
    this._renderTable();
  },

  _bindFilters() {
    const searchInput = document.getElementById('order-search');
    const filterProduct = document.getElementById('filter-product');
    const filterStatus = document.getElementById('filter-status');
    const filterPlatform = document.getElementById('filter-platform');

    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        this.filters.search = e.target.value;
        this.currentPage = 1;
        this._renderTable();
      }, 300));


      document.getElementById('filter-sort')?.addEventListener('change', (e) => {
        this.filters.sort = e.target.value;
        this.currentPage = 1;
        this._renderTable();
      });
    }

    [filterProduct, filterStatus, filterPlatform].forEach(el => {
      if (el) {
        el.addEventListener('change', () => {
          this.filters.product = filterProduct.value;
          this.filters.status = filterStatus.value;
          this.filters.platform = filterPlatform.value;
          this.currentPage = 1;
          this._renderTable();
        });
      }
    });
  },

  // --- Modal ---
  openModal(id = null) {
    this.editingId = id;
    const products = DataManager.getProducts();
    const platforms = DataManager.getPlatforms();
    const availableAccounts = DataManager.getAvailableAccounts();
    const allAccounts = DataManager.getAccounts();

    let order = {
      madon: Utils.generateOrderId(),
      email: '',
      product: products[0]?.name || '',
      status: 'Đã thanh toán',
      orderDate: new Date().toISOString().slice(0, 10),
      price: products[0]?.price || 0,
      platform: platforms[0] || '',
      accId: '',
      note: '',
    };

    if (id) {
      const found = DataManager.getOrders().find(o => o._id === id);
      if (found) {
        order = { ...found };
        // Convert date format for input
        if (order.orderDate && order.orderDate.includes('/')) {
          order.orderDate = Utils.formatDateISO(order.orderDate);
        }
      }
    }

    // When editing, show all accounts (including full ones if currently assigned to this order)
    const accountOptions = id
      ? allAccounts
      : availableAccounts;

    const modal = document.getElementById('order-modal');
    const title = document.getElementById('order-modal-title');
    title.textContent = id ? 'Sửa đơn hàng' : 'Thêm đơn hàng mới';

    document.getElementById('order-form').innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Mã đơn hàng</label>
          <input type="text" class="form-control" id="f-madon" value="${Utils.escapeHtml(order.madon)}" placeholder="Tự động tạo">
        </div>
        <div class="form-group">
          <label class="form-label">Email khách hàng</label>
          <input type="email" class="form-control" id="f-email" value="${Utils.escapeHtml(order.email)}" placeholder="email@gmail.com" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Sản phẩm</label>
          <select class="form-control" id="f-product">
            ${products.map(p => `<option value="${p.name}" data-price="${p.price}" ${order.product === p.name ? 'selected' : ''}>${p.name} — ${Utils.formatCurrency(p.price)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Giá (VNĐ)</label>
          <input type="number" class="form-control" id="f-price" value="${order.price}" min="0" step="1000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Trạng thái thanh toán</label>
          <select class="form-control" id="f-status">
            <option value="Đã thanh toán" ${order.status === 'Đã thanh toán' ? 'selected' : ''}>✅ Đã thanh toán</option>
            <option value="Chưa thanh toán" ${order.status === 'Chưa thanh toán' ? 'selected' : ''}>⏳ Chưa thanh toán</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ngày đặt hàng</label>
          <input type="date" class="form-control" id="f-date" value="${order.orderDate}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nền tảng bán hàng</label>
          <select class="form-control" id="f-platform">
            ${platforms.map(p => `<option value="${p}" ${order.platform === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Gán vào Tài khoản Quản lý</label>
          <select class="form-control" id="f-acc">
            <option value="">— Chưa gán —</option>
            ${accountOptions.map(a => {
              const slots = DataManager.getAccountSlotCount(a._id);
              return `<option value="${a._id}" ${order.accId === a._id ? 'selected' : ''}>#${a.accNumber} - ${a.email} (${slots}/5)</option>`;
            }).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ghi chú</label>
        <textarea class="form-control" id="f-note" rows="2" placeholder="Ghi chú...">${Utils.escapeHtml(order.note || '')}</textarea>
      </div>
      
      ${id ? `
      <!-- RENEWAL & HISTORY SECTION -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <label class="form-label" style="margin: 0;">Lịch sử giao dịch & Gia hạn</label>
          <button type="button" class="btn btn-primary" style="padding: 6px 12px; font-size: 13px;" onclick="Orders.renewOrder('${id}')">
            ⚡ Gia hạn 1-Click
          </button>
        </div>
        <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: 12px; max-height: 150px; overflow-y: auto;">
          ${(order.history && order.history.length > 0) ? order.history.map((h, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: ${i === order.history.length - 1 ? 'none' : '1px solid var(--border-color-light)'};">
              <div>
                <div style="font-weight: 500; color: var(--text-primary); font-size: 13px;">${h.type === 'new' ? '🆕 Đăng ký mới' : '🔄 Gia hạn'}</div>
                <div style="color: var(--text-muted); font-size: 11px;">${Utils.formatDateISO(h.date)} • ${Utils.escapeHtml(h.product || '')}</div>
              </div>
              <div style="font-weight: 600; color: var(--success); font-size: 13px;">
                +${Utils.formatCurrency(h.price || 0)}
              </div>
            </div>
          `).join('') : '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 8px;">Chưa có lịch sử giao dịch</div>'}
        </div>
      </div>
      ` : ''}
    `;

    // Auto-fill price when product changes
    document.getElementById('f-product').addEventListener('change', function () {
      const selected = this.options[this.selectedIndex];
      const price = selected.getAttribute('data-price');
      if (price) document.getElementById('f-price').value = price;
    });

    modal.classList.add('active');
  },

  closeModal() {
    document.getElementById('order-modal').classList.remove('active');
    this.editingId = null;
  },

  saveOrder() {
    const data = {
      madon: document.getElementById('f-madon').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      product: document.getElementById('f-product').value,
      status: document.getElementById('f-status').value,
      orderDate: document.getElementById('f-date').value,
      price: Number(document.getElementById('f-price').value) || 0,
      platform: document.getElementById('f-platform').value,
      accId: document.getElementById('f-acc').value,
      note: document.getElementById('f-note').value.trim(),
    };

    if (!data.email) {
      Utils.showToast('Vui lòng nhập email khách hàng', 'error');
      return;
    }

    // Set accNumber for display
    if (data.accId) {
      const acc = DataManager.getAccounts().find(a => a._id === data.accId);
      data.accNumber = acc ? String(acc.accNumber) : '';

      // Check slot limit
      const currentSlots = DataManager.getAccountSlotCount(data.accId);
      const isReassign = this.editingId && DataManager.getOrders().find(o => o._id === this.editingId)?.accId === data.accId;
      if (!isReassign && currentSlots >= 5) {
        Utils.showToast('Tài khoản Quản lý này đã đầy (5/5 slot)', 'error');
        return;
      }
    }

    if (this.editingId) {
      DataManager.updateOrder(this.editingId, data);
      Utils.showToast('Đã cập nhật đơn hàng', 'success');
    } else {
      DataManager.addOrder(data);
      Utils.showToast('Đã thêm đơn hàng mới', 'success');
    }

    this.closeModal();
    this._renderTable();
    // Update sidebar badge
    App.updateBadges();
  },

  async deleteOrder(id) {
    const confirmed = await Utils.confirm('Bạn có chắc muốn xoá đơn hàng này?');
    if (!confirmed) return;

    DataManager.deleteOrder(id);
    Utils.showToast('Đã xoá đơn hàng', 'success');
    this._renderTable();
    App.updateBadges();
  },

  exportOrders() {
    const orders = this._getFilteredOrders();
    const headers = ['Mã ĐH', 'Email', 'Sản phẩm', 'Trạng thái', 'Ngày đặt', 'Giá', 'Nền tảng', 'Acc', 'Ghi chú'];
    const rows = orders.map(o => [
      o.madon, o.email, o.product, o.status, o.orderDate,
      o.price, o.platform, o.accNumber || '', o.note || ''
    ]);
    Utils.exportCSV(headers, rows, `donhang_${new Date().toISOString().slice(0, 10)}.csv`);
    Utils.showToast('Đã xuất file CSV', 'success');
  },

  async renewOrder(id) {
    const order = DataManager.getOrders().find(o => o._id === id);
    if (!order) {
      Utils.showToast('Không tìm thấy đơn hàng', 'error');
      return;
    }

    const products = DataManager.getProducts();
    const product = products.find(p => p.name === order.product);
    if (!product) {
      Utils.showToast('Không tìm thấy thông tin sản phẩm này để gia hạn', 'error');
      return;
    }

    const confirmed = await Utils.confirm(`Bạn có chắc chắn muốn gia hạn đơn hàng này thêm ${product.duration || 1} tháng?`);
    if (!confirmed) return;

    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Parse current order date
      let currentOrderDate = Utils.parseVietnameseDate(order.orderDate);
      if (!currentOrderDate || isNaN(currentOrderDate)) {
        currentOrderDate = new Date();
        currentOrderDate.setHours(0, 0, 0, 0);
      }

      // Calculate current expiration date
      const durationMonths = product.duration || 1;
      const currentExpDate = new Date(currentOrderDate);
      currentExpDate.setMonth(currentExpDate.getMonth() + durationMonths);

      let newStartDate;
      if (currentExpDate > now) {
        // If not yet expired, extend from the old expiration date
        newStartDate = new Date(currentExpDate);
      } else {
        // If already expired, start from today
        newStartDate = new Date(now);
      }

      const newPrice = (Number(order.price) || 0) + (Number(product.price) || 0);

      const history = order.history || [];
      // Initialize if empty
      if (history.length === 0) {
        history.push({
          type: 'new',
          date: Utils.formatDateISO(currentOrderDate),
          price: Number(order.price) || 0,
          product: order.product
        });
      }

      // Add renewal transaction
      history.push({
        type: 'renew',
        date: Utils.formatDateISO(new Date()),
        price: Number(product.price) || 0,
        product: product.name
      });

      const updatedData = {
        orderDate: Utils.formatDateISO(newStartDate),
        price: newPrice,
        history: history
      };

      DataManager.updateOrder(id, updatedData);
      Utils.showToast('Gia hạn đơn hàng thành công', 'success');

      // Re-render modal to show updated history/price immediately, and refresh table
      this.openModal(id);
      this._renderTable();
      App.updateBadges();
    } catch (error) {
      console.error(error);
      Utils.showToast('Có lỗi xảy ra khi gia hạn', 'error');
    }
  },
};
