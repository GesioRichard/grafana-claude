// Gerador do dashboard "Monitoramento de Câmeras" — TV ATALAIA
// Node puro, sem dependências externas. Lê o backup bruto (baixado via
// GET /api/dashboards/uid/<uid>) e produz o payload completo pra
// POST /api/dashboards/db. Ver dashboards/monitoramento-de-cameras.md
// para o histórico de versões e decisões de layout.

const fs = require('fs');
const path = require('path');

const BACKUP_PATH = process.argv[2];
if (!BACKUP_PATH) {
  console.error('Uso: node generate_dashboard.js <caminho-do-backup.json> [saida.json]');
  process.exit(1);
}
const OUT_PATH = process.argv[3] || path.join(__dirname, 'dashboard_v2_payload.json');

const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
const dashboard = backup.dashboard;

const ZABBIX_DS = { type: 'alexanderzobnin-zabbix-datasource', uid: 'fdfjaoiye7im8a' };
const MYSQL_DS = { type: 'mysql', uid: 'de834v5wv8flsd' };

// --- teto de grid desta TV: 24 colunas x 29 linhas (mesmo teto do Fronius,
// confirmado batendo com a área hoje visível sem scroll deste dashboard
// antes desta mudança — ver dashboards/monitoramento-de-cameras.md) ---
const GRID_COLS = 24;
const GRID_ROWS = 29;

const NVRS = [
  { n: 1, host: 'NVR 01', x: 0, w: 5 },
  { n: 2, host: 'NVR 02', x: 5, w: 5 },
  { n: 3, host: 'NVR 03', x: 10, w: 5 },
  { n: 4, host: 'NVR 04', x: 15, w: 5 },
  { n: 5, host: 'NVR 05', x: 20, w: 4 },
];

// --- linhas (faixas verticais) ---
const Y_HEADER = 0, H_HEADER = 2;
const Y_CARDS = Y_HEADER + H_HEADER, H_CARDS = 2;
const Y_BARGAUGE = Y_CARDS + H_CARDS, H_BARGAUGE = 2;
const Y_TABLE = Y_BARGAUGE + H_BARGAUGE, H_TABLE = 17;
const Y_GRAPH = Y_TABLE + H_TABLE, H_GRAPH = 6;
const TOTAL_H = H_HEADER + H_CARDS + H_BARGAUGE + H_TABLE + H_GRAPH;

let nextId = 1;
const id = () => nextId++;

function headerPanel(nvr) {
  return {
    id: id(),
    type: 'stat',
    datasource: ZABBIX_DS,
    gridPos: { x: nvr.x, y: Y_HEADER, w: nvr.w, h: H_HEADER },
    fieldConfig: {
      defaults: {
        color: { mode: 'shades', fixedColor: '#00054e' },
        fieldMinMax: false,
        mappings: [],
        noValue: nvr.host,
        thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] },
      },
      overrides: [],
    },
    options: {
      colorMode: 'background',
      graphMode: 'area',
      justifyMode: 'center',
      orientation: 'vertical',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
      showPercentChange: false,
      textMode: 'auto',
      wideLayout: true,
    },
    pluginVersion: '10.4.0',
    targets: [{
      refId: 'A',
      datasource: ZABBIX_DS,
      queryType: '0', schema: 12, evaltype: '0', resultFormat: 'time_series',
      application: { filter: '' }, group: { filter: '' }, host: { filter: '' },
      item: { filter: '' }, itemTag: { filter: '' }, macro: { filter: '' },
      proxy: { filter: '' }, tags: { filter: '' }, trigger: { filter: '' },
      textFilter: '', countTriggersBy: '', functions: [],
      options: { count: false, disableDataAlignment: false, showDisabledItems: false, skipEmptyValues: false, useTrends: 'default', useZabbixValueMapping: false },
      table: { skipEmptyValues: false },
    }],
  };
}

