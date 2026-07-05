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
                  <th style="text-align: center;">Thao tác</th>
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

      const isChecked = Array.from(this.selectedEmails).some(jsonStr => {
        try { return JSON.parse(jsonStr).email === o.email; } catch(e) { return false; }
      });
      const productObj = DataManager.getProducts().find(p => p.name === o.product);

      return `
        <tr>
          <td style="text-align: center;">
            <input type="checkbox" class="renewal-checkbox" value="${Utils.escapeHtml(o.email)}" data-product="${Utils.escapeHtml(o.product)}" data-orderdate="${Utils.escapeHtml(o.orderDate || '')}" ${isChecked ? 'checked' : ''} onchange="Renewals.toggleSelection(this)">
          </td>
          <td><strong>${Utils.escapeHtml(o.email)}</strong></td>
          <td>${Utils.escapeHtml(o.madon)}</td>
          <td><span class="badge" style="${productObj ? `border:1px solid ${productObj.color}40; color:${productObj.color}; background:${productObj.color}15` : ''}">${Utils.escapeHtml(o.product)}</span></td>
          <td>${Utils.formatDateISO(o.orderDate)}</td>
          <td>${Utils.formatDateISO(o.expDate)}</td>
          <td>${statusBadge}</td>
          <td style="text-align: center;">
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px; background: rgba(59, 130, 246, 0.1); color: var(--accent-secondary); border-color: transparent;" onclick="Renewals.copyZaloMessage('${Utils.escapeHtml(o.email)}', '${Utils.escapeHtml(o.product)}', '${Utils.formatDateISO(o.expDate)}')">
              📋 Copy Zalo Msg
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Check if all are selected
    selectAllCheckbox.checked = orders.length > 0 && Array.from(document.querySelectorAll('.renewal-checkbox')).every(cb => cb.checked);
    this._updateBulkButton();
  },

  toggleSelection(checkbox) {
    const payload = JSON.stringify({ email: checkbox.value, product: checkbox.dataset.product, orderDate: checkbox.dataset.orderdate });
    if (checkbox.checked) {
      this.selectedEmails.add(payload);
    } else {
      this.selectedEmails.delete(payload);
    }
    this._checkSelectAllState();
    this._updateBulkButton();
  },

  async copyZaloMessage(email, product, expDate) {
    const template = `Xin chào anh/chị,\n\nGói dịch vụ [Ten_Goi] (Google AI Pro) của anh/chị trên email [Email] sẽ hết hạn vào ngày [Ngay_Het_Han].\n\nAnh/chị vui lòng gia hạn để không bị gián đoạn dịch vụ nhé. Cảm ơn anh/chị!`;
    const message = template
      .replace('\\[Ten_Goi\\]', product)
      .replace('\\[Email\\]', email)
      .replace('\\[Ngay_Het_Han\\]', expDate);
    
    try {
      await navigator.clipboard.writeText(message);
      Utils.showToast('Đã copy tin nhắn Zalo. Hãy dán (Ctrl+V) vào khung chat Zalo nhé!', 'success');
      window.open('https://chat.zalo.me/', '_blank');
    } catch (err) {
      Utils.showToast('Lỗi copy, vui lòng thử lại', 'error');
    }
  },

  toggleSelectAll(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.renewal-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = selectAllCheckbox.checked;
      const payload = JSON.stringify({ email: cb.value, product: cb.dataset.product, orderDate: cb.dataset.orderdate });
      if (cb.checked) {
        this.selectedEmails.add(payload);
      } else {
        this.selectedEmails.delete(payload);
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

  getExpireDate(orderDate, product) {
    if (!orderDate) return new Date().toLocaleDateString('vi-VN');
    
    // Use Utils.parseVietnameseDate to correctly handle DD/MM/YYYY string formats from Google Sheets
    const expire = Utils.parseVietnameseDate(orderDate);
    if (!expire || isNaN(expire.getTime())) return new Date().toLocaleDateString('vi-VN');

    const map = {
      '7 Ngày': { days: 7 },
      '15 Ngày': { days: 15 },
      '30 Ngày': { days: 30 },
      '1 Tháng': { months: 1 },
      '3 Tháng': { months: 3 },
      '6 Tháng': { months: 6 },
      '12 Tháng': { months: 12 },
      '1 Năm': { years: 1 },
      '2 Năm': { years: 2 }
    };

    for (const key in map) {
      if (product.includes(key)) {
        const t = map[key];
        if (t.days) expire.setDate(expire.getDate() + t.days);
        if (t.months) expire.setMonth(expire.getMonth() + t.months);
        if (t.years) expire.setFullYear(expire.getFullYear() + t.years);
        break;
      }
    }

    return Utils.formatDate(expire.toISOString()); // Guarantees DD/MM/YYYY
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
      const expireDate = this.getExpireDate(data.orderDate, data.product);
      
      // Fallback plain text email
      let bodyText = template.replace(/\[Ten_Goi\]/g, data.product);
      
      let htmlWrapper = `
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px; font-family: Helvetica, Arial, sans-serif;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="padding: 30px 20px 20px 20px; border-bottom: 1px solid #f1f5f9;">
                  <h2 style="margin: 0; color: #2563eb; font-size: 24px; font-weight: bold;">Google AI Pro</h2>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 25px 30px;">
                  <p style="color: #334155; font-size: 16px; margin-top: 0;">Chào ${data.email.split('@')[0]} &#128075;</p>
                  
                  <!-- Expiration Badge -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 20px 0;">
                    <tr>
                      <td align="center" style="padding: 15px;">
                        <div style="font-size: 18px; font-weight: bold; color: #dc2626;">&#10060; Gói của bạn đã hết hạn</div>
                        <div style="margin-top: 8px; color: #444; font-size: 15px;">Google AI Pro ${data.product}</div>
                        <div style="margin-top: 4px; color: #666; font-size: 14px;">Ngày hết hạn: ${expireDate}</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Features -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; margin: 25px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 15px 0; font-size: 15px; color: #1e293b; font-weight: bold;">&#10024; Quyền lợi khi gia hạn:</p>
                        <table width="100%" border="0" cellpadding="0" cellspacing="0">
                          <tr><td style="padding-bottom: 12px; font-size: 14px; color: #334155;">&#128142; 5TB lưu trữ</td></tr>
                          <tr><td style="padding-bottom: 12px; font-size: 14px; color: #334155;">&#128640; Gemini 3 Pro + Veo 3</td></tr>
                          <tr><td style="padding-bottom: 12px; font-size: 14px; color: #334155;">&#129504; NotebookLM</td></tr>
                          <tr><td style="padding-bottom: 12px; font-size: 14px; color: #334155;">&#9889; Google Antigravity</td></tr>
                          <tr><td style="padding-bottom: 12px; font-size: 14px; color: #334155;">&#127916; Flow</td></tr>
                          <tr><td style="padding-bottom: 12px; font-size: 14px; color: #334155;">&#128222; Google Meet không giới hạn</td></tr>
                          <tr><td style="font-size: 14px; color: #334155;">&#129689; 1.000 tín dụng AI VEO 3 mỗi tháng</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Warning Box -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; margin: 25px 0;">
                    <tr>
                      <td style="padding: 15px 20px;">
                        <h3 style="margin: 0 0 5px 0; font-size: 15px; color: #b91c1c;">&#9888;&#65039; Không rời hoặc thay đổi nhóm gia đình.</h3>
                        <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.5;">Google quy định tài khoản sẽ không thể tham gia nhóm gia đình khác trong 12 tháng.</p>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA -->
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 35px; margin-bottom: 10px;">
                    <tr>
                      <td align="center">
                        <p style="color: #16a34a; font-weight: bold; font-size: 15px; margin: 0 0 15px 0;">&#128640; Gia hạn ngay để tiếp tục sử dụng Google AI Pro.</p>
                        
                        <a href="https://zalo.me/0559629469" style="display: block; background-color: #0068ff; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 8px; font-weight: bold; font-size: 16px; margin-bottom: 8px;">&#128640; Gia hạn ngay</a>
                        <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b;">Hỗ trợ qua Zalo</p>

                        <a href="https://t.me/tuawn_anh" style="display: inline-block; color: #64748b; text-decoration: underline; font-size: 14px; font-weight: 500;">&#128233; Hoặc liên hệ Telegram</a>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; color: #ef4444; font-weight: bold;">Cảm ơn Anh/Chị đã tin tưởng sử dụng dịch vụ &#10084;&#65039;</p>
                  <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">Nếu Anh/Chị đã gia hạn gần đây, vui lòng bỏ qua email này.</p>
                  <p style="margin: 0 0 5px 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Google AI Pro. Tất cả các quyền được bảo lưu.</p>
                  <p style="margin: 0; font-size: 12px; color: #94a3b8;">Email tự động, vui lòng không trả lời thư này.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
