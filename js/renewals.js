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
      
      // Fallback plain text email
      let bodyText = template.replace(/\[Ten_Goi\]/g, data.product);
      
      let htmlWrapper = `
      <!-- Container -->
      <div style="font-family: 'Segoe UI', Inter, Arial, sans-serif; background-color: #F8FAFC; padding: 40px 16px; color: #1E293B; line-height: 1.8; font-size: 15px; -webkit-font-smoothing: antialiased;">
        <!-- Main Card -->
        <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025); overflow: hidden; border: 1px solid #E2E8F0;">
          
          <!-- ======================== -->
          <!-- HEADER -->
          <!-- ======================== -->
          <div style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); text-align: center; padding: 48px 24px;">
            <div style="background: linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%); width: 72px; height: 72px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2); transform: rotate(-5deg);">
              <span style="font-size: 32px; transform: rotate(5deg); display: block;">&#9888;&#65039;</span>
            </div>
            <h1 style="margin: 0 0 12px 0; font-size: 28px; color: #FFFFFF; font-weight: 700; letter-spacing: -0.5px;">THÔNG BÁO GIA HẠN DỊCH VỤ</h1>
            <p style="margin: 0; font-size: 16px; color: #94A3B8; font-weight: 500;">Google AI Pro</p>
          </div>

          <!-- ======================== -->
          <!-- BODY -->
          <!-- ======================== -->
          <div style="padding: 40px;">
            
            <!-- Section 1: Greeting -->
            <p style="margin-top: 0; margin-bottom: 32px; font-size: 16px;">Xin chào Anh/Chị,</p>
            
            <!-- Section 2: Order Info Card -->
            <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin-bottom: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              
              <!-- Package -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                <tr>
                  <td width="36" style="vertical-align: top;"><div style="background: #F1F5F9; width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">&#128230;</div></td>
                  <td>
                    <p style="margin: 0; font-size: 13px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Gói dịch vụ</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #1E293B;">Google AI Pro ${data.product}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Status -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="36" style="vertical-align: top;"><div style="background: #F1F5F9; width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">&#128197;</div></td>
                  <td>
                    <p style="margin: 0; font-size: 13px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Trạng thái</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #DC2626;">Đã hết hạn</p>
                  </td>
                </tr>
              </table>
              
              <!-- Warning Alert -->
              <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; padding: 16px; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #991B1B; line-height: 1.6;"><span style="font-weight: 700; color: #DC2626;">&#9888;&#65039; Lưu ý:</span> Nếu thay đổi nhóm gia đình sẽ bị cấm tham gia lại trong vòng 12 tháng.</p>
              </div>
            </div>

            <!-- Section 3: Value Proposition -->
            <div style="background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 12px; padding: 28px; margin-bottom: 32px;">
              <h3 style="margin: 0 0 20px 0; font-size: 16px; color: #92400E; font-weight: 700;">&#128161; Vì sao nên gia hạn?</h3>
              <ul style="margin: 0; padding-left: 20px; color: #92400E; font-size: 15px; line-height: 2;">
                <li>Không bị gián đoạn dịch vụ</li>
                <li>Tiếp tục dùng <strong>Gemini Pro</strong></li>
                <li><strong>NotebookLM</strong></li>
                <li><strong>Veo</strong></li>
                <li><strong>Antigravity</strong></li>
                <li><strong>Google AI Pro</strong></li>
                <li><strong>5TB Cloud</strong></li>
              </ul>
            </div>

            <!-- Section 4: Contact Info -->
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin-bottom: 40px;">
              <h3 style="margin: 0 0 20px 0; font-size: 13px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Thông tin liên hệ</h3>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td width="40" style="vertical-align: middle;"><div style="background: #DBEAFE; width: 32px; height: 32px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px;">&#128172;</div></td>
                  <td style="font-size: 16px;"><strong style="color: #2563EB;">Zalo:</strong> <a href="https://zalo.me/0559629469" style="color: #1E293B; text-decoration: none; font-weight: 500;">0559629469</a></td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="40" style="vertical-align: middle;"><div style="background: #E0F2FE; width: 32px; height: 32px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px;">&#9992;&#65039;</div></td>
                  <td style="font-size: 16px;"><strong style="color: #0EA5E9;">Telegram:</strong> <a href="https://t.me/tuawn_anh" style="color: #1E293B; text-decoration: none; font-weight: 500;">@tuawn_anh</a></td>
                </tr>
              </table>
            </div>

            <!-- ======================== -->
            <!-- CTA BUTTON -->
            <!-- ======================== -->
            <div style="text-align: center;">
              <a href="https://zalo.me/0559629469" style="display: inline-block; background: linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%); color: #FFFFFF; text-decoration: none; padding: 16px 48px; font-size: 16px; font-weight: 700; border-radius: 100px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4); text-transform: uppercase; letter-spacing: 1px;">Gia Hạn Ngay</a>
            </div>
            
          </div>

          <!-- ======================== -->
          <!-- FOOTER -->
          <!-- ======================== -->
          <div style="background-color: #F8FAFC; padding: 32px 40px; text-align: center; border-top: 1px solid #E2E8F0;">
            <div style="font-size: 28px; margin-bottom: 16px; opacity: 0.8;">&#129302;</div>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B; font-weight: 500;">Đây là email gửi tự động.</p>
            <p style="margin: 0; font-size: 13px; color: #64748B;">Nếu cần hỗ trợ vui lòng liên hệ Zalo.</p>
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