function onlineOfflinePanel(nvr, w) {
  const sqlFor = (statusLiteral, alias) => `SELECT \r\n  CONVERT_TZ(FROM_UNIXTIME(h.clock), '+00:00', '+03:00') AS Timestamp,\r\n  SUM(CASE WHEN h.value = '${statusLiteral}' THEN 1 ELSE 0 END) AS "${alias}"\r\nFROM history_str h\r\nJOIN (\r\n    SELECT itemid, MAX(clock) AS max_clock\r\n    FROM history_str\r\n    GROUP BY itemid\r\n) ult ON h.itemid = ult.itemid AND h.clock = ult.max_clock\r\nJOIN items i ON h.itemid = i.itemid\r\nJOIN hosts ht ON i.hostid = ht.hostid\r\nJOIN hosts_groups hg ON hg.hostid = ht.hostid\r\nJOIN hstgrp gp ON gp.groupid = hg.groupid\r\nWHERE gp.name = 'NVR' \r\n  AND ht.name = '${nvr.host}'\r\n  AND i.key_ LIKE 'remoteCam[status%'\r\n;\r\n`;
  return {
    id: id(),
    type: 'stat',
    datasource: MYSQL_DS,
    gridPos: { x: nvr.x, y: Y_CARDS, w, h: H_CARDS },
    fieldConfig: {
      defaults: {
        color: { mode: 'thresholds' },
        mappings: [],
        thresholds: { mode: 'absolute', steps: [{ color: 'semi-dark-green', value: null }, { color: 'red', value: 80 }] },
      },
      overrides: [
        { matcher: { id: 'byName', options: 'Cameras Online' }, properties: [{ id: 'displayName', value: 'ONLINE' }] },
        { matcher: { id: 'byName', options: 'Cameras Offline' }, properties: [{ id: 'displayName', value: 'OFFLINE' }, { id: 'color', value: { fixedColor: 'semi-dark-red', mode: 'fixed' } }] },
      ],
    },
    options: {
      colorMode: 'background', graphMode: 'none', justifyMode: 'center', orientation: 'auto',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
      showPercentChange: false, textMode: 'auto', wideLayout: true,
    },
    pluginVersion: '10.4.0',
    targets: [
      { refId: 'A', datasource: MYSQL_DS, dataset: 'performance_schema', editorMode: 'code', format: 'table', rawQuery: true, rawSql: sqlFor('Connected', 'Cameras Online'), sql: { columns: [{ parameters: [], type: 'function' }], groupBy: [{ property: { type: 'string' }, type: 'groupBy' }], limit: 50 } },
      { refId: 'B', datasource: MYSQL_DS, dataset: 'performance_schema', editorMode: 'code', format: 'table', rawQuery: true, hide: false, rawSql: sqlFor('Unconnect', 'Cameras Offline'), sql: { columns: [{ parameters: [], type: 'function' }], groupBy: [{ property: { type: 'string' }, type: 'groupBy' }], limit: 50 } },
    ],
  };
}

function downloadUploadPanel(nvr, x, w) {
  return {
    id: id(),
    type: 'stat',
    datasource: ZABBIX_DS,
    gridPos: { x, y: Y_CARDS, w, h: H_CARDS },
    fieldConfig: {
      defaults: {
        color: { mode: 'thresholds' },
        mappings: [],
        thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'red', value: 80 }] },
      },
      overrides: [
        { matcher: { id: 'byName', options: 'Interface eth0: Bits received' }, properties: [{ id: 'displayName', value: 'DOWNLOAD' }, { id: 'color', value: { fixedColor: '#1eff00', mode: 'fixed' } }] },
        { matcher: { id: 'byName', options: 'Interface eth0: Bits sent' }, properties: [{ id: 'displayName', value: 'UPLOAD' }, { id: 'color', value: { fixedColor: '#8f3bb8', mode: 'fixed' } }] },
      ],
    },
    options: {
      colorMode: 'value', graphMode: 'area', justifyMode: 'center', orientation: 'auto',
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
      showPercentChange: false, textMode: 'auto', wideLayout: true,
    },
    pluginVersion: '10.4.0',
    targets: [
      { refId: 'A', datasource: ZABBIX_DS, queryType: '0', schema: 12, evaltype: '0', resultFormat: 'time_series', group: { filter: 'NVR' }, host: { filter: nvr.host }, item: { filter: 'Interface eth0: Bits received' }, application: { filter: '' }, itemTag: { filter: '' }, macro: { filter: '' }, proxy: { filter: '' }, tags: { filter: '' }, trigger: { filter: '' }, textFilter: '', countTriggersBy: '', functions: [], options: { count: false, disableDataAlignment: false, showDisabledItems: false, skipEmptyValues: false, useTrends: 'default', useZabbixValueMapping: false }, table: { skipEmptyValues: false } },
      { refId: 'B', datasource: ZABBIX_DS, queryType: '0', schema: 12, evaltype: '0', resultFormat: 'time_series', hide: false, group: { filter: 'NVR' }, host: { filter: nvr.host }, item: { filter: 'Interface eth0: Bits sent' }, application: { filter: '' }, itemTag: { filter: '' }, macro: { filter: '' }, proxy: { filter: '' }, tags: { filter: '' }, trigger: { filter: '' }, textFilter: '', countTriggersBy: '', functions: [], options: { count: false, disableDataAlignment: false, showDisabledItems: false, skipEmptyValues: false, useTrends: 'default', useZabbixValueMapping: false }, table: { skipEmptyValues: false } },
    ],
  };
}

