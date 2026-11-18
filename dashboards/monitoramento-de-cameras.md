# Monitoramento de Câmeras — TV ATALAIA

- **UID**: `ag4ox6tas8uf4b`
- **URL**: `http://192.168.0.104:3000/d/ag4ox6tas8uf4b/monitoramento-de-cameras-copy`
- **Pasta**: folderId 37 / folderUid `beo1jpm2pybk0f`
- **Script gerador**: `scripts/monitoramento-de-cameras/generate_dashboard.js`
- **Templates de query SQL**: `scripts/monitoramento-de-cameras/query_templates.json`
  (extraídos uma vez do dashboard ao vivo, parametrizados por `ht.name` no
  gerador — nunca retranscritos à mão, pra não arriscar erro de digitação num
  SQL com CTE/regex)
- **Backup bruto antes da v2**: `scripts/monitoramento-de-cameras/backup_v1.json`
- **Harness de teste**: `scripts/monitoramento-de-cameras/mock_panel.js` — mock
  genérico, recebe payload + marcador de HTML + resultado de `/api/ds/query` +
  lista de refIds (ver padrão de teste no `STANDARDS.md`)

## O que este dashboard mostra

**Cabeçalho global** (padrão TV ATALAIA, igual ao Fronius — só muda o título)
no topo, seguido de 5 colunas, uma por NVR (`NVR 01` a `NVR 05`), cada uma com:

1. **Card unificado do NVR**: nome, ONLINE/OFFLINE (câmeras conectadas/
   desconectadas), DOWNLOAD/UPLOAD (tráfego de rede) e barras de CPU/Memória —
   tudo num painel só (desde a v4).
2. Tabela com todas as câmeras daquele NVR e o status atual (Online/Offline/Empty).
3. Gráfico de série temporal com o **número de câmeras offline ao longo das
   últimas 3h** (agregado, não mais 1 trilha por câmera — desde a v4).

## Datasources

- **Zabbix** (`alexanderzobnin-zabbix-datasource`, uid `fdfjaoiye7im8a`): métricas
  "ao vivo" dos hosts NVR (CPU Usage, Memory Utilization, Interface eth0: Bits
  received/sent). Usado nos cards de topo e nas barras de CPU/Memória.
- **MySQL** (`mysql`, uid `de834v5wv8flsd`): consultas diretas nas tabelas internas
  do Zabbix (`hosts`, `items`, `history_str`) pra extrair nome/status de cada
  câmera a partir das chaves de item `remoteCam[name...]` / `remoteCam[status...]`.
  Usado nos cards ONLINE/OFFLINE, na tabela de câmeras e no gráfico de quedas.

⚠️ **Desde a v3, este dashboard usa o plugin HTML Graphics**
(`gapit-htmlgraphics-panel`) em 100% dos painéis — é obrigatório em todo
dashboard novo (ver `STANDARDS.md`). Os gotchas de `refId` e o padrão de teste
via `new Function(...)` do `STANDARDS.md` **se aplicam normalmente** aqui. A v1
e a v2 (native, descontinuada) ficam só como histórico abaixo.

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

### v3 — 2026-11-18

**Por quê**: o usuário corrigiu um mal-entendido — **HTML Graphics é obrigatório
em todo dashboard novo**, sem exceção; não é uma escolha por painel/por
dashboard. A v2 (painéis nativos) foi feita por engano. Pedido: refazer a
identidade visual inteira do dashboard usando HTML Graphics, aplicando a mesma
paleta/componentes já estabelecidos no dashboard Fronius.

**O que mudou**: todos os 30 painéis foram reconstruídos como
`gapit-htmlgraphics-panel`. **Nenhuma query SQL/Zabbix mudou** — extraídas uma
vez do dashboard ao vivo (`query_templates.json`) e reaproveitadas tal qual; só
a renderização mudou. Layout (posições/alturas) idêntico ao da v2.

