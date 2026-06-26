// ============================================
// DASHBOARD PAGE
// ============================================

const Dashboard = {
  render() {
    const stats = DataManager.getStats();
    const orders = DataManager.getOrders();
    const recentOrders = [...orders].sort((a, b) => {
      const dateA = Utils.parseVietnameseDate(a.orderDate) || new Date(a.createdAt || 0);
      const dateB = Utils.parseVietnameseDate(b.orderDate) || new Date(b.createdAt || 0);
      return dateB - dateA;
    }).slice(0, 8);
    const products = DataManager.getProducts();

    const platformColors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

    const container = document.getElementById('page-dashboard');
    container.innerHTML = `
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <div>
              <div class="stat-label">Tổng đơn hàng</div>
              <div class="stat-value">${stats.totalOrders}</div>
              <div class="stat-change positive">✅ ${stats.paidOrders} đã thanh toán</div>
            </div>
            <div class="stat-icon purple">📦</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div>
              <div class="stat-label">Doanh thu</div>
              <div class="stat-value">${Utils.formatCurrency(stats.totalRevenue)}</div>
              <div class="stat-change positive">💰 Đã thanh toán</div>
            </div>
            <div class="stat-icon green">💵</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div>
              <div class="stat-label">Tổng acc mẹ</div>
              <div class="stat-value">${stats.totalAccounts}</div>
              <div class="stat-change ${stats.freeSlots > 0 ? 'positive' : 'negative'}">${stats.freeSlots > 0 ? '🟢' : '🔴'} ${stats.freeSlots} slot trống</div>
            </div>
            <div class="stat-icon blue">👤</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <div>
              <div class="stat-label">Slot đã dùng</div>
              <div class="stat-value">${stats.usedSlots}/${stats.totalSlots}</div>
              <div class="stat-change negative">🔒 ${stats.fullAccounts} acc đã full</div>
            </div>
            <div class="stat-icon orange">📊</div>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📈 Doanh thu theo tháng</div>
          </div>
          <div class="chart-container">
            <canvas id="revenue-chart"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">🏪 Nền tảng bán hàng</div>
          </div>
          <div class="card-body">
            <div class="platform-list">
              ${Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]).map((entry, i) => {
                const [name, count] = entry;
                const maxCount = Math.max(...Object.values(stats.byPlatform));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return `
                  <div class="platform-item">
                    <div class="platform-color" style="background: ${platformColors[i % platformColors.length]}"></div>
                    <div class="platform-name">${Utils.escapeHtml(name)}</div>
                    <div class="platform-count">${count}</div>
                    <div class="platform-bar">
                      <div class="platform-bar-fill" style="width: ${pct}%; background: ${platformColors[i % platformColors.length]}"></div>
                    </div>
                  </div>
                `;
              }).join('') || '<div class="text-muted">Chưa có dữ liệu</div>'}
            </div>
          </div>
        </div>
      </div>

      <!-- Product Distribution -->
      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Đơn hàng gần đây</div>
            <button class="btn btn-sm btn-secondary" onclick="App.navigate('orders')">Xem tất cả →</button>
          </div>
          <div class="card-body no-padding">
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã ĐH</th>
                    <th>Email</th>
                    <th>Sản phẩm</th>
                    <th>Giá</th>
                    <th>Ngày</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentOrders.length > 0 ? recentOrders.map(o => {
                    const product = products.find(p => p.name === o.product || p.id === o.product);
                    return `
                      <tr>
                        <td><strong>${Utils.escapeHtml(o.madon || '')}</strong></td>
                        <td class="truncate">${Utils.escapeHtml(o.email || '')}</td>
                        <td><span class="badge badge-purple">${Utils.escapeHtml(o.product || '')}</span></td>
                        <td>${Utils.formatCurrency(o.price || 0)}</td>
                        <td>${Utils.escapeHtml(o.orderDate || '')}</td>
                        <td><span class="badge ${o.status === 'Đã thanh toán' ? 'badge-success' : 'badge-warning'}">${Utils.escapeHtml(o.status || '')}</span></td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr><td colspan="6" class="text-center text-muted" style="padding:40px">Chưa có đơn hàng nào</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">📦 Phân bổ sản phẩm</div>
          </div>
          <div class="card-body">
            <div class="platform-list">
              ${Object.entries(stats.byProduct).sort((a, b) => b[1] - a[1]).map((entry, i) => {
                const [name, count] = entry;
                const product = products.find(p => p.name === name);
                const color = product ? product.color : platformColors[i % platformColors.length];
                const maxCount = Math.max(...Object.values(stats.byProduct));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return `
                  <div class="platform-item">
                    <div class="platform-color" style="background: ${color}"></div>
                    <div class="platform-name">${Utils.escapeHtml(name)}</div>
                    <div class="platform-count">${count}</div>
                    <div class="platform-bar">
                      <div class="platform-bar-fill" style="width: ${pct}%; background: ${color}"></div>
                    </div>
                  </div>
                `;
              }).join('') || '<div class="text-muted">Chưa có dữ liệu</div>'}
            </div>
          </div>
        </div>
      </div>
    `;

    // Render chart
    this._renderRevenueChart(stats.monthlyRevenue);
  },

  _renderRevenueChart(data) {
    const canvas = document.getElementById('revenue-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = Object.keys(data);
    const values = Object.values(data);
    const maxVal = Math.max(...values, 1);

    // Hi-DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 260 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '260px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 260;
    const padding = { top: 20, right: 20, bottom: 40, left: 70 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Background
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Y labels
      const val = maxVal - (maxVal / 4) * i;
      ctx.fillStyle = '#8b8ba3';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Utils.formatCurrency(Math.round(val)), padding.left - 8, y + 4);
    }

    if (labels.length === 0) return;

    const barWidth = Math.min(40, (chartW / labels.length) * 0.6);
    const gap = chartW / labels.length;

    labels.forEach((label, i) => {
      const x = padding.left + gap * i + gap / 2;
      const val = values[i];
      const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
      const y = padding.top + chartH - barH;

      // Bar gradient
      const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(1, '#3b82f6');

      // Bar
      ctx.fillStyle = grad;
      ctx.beginPath();
      const radius = 4;
      ctx.moveTo(x - barWidth / 2 + radius, y);
      ctx.lineTo(x + barWidth / 2 - radius, y);
      ctx.quadraticCurveTo(x + barWidth / 2, y, x + barWidth / 2, y + radius);
      ctx.lineTo(x + barWidth / 2, padding.top + chartH);
      ctx.lineTo(x - barWidth / 2, padding.top + chartH);
      ctx.lineTo(x - barWidth / 2, y + radius);
      ctx.quadraticCurveTo(x - barWidth / 2, y, x - barWidth / 2 + radius, y);
      ctx.fill();

      // Bar glow
      ctx.shadowColor = 'rgba(99, 102, 241, 0.2)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      // Value above bar
      if (val > 0) {
        ctx.fillStyle = '#1e293b';
        ctx.font = '600 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Utils.formatCurrency(val), x, y - 8);
      }

      // X labels
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, h - padding.bottom + 20);
    });
  },
};