function bargaugePanel(nvr) {
  return {
    id: id(),
    type: 'bargauge',
    title: 'CPU / Memória',
    datasource: ZABBIX_DS,
    gridPos: { x: nvr.x, y: Y_BARGAUGE, w: nvr.w, h: H_BARGAUGE },
    fieldConfig: {
      defaults: {
        color: { mode: 'thresholds' },
        unit: 'percent', min: 0, max: 100,
        mappings: [],
        thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'yellow', value: 80 }, { color: 'red', value: 90 }] },
      },
      overrides: [
        { matcher: { id: 'byName', options: 'CPU Usage' }, properties: [{ id: 'displayName', value: 'CPU' }] },
        { matcher: { id: 'byName', options: 'Memory Utilization' }, properties: [{ id: 'displayName', value: 'Memória' }] },
      ],
    },
    options: {
      displayMode: 'gradient',
      orientation: 'horizontal',
      showUnfilled: true,
      valueMode: 'color',
      minVizHeight: 10, minVizWidth: 0,
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
    },
    pluginVersion: '10.4.0',
    targets: [
      { refId: 'A', datasource: ZABBIX_DS, queryType: '0', schema: 12, evaltype: '0', resultFormat: 'time_series', group: { filter: 'NVR' }, host: { filter: nvr.host }, item: { filter: 'CPU Usage' }, application: { filter: '' }, itemTag: { filter: '' }, macro: { filter: '' }, proxy: { filter: '' }, tags: { filter: '' }, trigger: { filter: '' }, textFilter: '', countTriggersBy: '', functions: [], options: { count: false, disableDataAlignment: false, showDisabledItems: false, skipEmptyValues: false, useTrends: 'default', useZabbixValueMapping: false }, table: { skipEmptyValues: false } },
      { refId: 'B', datasource: ZABBIX_DS, queryType: '0', schema: 12, evaltype: '0', resultFormat: 'time_series', hide: false, group: { filter: 'NVR' }, host: { filter: nvr.host }, item: { filter: 'Memory Utilization' }, application: { filter: '' }, itemTag: { filter: '' }, macro: { filter: '' }, proxy: { filter: '' }, tags: { filter: '' }, trigger: { filter: '' }, textFilter: '', countTriggersBy: '', functions: [], options: { count: false, disableDataAlignment: false, showDisabledItems: false, skipEmptyValues: false, useTrends: 'default', useZabbixValueMapping: false }, table: { skipEmptyValues: false } },
    ],
  };
}

