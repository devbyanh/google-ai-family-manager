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
          <td>${Utils.formatDateISO(o.expDate)}</td>
          <td>${statusBadge}</td>
          <td style="text-align: center;">
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px; background: rgba(59, 130, 246, 0.1); color: var(--accent-secondary); border-color: transparent;" onclick="Renewals.copyZaloMessage('${Utils.escapeHtml(o.email)}', '${Utils.escapeHtml(o.product)}', '${Utils.formatDateISO(o.expDate)}')">
              💬 Gửi Zalo
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Check if all are selected
    selectAllCheckbox.checked = orders.length > 0 && Array.from(document.querySelectorAll('.renewal-checkbox')).every(cb => cb.checked);
    this._updateBulkButton();
  },

  toggleSelection(checkbox, productName) {
    if (checkbox.checked) {
      this.selectedEmails.add(JSON.stringify({ email: checkbox.value, product: productName }));
    } else {
      this.selectedEmails.delete(JSON.stringify({ email: checkbox.value, product: productName }));
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
      
      // Fallback plain text email
      let bodyText = template.replace(/\[Ten_Goi\]/g, data.product);
      
      let htmlWrapper = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FFFFFF; color: #111827; font-size: 15px; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px 16px; -webkit-font-smoothing: antialiased;">
        
        <!-- HEADER -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
          <tr>
            <td align="center">
              <div style="font-size: 40px; margin-bottom: 16px;">&#129302;</div>
              <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #111827; font-weight: 700; letter-spacing: -0.5px;">Thông báo gia hạn dịch vụ</h1>
              <p style="margin: 0; font-size: 16px; color: #6B7280; font-weight: 500;">Google AI Pro</p>
            </td>
          </tr>
        </table>

        <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 0 0 24px 0;">

        <!-- GREETING -->
        <p style="margin: 0 0 24px 0; font-size: 15px;">Xin chào Anh/Chị,</p>

        <!-- PACKAGE CARD -->
        <table width="100%" border="0" cellpadding="20" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 12px; margin-bottom: 16px;">
          <tr>
            <td>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">&#128230; GÓI DỊCH VỤ</p>
              <p style="margin: 0; font-size: 16px; font-weight: 700; color: #111827;">Google AI Pro ${data.product}</p>
            </td>
          </tr>
        </table>

        <!-- STATUS CARD -->
        <table width="100%" border="0" cellpadding="20" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 12px; margin-bottom: 24px;">
          <tr>
            <td>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">&#9200; TRẠNG THÁI</p>
              <p style="margin: 0; font-size: 16px; font-weight: 700; color: #DC2626;">Đã hết hạn</p>
            </td>
          </tr>
        </table>

        <!-- WARNING -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
          <tr>
            <td style="border-left: 4px solid #F59E0B; padding-left: 16px;">
              <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #111827;">&#9888;&#65039; Lưu ý</p>
              <p style="margin: 0; font-size: 15px; color: #6B7280; line-height: 1.6;">Nếu thay đổi nhóm gia đình sẽ bị cấm tham gia lại 12 tháng.</p>
            </td>
          </tr>
        </table>

        <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 0 0 24px 0;">

        <!-- FEATURES -->
        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700;">&#10024; Quyền lợi khi gia hạn</p>
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
          <tr><td style="padding-bottom: 12px; color: #111827; font-size: 15px;">&#10004;&#65039; &nbsp;<strong>Gemini Pro</strong></td></tr>
          <tr><td style="padding-bottom: 12px; color: #111827; font-size: 15px;">&#10004;&#65039; &nbsp;<strong>NotebookLM</strong></td></tr>
          <tr><td style="padding-bottom: 12px; color: #111827; font-size: 15px;">&#10004;&#65039; &nbsp;<strong>Veo</strong></td></tr>
          <tr><td style="padding-bottom: 12px; color: #111827; font-size: 15px;">&#10004;&#65039; &nbsp;<strong>Antigravity</strong></td></tr>
          <tr><td style="padding-bottom: 0; color: #111827; font-size: 15px;">&#10004;&#65039; &nbsp;<strong>5TB Storage</strong></td></tr>
        </table>

        <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 0 0 24px 0;">

        <!-- SUPPORT -->
        <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700;">&#128222; Hỗ trợ</p>
        <table width="100%" border="0" cellpadding="20" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 12px; margin-bottom: 12px;">
          <tr>
            <td>
              <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #2563EB;">&#128172; Zalo</p>
              <p style="margin: 0; font-size: 15px;"><a href="https://zalo.me/0559629469" style="color: #111827; text-decoration: none;">0559629469</a></p>
            </td>
          </tr>
        </table>
        
        <table width="100%" border="0" cellpadding="20" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 12px; margin-bottom: 40px;">
          <tr>
            <td>
              <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #0EA5E9;">&#9992;&#65039; Telegram</p>
              <p style="margin: 0; font-size: 15px;"><a href="https://t.me/tuawn_anh" style="color: #111827; text-decoration: none;">@tuawn_anh</a></p>
            </td>
          </tr>
        </table>

        <!-- CTA -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 48px;">
          <tr>
            <td align="center">
              <a href="https://zalo.me/0559629469" style="display: block; background-color: #2563EB; color: #FFFFFF; text-decoration: none; padding: 18px 0; font-size: 16px; font-weight: 600; border-radius: 12px; text-align: center;">Gia hạn ngay</a>
            </td>
          </tr>
        </table>

        <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 0 0 24px 0;">

        <!-- FOOTER -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280; font-weight: 500;">Đây là email gửi tự động.</p>
              <p style="margin: 0; font-size: 13px; color: #6B7280;">Nếu cần hỗ trợ vui lòng liên hệ Zalo.</p>
            </td>
          </tr>
        </table>
        
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
