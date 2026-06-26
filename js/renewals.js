// ============================================
// RENEWALS PAGE
// ============================================

const Renewals = {
  selectedEmails: new Set(),
  
  render() {
    const products = DataManager.getProducts();

    const container = document.getElementById('page-renewals');
    container.innerHTML = `
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <select class="form-control" id="filter-product-renewals" style="min-width:160px" onchange="Renewals.handleFilterChange()">
            <option value="">Tất cả sản phẩm</option>
            ${products.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
          </select>
          <select class="form-control" id="filter-days" style="min-width:160px" onchange="Renewals.handleFilterChange()">
            <option value="7">Sắp hết hạn (trong 7 ngày)</option>
            <option value="15">Sắp hết hạn (trong 15 ngày)</option>
            <option value="30">Sắp hết hạn (trong 30 ngày)</option>
            <option value="0">Đã hết hạn</option>
            <option value="-1">Tất cả</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Renewals.sendBulkEmails()" id="btn-send-bulk" disabled>✉️ Gửi Mail Hàng Loạt</button>
        </div>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="card-body no-padding">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">
                    <input type="checkbox" id="selectAllRenewals" onchange="Renewals.toggleSelectAll(this)">
                  </th>
                  <th>Email</th>
                  <th>Mã ĐH</th>
                  <th>Sản phẩm</th>
                  <th>Ngày đặt</th>
                  <th>Ngày hết hạn</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody id="renewals-tbody">
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.selectedEmails.clear();
    this._renderTable();
  },

  handleFilterChange() {
    this.selectedEmails.clear();
    this._renderTable();
  },

  _getExpiringOrders() {
    const orders = DataManager.getOrders();
    const products = DataManager.getProducts();
    const daysFilter = parseInt(document.getElementById('filter-days').value);
    const productFilter = document.getElementById('filter-product-renewals').value;
    
    const now = new Date();
    // Reset time for accurate day difference
    now.setHours(0, 0, 0, 0);

    const expiringOrders = [];

    orders.forEach(o => {
      // Only process valid orders with email and date
      if (!o.email || !o.orderDate || o.status !== 'Đã thanh toán') return;
      if (productFilter && o.product !== productFilter) return;

      const orderDate = Utils.parseVietnameseDate(o.orderDate);
      if (!orderDate || isNaN(orderDate)) return;

      const product = products.find(p => p.name === o.product);
      const durationMonths = product ? (product.duration || 1) : 1;

      // Calculate expiration date
      const expDate = new Date(orderDate);
      expDate.setMonth(expDate.getMonth() + durationMonths);
      
      const diffTime = expDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let isMatch = false;
      if (daysFilter === -1) {
        isMatch = true; // All
      } else if (daysFilter === 0) {
        isMatch = diffDays <= 0; // Already expired (including today)
      } else {
        // Expiring in X days (including already expired or exactly today)
        isMatch = diffDays <= daysFilter;
      }

      if (isMatch) {
        expiringOrders.push({
          ...o,
          expDate,
          diffDays,
          durationMonths
        });
      }
    });

    // Sort by expiration date (closest or most expired first)
    return expiringOrders.sort((a, b) => a.expDate - b.expDate);
  },

  _renderTable() {
    const tbody = document.getElementById('renewals-tbody');
    if (!tbody) return;

    const orders = this._getExpiringOrders();
    const selectAllCheckbox = document.getElementById('selectAllRenewals');

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:32px">Không có đơn hàng nào khớp với điều kiện</td></tr>';
      selectAllCheckbox.disabled = true;
      selectAllCheckbox.checked = false;
      this._updateBulkButton();
      return;
    }

    selectAllCheckbox.disabled = false;

    tbody.innerHTML = orders.map(o => {
      let statusBadge = '';
      if (o.diffDays < 0) {
        statusBadge = '<span class="badge badge-danger">Đã hết hạn</span>';
      } else if (o.diffDays === 0) {
        statusBadge = '<span class="badge badge-warning">Hết hạn hôm nay</span>';
      } else {
        statusBadge = `<span class="badge badge-warning">Còn ${o.diffDays} ngày</span>`;
      }

      const isChecked = this.selectedEmails.has(o.email);
      const productObj = DataManager.getProducts().find(p => p.name === o.product);

      return `
        <tr>
          <td style="text-align: center;">
            <input type="checkbox" class="renewal-checkbox" value="${Utils.escapeHtml(o.email)}" ${isChecked ? 'checked' : ''} onchange="Renewals.toggleSelection(this, '${Utils.escapeHtml(o.product)}')">
          </td>
          <td><strong>${Utils.escapeHtml(o.email)}</strong></td>
          <td>${Utils.escapeHtml(o.madon)}</td>
          <td><span class="badge" style="${productObj ? `border:1px solid ${productObj.color}40; color:${productObj.color}; background:${productObj.color}15` : ''}">${Utils.escapeHtml(o.product)}</span></td>
          <td>${Utils.formatDateISO(o.orderDate)}</td>
          <td><strong>${Utils.formatDateISO(o.expDate)}</strong></td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

    // Check if all are selected
    selectAllCheckbox.checked = orders.length > 0 && Array.from(document.querySelectorAll('.renewal-checkbox')).every(cb => cb.checked);
    this._updateBulkButton();
  },

  toggleSelection(checkbox, productName) {
    if (checkbox.checked) {
      // Store both email and product name so we can inject [Ten_Goi]
      this.selectedEmails.add(JSON.stringify({ email: checkbox.value, product: productName }));
    } else {
      this.selectedEmails.delete(JSON.stringify({ email: checkbox.value, product: productName }));
    }
    this._checkSelectAllState();
    this._updateBulkButton();
  },

  toggleSelectAll(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.renewal-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = selectAllCheckbox.checked;
      const productName = cb.closest('tr').querySelector('.badge-blue').textContent;
      if (cb.checked) {
        this.selectedEmails.add(JSON.stringify({ email: cb.value, product: productName }));
      } else {
        this.selectedEmails.delete(JSON.stringify({ email: cb.value, product: productName }));
      }
    });
    this._updateBulkButton();
  },

  _checkSelectAllState() {
    const checkboxes = Array.from(document.querySelectorAll('.renewal-checkbox'));
    const selectAllCheckbox = document.getElementById('selectAllRenewals');
    if (checkboxes.length === 0) return;
    selectAllCheckbox.checked = checkboxes.every(cb => cb.checked);
  },

  _updateBulkButton() {
    const btn = document.getElementById('btn-send-bulk');
    if (btn) {
      btn.disabled = this.selectedEmails.size === 0;
      btn.textContent = `✉️ Gửi Mail Hàng Loạt (${this.selectedEmails.size})`;
    }
  },

  async sendBulkEmails() {
    if (this.selectedEmails.size === 0) return;
    if (!SheetsAPI.isConnected()) {
      Utils.showToast('Vui lòng kết nối Google Apps Script trong Cài đặt trước', 'error');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn gửi email nhắc gia hạn tới ${this.selectedEmails.size} khách hàng?`)) {
      return;
    }

    const template = DataManager.getEmailTemplate();
    const emailsPayload = [];

    this.selectedEmails.forEach(jsonStr => {
      const data = JSON.parse(jsonStr);
      // Replace variables in template
      let bodyText = template.replace(/\[Ten_Goi\]/g, data.product);
      
      // Split text into paragraphs by double newlines, then replace single newlines with <br>
      let paragraphs = bodyText.split(/\n\n+/);
      let bodyHtmlContent = paragraphs.map(p => {
        let text = p.replace(/\n/g, '<br>');
        
        // Beautiful prominent highlighting
        text = text.replace(/Google AI Pro/gi, '<span style="color: #ef4444; font-weight: 700;">Google AI Pro</span>');
        text = text.replace(new RegExp(data.product, 'g'), `<span style="background: #fee2e2; color: #dc2626; border: 1px solid #f87171; border-radius: 4px; padding: 2px 8px; font-weight: bold; margin: 0 4px;">${data.product}</span>`);
        text = text.replace(/đã hết hạn sử dụng\./gi, '<span style="color: #dc2626; font-weight: bold;">đã hết hạn sử dụng.</span>');
        text = text.replace(/cấm thay đổi nhóm gia đình trong vòng 12 tháng/gi, '<span style="color: #dc2626; text-decoration: underline; font-style: italic; font-weight: bold;">cấm thay đổi nhóm gia đình trong vòng 12 tháng</span>');
        
        // Contact info highlighting
        text = text.replace(/Zalo:/gi, '<span style="color: #0068ff; font-weight: bold;">Zalo:</span>');
        text = text.replace(/Telegram:/gi, '<span style="color: #24a1de; font-weight: bold;">Telegram:</span>');
        
        return `<p style="margin: 0 0 16px 0;">${text}</p>`;
      }).join('');
      
      let htmlWrapper = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 40px 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 35px 30px; text-align: center; border-bottom: 4px solid #fde047;">
            <div style="background: rgba(255,255,255,0.2); width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px; font-size: 30px; line-height: 60px;">
              &#9888;&#65039;
            </div>
            <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">THÔNG BÁO HẾT HẠN</h2>
          </div>
          
          <!-- Body -->
          <div style="padding: 40px 35px 20px 35px;">
            <div style="font-size: 16px; line-height: 1.7; color: #334155;">
              ${bodyHtmlContent}
            </div>
          </div>
          
          <!-- Action Box -->
          <div style="padding: 10px 35px 40px 35px; text-align: center;">
            <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 25px;">
              <p style="margin: 0 0 15px 0; font-size: 15px; color: #475569; font-weight: 600;">&#128071; Vui lòng liên hệ Zalo để gia hạn ngay &#128071;</p>
              <a href="https://zalo.me/0559629469" style="display: inline-block; background: linear-gradient(to right, #0068ff, #005ce6); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 16px rgba(0, 104, 255, 0.25); transition: all 0.2s;">&#128172; Liên Hệ Zalo Hỗ Trợ</a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 5px 0;">Trân trọng cảm ơn quý khách!</p>
            <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">Đây là hệ thống gửi thư tự động.<br>Quý khách vui lòng phản hồi qua các kênh liên hệ chính thức.</p>
          </div>
          
        </div>
      </div>
      `;
      
      emailsPayload.push({
        to: data.email,
        subject: `Thông báo hết hạn gói ${data.product}`,
        body: bodyText,
        htmlBody: htmlWrapper
      });
    });

    const btn = document.getElementById('btn-send-bulk');
    const originalText = btn.textContent;
    btn.textContent = 'Đang gửi...';
    btn.disabled = true;

    try {
      const res = await SheetsAPI.sendEmails(emailsPayload);
      if (res.success) {
        Utils.showToast(`Đã gửi thành công ${res.count} email!`, 'success');
        if (res.errors && res.errors.length > 0) {
          console.error('Email errors:', res.errors);
          Utils.showToast(`Có ${res.errors.length} email bị lỗi, xem console`, 'warning');
        }
        // Deselect all after success
        this.selectedEmails.clear();
        this._renderTable();
      }
    } catch (e) {
      Utils.showToast('Lỗi gửi mail: ' + e.message, 'error');
    } finally {
      btn.textContent = originalText;
      this._updateBulkButton();
    }
  }
};