> ⚠️ **Essa suposição (layout da v2 já estava certo) estava errada** — o
> usuário rejeitou a v3 de novo, dessa vez pelo nível de acabamento (sem
> cabeçalho global, 4 mini-painéis fragmentados por NVR em vez de 1 card
> unificado, lista de câmeras com contraste fraco, timeline em várias trilhas
> parecendo "gráfico de barras horizontais"). **Ver v4 abaixo pra correção.**
> Ficam as duas versões documentadas pra não repetir nenhuma das duas
> tentativas erradas (v2: tecnologia nativa; v3: tecnologia certa, acabamento
> abaixo do nível do Fronius).

- **Cabeçalho NVR**: painel estático (sem query), título grande centralizado,
  fundo em gradiente navy igual aos cards do Fronius.
- **Online/Offline**: 2 células lado a lado com fundo verde/vermelho escuro
  (gradiente, não cor chapada) e número em destaque — mesma query MySQL de
  antes (2 targets).
- **Download/Upload**: 2 células num card navy padrão, valores formatados com
  a mesma função de escala automática do Fronius (`hg_fmtScaled`), adaptada pra
  bits/s (`hg_fmtBits`: b/s → Kb/s → Mb/s → Gb/s).
- **CPU/Memória**: a barra de carga em gradiente contínuo do Fronius (SVG+CSS,
  não mais o `bargauge` nativo), **mas com o gradiente invertido**
  (verde→amarelo→vermelho da esquerda pra direita, não vermelho→verde) — pra
  CPU/Memória, valor **alto é ruim**, o oposto da semântica original da barra
  (criada pra "quanto mais gerado, melhor"). Ver nota nova em `STANDARDS.md`.
- **Tabela de câmeras**: lista HTML customizada (não mais `table` nativa) —
  cada câmera uma linha com fundo colorido (verde/vermelho/cinza) por status,
  construída com `flex:1` por linha pra se adaptar a qualquer contagem de
  câmeras sem precisar calcular altura manualmente.
- **Gráfico de quedas**: state-timeline **100% customizado em HTML/SVG** (ver
  `STANDARDS.md`, "Dado categórico em formato longo") — substituiu o painel
  nativo `state-timeline` + transformação `partitionByValues`. Mesmo algoritmo
  de "nice ticks" do Fronius pro eixo de tempo. Cada segmento tem `title`
  (tooltip nativo do navegador) com câmera + status + horário.

**Validação antes de publicar** (ver `STANDARDS.md`, padrão de teste): rodei a
query real de cada um dos 5 tipos de painel via `POST /api/ds/query` e testei
o `onRender` gerado contra os dados reais com `mock_panel.js`, incluindo os
dois extremos da timeline de quedas — NVR02 (1 câmera, com um blip claro de
queda-e-volta no meio da janela, exatamente o padrão que o usuário quer
investigar) e NVR05 (18 câmeras, o caso mais pesado) — sem exceções em nenhum
dos dois.

Publicado como `version: 3` (30 painéis, mesmo `gridPos` da v2).

**Pendências da v3** (superadas pela v4 abaixo, mantidas aqui só por registro
histórico): altura da timeline pra NVR03/04/05, legibilidade da tabela e das
trilhas por câmera.

### v4 — 2026-11-18