function tablePanel(nvr) {
  const rawSql = `SELECT\r\n  cam_names.value AS "Câmera",\r\n  cam_status.value AS "Status"\r\nFROM hosts ht\r\nJOIN hosts_groups hg ON hg.hostid = ht.hostid\r\nJOIN hstgrp gp ON gp.groupid = hg.groupid\r\n\r\n-- Nomes das câmeras (último valor válido)\r\nLEFT JOIN (\r\n  SELECT \r\n    i.hostid,\r\n    REGEXP_SUBSTR(i.key_, '[0-9]+(?=\\]$)') AS cam_index,\r\n    h.value\r\n  FROM items i\r\n  JOIN history_str h \r\n    ON h.itemid = i.itemid\r\n  JOIN (\r\n    SELECT itemid, MAX(clock) AS max_clock\r\n    FROM history_str\r\n    GROUP BY itemid\r\n  ) ult ON ult.itemid = h.itemid AND ult.max_clock = h.clock\r\n  WHERE i.key_ LIKE 'remoteCam[name%'\r\n) AS cam_names ON cam_names.hostid = ht.hostid\r\n\r\n-- Status das câmeras (último valor válido)\r\nLEFT JOIN (\r\n  SELECT \r\n    i.hostid,\r\n    REGEXP_SUBSTR(i.key_, '[0-9]+(?=\\]$)') AS cam_index,\r\n    h.value\r\n  FROM items i\r\n  JOIN history_str h \r\n    ON h.itemid = i.itemid\r\n  JOIN (\r\n    SELECT itemid, MAX(clock) AS max_clock\r\n    FROM history_str\r\n    GROUP BY itemid\r\n  ) ult ON ult.itemid = h.itemid AND ult.max_clock = h.clock\r\n  WHERE i.key_ LIKE 'remoteCam[status%'\r\n) AS cam_status ON cam_status.hostid = ht.hostid \r\n               AND cam_status.cam_index = cam_names.cam_index\r\n\r\nWHERE ht.name = '${nvr.host}'\r\nORDER BY cam_status.value DESC;\r\n`;
  return {
    id: id(),
    type: 'table',
    datasource: MYSQL_DS,
    gridPos: { x: nvr.x, y: Y_TABLE, w: nvr.w, h: H_TABLE },
    fieldConfig: {
      defaults: {
        color: { mode: 'thresholds' },
        custom: { align: 'auto', cellOptions: { type: 'auto' }, inspect: false },
        mappings: [],
        thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'red', value: 80 }] },
      },
      overrides: [
        {
          matcher: { id: 'byName', options: 'Câmera' },
          properties: [
            { id: 'custom.cellOptions', value: { type: 'color-background' } },
            { id: 'color', value: { fixedColor: '#00054e', mode: 'shades' } },
            { id: 'custom.align', value: 'center' },
            { id: 'custom.width', value: 239 },
          ],
        },
        {
          matcher: { id: 'byName', options: 'Status' },
          properties: [
            { id: 'custom.align', value: 'center' },
            { id: 'custom.cellOptions', value: { type: 'color-background' } },
            {
              id: 'mappings',
              value: [{
                type: 'value',
                options: {
                  Connected: { color: 'semi-dark-green', index: 1, text: 'Online' },
                  Empty: { color: '#808080', index: 2, text: 'Empty' },
                  Unconnect: { color: 'semi-dark-red', index: 0, text: 'Offline' },
                },
              }],
            },
          ],
        },
      ],
    },
    options: { cellHeight: 'sm', footer: { countRows: false, fields: '', reducer: ['sum'], show: false }, showHeader: true, sortBy: [] },
    pluginVersion: '10.4.0',
    targets: [{ refId: 'A', datasource: MYSQL_DS, editorMode: 'code', format: 'table', rawQuery: true, rawSql }],
  };
}

