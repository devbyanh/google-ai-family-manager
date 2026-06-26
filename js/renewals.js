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
      
      // Convert plain text to HTML
      let bodyHtmlContent = bodyText.replace(/\n/g, '<br>');
      
      // Auto-highlight important keywords
      bodyHtmlContent = bodyHtmlContent.replace(/Google AI Pro/gi, '<strong style="color: #2563eb; font-size: 16px;">&#10024; Google AI Pro</strong>');
      bodyHtmlContent = bodyHtmlContent.replace(/Gemini Pro/gi, '<strong style="color: #8b5cf6;">&#128640; Gemini Pro</strong>');
      bodyHtmlContent = bodyHtmlContent.replace(/5TB/gi, '<strong style="color: #ec4899;">&#9729;&#65039; 5TB</strong>');
      bodyHtmlContent = bodyHtmlContent.replace(/Antigravity/gi, '<strong style="color: #f97316;">&#9889; Antigravity</strong>');
      bodyHtmlContent = bodyHtmlContent.replace(/Zalo:/gi, '<br><strong style="color: #0068ff; font-size: 16px;">&#128172; Zalo:</strong>');
      bodyHtmlContent = bodyHtmlContent.replace(/Telegram:/gi, '<strong style="color: #24a1de; font-size: 16px;">&#9992;&#65039; Telegram:</strong>');
      bodyHtmlContent = bodyHtmlContent.replace(new RegExp(data.product, 'g'), `<strong style="color: #ef4444; background: #fee2e2; padding: 3px 8px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">&#128142; ${data.product}</strong>`);
      
      let htmlWrapper = `
      <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; background-color: #f3f4f6; padding: 40px 20px; color: #1f2937;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%); padding: 35px 20px; text-align: center; border-bottom: 4px solid #fcd34d;">
            <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.25); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <span style="font-size: 35px;">&#9888;&#65039;</span>
            </div>
            <h2 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.2); text-transform: uppercase;">Thông báo hết hạn</h2>
          </div>
          
          <!-- Body -->
          <div style="padding: 40px 35px;">
            <div style="font-size: 16px; line-height: 1.8; color: #374151;">
              ${bodyHtmlContent}
            </div>
            
            <div style="margin-top: 40px; text-align: center; padding: 25px; background: #f8fafc; border-radius: 16px; border: 2px dashed #94a3b8;">
              <p style="margin: 0 0 15px 0; font-weight: 600; color: #334155; font-size: 15px;">&#128071; Bấm vào nút bên dưới để gia hạn ngay &#128071;</p>
              <a href="https://zalo.me/0559629469" style="display: inline-block; background: linear-gradient(to right, #0068ff, #005ce6); color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(0, 104, 255, 0.3); transition: all 0.3s;">&#128172; Chat Zalo Hỗ Trợ</a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f1f5f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 14px; font-weight: 600; color: #475569; margin: 0 0 8px 0;">Cảm ơn Anh/Chị đã tin tưởng và sử dụng dịch vụ!</p>
            <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5;">Đây là email tự động gửi từ hệ thống quản lý.<br>Quý khách vui lòng liên hệ trực tiếp qua Zalo/Telegram.</p>
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
