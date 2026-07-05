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
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #334155; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 30px 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Thông Báo Hết Hạn Dịch Vụ</h2>
            <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 15px;">Google AI Pro</p>
          </div>

          <div style="padding: 30px;">
            <p style="font-size: 16px; margin-top: 0;">Chào Anh/Chị,</p>
            <p style="font-size: 16px;">Gói dịch vụ <strong style="color: #0f172a;">Google AI Pro ${data.product}</strong> của Anh/Chị hiện tại <span style="color: #ef4444; font-weight: 700;">Đã hết hạn</span>. Vui lòng gia hạn để tiếp tục trải nghiệm các tính năng cao cấp không gián đoạn.</p>

            <!-- Features Box -->
            <div style="margin: 25px 0; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; overflow: hidden;">
              <div style="background-color: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 700;">&#10024; Quyền lợi đặc quyền khi gia hạn:</h3>
              </div>
              <div style="padding: 15px 20px;">
                <ul style="list-style-type: none; padding: 0; margin: 0; font-size: 14px;">
                  <li style="margin-bottom: 8px;">&#128142; <strong>5TB lưu trữ</strong> (Drive / Gmail / Photos)</li>
                  <li style="margin-bottom: 8px;">&#128640; <strong>Gemini 3 Pro + Veo</strong> (AI chat + tạo video)</li>
                  <li style="margin-bottom: 8px;">&#129504; <strong>NotebookLM</strong> (bản nâng cao)</li>
                  <li style="margin-bottom: 8px;">&#9889; <strong>Google Antigravity</strong> (agent AI nâng cao)</li>
                  <li style="margin-bottom: 8px;">&#127916; <strong>Flow</strong> (tạo video bằng AI)</li>
                  <li style="margin-bottom: 8px;">&#127912; <strong>Whisk + Whisk Animate</strong> (tạo ảnh + ảnh sang video)</li>
                  <li style="margin-bottom: 8px;">&#128187; <strong>Jules</strong> (AI lập trình, hạn mức cao)</li>
                  <li style="margin-bottom: 8px;">&#128736;&#65039; <strong>Gemini CLI + Code Assist</strong> (hỗ trợ code/IDE)</li>
                  <li style="margin-bottom: 8px;">&#128269; <strong>Deep Search / Deep Research</strong> (nghiên cứu chuyên sâu)</li>
                  <li style="margin-bottom: 8px;">&#128279; <strong>Gemini tích hợp</strong> Gmail / Docs / Sheets / Slides / Meet</li>
                  <li style="margin-bottom: 8px;">&#128222; <strong>Google Meet</strong> không giới hạn</li>
                  <li style="margin-bottom: 8px;">&#128444;&#65039; <strong>Ảnh &rarr; video + Đổi phong cách</strong> trong Google Photos</li>
                  <li style="margin-bottom: 0;">&#129689; <strong>1.000 tín dụng AI VEO 3</strong> mỗi tháng</li>
                </ul>
              </div>
            </div>

            <!-- Warning Box -->
            <div style="margin: 25px 0; border-left: 4px solid #ef4444; background-color: #fef2f2; padding: 15px 20px; border-radius: 0 8px 8px 0;">
              <h3 style="margin: 0 0 5px 0; font-size: 15px; color: #b91c1c;">&#9888;&#65039; Lưu ý quan trọng</h3>
              <p style="margin: 0; font-size: 14px; color: #991b1b;">Nếu thay đổi nhóm gia đình sẽ bị cấm tham gia lại 12 tháng.</p>
            </div>

            <!-- Action Buttons -->
            <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
              <a href="https://zalo.me/0559629469" style="display: inline-block; background-color: #0068ff; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 50px; font-weight: 600; font-size: 15px; margin: 0 5px 10px 5px; min-width: 160px; box-shadow: 0 4px 6px rgba(0, 104, 255, 0.2);">&#128172; Zalo: 0559629469</a>
              <a href="https://t.me/tuawn_anh" style="display: inline-block; background-color: #2481cc; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 50px; font-weight: 600; font-size: 15px; margin: 0 5px 10px 5px; min-width: 160px; box-shadow: 0 4px 6px rgba(36, 129, 204, 0.2);">&#9992;&#65039; Telegram Hỗ Trợ</a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">&copy; 2026 Khotaikhoan. Tất cả các quyền được bảo lưu.</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #94a3b8;">Email tự động, vui lòng không trả lời thư này.</p>
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
