// ══════════════════════════════════════════════════════════════
// BPP Dashboard — Módulo de Upload CSV (v3 — Base_XD nativo)
// Adicione ao index.html: <script src="csv-upload.js"></script>
// ══════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ── 1. CSS ──────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '.csv-upload-wrap{display:flex;align-items:center;gap:6px}',
    '.csv-upload-btn{display:flex;align-items:center;gap:6px;padding:5px 12px;background:#1a1a2e;border:1px solid rgba(26,26,46,.3);color:#FFE600;border-radius:7px;font-family:"IBM Plex Sans",sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:all .25s}',
    '.csv-upload-btn:hover{background:#333;box-shadow:0 0 14px rgba(255,230,0,.18)}',
    '.csv-upload-btn.has-data{background:#003020;border-color:rgba(0,224,158,.4);color:#00e09e}',
    '.csv-clear-btn{display:none;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:rgba(255,58,92,.1);border:1px solid rgba(255,58,92,.3);color:#ff3a5c;font-size:11px;font-weight:700;cursor:pointer;font-family:"IBM Plex Sans",sans-serif}',
    '.csv-clear-btn.visible{display:flex}',
    '.csv-data-badge{display:none;font-size:9px;padding:2px 7px;border-radius:20px;background:rgba(0,224,158,.12);color:#00e09e;border:1px solid rgba(0,224,158,.25);font-family:"IBM Plex Mono",monospace;font-weight:600;white-space:nowrap}',
    '.csv-data-badge.visible{display:inline-flex}',
    '.csv-toast{position:fixed;top:60px;right:24px;z-index:9999;padding:14px 20px;border-radius:10px;font-family:"IBM Plex Sans",sans-serif;font-size:12px;font-weight:600;transform:translateX(120%);opacity:0;transition:transform .4s cubic-bezier(.22,1,.36,1),opacity .35s;pointer-events:none;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.5)}',
    '.csv-toast.show{transform:translateX(0);opacity:1}',
    '.csv-toast.success{background:linear-gradient(135deg,#003020,#001a10);border:1px solid rgba(0,224,158,.5);color:#00e09e}',
    '.csv-toast.error{background:linear-gradient(135deg,#2d0010,#1a0008);border:1px solid rgba(255,58,92,.5);color:#ff3a5c}',
    '.csv-toast.warning{background:linear-gradient(135deg,#2d1f00,#1a1200);border:1px solid rgba(255,230,0,.5);color:#FFE600}',
    '.csv-toast .toast-title{font-weight:700;margin-bottom:3px;font-size:13px}',
    '.csv-toast .toast-detail{font-size:10px;opacity:.7}'
  ].join('\n');
  document.head.appendChild(style);

  // ── 2. DOM ──────────────────────────────────────────────────
  var toast = document.createElement('div');
  toast.className = 'csv-toast'; toast.id = 'csv-toast';
  toast.innerHTML = '<div class="toast-title" id="csv-toast-title"></div><div class="toast-detail" id="csv-toast-detail"></div>';
  document.body.appendChild(toast);

  var topbarRight = document.querySelector('.topbar-right');

  // Esconder gráfico "Estimado vs Coletado" original (será substituído)
  var volListEl = document.getElementById('sellers-vol-list');
  if (volListEl && volListEl.closest('.chart-card')) {
    volListEl.closest('.chart-card').style.display = 'none';
  }

  if (topbarRight) {
    var exportBtn = topbarRight.querySelector('button[onclick*="exportarPDF"]');
    var wrap = document.createElement('div');
    wrap.className = 'csv-upload-wrap';
    wrap.innerHTML =
      '<input type="file" id="csv-file-input" accept=".csv,.txt,.tsv" style="display:none">' +
      '<button class="csv-upload-btn" id="csv-upload-btn" title="Carregar CSV">' +
        '<span style="font-size:14px;line-height:1">📂</span> Carregar CSV</button>' +
      '<button class="csv-clear-btn" id="csv-clear-btn" title="Limpar dados">✕</button>' +
      '<span class="csv-data-badge" id="csv-data-badge"></span>';
    if (exportBtn) topbarRight.insertBefore(wrap, exportBtn);
    else topbarRight.prepend(wrap);
    document.getElementById('csv-upload-btn').addEventListener('click', function() {
      document.getElementById('csv-file-input').click();
    });
    document.getElementById('csv-file-input').addEventListener('change', handleCSVUpload);
    document.getElementById('csv-clear-btn').addEventListener('click', clearCSVData);
  }

  // ── 3. HELPERS ──────────────────────────────────────────────
  function showToast(type, title, detail, dur) {
    var el = document.getElementById('csv-toast');
    el.className = 'csv-toast ' + type;
    document.getElementById('csv-toast-title').textContent = title;
    document.getElementById('csv-toast-detail').textContent = detail || '';
    setTimeout(function() { el.classList.add('show'); }, 30);
    setTimeout(function() { el.classList.remove('show'); }, dur || 4000);
  }

  function updateUploadUI(hasData, info) {
    var btn = document.getElementById('csv-upload-btn');
    var clr = document.getElementById('csv-clear-btn');
    var bdg = document.getElementById('csv-data-badge');
    if (!btn) return;
    if (hasData) {
      btn.classList.add('has-data');
      btn.innerHTML = '<span style="font-size:14px;line-height:1">✅</span> Atualizar CSV';
      if (clr) clr.classList.add('visible');
      if (bdg && info) { bdg.textContent = info; bdg.classList.add('visible'); }
    } else {
      btn.classList.remove('has-data');
      btn.innerHTML = '<span style="font-size:14px;line-height:1">📂</span> Carregar CSV';
      if (clr) clr.classList.remove('visible');
      if (bdg) bdg.classList.remove('visible');
    }
  }

  function parseCSVLine(line, d) {
    if (!line || !line.trim()) return null;
    var r = [], c = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') q = !q;
      else if (ch === d && !q) { r.push(c); c = ''; }
      else c += ch;
    }
    r.push(c);
    return r;
  }

  // ── 4. PARSER BASE_XD ──────────────────────────────────────
  function parseBaseXD(text) {
    var firstLine = text.split(/\r?\n/)[0];
    var delim = ',';
    if (firstLine.split('\t').length > firstLine.split(',').length) delim = '\t';
    else if (firstLine.split(';').length > firstLine.split(',').length) delim = ';';

    var lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { error: 'CSV vazio' };

    var headers = parseCSVLine(lines[0], delim).map(function(h) { return h.trim().replace(/^"|"$/g, ''); });

    // Map column indices
    var idx = {};
    headers.forEach(function(h, i) { idx[h] = i; });

    // Check required columns
    var parada = idx['Parada']; if (parada === undefined) parada = idx['PARADA'];
    var deposito = idx['Depósito']; if (deposito === undefined) deposito = idx['DEPOSITO'] || idx['Deposito'];
    var trans = idx['Transportadora']; if (trans === undefined) trans = idx['TRANSPORTADORA'];
    var estCol = idx['Pacotes estimados']; if (estCol === undefined) estCol = idx['PACOTES ESTIMADOS'];
    var colCol = idx['Pacotes coletados']; if (colCol === undefined) colCol = idx['PACOTES COLETADOS'];
    var tipoParada = idx['Tipo de parada']; if (tipoParada === undefined) tipoParada = idx['TIPO DE PARADA'];
    var veiculo = idx['Tipo de veículo']; if (veiculo === undefined) veiculo = idx['TIPO DE VEICULO'];
    var horario = idx['Horários']; if (horario === undefined) horario = idx['HORARIOS'];
    var motivo = idx['Motivo']; if (motivo === undefined) motivo = idx['MOTIVO'];
    var driver = idx['ID do Motorista']; if (driver === undefined) driver = idx['ID DO MOTORISTA'];

    if (parada === undefined || estCol === undefined) {
      return { error: 'Colunas obrigatórias não encontradas (Parada, Pacotes estimados)' };
    }

    // Parse rows
    var sellerAgg = {};
    var horaAgg = {};
    var transHoraAgg = {};
    var veicAgg = {};
    var totalEst = 0, totalCol = 0, totalRows = 0;

    for (var i = 1; i < lines.length; i++) {
      var cols = parseCSVLine(lines[i], delim);
      if (!cols || cols.length < 5) continue;

      // Filter only "Vendedor" if column exists
      if (tipoParada !== undefined) {
        var tp = (cols[tipoParada] || '').trim();
        if (tp && tp !== 'Vendedor') continue;
      }

      var seller = (cols[parada] || '').trim();
      if (!seller) continue;

      var est = parseInt(cols[estCol]) || 0;
      var col = colCol !== undefined ? (parseInt(cols[colCol]) || 0) : 0;
      var hub = deposito !== undefined ? (cols[deposito] || '').trim() : '';
      var tr = trans !== undefined ? (cols[trans] || '').trim() : '';
      var veic = veiculo !== undefined ? (cols[veiculo] || '').trim() : '';
      var hora = horario !== undefined ? (cols[horario] || '').trim() : '';
      var mot = motivo !== undefined ? (cols[motivo] || '').trim() : '';
      var drv = driver !== undefined ? (cols[driver] || '').trim() : '';

      totalEst += est;
      totalCol += col;
      totalRows++;

      // Aggregate by seller
      if (!sellerAgg[seller]) sellerAgg[seller] = { seller: seller, hub: hub, trans: tr, est: 0, col: 0, motivo: mot, driver: drv, veiculo: veic };
      sellerAgg[seller].est += est;
      sellerAgg[seller].col += col;

      // Aggregate by hour
      if (hora) {
        var hMatch = hora.match(/^(\d{1,2})/);
        if (hMatch) {
          var hKey = ('0' + hMatch[1]).slice(-2) + 'h';
          if (!horaAgg[hKey]) horaAgg[hKey] = { est: 0, col: 0 };
          horaAgg[hKey].est += est;
          horaAgg[hKey].col += col;
          // Trans x Hour
          if (tr) {
            if (!transHoraAgg[tr]) transHoraAgg[tr] = {};
            if (!transHoraAgg[tr][hKey]) transHoraAgg[tr][hKey] = 0;
            transHoraAgg[tr][hKey] += col;
          }
        }
      }

      // Aggregate vehicles
      if (veic) {
        if (!veicAgg[veic]) veicAgg[veic] = 0;
        veicAgg[veic] += col;
      }
    }

    // Build RAW (backlog: sellers with pending > 0)
    var rawData = [];
    Object.keys(sellerAgg).forEach(function(s) {
      var d = sellerAgg[s];
      var pend = d.est - d.col;
      if (pend > 0) {
        rawData.push({
          seller: s, hub: d.hub, trans: d.trans, rota: d.hub,
          vol: pend, days: 1, status: 'Pendente',
          motivo: d.motivo, driver: d.driver, veiculo: d.veiculo,
          estimado: d.est, coletado: d.col
        });
      }
    });

    // Build hourly data sorted
    var horaLabels = [], horaEst = [], horaCol = [];
    Object.keys(horaAgg).sort().forEach(function(h) {
      horaLabels.push(h);
      horaEst.push(horaAgg[h].est);
      horaCol.push(horaAgg[h].col);
    });

    // Build top transportadoras by hour
    var topTrans = Object.keys(transHoraAgg).map(function(t) {
      return { name: t, total: Object.values(transHoraAgg[t]).reduce(function(a, b) { return a + b; }, 0), byHour: transHoraAgg[t] };
    }).sort(function(a, b) { return b.total - a.total; }).slice(0, 5);

    // Build vehicle groups
    var vGroups = {
      'VUC': ['Vuc', 'Vuc Rental TKS', 'Rental VUC FM', 'VUC Dedicado com Ajudante', 'VUC Dedicado FBM 4K', 'VUC Dedicado FBM 7K', 'VUC Elétrico', 'Vuc TKS 2025', 'Melione VUC Dedicado'],
      'Caminhão Médio': ['Médio', 'Rental Medio FM', 'MEDIO FM DD'],
      'Van': ['Van', 'Van Frota Fixa Dedicado', 'Rental Utilitário sem Ajudante', 'Large Van Elétrica - Equipe Única'],
      'Toco': ['Toco'], 'HR / Utilitário': ['HR', 'Utilitários'], 'Truck': ['Truck'], 'Carreta': ['Carreta']
    };
    var veicGrouped = {};
    Object.keys(veicAgg).forEach(function(v) {
      var found = false;
      Object.keys(vGroups).forEach(function(g) {
        if (found) return;
        vGroups[g].forEach(function(item) {
          if (found) return;
          if (v.indexOf(item) >= 0 || item.indexOf(v) >= 0) {
            veicGrouped[g] = (veicGrouped[g] || 0) + veicAgg[v];
            found = true;
          }
        });
      });
      if (!found) veicGrouped[v] = (veicGrouped[v] || 0) + veicAgg[v];
    });

    // Top 10 sellers by COLLECTED
    var topCollected = Object.values(sellerAgg).sort(function(a, b) { return b.col - a.col; }).slice(0, 10);

    return {
      raw: rawData,
      eficiencia: { est: totalEst, col: totalCol, efic: totalEst > 0 ? Math.round(totalCol / totalEst * 1000) / 10 : 0 },
      horaLabels: horaLabels, horaEst: horaEst, horaCol: horaCol,
      topTrans: topTrans,
      veicGrouped: veicGrouped,
      topCollected: topCollected,
      sellerAgg: sellerAgg,
      totalRows: totalRows
    };
  }

  // ── 5. FALLBACK PARSER (Criticidade/BPP) ────────────────────
  function parseCriticidade(text) {
    var firstLine = text.split(/\r?\n/)[0];
    var delim = ',';
    if (firstLine.split('\t').length > firstLine.split(',').length) delim = '\t';
    else if (firstLine.split(';').length > firstLine.split(',').length) delim = ';';
    var lines = text.trim().split(/\r?\n/);
    var headers = parseCSVLine(lines[0], delim).map(function(h) { return h.trim().replace(/^"|"$/g, '').toUpperCase(); });
    var result = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = parseCSVLine(lines[i], delim);
      if (!cols || cols.length < 3) continue;
      var row = {};
      headers.forEach(function(h, j) { row[h] = (cols[j] || '').trim(); });
      var seller = row['SELLER'] || row['VENDEDOR'] || '';
      if (!seller) continue;
      var vol = parseInt(row['VOL. PENDENTE'] || row['VOL PENDENTE'] || row['VOLUME'] || '0') || 0;
      var status = row['STATUS BPP'] || row['STATUS'] || '';
      result.push({ seller: seller, hub: row['HUB'] || row['DEPÓSITO'] || '', trans: row['TRANSPORTADORA'] || '', rota: row['ROTA'] || '', vol: vol, days: parseInt(status) || 0, status: status || 'Pendente', motivo: row['MOTIVO'] || '' });
    }
    return { raw: result, totalRows: result.length };
  }

  // ── 6. UPLOAD HANDLER ───────────────────────────────────────
  function handleCSVUpload(ev) {
    var file = ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var text = e.target.result;
        var isBaseXD = text.indexOf('Pacotes estimados') >= 0 || text.indexOf('PACOTES ESTIMADOS') >= 0 || text.indexOf('Parada') >= 0;
        var result;
        if (isBaseXD) {
          result = parseBaseXD(text);
        } else {
          result = parseCriticidade(text);
        }
        if (result.error) { showToast('error', '❌ Erro', result.error, 6000); return; }
        if (!result.raw || result.raw.length === 0) { showToast('error', '❌ Sem dados', 'Nenhum seller com pendência', 5000); return; }

        var saveObj = {
          raw: result.raw,
          eficiencia: result.eficiencia || null,
          horaLabels: result.horaLabels || null,
          horaEst: result.horaEst || null,
          horaCol: result.horaCol || null,
          topTrans: result.topTrans || null,
          veicGrouped: result.veicGrouped || null,
          topCollected: result.topCollected || null,
          sellerAgg: result.sellerAgg || null,
          timestamp: new Date().toISOString(),
          filename: file.name,
          totalRows: result.totalRows || result.raw.length
        };
        localStorage.setItem('bpp_csv_data', JSON.stringify(saveObj));
        applyCSVData(saveObj);
        var tv = result.raw.reduce(function(s, x) { return s + x.vol; }, 0);
        showToast('success', '✅ CSV carregado!', result.raw.length + ' sellers · ' + tv.toLocaleString('pt-BR') + ' vol · ' + file.name, 5000);
      } catch (err) {
        console.error('CSV error:', err);
        showToast('error', '❌ Erro', err.message, 5000);
      }
    };
    reader.readAsText(file, 'UTF-8');
    ev.target.value = '';
  }

  // ── 7. APPLY DATA ──────────────────────────────────────────
  function applyCSVData(obj) {
    window.RAW = obj.raw;
    window.data = obj.raw.slice();
    if (obj.eficiencia) window.EFIC_HOJE = obj.eficiencia;

    // Update VEHICLE global
    if (obj.veicGrouped && window.VEHICLE) {
      var vs = Object.entries(obj.veicGrouped).sort(function(a, b) { return b[1] - a[1]; });
      window.VEHICLE.labels = vs.map(function(x) { return x[0]; });
      window.VEHICLE.vals = vs.map(function(x) { return x[1]; });
    }

    // Update HOURS global
    if (obj.horaLabels && window.HOURS) {
      window.HOURS.labels = obj.horaLabels;
      window.HOURS.vals = obj.horaEst;
    }

    // Update alert banner
    var top = obj.raw.slice().sort(function(a, b) { return b.vol - a.vol; })[0];
    if (top) {
      var at = document.querySelector('.alert-text');
      if (at) at.innerHTML = '<strong>ALERTA:</strong> Principal ofensor: <span class="highlight">' + top.vol.toLocaleString('pt-BR') + ' vol pendente</span> — ' + top.seller + ' · HUB ' + top.hub + ' · ' + top.trans;
    }

    // Status
    var st = document.getElementById('load-status');
    var ts = new Date(obj.timestamp);
    if (st) { st.textContent = '✓ CSV ' + ts.toLocaleTimeString('pt-BR'); st.style.color = '#00e09e'; }
    var ti = ts.toLocaleDateString('pt-BR') + ' ' + ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    updateUploadUI(true, ti + ' · ' + obj.totalRows + ' linhas');

    // Override Performance charts with real data
    if (obj.topCollected) overrideTop10Pos(obj.topCollected);
    if (obj.horaLabels) overrideHoraPos(obj.horaLabels, obj.horaCol);
    if (obj.topTrans && obj.horaLabels) overrideTransHora(obj.topTrans, obj.horaLabels);

    // Reload filters & render
    reloadFilters();
    if (typeof renderAll === 'function') renderAll();
    if (typeof buildDestaqueCards === 'function') buildDestaqueCards();
  }

  // ── 8. CHART OVERRIDES ─────────────────────────────────────
  function overrideTop10Pos(topCollected) {
    window.buildTop10Pos = function() {
      if (typeof destroyChart === 'function') destroyChart('top10pos');
      var ctx = document.getElementById('cTop10Pos');
      if (!ctx) return;
      var labels = topCollected.map(function(d) { var s = d.seller || ''; return s.length > 20 ? s.substring(0, 20) + '…' : s; });
      var vals = topCollected.map(function(d) { return d.col; });
      var ci = window.chartInstances || window.charts || {};
      ci['top10pos'] = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Vol. Coletado', data: vals, backgroundColor: vals.map(function(_, i) { return 'hsla(' + (160 + i * 8) + ',80%,55%,0.3)'; }), borderColor: vals.map(function(_, i) { return 'hsla(' + (160 + i * 8) + ',80%,60%,1)'; }), borderWidth: 1.5, borderRadius: 5 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#5a7099', font: { family: 'IBM Plex Mono', size: 10 } }, grid: { color: 'rgba(30,43,66,.4)' } }, y: { ticks: { color: '#dce6f5', font: { family: 'IBM Plex Sans', size: 11, weight: '600' } }, grid: { display: false } } }, animation: { onComplete: function() { var ch = this, cx = ch.ctx; cx.save(); ch.data.datasets.forEach(function(_, i) { ch.getDatasetMeta(i).data.forEach(function(el, j) { cx.fillStyle = '#dce6f5'; cx.font = '600 10px IBM Plex Mono'; cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.fillText(ch.data.datasets[i].data[j].toLocaleString('pt-BR'), el.x + 6, el.y); }); }); cx.restore(); } } }
      });
      if (window.chartInstances) window.chartInstances['top10pos'] = ci['top10pos'];
      if (window.charts) window.charts['top10pos'] = ci['top10pos'];
    };
  }

  function overrideHoraPos(labels, vals) {
    window.buildHoraPos = function() {
      if (typeof destroyChart === 'function') destroyChart('horapos');
      var ctx = document.getElementById('cHoraPos');
      if (!ctx) return;
      var ci = window.chartInstances || window.charts || {};
      ci['horapos'] = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Coletas', data: vals, backgroundColor: 'rgba(0,224,158,.25)', borderColor: '#00e09e', borderWidth: 1.5, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#5a7099', font: { family: 'IBM Plex Mono', size: 9 } }, grid: { color: 'rgba(30,43,66,.4)' } }, y: { ticks: { color: '#5a7099', font: { family: 'IBM Plex Mono', size: 9 } }, grid: { color: 'rgba(30,43,66,.4)' } } }, animation: { onComplete: function() { var ch = this, cx = ch.ctx; cx.save(); cx.fillStyle = '#8298b8'; cx.font = 'bold 9px IBM Plex Mono'; cx.textAlign = 'center'; ch.data.datasets.forEach(function(_, i) { ch.getDatasetMeta(i).data.forEach(function(el, j) { cx.fillText(ch.data.datasets[i].data[j].toLocaleString('pt-BR'), el.x, el.y - 5); }); }); cx.restore(); } } }
      });
      if (window.chartInstances) window.chartInstances['horapos'] = ci['horapos'];
      if (window.charts) window.charts['horapos'] = ci['horapos'];
    };
  }

  function overrideTransHora(topTrans, horaLabels) {
    window.buildTransHora = function() {
      if (typeof destroyChart === 'function') destroyChart('transhora');
      var ctx = document.getElementById('cTransHora');
      if (!ctx) return;
      var colors = ['#00c8ff', '#ff7b3a', '#00e09e', '#a259ff', '#FFE600'];
      var datasets = topTrans.slice(0, 3).map(function(t, i) {
        var data = horaLabels.map(function(h) { return t.byHour[h] || 0; });
        return { label: t.name.length > 12 ? t.name.substring(0, 12) + '…' : t.name, data: data, backgroundColor: colors[i] + '30', borderColor: colors[i], borderWidth: 1.5, borderRadius: 3 };
      });
      var ci = window.chartInstances || window.charts || {};
      ci['transhora'] = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: horaLabels, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8298b8', font: { family: 'IBM Plex Sans', size: 10 } }, position: 'bottom' } }, scales: { x: { stacked: true, ticks: { color: '#5a7099', font: { family: 'IBM Plex Mono', size: 9 } }, grid: { color: 'rgba(30,43,66,.4)' } }, y: { stacked: true, ticks: { color: '#5a7099', font: { family: 'IBM Plex Mono', size: 9 } }, grid: { color: 'rgba(30,43,66,.4)' } } } }
      });
      if (window.chartInstances) window.chartInstances['transhora'] = ci['transhora'];
      if (window.charts) window.charts['transhora'] = ci['transhora'];
    };
  }

  // ── 9. FILTERS ─────────────────────────────────────────────
  function reloadFilters() {
    var fh = document.getElementById('f-hub');
    var ft = document.getElementById('f-trans');
    var fs = document.getElementById('f-seller');
    [fh, ft, fs].forEach(function(el) { if (el) while (el.options.length > 1) el.remove(1); });
    var hS = {}, tS = {}, sS = {}, hubs = [], trans = [], sellers = [];
    (window.RAW || []).forEach(function(d) {
      if (d.hub && !hS[d.hub]) { hubs.push(d.hub); hS[d.hub] = 1; }
      if (d.trans && !tS[d.trans]) { trans.push(d.trans); tS[d.trans] = 1; }
      if (d.seller && !sS[d.seller]) { sellers.push(d.seller); sS[d.seller] = 1; }
    });
    hubs.sort(); trans.sort(); sellers.sort();
    hubs.forEach(function(h) { if (fh) fh.add(new Option('📍 ' + h, h)); });
    trans.forEach(function(t) { if (ft) ft.add(new Option('🚚 ' + (t.length > 24 ? t.substring(0, 24) + '…' : t), t)); });
    sellers.forEach(function(s) { if (fs) fs.add(new Option('👤 ' + (s.length > 22 ? s.substring(0, 22) + '…' : s), s)); });
  }

  // ── 10. CLEAR ──────────────────────────────────────────────
  function clearCSVData() {
    if (!confirm('Limpar dados do CSV e voltar aos dados padrão?')) return;
    localStorage.removeItem('bpp_csv_data');
    try { window.RAW = RAW_DATA_HOJE; } catch(e) { try { window.RAW = FALLBACK_DATA; } catch(e2) { window.RAW = []; } }
    try { window.EFIC_HOJE = EFIC_HOJE_FIXO; } catch(e) {}
    window.data = (window.RAW || []).slice();
    updateUploadUI(false);
    var st = document.getElementById('load-status');
    if (st) { st.textContent = '⚠ dados padrão'; st.style.color = '#FFE600'; }
    reloadFilters();
    if (typeof renderAll === 'function') renderAll();
    if (typeof buildDestaqueCards === 'function') buildDestaqueCards();
    showToast('warning', '↺ Restaurado', 'Usando dados padrão');
  }

  // ── 11. LOAD FROM CACHE ────────────────────────────────────
  function loadFromLocalStorage() {
    try {
      var s = localStorage.getItem('bpp_csv_data');
      if (!s) return false;
      var obj = JSON.parse(s);
      if (!obj.raw || obj.raw.length === 0) { localStorage.removeItem('bpp_csv_data'); return false; }
      var age = Math.round((Date.now() - new Date(obj.timestamp).getTime()) / 3600000);
      applyCSVData(obj);
      if (age > 12) showToast('warning', '⚠ Dados de ' + age + 'h atrás', 'Carregue um CSV atualizado', 6000);
      return true;
    } catch(e) { localStorage.removeItem('bpp_csv_data'); return false; }
  }

  // ── 12. INTERCEPT LOAD ─────────────────────────────────────
  var _orig = window.loadData;
  window.loadData = function() {
    if (loadFromLocalStorage()) { console.log('[CSV Upload] Cache carregado'); return; }
    if (typeof _orig === 'function') return _orig.call(window);
  };
})();
