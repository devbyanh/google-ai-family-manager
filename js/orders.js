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
        </div>
        <div class="toolbar-right">
          <button class="btn btn-secondary" onclick="Orders.exportOrders()">📥 Xuất CSV</button>
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
          <label class="form-label">Gán vào Acc mẹ</label>
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
        Utils.showToast('Acc mẹ này đã đầy (5/5 slot)', 'error');
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
};
