// ============================================
// UTILITIES - Format, Toast, CSV, Backup
// ============================================

const Utils = {
  // --- Format ---
  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateISO(dateStr) {
    if (!dateStr) return '';
    // Convert dd/mm/yyyy to yyyy-mm-dd
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return dateStr;
  },

  parseVietnameseDate(dateStr) {
    if (!dateStr) return null;
    // Handle dd/mm/yyyy
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    return new Date(dateStr);
  },

  // --- ID Generation ---
  generateOrderId() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `DH${y}${m}${d}${rand}`;
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  },

  // --- Toast Notifications ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  },

  // --- CSV Export ---
  exportCSV(headers, rows, filename) {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this._downloadBlob(blob, filename);
  },

  // --- CSV Import (handles messy Google Sheet exports) ---
  parseCSV(text) {
    // Step 1: Merge multiline quoted fields
    // Google Sheet can export emails like: "email@gmail.com\n"
    const mergedLines = this._mergeMultilineFields(text);
    if (mergedLines.length < 2) return [];

    // Step 2: Parse all lines into arrays of values
    const parsedLines = mergedLines.map(l => this._parseCSVLine(l));

    // Step 3: Find the actual header row by looking for known column names
    const knownHeaders = [
      'Acc', 'Mail', 'Email', 'Slot', 'Gói', 'Ghi chú',
      'Username / Mã ĐH', 'Mã ĐH', 'Username', 'Sản phẩm',
      'Trạng thái thanh toán', 'Ngày đặt hàng', 'Giá',
      'Nền tảng bán hàng', 'Nền tảng'
    ];

    let headerRowIdx = -1;
    let headerCols = []; // { name, colIndex }

    for (let i = 0; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      const matches = [];
      for (let c = 0; c < line.length; c++) {
        const val = line[c].trim();
        if (val && knownHeaders.some(h => h.toLowerCase() === val.toLowerCase())) {
          matches.push({ name: val, colIndex: c });
        }
      }
      // Need at least 2 known headers to be considered the header row
      if (matches.length >= 2) {
        headerRowIdx = i;
        headerCols = matches;

        // Also capture any headers between known ones (fill in non-empty cells)
        for (let c = 0; c < line.length; c++) {
          const val = line[c].trim();
          if (val && !matches.some(m => m.colIndex === c)) {
            headerCols.push({ name: val, colIndex: c });
          }
        }
        headerCols.sort((a, b) => a.colIndex - b.colIndex);
        break;
      }
    }

    if (headerRowIdx === -1) {
      // Fallback: use first non-empty row as headers
      for (let i = 0; i < parsedLines.length; i++) {
        const nonEmpty = parsedLines[i].filter(v => v.trim());
        if (nonEmpty.length >= 2) {
          headerRowIdx = i;
          headerCols = parsedLines[i]
            .map((v, idx) => ({ name: v.trim(), colIndex: idx }))
            .filter(h => h.name);
          break;
        }
      }
    }

    if (headerRowIdx === -1) return [];

    // Step 4: Map data rows using the detected header columns
    const rows = [];
    for (let i = headerRowIdx + 1; i < parsedLines.length; i++) {
      const line = parsedLines[i];

      // Skip empty rows (all cells empty)
      const hasData = line.some(v => v.trim());
      if (!hasData) continue;

      const obj = {};
      let hasValue = false;
      headerCols.forEach(h => {
        const val = (line[h.colIndex] || '').trim().replace(/[\r\n]+/g, '');
        obj[h.name] = val;
        if (val) hasValue = true;
      });

      if (hasValue) rows.push(obj);
    }

    return rows;
  },

  // Merge lines that are part of a multiline quoted field
  _mergeMultilineFields(text) {
    const rawLines = text.split(/\r?\n/);
    const merged = [];
    let buffer = '';
    let inQuotes = false;

    for (const line of rawLines) {
      if (!inQuotes) {
        buffer = line;
      } else {
        buffer += ' ' + line; // Join with space instead of newline
      }

      // Count unescaped quotes to determine if we're inside a quoted field
      let quotes = 0;
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === '"') quotes++;
      }
      inQuotes = (quotes % 2 !== 0);

      if (!inQuotes) {
        merged.push(buffer);
        buffer = '';
      }
    }
    if (buffer) merged.push(buffer);

    return merged.filter(l => l.trim());
  },

  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);
    return result;
  },

  // --- JSON Backup/Restore ---
  exportJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    this._downloadBlob(blob, filename);
  },

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // --- Debounce ---
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // --- Confirm Dialog ---
  confirm(message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirm-dialog');
      const msgEl = overlay.querySelector('.confirm-message');
      msgEl.textContent = message;
      overlay.classList.add('active');

      const btnConfirm = overlay.querySelector('.btn-confirm-yes');
      const btnCancel = overlay.querySelector('.btn-confirm-no');

      const cleanup = () => {
        overlay.classList.remove('active');
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
      };

      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };

      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
    });
  },

  // --- Escaping ---
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