// Gráfico novo: câmeras que caíram e voltaram sozinhas, por NVR.
// Query original fornecida pelo usuário (ver dashboards/monitoramento-de-cameras.md),
// parametrizada por host — validada ao vivo via /api/ds/query para os 5 NVRs
// antes de publicar (NVR01: 2 câmeras flagradas; NVR02: 1; NVR03: 14; NVR04: 10; NVR05: 18).
function fallenCamerasPanel(nvr) {
  const rawSql = `WITH cte_cams AS (\r\n  SELECT\r\n    CONVERT_TZ(FROM_UNIXTIME(cam_status.clock), '+00:00', '+03:00') AS "TimestampStatus",\t\r\n    cam_names.value AS "Câmera",\r\n    (CASE WHEN cam_status.value = 'Connected' THEN 1 ELSE 0 END) AS "Status"\r\n  FROM hosts ht\r\n  JOIN hosts_groups hg ON hg.hostid = ht.hostid\r\n  JOIN hstgrp gp ON gp.groupid = hg.groupid\r\n  LEFT JOIN (\r\n    SELECT \r\n      i.hostid,\r\n      REGEXP_SUBSTR(i.key_, '[0-9]+(?=\\]$)') AS cam_index,\r\n      h.clock AS clock,\r\n      h.value\r\n    FROM items i\r\n    JOIN history_str h ON h.itemid = i.itemid\r\n    WHERE i.key_ LIKE 'remoteCam[name%' AND h.clock > UNIX_TIMESTAMP(NOW() - INTERVAL 3 HOUR)\r\n  ) AS cam_names ON cam_names.hostid = ht.hostid\r\n  LEFT JOIN (\r\n    SELECT \r\n      i.hostid,\r\n      REGEXP_SUBSTR(i.key_, '[0-9]+(?=\\]$)') AS cam_index,\r\n      h.clock AS clock,\r\n      h.value\r\n    FROM items i\r\n    JOIN history_str h ON h.itemid = i.itemid\r\n    WHERE i.key_ LIKE 'remoteCam[status%' AND h.clock > UNIX_TIMESTAMP(NOW() - INTERVAL 3 HOUR)\r\n  ) AS cam_status ON cam_status.hostid = ht.hostid AND cam_status.cam_index = cam_names.cam_index\r\n  WHERE ht.name = '${nvr.host}'\r\n  GROUP BY TimestampStatus, cam_names.value\r\n),\r\ncte_filtrada AS (\r\n  SELECT \r\n    TimestampStatus,\r\n    Câmera,\r\n    Status,\r\n    MIN(Status) OVER(PARTITION BY Câmera) AS menor_status_periodo\r\n  FROM cte_cams\r\n)\r\nSELECT \r\n  TimestampStatus,\r\n  Câmera,\r\n  Status\r\nFROM cte_filtrada\r\nWHERE menor_status_periodo = 0\r\nORDER BY Câmera ASC, TimestampStatus ASC;`;
  return {
    id: id(),
    type: 'state-timeline',
    title: `Quedas — ${nvr.host} (3h)`,
    datasource: MYSQL_DS,
    gridPos: { x: nvr.x, y: Y_GRAPH, w: nvr.w, h: H_GRAPH },
    // janela fixa de 3h, independente do seletor global do dashboard (now-6h) —
    // a query já filtra por "NOW() - INTERVAL 3 HOUR" internamente, então o eixo
    // visual precisa bater com essa janela (ver STANDARDS.md, "painel com janela de tempo fixa").
    timeFrom: '3h',
    fieldConfig: {
      defaults: {
        color: { mode: 'thresholds' },
        custom: { lineWidth: 0, fillOpacity: 70 },
        mappings: [{
          type: 'value',
          options: {
            0: { color: 'semi-dark-red', index: 0, text: 'Offline' },
            1: { color: 'semi-dark-green', index: 1, text: 'Online' },
          },
        }],
        thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }] },
      },
      overrides: [],
    },
    options: {
      mergeValues: true,
      showValue: 'never',
      alignValue: 'left',
      rowHeight: 0.9,
      legend: { displayMode: 'list', placement: 'bottom' },
      tooltip: { mode: 'single', sort: 'none' },
    },
    pluginVersion: '10.4.0',
    targets: [{ refId: 'A', datasource: MYSQL_DS, editorMode: 'code', format: 'table', rawQuery: true, rawSql }],
    transformations: [{
      id: 'partitionByValues',
      options: { fields: ['Câmera'], keepFields: false, naming: { asLabels: false } },
    }],
  };
}

const panels = [];
for (const nvr of NVRS) {
  panels.push(headerPanel(nvr));
  const wOnline = 2;
  const wDownload = nvr.w - wOnline;
  panels.push(onlineOfflinePanel(nvr, wOnline));
  panels.push(downloadUploadPanel(nvr, nvr.x + wOnline, wDownload));
  panels.push(bargaugePanel(nvr));
  panels.push(tablePanel(nvr));
  panels.push(fallenCamerasPanel(nvr));
}

// --- checagem do teto de grid antes de montar o payload ---
let maxY = 0;
for (const p of panels) maxY = Math.max(maxY, p.gridPos.y + p.gridPos.h);
console.log(`Bounding box: ${GRID_COLS} colunas x ${maxY} linhas (teto documentado: ${GRID_COLS}x${GRID_ROWS})`);
if (maxY > GRID_ROWS) {
  console.error(`ERRO: altura total (${maxY}) excede o teto de ${GRID_ROWS} linhas.`);
  process.exit(1);
}
console.log(`Linhas por seção -> header:${H_HEADER} cards:${H_CARDS} bargauge:${H_BARGAUGE} tabela:${H_TABLE} grafico:${H_GRAPH} (soma=${TOTAL_H})`);

const newDashboard = Object.assign({}, dashboard, {
  panels,
});

const payload = {
  dashboard: newDashboard,
  folderId: backup.meta.folderId,
  folderUid: backup.meta.folderUid,
  overwrite: true,
  message: 'Reorganiza layout (cabeçalho/cards/CPU-Memória compactados), corrige bug de host na contagem OFFLINE do NVR 05, e adiciona gráficos de State Timeline por NVR com as câmeras que caíram e voltaram sozinhas (últimas 3h).',
};

fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
console.log('Payload salvo em', OUT_PATH);
