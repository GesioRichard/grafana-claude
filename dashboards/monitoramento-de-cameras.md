# Monitoramento de Câmeras — TV ATALAIA

- **UID**: `ag4ox6tas8uf4b`
- **URL**: `http://192.168.0.104:3000/d/ag4ox6tas8uf4b/monitoramento-de-cameras-copy`
- **Pasta**: folderId 37 / folderUid `beo1jpm2pybk0f`
- **Script gerador**: `scripts/monitoramento-de-cameras/generate_dashboard.js`
- **Backup bruto antes da v2**: `scripts/monitoramento-de-cameras/backup_v1.json`

## O que este dashboard mostra

5 colunas, uma por NVR (`NVR 01` a `NVR 05`), cada uma com:

1. Cabeçalho com o nome do NVR.
2. Cards ONLINE/OFFLINE (câmeras conectadas/desconectadas) e DOWNLOAD/UPLOAD
   (tráfego de rede do NVR).
3. CPU e Memória do NVR.
4. Tabela com todas as câmeras daquele NVR e o status atual (Online/Offline/Empty).
5. **(novo na v2)** Gráfico State Timeline com as câmeras que caíram em algum
   momento das últimas 3h (ver seção da query abaixo).

## Datasources

- **Zabbix** (`alexanderzobnin-zabbix-datasource`, uid `fdfjaoiye7im8a`): métricas
  "ao vivo" dos hosts NVR (CPU Usage, Memory Utilization, Interface eth0: Bits
  received/sent). Usado nos cards de topo e no bar gauge de CPU/Memória.
- **MySQL** (`mysql`, uid `de834v5wv8flsd`): consultas diretas nas tabelas internas
  do Zabbix (`hosts`, `items`, `history_str`) pra extrair nome/status de cada
  câmera a partir das chaves de item `remoteCam[name...]` / `remoteCam[status...]`.
  Usado nos cards ONLINE/OFFLINE, na tabela de câmeras e no gráfico de quedas.

⚠️ **Este dashboard não usa o plugin HTML Graphics** (`gapit-htmlgraphics-panel`) —
é inteiramente montado com painéis nativos do Grafana (`stat`, `bargauge`, `table`,
`state-timeline`). Os gotchas de `refId`/HTML Graphics do `STANDARDS.md` **não se
aplicam** aqui.

## Teto de grid desta TV

**24 colunas × 29 linhas** — mesmo teto documentado para o Fronius. Confirmado
porque o conteúdo visível (sem scroll) da v1 deste dashboard já ocupava
exatamente 29 linhas antes de qualquer alteração. **Assumido como a mesma TV
classe 65" 4K a ~3,25m do Fronius — não confirmado explicitamente pelo usuário
para este dashboard específico, validar se a tela física for diferente.**

## Histórico de versões

### v1 (baseline, antes desta sessão)
Dashboard pré-existente no Grafana, nunca documentado neste repositório. Layout:
cabeçalho (2 linhas) + cards online/offline/download/upload (3 linhas) + gauges
radiais de CPU/Memória (4 linhas) + tabelas de câmeras (20 linhas) = 29 linhas
visíveis. Havia ainda **4 painéis de timeseries órfãos** abaixo da área visível
(y=29 a 49, um por NVR 01-04, faltando NVR 05), com a query crua (todas as 32
câmeras, sem filtro) — por isso ilegíveis e deixados fora da tela, nunca usados
de fato. Removidos nesta v2 em favor dos novos painéis State Timeline.

**Bug encontrado na v1** (corrigido na v2): o card OFFLINE do NVR 05 (painel
id 38, query B) tinha `ht.name = 'NVR 04'` em vez de `'NVR 05'` — copy/paste de
quando os painéis foram duplicados. O número de câmeras offline exibido pro
NVR 05 na TV, até esta correção, na verdade vinha do NVR 04.

### v2 — 2026-11-18
**Por quê**: usuário queria reorganizar o layout pra abrir espaço pra um novo
tipo de gráfico (câmeras que caíram e voltaram sozinhas, pra investigação), sem
perder nenhuma informação existente, dentro do teto fixo de 24×29 da TV.

**O que mudou**:
- Cabeçalho, cards online/offline/download/upload e CPU/Memória comprimidos de
  9 linhas pra 6 (2+2+2), abrindo espaço pro novo gráfico.
- **Gauge radial → Bar Gauge horizontal em gradiente** pra CPU/Memória. Native
  Grafana (`type: bargauge`, `displayMode: gradient`, thresholds
  verde/amarelo(80)/vermelho(90)) — ocupa bem menos altura que o gauge radial e
  mantém a mesma lógica visual de "barra de carga" do padrão TV ATALAIA (ver
  `STANDARDS.md`), sem precisar do plugin HTML Graphics.
- Tabelas de câmeras reduzidas de 20 → 17 linhas (redução de ~15% na altura de
  cada linha de câmera) pra abrir espaço pro gráfico novo. Mantido o mapeamento
  de cores Online(verde)/Offline(vermelho)/Empty(cinza) como estava.
- **Novo**: 1 painel **State Timeline** por NVR (5 no total, incluindo um novo
  pra NVR 05 que não existia antes), mostrando apenas as câmeras que ficaram
  offline em algum momento das últimas 3h — não o painel inteiro de 32 câmeras
  (isso é o que torna o gráfico legível: cada câmera "suspeita" vira uma faixa
  horizontal verde/vermelha ao longo do tempo).