**Por quê**: o usuário comparou a v3 com o Fronius e achou o design "muito
abaixo do nível" — pediu uma correção completa de identidade visual, não só de
tecnologia (ver aviso na v3 acima). Pediu também pra eu revisar a documentação
do projeto e remover/corrigir o que me levou a montar a v3 daquele jeito —
ver as mudanças em `STANDARDS.md` (checklist de acabamento na seção "Criar um
dashboard novo do zero", e a seção de dado categórico reescrita).

**O que mudou** (16 painéis, de 30 na v3 — layout bem mais enxuto):

- **Cabeçalho global** (novo, não existia nem na v2 nem na v3): 1 painel
  full-width no topo, cópia do componente de cabeçalho do Fronius (logo,
  "TV ATALAIA", bloco de título, indicador ao vivo, intervalo de tempo
  calculado dinamicamente, taxa de atualização) — só o título mudou pra
  "MONITORAMENTO DE CAMERAS" / "NVRs E CAMERAS". Refresh do chip fixado em
  "1m" (o dashboard já usa `refresh=1m` na URL, diferente do Fronius que usa
  5s).
- **Card unificado por NVR** (substituiu os 4 mini-painéis fragmentados da
  v3 — cabeçalho-por-NVR, online/offline, download/upload, CPU/memória):
  1 painel só com datasource **mista** (`{type:'datasource',uid:'-- Mixed --'}`,
  2 targets MySQL + 4 targets Zabbix no mesmo painel — testado via
  `/api/ds/query` com as 6 queries juntas antes de publicar, igual a como o
  próprio Grafana executaria). Layout interno: título com ponto "ao vivo" em
  cima, 4 estatísticas (Online/Offline/Download/Upload) numa grade de 4
  colunas no meio, 2 barras de carga (CPU/Memória, gradiente invertido — ver
  `STANDARDS.md`) embaixo. Ganhou `h=6` de grid (bem mais espaço que o `h=2`
  fragmentado da v3) — o card fica com respiro, nível parecido com os cards de
  inversor do Fronius.
- **Tabela de câmeras**: trocado o fundo de linha tintado (baixa opacidade,
  contraste fraco) por **badge sólido** colorido à direita de cada linha
  (verde/vermelho/cinza, texto escuro em caixa alta) — nome da câmera em texto
  claro de alto contraste à esquerda. Zebra sutil entre linhas pra separar
  visualmente. Ver padrão novo em `STANDARDS.md` ("Listas de status").
- **Gráfico de quedas**: trocado de "1 trilha horizontal por câmera" (parecia
  gráfico de barras, segundo o usuário) para **1 linha de série temporal só**,
  em degraus (step), mostrando **quantas câmeras flagradas estavam offline a
  cada instante** — mesmo componente de sparkline-com-hover do Fronius
  (tooltip mostra horário + contagem + até 3 nomes de câmeras afetadas). Ver
  padrão reescrito em `STANDARDS.md` ("Dado categórico em formato longo").

**Bug pego durante o teste** (não existia antes porque a v3 nunca tinha sido
testada com esse volume de dado neste componente novo): a câmera `Canal32` do
NVR 05 tem nome mas nenhum status registrado nas últimas 3h (join que não
casou), então sua única linha na query vem com `TimestampStatus = NULL`. Um
`t` nulo quebra a ordenação cronológica (`null` vira `0` numa subtração JS) e
jogava o cálculo do eixo de tempo pros anos 1970, gerando **~10.400 marcações
idênticas**. Corrigido filtrando `t == null || isNaN(t)` antes de processar, e
foi adicionada uma trava de segurança no `hg_niceTicks` (máximo de 50
marcações, nunca mais um loop desse tamanho) — ver `STANDARDS.md`.

**Validação antes de publicar**: reexecutei os 5 tipos de painel via
`POST /api/ds/query` (card unificado com as 6 queries mistas juntas; tabela;
gráfico de quedas pros 3 cenários reais — NVR01 com 2 câmeras, NVR02 com 1,
NVR05 com 18) e testei o `onRender` com `mock_panel.js`/scripts de detalhe
ad-hoc. Confirmei o bug do `Canal32` isolando a query bruta antes de corrigir,
e confirmei a correção reexecutando o mesmo teste depois.

**Layout final (grid 24×29)**:

| Seção | y | h |
|---|---|---|
| Cabeçalho global (full-width) | 0 | 2 |
| Card unificado por NVR | 2 | 6 |
| Tabela de câmeras | 8 | 15 |
| Gráfico de quedas (série temporal agregada, 3h) | 23 | 6 |

Colunas por NVR: NVR01-04 w=5 (x=0,5,10,15), NVR05 w=4 (x=20) — total 24.

Publicado como `version: 4` (16 painéis).

**Pendências da v4** (resolvidas na v5 abaixo): nível de acabamento do card
unificado, legibilidade da tabela, teto de grid.

### v5 — 2026-11-18

**Por quê**: usuário confirmou que a v4 "melhorou bastante", pediu polimento
fino em 4 pontos específicos.

**O que mudou**:

1. **Tabela de câmeras**: trocado o badge sólido com texto ("ONLINE"/
   "OFFLINE"/"EMPTY") por um **ponto de status** (bolinha colorida, com glow
   nas online/offline, igual ao indicador "ao vivo" usado no resto do
   dashboard) à esquerda do nome. Isso libera a largura que o texto do badge
   ocupava, usada pra aumentar a fonte do nome da câmera de `12px` pra
   `14.5px` — ganho real de legibilidade, não só cosmético.
2. **Card do NVR reorganizado em 3 linhas**, como pedido:
   - Linha 1: ponto "ao vivo" + título do NVR + **Online/Offline movidos pro
     canto direito**, alinhados verticalmente com o título (`margin-left:auto`
     no container, mesmo `align-items:center` da linha) — formato "32 ONLINE /
     0 OFFLINE" compacto.
   - Linha 2: barras de CPU e Memória (sem mudança de posição, só ganharam
     mais altura/fonte com o espaço liberado).
   - Linha 3: Download/Upload, agora sozinhos na própria linha (antes
     dividiam uma grade de 4 colunas com Online/Offline) — puderam crescer de
     `17px`/`10px` pra `22px`/`11.5px` (valor/label).
3. **Mais espaço pra tabela**: o gráfico de quedas ficou mais simples na v4
   (1 linha em vez de várias trilhas), então não precisa mais de tanta altura
   — reduzido de `h=6` pra `h=4`, e as 2 linhas de grade ganhas foram todas
   pra tabela de câmeras (`h=15` → `h=17`), aumentando ~13% a altura
   disponível por linha de câmera.
4. **Gráfico de quedas invertido**: antes a linha **subia** quando uma câmera
   caía (contagem de offline crescendo) — o usuário achou contraintuitivo,
   queria que a linha **caísse** no momento da queda, pra passar a mensagem
   "estava estável e caiu agora". Trocado pra plotar a **contagem de câmeras
   online** entre as flagradas (começa no total, cai quando alguma cai, sobe
   de volta quando reconecta) — cor da linha trocada de vermelho pra verde
   (convenção "saudável"), e o domínio do eixo X passou a usar
   `data.timeRange` (janela real do painel, `timeFrom: 3h`) em vez do
   min/max dos eventos, com um ponto inicial sintético no início da janela
   (valor = total de câmeras, saudável) e um ponto final no fim da janela
   (repete o último valor conhecido) — isso faz a linha ficar **estável antes
   da primeira queda real**, em vez de já começar caída, reforçando a leitura
   de "caiu nesse momento específico". Título trocado pra "ULTIMAS QUEDAS —
   3H" (ajustável). Tooltip no hover agora mostra "HH:MM — X/Y online" +
   lista de offline, em vez de só a contagem de offline.

**Validado com dados reais** (`POST /api/ds/query` + `mock_panel.js` + scripts
de detalhe ad-hoc) nos mesmos 3 cenários da v4 (card unificado com 6 queries
mistas; tabela; gráfico de quedas pra NVR02 com 1 câmera e NVR05 com 18).
Confirmado visualmente no resultado do mock: NVR02 mostra a linha estável em
`1/1`, caindo pra `0` no meio da janela e voltando (exatamente o padrão de
flapping que o usuário quer investigar); NVR05 mostra a queda gradual até `0`
conforme as câmeras com problema crônico ficam offline uma a uma.

**Layout final (grid 24×29)**:

| Seção | y | h |
|---|---|---|
| Cabeçalho global (full-width) | 0 | 2 |
| Card unificado por NVR | 2 | 6 |
| Tabela de câmeras | 8 | 17 |
| Gráfico de quedas (série temporal agregada, invertida, 3h) | 25 | 4 |

Colunas por NVR: NVR01-04 w=5 (x=0,5,10,15), NVR05 w=4 (x=20) — total 24.

Publicado como `version: 5` (16 painéis, mesma contagem da v4).

**Pendências / a confirmar com o usuário após ver na TV real**:
- Legibilidade real dos novos pontos de status na tabela e do card
  reorganizado — primeira vez vistos numa tela real.
- Confirmar que o teto 24×29 realmente se aplica a esta TV (pendência antiga,
  ainda não confirmada explicitamente pelo usuário).
