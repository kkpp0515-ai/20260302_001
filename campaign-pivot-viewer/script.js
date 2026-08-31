/*
 * Campaign Pivot Table
 * CSV/TSV を読み込み、行=日付（先頭に合計行）× 列=グループ（先頭に合計列）の
 * ピボット表として表示するブラウザ完結ツール。
 */
(function () {
  'use strict';

  const KEY_SEP = String.fromCharCode(31); // unit separator, never appears in source data

  // ---------------------------------------------------------------------
  // 比率指標の再計算ルール（単純平均ではなく分子/分母の合算から算出する）
  // ---------------------------------------------------------------------
  const DERIVED = {
    'Real_Roas': { num: 'Real_Payamt', den: 'COST', percent: true },
    'Predict_Roas': { num: 'Predict_Payamt', den: 'COST', percent: true },
    'FirstpayCPA': { num: 'COST', den: 'Firstpay Cv', percent: false },
    'CreateroleCPA': { num: 'COST', den: 'L Cv', percent: false },
    'Real_LTV': { num: 'Real_Payamt', den: 'L Cv', percent: false },
  };

  const METRIC_LABELS = {
    'COST': 'COST（消化金額）',
    'Predict_Payamt': 'Predict Payamt［予測］',
    'Predict_Roas': 'Predict ROAS［予測］',
    'Real_Payamt': 'Real Payamt（実績売上）',
    'Real_Roas': 'Real ROAS（実績）',
    'Firstpay Cv': 'Firstpay CV',
    'FirstpayCPA': 'Firstpay CPA',
    'L Cv': 'L CV',
    'CreateroleCPA': 'Createrole CPA',
    'Real_LTV': 'Real LTV',
    'D Cv': 'D CV',
  };

  const IGNORE_HEADERS = new Set(['Y-M']);

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const state = {
    headers: [],
    colTypes: {},        // header -> { type: 'date'|'number'|'dimension'|'ignore', isPercent }
    rows: [],            // { dims: {}, nums: {}, date: 'YYYY/MM/DD' }
    dimensionHeaders: [],
    numberHeaders: [],
    quickFilterHeaders: [], // low-cardinality dimension headers (excluding groupBy)
  };

  // ---------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------
  const els = {
    dropZone: document.getElementById('pvDropZone'),
    fileInput: document.getElementById('pvFileInput'),
    error: document.getElementById('pvError'),
    upload: document.getElementById('pvUpload'),
    workspace: document.getElementById('pvWorkspace'),
    groupBy: document.getElementById('pvGroupBy'),
    metric: document.getElementById('pvMetric'),
    search: document.getElementById('pvSearch'),
    quickFilters: document.getElementById('pvQuickFilters'),
    dateFrom: document.getElementById('pvDateFrom'),
    dateTo: document.getElementById('pvDateTo'),
    sort: document.getElementById('pvSort'),
    limit: document.getElementById('pvLimit'),
    target: document.getElementById('pvTarget'),
    lowerBetter: document.getElementById('pvLowerBetter'),
    reload: document.getElementById('pvReload'),
    summary: document.getElementById('pvSummary'),
    table: document.getElementById('pvTable'),
  };

  // ---------------------------------------------------------------------
  // File loading & decoding
  // ---------------------------------------------------------------------

  function decodeBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3));
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function detectDelimiter(headerLine) {
    const tabs = (headerLine.match(/\t/g) || []).length;
    const commas = (headerLine.match(/,/g) || []).length;
    return tabs >= commas ? '\t' : ',';
  }

  function parseText(text) {
    const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
    if (lines.length < 2) {
      throw new Error('データ行が見つかりません。ヘッダー行＋1行以上のデータが必要です。');
    }
    const delimiter = detectDelimiter(lines[0]);
    const headers = lines[0].split(delimiter).map((h) => h.trim());
    const rawRows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(delimiter);
      if (cells.length < headers.length) continue;
      const row = {};
      for (let c = 0; c < headers.length; c++) {
        row[headers[c]] = (cells[c] || '').trim();
      }
      rawRows.push(row);
    }
    return { headers, rawRows };
  }

  function classifyColumns(headers, rawRows) {
    const types = {};
    const sample = rawRows.slice(0, Math.min(rawRows.length, 400));
    for (const h of headers) {
      if (IGNORE_HEADERS.has(h)) { types[h] = { type: 'ignore' }; continue; }
      if (h === 'Date') { types[h] = { type: 'date' }; continue; }
      let dateHits = 0, numHits = 0, total = 0, pct = false;
      for (const row of sample) {
        const v = row[h];
        if (!v) continue;
        total++;
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v)) {
          dateHits++;
        } else if (/^-?[\d,]+(\.\d+)?%?$/.test(v)) {
          numHits++;
          if (v.endsWith('%')) pct = true;
        }
      }
      if (total === 0) { types[h] = { type: 'dimension' }; continue; }
      if (dateHits / total > 0.8) types[h] = { type: 'date' };
      else if (numHits / total > 0.7) types[h] = { type: 'number', isPercent: pct };
      else types[h] = { type: 'dimension' };
    }
    return types;
  }

  function parseNum(v) {
    if (!v) return null;
    const cleaned = v.replace(/,/g, '').replace('%', '').trim();
    if (cleaned === '') return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function buildRows(headers, rawRows, colTypes) {
    const out = [];
    for (const raw of rawRows) {
      const rec = { dims: {}, nums: {}, date: null };
      for (const h of headers) {
        const ct = colTypes[h];
        if (!ct || ct.type === 'ignore') continue;
        const v = raw[h];
        if (ct.type === 'date') rec.date = v || null;
        else if (ct.type === 'number') rec.nums[h] = parseNum(v);
        else rec.dims[h] = v || '';
      }
      if (rec.date) out.push(rec);
    }
    return out;
  }

  function toISO(dateStr) {
    // 'YYYY/M/D' -> 'YYYY-MM-DD'
    const parts = dateStr.split('/');
    const y = parts[0], m = parts[1], d = parts[2];
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function loadFile(file) {
    hideError();
    const reader = new FileReader();
    reader.onerror = () => showError('ファイルの読み込みに失敗しました。');
    reader.onload = () => {
      try {
        const text = decodeBuffer(reader.result);
        const parsed = parseText(text);
        const headers = parsed.headers;
        const rawRows = parsed.rawRows;
        const colTypes = classifyColumns(headers, rawRows);
        const rows = buildRows(headers, rawRows, colTypes);
        if (rows.length === 0) {
          throw new Error('日付列（Date）を認識できませんでした。ヘッダーに "Date" 列が含まれているか確認してください。');
        }

        state.headers = headers;
        state.colTypes = colTypes;
        state.rows = rows;
        state.dimensionHeaders = headers.filter((h) => colTypes[h] && colTypes[h].type === 'dimension');
        state.numberHeaders = headers.filter((h) => colTypes[h] && colTypes[h].type === 'number');

        initWorkspace();
      } catch (err) {
        showError(err.message || String(err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = false;
  }
  function hideError() {
    els.error.hidden = true;
    els.error.textContent = '';
  }

  // ---------------------------------------------------------------------
  // Aggregation
  // ---------------------------------------------------------------------

  function addSums(target, nums) {
    for (const h of state.numberHeaders) {
      const v = nums[h];
      if (v == null) continue;
      target[h] = (target[h] || 0) + v;
    }
  }

  function aggregate(rows, groupByHeader) {
    const cellMap = new Map();
    const colTotals = new Map();
    const rowTotals = new Map();
    const grand = {};

    for (const r of rows) {
      const gv = r.dims[groupByHeader] || '(不明)';
      const key = r.date + KEY_SEP + gv;

      if (!cellMap.has(key)) cellMap.set(key, {});
      addSums(cellMap.get(key), r.nums);

      if (!colTotals.has(gv)) colTotals.set(gv, {});
      addSums(colTotals.get(gv), r.nums);

      if (!rowTotals.has(r.date)) rowTotals.set(r.date, {});
      addSums(rowTotals.get(r.date), r.nums);

      addSums(grand, r.nums);
    }
    return { cellMap: cellMap, colTotals: colTotals, rowTotals: rowTotals, grand: grand };
  }

  function metricValue(sums, metric) {
    if (!sums) return null;
    const d = DERIVED[metric];
    if (d) {
      const den = sums[d.den];
      if (!den) return null;
      const num = sums[d.num] || 0;
      return d.percent ? (num / den) * 100 : num / den;
    }
    const v = sums[metric];
    return v == null ? null : v;
  }

  function isPercentMetric(metric) {
    const d = DERIVED[metric];
    if (d) return d.percent;
    return !!(state.colTypes[metric] && state.colTypes[metric].isPercent);
  }

  function formatMetric(value, metric) {
    if (value == null || !Number.isFinite(value)) return '–';
    if (isPercentMetric(metric)) return value.toFixed(1) + '%';
    const d = DERIVED[metric];
    if (d && !d.percent) {
      return value.toLocaleString('ja-JP', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
    }
    return Math.round(value).toLocaleString('ja-JP');
  }

  // ---------------------------------------------------------------------
  // Heat coloring
  // ---------------------------------------------------------------------

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function lerpRGB(c1, c2, t) {
    return [0, 1, 2].map((i) => Math.round(c1[i] + (c2[i] - c1[i]) * t));
  }

  function heatColor(goodness) {
    const bad = [239, 68, 68], mid = [234, 179, 8], good = [34, 197, 94];
    const c = goodness <= 0.5 ? lerpRGB(bad, mid, goodness / 0.5) : lerpRGB(mid, good, (goodness - 0.5) / 0.5);
    return 'rgba(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', 0.42)';
  }

  function cellGoodness(v, lowerBetter, target, vmin, vmax) {
    if (target != null && !Number.isNaN(target) && target !== 0) {
      const score = lowerBetter ? (v === 0 ? Infinity : target / v) : v / target;
      return clamp(score / 2, 0, 1);
    }
    if (vmax > vmin) {
      const t = (v - vmin) / (vmax - vmin);
      return lowerBetter ? 1 - t : t;
    }
    return 0.5;
  }

  // ---------------------------------------------------------------------
  // UI initialisation (once a file is loaded)
  // ---------------------------------------------------------------------

  function niceLabel(header) {
    return METRIC_LABELS[header] || header;
  }

  function initWorkspace() {
    // group-by options
    els.groupBy.innerHTML = state.dimensionHeaders
      .map((h) => '<option value="' + escapeAttr(h) + '">' + escapeHtml(h) + '</option>')
      .join('');
    const defaultGroupBy = state.dimensionHeaders.indexOf('Campaign') !== -1 ? 'Campaign' : state.dimensionHeaders[0];
    els.groupBy.value = defaultGroupBy;

    // metric options
    els.metric.innerHTML = state.numberHeaders
      .map((h) => '<option value="' + escapeAttr(h) + '">' + escapeHtml(niceLabel(h)) + '</option>')
      .join('');
    const defaultMetric = state.numberHeaders.indexOf('Real_Roas') !== -1 ? 'Real_Roas' : state.numberHeaders[0];
    els.metric.value = defaultMetric;
    els.lowerBetter.checked = /cpa/i.test(defaultMetric);

    // date range
    const dates = Array.from(new Set(state.rows.map((r) => r.date))).sort();
    els.dateFrom.value = toISO(dates[0]);
    els.dateTo.value = toISO(dates[dates.length - 1]);
    els.dateFrom.min = els.dateTo.min = toISO(dates[0]);
    els.dateFrom.max = els.dateTo.max = toISO(dates[dates.length - 1]);

    els.search.value = '';
    els.target.value = '';

    buildQuickFilters();

    els.upload.hidden = true;
    els.workspace.hidden = false;

    render();
  }

  function buildQuickFilters() {
    const groupBy = els.groupBy.value;
    const candidates = state.dimensionHeaders
      .filter((h) => h !== groupBy)
      .map((h) => {
        const values = new Set(state.rows.map((r) => r.dims[h]).filter((v) => v));
        return { header: h, values: Array.from(values).sort((a, b) => a.localeCompare(b, 'ja')) };
      })
      .filter((c) => c.values.length >= 2 && c.values.length <= 20)
      .sort((a, b) => a.values.length - b.values.length)
      .slice(0, 3);

    state.quickFilterHeaders = candidates.map((c) => c.header);

    els.quickFilters.innerHTML = candidates
      .map((c) => {
        const id = 'pvQF_' + safeId(c.header);
        const opts = c.values.map((v) => '<option value="' + escapeAttr(v) + '">' + escapeHtml(v) + '</option>').join('');
        return '' +
          '<div class="pv-control">' +
          '<label for="' + id + '">' + escapeHtml(c.header) + '</label>' +
          '<select id="' + id + '" class="neo-input" data-qf-header="' + escapeAttr(c.header) + '">' +
          '<option value="__all__">すべて</option>' +
          opts +
          '</select>' +
          '</div>';
      })
      .join('');

    const selects = els.quickFilters.querySelectorAll('select');
    for (let i = 0; i < selects.length; i++) selects[i].addEventListener('change', render);
  }

  function safeId(s) {
    return s.replace(/[^a-zA-Z0-9]/g, '_');
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  function computeGroupList(colTotals, metric, opts) {
    let groups = Array.from(colTotals.keys());
    if (opts.search) {
      const q = opts.search.toLowerCase();
      groups = groups.filter((g) => g.toLowerCase().indexOf(q) !== -1);
    }
    if (opts.sort === 'name-asc') {
      groups.sort((a, b) => a.localeCompare(b, 'ja'));
    } else {
      groups.sort((a, b) => {
        const va = metricValue(colTotals.get(a), metric);
        const vb = metricValue(colTotals.get(b), metric);
        const na = va == null ? -Infinity : va;
        const nb = vb == null ? -Infinity : vb;
        return opts.sort === 'total-asc' ? na - nb : nb - na;
      });
    }
    if (opts.limit !== 'all') groups = groups.slice(0, parseInt(opts.limit, 10));
    return groups;
  }

  function render() {
    const groupBy = els.groupBy.value;
    const metric = els.metric.value;
    const search = els.search.value.trim();
    const sort = els.sort.value;
    const limit = els.limit.value;
    const lowerBetter = els.lowerBetter.checked;
    const targetRaw = els.target.value;
    const target = targetRaw === '' ? null : parseFloat(targetRaw);
    const dateFrom = els.dateFrom.value;
    const dateTo = els.dateTo.value;

    let rows = state.rows;
    if (dateFrom) rows = rows.filter((r) => toISO(r.date) >= dateFrom);
    if (dateTo) rows = rows.filter((r) => toISO(r.date) <= dateTo);

    const selects = els.quickFilters.querySelectorAll('select');
    for (let i = 0; i < selects.length; i++) {
      const sel = selects[i];
      const header = sel.dataset.qfHeader;
      if (sel.value !== '__all__') {
        rows = rows.filter((r) => r.dims[header] === sel.value);
      }
    }

    const agg = aggregate(rows, groupBy);
    const groups = computeGroupList(agg.colTotals, metric, { search: search, sort: sort, limit: limit });
    const dates = Array.from(new Set(rows.map((r) => r.date))).sort().reverse();

    renderTable({
      groupBy: groupBy, metric: metric, groups: groups, dates: dates,
      cellMap: agg.cellMap, colTotals: agg.colTotals, rowTotals: agg.rowTotals, grand: agg.grand,
      lowerBetter: lowerBetter, target: target,
    });
    renderSummary({ rows: rows, groups: groups, dates: dates, grand: agg.grand, metric: metric });
  }

  function renderTable(ctx) {
    const groupBy = ctx.groupBy, metric = ctx.metric, groups = ctx.groups, dates = ctx.dates;
    const cellMap = ctx.cellMap, colTotals = ctx.colTotals, rowTotals = ctx.rowTotals, grand = ctx.grand;
    const lowerBetter = ctx.lowerBetter, target = ctx.target;

    let vmin = 0, vmax = 1;
    if (target == null) {
      const vals = [];
      for (const d of dates) {
        for (const g of groups) {
          const v = metricValue(cellMap.get(d + KEY_SEP + g), metric);
          if (v != null) vals.push(v);
        }
      }
      if (vals.length) { vmin = Math.min.apply(null, vals); vmax = Math.max.apply(null, vals); }
    }

    const parts = [];
    parts.push('<thead><tr>');
    parts.push('<th class="pv-corner">日付＼' + escapeHtml(groupBy) + '</th>');
    parts.push('<th class="pv-colhead-total">合計</th>');
    for (const g of groups) parts.push('<th class="pv-colhead">' + escapeHtml(g) + '</th>');
    parts.push('</tr></thead><tbody>');

    // total row
    parts.push('<tr>');
    parts.push('<td class="pv-rowhead-total">合計</td>');
    const grandVal = metricValue(grand, metric);
    parts.push('<td class="pv-grand">' + formatMetric(grandVal, metric) + '</td>');
    for (const g of groups) {
      const v = metricValue(colTotals.get(g), metric);
      parts.push('<td class="pv-totalcell">' + formatMetric(v, metric) + '</td>');
    }
    parts.push('</tr>');

    // date rows
    for (const d of dates) {
      parts.push('<tr>');
      parts.push('<td class="pv-rowhead">' + d + '</td>');
      const rv = metricValue(rowTotals.get(d), metric);
      parts.push('<td class="pv-rowtotal">' + formatMetric(rv, metric) + '</td>');
      for (const g of groups) {
        const v = metricValue(cellMap.get(d + KEY_SEP + g), metric);
        if (v == null) {
          parts.push('<td class="pv-null">–</td>');
        } else {
          const goodness = cellGoodness(v, lowerBetter, target, vmin, vmax);
          parts.push('<td style="background:' + heatColor(goodness) + '">' + formatMetric(v, metric) + '</td>');
        }
      }
      parts.push('</tr>');
    }
    parts.push('</tbody>');

    els.table.innerHTML = parts.join('');
  }

  function renderSummary(ctx) {
    const rows = ctx.rows, groups = ctx.groups, dates = ctx.dates, grand = ctx.grand, metric = ctx.metric;
    const grandVal = metricValue(grand, metric);
    const period = dates.length
      ? dates[dates.length - 1] + ' 〜 ' + dates[0] + '（' + dates.length + '日）'
      : '—';

    els.summary.innerHTML =
      '<span class="pv-chip">表示グループ数 <span class="pv-chip-value">' + groups.length.toLocaleString('ja-JP') + '</span></span>' +
      '<span class="pv-chip">期間 <span class="pv-chip-value">' + period + '</span></span>' +
      '<span class="pv-chip">元データ行数 <span class="pv-chip-value">' + rows.length.toLocaleString('ja-JP') + '</span></span>' +
      '<span class="pv-chip">全体合計（' + escapeHtml(niceLabel(metric)) + '） <span class="pv-chip-value">' + formatMetric(grandVal, metric) + '</span></span>';
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------

  els.dropZone.addEventListener('click', () => els.fileInput.click());
  els.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
  });
  els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('pv-dragover'); });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('pv-dragover'));
  els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('pv-dragover');
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });
  els.fileInput.addEventListener('change', () => {
    if (els.fileInput.files.length) loadFile(els.fileInput.files[0]);
  });

  els.groupBy.addEventListener('change', () => { els.search.value = ''; buildQuickFilters(); render(); });
  els.metric.addEventListener('change', () => { els.lowerBetter.checked = /cpa/i.test(els.metric.value); render(); });
  els.search.addEventListener('input', debounce(render, 150));
  els.dateFrom.addEventListener('change', render);
  els.dateTo.addEventListener('change', render);
  els.sort.addEventListener('change', render);
  els.limit.addEventListener('change', render);
  els.target.addEventListener('input', debounce(render, 150));
  els.lowerBetter.addEventListener('change', render);
  els.reload.addEventListener('click', () => {
    els.workspace.hidden = true;
    els.upload.hidden = false;
    els.fileInput.value = '';
    hideError();
  });

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }
})();