- Corrigido o bug do NVR 05 descrito acima (v1).
- `panel.timeFrom: "3h"` nos 5 painéis novos — a query já filtra
  `clock > NOW() - INTERVAL 3 HOUR` internamente (não usa macro de tempo do
  Grafana), então o eixo visual do painel precisa da mesma janela fixa (ver
  técnica em `STANDARDS.md`, "Painel com janela de tempo fixa").

**Query do gráfico de quedas** (fornecida pelo usuário, parametrizada por
`ht.name` no script gerador — testada ao vivo via `POST /api/ds/query` pros 5
NVRs antes de publicar):

```sql
WITH cte_cams AS (
  SELECT
    CONVERT_TZ(FROM_UNIXTIME(cam_status.clock), '+00:00', '+03:00') AS "TimestampStatus",
    cam_names.value AS "Câmera",
    (CASE WHEN cam_status.value = 'Connected' THEN 1 ELSE 0 END) AS "Status"
  FROM hosts ht
  JOIN hosts_groups hg ON hg.hostid = ht.hostid
  JOIN hstgrp gp ON gp.groupid = hg.groupid
  LEFT JOIN (...) AS cam_names ON cam_names.hostid = ht.hostid
  LEFT JOIN (...) AS cam_status ON cam_status.hostid = ht.hostid AND cam_status.cam_index = cam_names.cam_index
  WHERE ht.name = '<NVR 0X>'
  GROUP BY TimestampStatus, cam_names.value
),
cte_filtrada AS (
  SELECT TimestampStatus, Câmera, Status,
    MIN(Status) OVER(PARTITION BY Câmera) AS menor_status_periodo
  FROM cte_cams
)
SELECT TimestampStatus, Câmera, Status
FROM cte_filtrada
WHERE menor_status_periodo = 0
ORDER BY Câmera ASC, TimestampStatus ASC;
```

Resultado real por NVR no momento do teste (3h): NVR01 → 2 câmeras flagradas
(`TV-SUP`, `TV_SUP_ENTRADA`); NVR02 → 1 (`TV_TES01`); NVR03 → 14; NVR04 → 10;
NVR05 → 18.

**⚠️ Observação importante sobre a query (não alterada, reportar ao usuário)**:
o filtro `menor_status_periodo = 0` pega qualquer câmera que ficou offline **em
algum momento** da janela — isso inclui tanto câmeras que "caíram e voltaram"
(o padrão de piscar que o usuário quer investigar) quanto câmeras **permanentemente
offline a janela toda** (ex.: câmeras já mostradas como "Offline" fixo na tabela,
ou slots vazios cujo nome literal é `VAZIO`/`Empty`, que nunca tiveram status
`Connected`). No State Timeline isso é visualmente distinguível (barra vermelha
sólida = sempre caída; barra alternando verde/vermelho = piscando/investigar),
mas infla a lista de câmeras exibidas nos NVRs com mais problemas crônicos
(03/04/05). Se o usuário quiser isolar só o padrão de "flapping", a query
precisaria também exigir pelo menos uma transição 0→1 dentro da janela — não
implementado porque não foi pedido.

**Layout final (grid 24×29)**:

| Seção | y | h |
|---|---|---|
| Cabeçalho NVR | 0 | 2 |
| Cards online/offline/download/upload | 2 | 2 |
| Bar Gauge CPU/Memória | 4 | 2 |
| Tabela de câmeras | 6 | 17 |
| State Timeline (quedas, 3h) | 23 | 6 |

Colunas por NVR: NVR01-04 w=5 (x=0,5,10,15), NVR05 w=4 (x=20) — total 24.

### Verificação pós-publicação (sessão de 2026-11-18, outro chat)

A v2 foi publicada numa sessão anterior sem o trabalho ter sido commitado no git.
Nesta sessão, antes de commitar, conferi o estado **real** do Grafana (não só o
que o payload local dizia) via `GET /api/dashboards/uid/ag4ox6tas8uf4b`:

- Live está mesmo na `version: 2`, 30 painéis, batendo exatamente com a tabela de
  layout acima (gridPos de cada um dos 30 painéis conferido um a um).
- Fix do NVR 05 confirmado: os dois targets do card online/offline (painel #26)
  têm `ht.name = 'NVR 05'` corretamente, não mais `'NVR 04'`.
- Os 5 painéis State Timeline (#6, #12, #18, #24, #30) têm `ht.name` correto cada
  um pro seu próprio NVR, `timeFrom: "3h"` presente em todos, e a transformação
  `partitionByValues` configurada igual em todos.

**Pendências / a confirmar com o usuário após ver na TV real** (isso eu não
consigo validar sem acesso a navegador — continua em aberto):
- Altura do gráfico State Timeline (6 linhas) pode ficar apertada para NVR03/04/05
  (10-18 câmeras flagradas) — ajustar altura ou filtrar a query se a leitura não
  for satisfatória.
- Confirmar que o teto 24×29 realmente se aplica a esta TV (assumido igual ao
  Fronius).
- Confirmar visualmente que a transformação `partitionByValues` está realmente
  renderizando cada câmera como uma linha separada e legível no State Timeline
  (a configuração está correta no JSON, mas o resultado visual/legibilidade só o
  usuário consegue confirmar).
