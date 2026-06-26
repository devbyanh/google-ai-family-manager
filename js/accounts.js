// ============================================
// ACCOUNTS PAGE
// ============================================

const Accounts = {
  editingId: null,
  viewMode: 'cards', // 'cards' or 'table'

  render() {
    const container = document.getElementById('page-accounts');
    container.innerHTML = `
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="text" class="form-control search-input" placeholder="🔍 Tìm theo email TK Quản lý..." id="acc-search">
          <select class="form-control" id="filter-slot" style="min-width:140px">
            <option value="">Tất cả trạng thái</option>
            <option value="available">Còn slot trống</option>
            <option value="full">Đã full (5/5)</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-secondary" onclick="Accounts.toggleView()" id="btn-toggle-view">📋 Xem bảng</button>
          <button class="btn btn-primary" onclick="Accounts.openModal()">➕ Thêm TK Quản lý</button>
        </div>
      </div>

      <!-- Content -->
      <div id="accounts-content"></div>
    `;

    this._bindFilters();
    this._renderContent();
  },

  _getFilteredAccounts() {
    let accounts = DataManager.getAccounts();
    const searchEl = document.getElementById('acc-search');
    const filterEl = document.getElementById('filter-slot');

    const search = searchEl ? searchEl.value.toLowerCase() : '';
    const slotFilter = filterEl ? filterEl.value : '';

    if (search) {
      accounts = accounts.filter(a => (a.email || '').toLowerCase().includes(search));
    }

    if (slotFilter === 'available') {
      accounts = accounts.filter(a => DataManager.getAccountSlotCount(a._id) < 5);
    } else if (slotFilter === 'full') {
      accounts = accounts.filter(a => DataManager.getAccountSlotCount(a._id) >= 5);
    }

    return accounts.sort((a, b) => (a.accNumber || 0) - (b.accNumber || 0));
  },

  _renderContent() {
    const content = document.getElementById('accounts-content');
    if (!content) return;

    if (this.viewMode === 'cards') {
      this._renderCards(content);
    } else {
      this._renderTable(content);
    }
  },

  _renderCards(container) {
    const accounts = this._getFilteredAccounts();
    const orders = DataManager.getOrders();
    const products = DataManager.getProducts();

    if (accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-title">Chưa có Tài khoản Quản lý nào</div>
          <div class="empty-desc">Nhấn "Thêm TK Quản lý" để tạo tài khoản mới</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="accounts-grid">
        ${accounts.map(a => {
          const members = orders.filter(o => o.accId === a._id);
          const slotCount = members.length;
          const slotPct = (slotCount / 5) * 100;
          const isFull = slotCount >= 5;

          return `
            <div class="account-card">
              <div class="account-card-header">
                <div class="acc-number">
                  <div class="acc-badge" style="${isFull ? 'background: linear-gradient(135deg, #ef4444, #f97316)' : ''}">${a.accNumber}</div>
                  <div class="acc-info">
                    <div class="acc-email">${Utils.escapeHtml(a.email)}</div>
                    <div class="acc-plan">${Utils.escapeHtml(a.plan || 'Chưa xác định')}</div>
                  </div>
                </div>
                <div class="acc-actions">
                  <button class="btn-icon" title="Sửa" onclick="Accounts.openModal('${a._id}')">✏️</button>
                  <button class="btn-icon danger" title="Xoá" onclick="Accounts.deleteAccount('${a._id}')">🗑️</button>
                </div>
              </div>

              <!-- Slot Progress -->
              <div class="slot-bar">
                <div class="slot-progress">
                  <div class="slot-progress-fill ${isFull ? 'full' : slotCount >= 4 ? 'warning' : ''}" style="width:${slotPct}%"></div>
                </div>
                <div class="slot-text ${isFull ? 'text-danger' : ''}">${slotCount}/5</div>
              </div>

              <!-- Members -->
              <div class="members-list">
                ${members.map(m => {
                  const prod = products.find(p => p.name === m.product);
                  return `
                    <div class="member-item">
                      <span class="member-email">${Utils.escapeHtml(m.email)}</span>
                      <span class="member-product">
                        <span class="badge badge-purple" style="${prod ? `border-color:${prod.color}40; color:${prod.color}; background:${prod.color}15` : ''}">${Utils.escapeHtml(m.product || '')}</span>
                      </span>
                      <button class="btn-icon danger" style="margin-left:4px;font-size:12px" title="Gỡ khỏi acc" onclick="Accounts.removeMember('${m._id}')">✕</button>
                    </div>
                  `;
                }).join('')}
                ${Array.from({ length: 5 - slotCount }, () => `
                  <div class="empty-slot">— Slot trống —</div>
                `).join('')}
              </div>

              ${a.note ? `<div class="mt-2 text-muted" style="font-size:11px">📝 ${Utils.escapeHtml(a.note)}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _renderTable(container) {
    const accounts = this._getFilteredAccounts();

    container.innerHTML = `
      <div class="card">
        <div class="card-body no-padding">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Acc</th>
                  <th>Email</th>
                  <th>Slot</th>
                  <th>Gói</th>
                  <th>Ghi chú</th>
                  <th style="width:90px">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${accounts.length > 0 ? accounts.map(a => {
                  const slotCount = DataManager.getAccountSlotCount(a._id);
                  const isFull = slotCount >= 5;
                  return `
                    <tr>
                      <td><strong>#${a.accNumber}</strong></td>
                      <td>${Utils.escapeHtml(a.email)}</td>
                      <td>
                        <div class="slot-bar">
                          <div class="slot-progress" style="min-width:60px">
                            <div class="slot-progress-fill ${isFull ? 'full' : ''}" style="width:${(slotCount / 5) * 100}%"></div>
                          </div>
                          <span class="slot-text ${isFull ? 'text-danger' : ''}">${slotCount}/5</span>
                        </div>
                      </td>
                      <td><span class="badge badge-info">${Utils.escapeHtml(a.plan || '')}</span></td>
                      <td class="truncate">${Utils.escapeHtml(a.note || '')}</td>
                      <td>
                        <div style="display:flex;gap:2px">
                          <button class="btn-icon" title="Sửa" onclick="Accounts.openModal('${a._id}')">✏️</button>
                          <button class="btn-icon danger" title="Xoá" onclick="Accounts.deleteAccount('${a._id}')">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr><td colspan="6" class="text-center text-muted" style="padding:50px">Chưa có Tài khoản Quản lý nào</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  toggleView() {
    this.viewMode = this.viewMode === 'cards' ? 'table' : 'cards';
    const btn = document.getElementById('btn-toggle-view');
    if (btn) {
      btn.textContent = this.viewMode === 'cards' ? '📋 Xem bảng' : '🃏 Xem thẻ';
    }
    this._renderContent();
  },

  _bindFilters() {
    const searchInput = document.getElementById('acc-search');
    const filterSlot = document.getElementById('filter-slot');

    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce(() => {
        this._renderContent();
      }, 300));
    }

    if (filterSlot) {
      filterSlot.addEventListener('change', () => {
        this._renderContent();
      });
    }
  },

  // --- Modal ---
  openModal(id = null) {
    this.editingId = id;

    let account = {
      accNumber: '',
      email: '',
      plan: '',
      note: '',
    };

    if (id) {
      const found = DataManager.getAccounts().find(a => a._id === id);
      if (found) account = { ...found };
    }

    const modal = document.getElementById('account-modal');
    const title = document.getElementById('account-modal-title');
    title.textContent = id ? 'Sửa TK Quản lý' : 'Thêm TK Quản lý mới';

    document.getElementById('account-form').innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Số thứ tự Acc</label>
          <input type="number" class="form-control" id="f-acc-number" value="${account.accNumber}" placeholder="Tự động" min="1">
          <div class="form-hint">Để trống sẽ tự động tăng</div>
        </div>
        <div class="form-group">
          <label class="form-label">Email TK Quản lý</label>
          <input type="email" class="form-control" id="f-acc-email" value="${Utils.escapeHtml(account.email)}" placeholder="email@gmail.com" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Gói</label>
        <select class="form-control" id="f-acc-plan">
          <option value="Gói tháng / chính chủ" ${account.plan === 'Gói tháng / chính chủ' ? 'selected' : ''}>Gói tháng / chính chủ</option>
          <option value="3 tháng" ${account.plan === '3 tháng' ? 'selected' : ''}>3 tháng</option>
          <option value="6 tháng" ${account.plan === '6 tháng' ? 'selected' : ''}>6 tháng</option>
          <option value="1 năm" ${account.plan === '1 năm' ? 'selected' : ''}>1 năm</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Ghi chú</label>
        <textarea class="form-control" id="f-acc-note" rows="2" placeholder="Ghi chú...">${Utils.escapeHtml(account.note || '')}</textarea>
      </div>
    `;

    modal.classList.add('active');
  },

  closeModal() {
    document.getElementById('account-modal').classList.remove('active');
    this.editingId = null;
  },

  saveAccount() {
    const data = {
      email: document.getElementById('f-acc-email').value.trim(),
      plan: document.getElementById('f-acc-plan').value,
      note: document.getElementById('f-acc-note').value.trim(),
    };

    const accNum = document.getElementById('f-acc-number').value;
    if (accNum) data.accNumber = Number(accNum);

    if (!data.email) {
      Utils.showToast('Vui lòng nhập email TK Quản lý', 'error');
      return;
    }

    if (this.editingId) {
      DataManager.updateAccount(this.editingId, data);
      Utils.showToast('Đã cập nhật TK Quản lý', 'success');
    } else {
      DataManager.addAccount(data);
      Utils.showToast('Đã thêm TK Quản lý mới', 'success');
    }

    this.closeModal();
    this._renderContent();
    App.updateBadges();
  },

  async deleteAccount(id) {
    const members = DataManager.getOrdersByAccount(id);
    const msg = members.length > 0
      ? `Acc này đang có ${members.length} thành viên. Xoá acc sẽ huỷ gán tất cả thành viên. Tiếp tục?`
      : 'Bạn có chắc muốn xoá TK Quản lý này?';

    const confirmed = await Utils.confirm(msg);
    if (!confirmed) return;

    DataManager.deleteAccount(id);
    Utils.showToast('Đã xoá TK Quản lý', 'success');
    this._renderContent();
    App.updateBadges();
  },

  async removeMember(orderId) {
    const confirmed = await Utils.confirm('Gỡ thành viên này khỏi TK Quản lý?');
    if (!confirmed) return;

    DataManager.updateOrder(orderId, { accId: '', accNumber: '' });
    Utils.showToast('Đã gỡ thành viên', 'success');
    this._renderContent();
    App.updateBadges();
  },
};
