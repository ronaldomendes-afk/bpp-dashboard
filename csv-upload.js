// ══════════════════════════════════════════════════════════════
// BPP Dashboard — Módulo de Upload CSV
// Adicione ao seu index.html: <script src="csv-upload.js"></script>
// Coloque ANTES do </body> (último script)
// ══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── 1. INJETAR CSS ──────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .csv-upload-wrap { display:flex; align-items:center; gap:6px; }
    .csv-upload-btn {
      display:flex; align-items:center; gap:6px; padding:5px 12px;
      background:#1a1a2e; border:1px solid rgba(26,26,46,.3); color:#FFE600;
      border-radius:7px; font-family:'IBM Plex Sans',sans-serif; font-size:11px;
      font-weight:700; cursor:pointer; transition:all .25s; position:relative;
    }
    .csv-upload-btn:hover { background:#333; box-shadow:0 0 14px rgba(255,230,0,.18); }
    .csv-upload-btn.has-data { background:#003020; border-color:rgba(0,224,158,.4); color:#00e09e; }
    .csv-upload-btn.has-data:hover { background:#004030; }
    .csv-clear-btn {
      display:none; align-items:center; justify-content:center;
      width:24px; height:24px; border-radius:6px;
      background:rgba(255,58,92,.1); border:1px solid rgba(255,58,92,.3);
      color:#ff3a5c; font-size:11px; font-weight:700; cursor:pointer; transition:all .15s;
      font-family:'IBM Plex Sans',sans-serif;
    }
    .csv-clear-btn:hover { background:rgba(255,58,92,.25); }
    .csv-clear-btn.visible { display:flex; }
    .csv-data-badge {
      display:none; font-size:9px; padding:2px 7px; border-radius:20px;
      background:rgba(0,224,158,.12); color:#00e09e; border:1px solid rgba(0,224,158,.25);
      font-family:'IBM Plex Mono',monospace; font-weight:600; white-space:nowrap;
    }
    .csv-data-badge.visible { display:inline-flex; }
    .csv-toast {
      position:fixed; top:60px; right:24px; z-index:9999;
      padding:14px 20px; border-radius:10px;
      font-family:'IBM Plex Sans',sans-serif; font-size:12px; font-weight:600;
      transform:translateX(120%); opacity:0;
      transition: transform .4s cubic-bezier(.22,1,.36,1), opacity .35s;
      pointer-events:none; max-width:380px;
      box-shadow:0 8px 32px rgba(0,0,0,.5);
    }
    .csv-toast.show { transform:translateX(0); opacity:1; }
    .csv-toast.success { background:linear-gradient(135deg,#003020,#001a10); border:1px solid rgba(0,224,158,.5); color:#00e09e; }
    .csv-toast.error { background:linear-gradient(135deg,#2d0010,#1a0008); border:1px solid rgba(255,58,92,.5); color:#ff3a5c; }
    .csv-toast.warning { background:linear-gradient(135deg,#2d1f00,#1a1200); border:1px solid rgba(255,230,0,.5); color:#FFE600; }
    .csv-toast .toast-title { font-weight:700; margin-bottom:3px; font-size:13px; }
    .csv-toast .toast-detail { font-size:10px; opacity:.7; }
  `;
  document.head.appendChild(style);

  // ── 2. CRIAR ELEMENTOS DOM ──────────────────────────────────
  // Toast
  const toast = document.createElement('div');
  toast.className = 'csv-toast';
  toast.id = 'csv-toast';
  toast.innerHTML = '<div class="toast-title" id="csv-toast-title"></div><div class="toast-detail" id="csv-toast-detail"></div>';
  document.body.appendChild(toast);

  // Upload wrap (inserido na topbar, antes do botão PDF)
  const topbarRight = document.querySelector('.topbar-right');
  if (topbarRight) {
    const exportBtn = topbarRight.querySelector('button[onclick*="exportarPDF"]');
    const wrap = document.createElement('div');
    wrap.className = 'csv-upload-wrap';
    wrap.innerHTML = `
      <input type="file" id="csv-file-input" accept=".csv,.txt,.tsv" style="display:none">
      <button class="csv-upload-btn" id="csv-upload-btn" title="Carregar CSV da planilha">
        <span style="font-size:14px;line-height:1;">📂</span> Carregar CSV
      </button>
      <button class="csv-clear-btn" id="csv-clear-btn" title="Limpar dados e voltar ao padrão">✕</button>
      <span class="csv-data-badge" id="csv-data-badge"></span>
    `;
    if (exportBtn) {
      topbarRight.insertBefore(wrap, exportBtn);
    } else {
      topbarRight.prepend(wrap);
    }

    // Event listeners
    document.getElementById('csv-upload-btn').addEventListener('click', function() {
      document.getElementById('csv-file-input').click();
    });
    document.getElementById('csv-file-input').addEventListener('change', handleCSVUpload);
    document.getElementById('csv-clear-btn').addEventListener('click', clearCSVData);
  }

  // ── 3. FUNÇÕES DE TOAST ─────────────────────────────────────
  function showToast(type, title, detail, duration) {
    duration = duration || 4000;
    const el = document.getElementById('csv-toast');
    el.className = 'csv-toast ' + type;
    document.getElementById('csv-toast-title').textContent = title;
    document.getElementById('csv-toast-detail').textContent = detail || '';
    setTimeout(function() { el.classList.add('show'); }, 30);
    setTimeout(function() { el.classList.remove('show'); }, duration);
  }

  function updateUploadUI(hasData, info) {
    var btn = document.getElementById('csv-upload-btn');
    var clearBtn = document.getElementById('csv-clear-btn');
    var badge = document.getElementById('csv-data-badge');
    if (!btn) return;
    if (hasData) {
      btn.classList.add('has-data');
      btn.innerHTML = '<span style="font-size:14px;line-height:1;">✅</span> Atualizar CSV';
      if (clearBtn) clearBtn.classList.add('visible');
      if (badge && info) { badge.textContent = info; badge.classList.add('visible'); }
    } else {
      btn.classList.remove('has-data');
      btn.innerHTML = '<span style="font-size:14px;line-height:1;">📂</span> Carregar CSV';
      if (clearBtn) clearBtn.classList.remove('visible');
      if (badge) badge.classList.remove('visible');
    }
  }

  // ── 4. PARSER CSV INTELIGENTE ───────────────────────────────
  function parseCSVLine(line, delim) {
    if (!line || !line.trim()) return null;
    var result = [], current = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === delim && !inQ) { result.push(current); current = ''; }
      else { current += c; }
    }
    result.push(current);
    return result;
  }

  function smartParseCSV(text) {
    var firstLine = text.split(/\r?\n/)[0];
    var delim = ',';
    if (firstLine.split('\t').length > firstLine.split(',').length) delim = '\t';
    else if (firstLine.split(';').length > firstLine.split(',').length) delim = ';';

    var lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { error: 'CSV vazio ou com apenas 1 linha' };

    var headers = lines[0].split(delim).map(function(h) {
      return h.trim().replace(/^"|"$/g, '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    });
    var headersOriginal = lines[0].split(delim).map(function(h) {
      return h.trim().replace(/^"|"$/g, '').toUpperCase();
    });

    // Detect format
    var h = headers.join('|');
    var format = null;

    if (h.includes('SELLER') && (h.includes('VOL') || h.includes('STATUS'))) {
      format = 'criticidade_bpp';
    } else if (h.includes('PARADA') || h.includes('PACOTES ESTIMADOS') || h.includes('PACOTES COLETADOS')) {
      format = 'base_xd';
    } else if (h.includes('VENDEDOR') || h.includes('DEPOSITO') || h.includes('TRANSPORTADORA')) {
      format = 'generic';
    }

    if (!format) {
      return { error: 'Colunas não reconhecidas: ' + headersOriginal.slice(0, 6).join(', ') + '...\nEsperado: SELLER, HUB, TRANSPORTADORA, etc.' };
    }

    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = parseCSVLine(lines[i], delim);
      if (!cols || cols.length < 3) continue;
      var row = {};
      headersOriginal.forEach(function(hdr, j) { row[hdr] = (cols[j] || '').trim(); });
      // Also add normalized versions
      headers.forEach(function(hdr, j) { if (!row[hdr]) row[hdr] = (cols[j] || '').trim(); });
      rows.push(row);
    }

    return { format: format, headers: headersOriginal, rows: rows };
  }

  // ── 5. TRANSFORMADORES DE DADOS ─────────────────────────────
  function findCol(row, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var keys = Object.keys(row);
      for (var j = 0; j < keys.length; j++) {
        if (keys[j].toUpperCase().includes(candidates[i].toUpperCase())) return row[keys[j]];
      }
    }
    return '';
  }

  function transformCriticidadeBPP(rows) {
    var result = [];
    rows.forEach(function(r) {
      var seller = findCol(r, ['SELLER', 'VENDEDOR']);
      if (!seller) return;
      var vol = parseInt(findCol(r, ['VOL. PENDENTE', 'VOL PENDENTE', 'VOLUME', 'VOL'])) || 0;
      var statusStr = findCol(r, ['STATUS BPP', 'STATUS']);
      var days = parseInt(statusStr) || 0;
      result.push({
        seller: seller,
        hub: findCol(r, ['HUB', 'DEPÓSITO', 'DEPOSITO']),
        trans: findCol(r, ['TRANSPORTADORA']),
        rota: findCol(r, ['ROTA']),
        vol: vol, days: days,
        status: statusStr || 'Pendente',
        motivo: findCol(r, ['MOTIVO']),
        driver: findCol(r, ['DRIVER', 'MOTORISTA']),
        veiculo: findCol(r, ['VEÍCULO', 'VEICULO', 'TIPO DE VEÍCULO', 'TIPO DE VEICULO'])
      });
    });
    return { data: result };
  }

  function transformBaseXD(rows) {
    var result = [];
    var totalEst = 0, totalCol = 0;
    var veiculoCount = {};

    rows.forEach(function(r) {
      var seller = findCol(r, ['PARADA', 'SELLER', 'VENDEDOR']);
      if (!seller) return;
      var tipoParada = findCol(r, ['TIPO DE PARADA']);
      // Filtra só vendedores se a coluna existir
      if (tipoParada && tipoParada.toLowerCase() !== 'vendedor') return;

      var est = parseInt(findCol(r, ['PACOTES ESTIMADOS'])) || 0;
      var col = parseInt(findCol(r, ['PACOTES COLETADOS'])) || 0;
      var veiculo = findCol(r, ['TIPO DE VEÍCULO', 'TIPO DE VEICULO', 'VEÍCULO', 'VEICULO']);

      totalEst += est;
      totalCol += col;
      if (veiculo) veiculoCount[veiculo] = (veiculoCount[veiculo] || 0) + 1;

      if (col < est) {
        var pendente = est - col;
        result.push({
          seller: seller,
          hub: findCol(r, ['DEPÓSITO', 'DEPOSITO', 'HUB']),
          trans: findCol(r, ['TRANSPORTADORA']),
          rota: findCol(r, ['ROTA']),
          vol: pendente, days: 1, status: 'Pendente',
          motivo: findCol(r, ['MOTIVO', 'MOTIVO SELLER']),
          driver: findCol(r, ['DRIVER', 'MOTORISTA']),
          veiculo: veiculo,
          estimado: est, coletado: col
        });
      }
    });

    var efic = totalEst > 0 ? Math.round((totalCol / totalEst) * 1000) / 10 : 0;
    return {
      data: result,
      eficiencia: { est: totalEst, col: totalCol, efic: efic },
      veiculos: veiculoCount
    };
  }

  // ── 6. HANDLER DE UPLOAD ────────────────────────────────────
  function handleCSVUpload(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var text = e.target.result;
        var parsed = smartParseCSV(text);

        if (parsed.error) {
          showToast('error', '❌ Erro no CSV', parsed.error, 6000);
          return;
        }

        var transformed;
        if (parsed.format === 'base_xd') {
          transformed = transformBaseXD(parsed.rows);
        } else {
          transformed = transformCriticidadeBPP(parsed.rows);
        }

        if (!transformed.data || transformed.data.length === 0) {
          showToast('error', '❌ Sem dados válidos', 'Nenhum seller com volume pendente encontrado.', 5000);
          return;
        }

        // Salvar no localStorage
        var saveObj = {
          data: transformed.data,
          eficiencia: transformed.eficiencia || null,
          veiculos: transformed.veiculos || null,
          timestamp: new Date().toISOString(),
          filename: file.name,
          format: parsed.format,
          totalRows: parsed.rows.length
        };
        localStorage.setItem('bpp_csv_data', JSON.stringify(saveObj));

        // Aplicar
        applyCSVData(saveObj);

        var totalVol = transformed.data.reduce(function(s, x) { return s + x.vol; }, 0);
        showToast('success',
          '✅ CSV carregado com sucesso!',
          transformed.data.length + ' sellers · ' + totalVol.toLocaleString('pt-BR') + ' vol · ' + file.name,
          5000
        );

      } catch (err) {
        console.error('Erro CSV:', err);
        showToast('error', '❌ Erro ao processar', err.message, 5000);
      }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  }

  // ── 7. APLICAR DADOS NO DASHBOARD ──────────────────────────
  function applyCSVData(saveObj) {
    // Atualizar dados globais
    window.RAW = saveObj.data;
    window.data = saveObj.data.slice();

    // Atualizar eficiência se disponível
    if (saveObj.eficiencia && window.EFIC_HOJE !== undefined) {
      window.EFIC_HOJE = saveObj.eficiencia;
    }

    // Atualizar veículos se disponível
    if (saveObj.veiculos && window.VEHICLE) {
      var vGroups = {
        'VUC': ['Vuc','Vuc Rental TKS','Rental VUC FM','VUC Dedicado','VUC Elétrico','Melione VUC Dedicado'],
        'Caminhão Médio': ['Médio','Rental Medio FM','MEDIO FM DD'],
        'Van': ['Van','Van Frota Fixa','Rental Utilitário','Large Van'],
        'Toco': ['Toco'],
        'HR / Utilitário': ['HR','Utilitários'],
        'Truck': ['Truck'],
        'Carreta': ['Carreta']
      };
      var grouped = {};
      Object.keys(saveObj.veiculos).forEach(function(v) {
        var count = saveObj.veiculos[v];
        var found = false;
        Object.keys(vGroups).forEach(function(grupo) {
          if (found) return;
          vGroups[grupo].forEach(function(item) {
            if (found) return;
            if (v.includes(item) || item.includes(v)) {
              grouped[grupo] = (grouped[grupo] || 0) + count;
              found = true;
            }
          });
        });
        if (!found) grouped[v] = (grouped[v] || 0) + count;
      });
      var sorted = Object.entries(grouped).sort(function(a, b) { return b[1] - a[1]; });
      window.VEHICLE.labels = sorted.map(function(x) { return x[0]; });
      window.VEHICLE.vals = sorted.map(function(x) { return x[1]; });
    }

    // Atualizar banner de alerta
    var topCrit = saveObj.data.slice().sort(function(a, b) {
      return b.days - a.days || b.vol - a.vol;
    })[0];
    if (topCrit) {
      var alertText = document.querySelector('.alert-text');
      if (alertText) {
        var label = topCrit.days >= 2
          ? '<span class="highlight">' + topCrit.days + ' dias sem coleta</span>'
          : '<span class="highlight">maior volume: ' + topCrit.vol.toLocaleString('pt-BR') + '</span>';
        alertText.innerHTML = '<strong>ALERTA:</strong> Principal ofensor: ' + label +
          ' — ' + topCrit.seller + ' · ' + topCrit.vol.toLocaleString('pt-BR') + ' vol · HUB ' + topCrit.hub + ' · ' + topCrit.trans;
      }
    }

    // Atualizar status na topbar
    var statusEl = document.getElementById('load-status');
    var ts = new Date(saveObj.timestamp);
    if (statusEl) {
      statusEl.textContent = '✓ CSV ' + ts.toLocaleTimeString('pt-BR');
      statusEl.style.color = '#00e09e';
    }

    // Atualizar botão
    var timeStr = ts.toLocaleDateString('pt-BR') + ' ' + ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    updateUploadUI(true, timeStr + ' · ' + saveObj.totalRows + ' linhas');

    // Recarregar filtros do zero
    reloadFilters();

    // Override do buildSellersVolList para mostrar Estimado vs Coletado real
    // Re-renderizar tudo
    if (typeof renderAll === 'function') renderAll();
    if (typeof buildDestaqueCards === 'function') buildDestaqueCards();
  }

  function reloadFilters() {
    var fh = document.getElementById('f-hub');
    var ft = document.getElementById('f-trans');
    var fs = document.getElementById('f-seller');
    [fh, ft, fs].forEach(function(el) {
      if (!el) return;
      while (el.options.length > 1) el.remove(1);
    });

    var hubs = []; var trans = []; var sellers = [];
    var hubSet = {}, transSet = {}, sellerSet = {};
    window.RAW = window.RAW || [];
    window.RAW.forEach(function(d) {
      if (d.hub && !hubSet[d.hub]) { hubs.push(d.hub); hubSet[d.hub] = 1; }
      if (d.trans && !transSet[d.trans]) { trans.push(d.trans); transSet[d.trans] = 1; }
      if (d.seller && !sellerSet[d.seller]) { sellers.push(d.seller); sellerSet[d.seller] = 1; }
    });
    hubs.sort(); trans.sort(); sellers.sort();

    hubs.forEach(function(h) { if (fh) fh.add(new Option('📍 ' + h, h)); });
    trans.forEach(function(t) { if (ft) ft.add(new Option('🚚 ' + (t.length > 24 ? t.substring(0, 24) + '…' : t), t)); });
    sellers.forEach(function(s) { if (fs) fs.add(new Option('👤 ' + (s.length > 22 ? s.substring(0, 22) + '…' : s), s)); });
  }

  // ── 8. LIMPAR DADOS CSV ─────────────────────────────────────
  function clearCSVData() {
    if (!confirm('Limpar dados do CSV e voltar aos dados padrão do dashboard?')) return;
    localStorage.removeItem('bpp_csv_data');

    // Restaurar dados originais (const não fica em window, acessa direto)
    try { window.RAW = RAW_DATA_HOJE; } catch(e) { try { window.RAW = FALLBACK_DATA; } catch(e2) { window.RAW = []; } }
    try { window.EFIC_HOJE = EFIC_HOJE_FIXO; } catch(e) {}
    window.data = (window.RAW || []).slice();

    updateUploadUI(false);

    var statusEl = document.getElementById('load-status');
    if (statusEl) {
      statusEl.textContent = '⚠ dados padrão';
      statusEl.style.color = '#FFE600';
    }

    reloadFilters();
    if (typeof renderAll === 'function') renderAll();
    if (typeof buildDestaqueCards === 'function') buildDestaqueCards();
    showToast('warning', '↺ Dados restaurados', 'Usando snapshot padrão do dashboard');
  }

  // ── 9. CARREGAR DO LOCALSTORAGE ─────────────────────────────
  function loadFromLocalStorage() {
    try {
      var saved = localStorage.getItem('bpp_csv_data');
      if (!saved) return false;
      var saveObj = JSON.parse(saved);

      if (!saveObj.data || saveObj.data.length === 0) {
        localStorage.removeItem('bpp_csv_data');
        return false;
      }

      var age = Date.now() - new Date(saveObj.timestamp).getTime();
      var hoursOld = Math.round(age / 3600000);

      applyCSVData(saveObj);

      if (hoursOld > 12) {
        showToast('warning', '⚠ Dados de ' + hoursOld + 'h atrás', 'Considere carregar um CSV atualizado', 6000);
      }
      return true;
    } catch (e) {
      console.warn('Erro localStorage:', e);
      localStorage.removeItem('bpp_csv_data');
      return false;
    }
  }

  // ── 10. INTERCEPTAR O CARREGAMENTO INICIAL ──────────────────
  // Sobrescreve loadData para verificar localStorage primeiro
  var _origLoadData = window.loadData;
  window.loadData = function() {
    if (loadFromLocalStorage()) {
      console.log('[CSV Upload] Dados carregados do cache local');
      return;
    }
    // Nenhum CSV salvo — usa o fluxo original
    if (typeof _origLoadData === 'function') {
      return _origLoadData.call(window);
    }
  };

})();
