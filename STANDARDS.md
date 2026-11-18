# Padrões para Dashboards Grafana — TV ATALAIA

Esta pasta reúne os dashboards Grafana customizados usados para exibição em TVs de
monitoramento (sinalização digital). Cada dashboard tem um script gerador de JSON em
`scripts/<nome-do-dashboard>/` e um documento de histórico em `dashboards/<nome>.md`.

Este arquivo contém os padrões técnicos e visuais que devem ser **reaproveitados em
todos os dashboards** para manter consistência. Qualquer decisão de identidade visual
tomada aqui vale para todos os dashboards, a menos que o documento específico do
dashboard diga o contrário.

> ⚠️ Regra obrigatória: sempre que uma alteração chegar a um ponto de versão publicado
> (nova `version` no Grafana) ou a identidade visual mudar, **atualize este arquivo
> (se for mudança de padrão geral) e o markdown do dashboard em `dashboards/`** antes
> de encerrar a tarefa. Ver `CLAUDE.md` na raiz.
>
> ⚠️ **Limite de grade é intocável.** Cada dashboard tem um teto fixo de linhas×colunas
> definido pelo tamanho físico da tela onde ele é exibido (sem rolagem). Para o
> dashboard Fronius esse teto é **24 colunas × 29 linhas** — ver
> `dashboards/paineis-solares-fronius.md`. O dashboard de Monitoramento de Câmeras
> usa o **mesmo teto 24×29** (confirmado batendo com a área visível sem scroll que
> já estava em produção antes de qualquer alteração — ver
> `dashboards/monitoramento-de-cameras.md`), o que sugere que **24×29 é o teto
> padrão desta TV/classe de tela ("TV ATALAIA")**, não algo exclusivo do Fronius —
> mas confirme com o usuário se um dashboard novo for exibido em tela física
> diferente antes de assumir o mesmo valor. **Qualquer pedido de painel novo,
> gráfico adicional ou redistribuição de layout precisa primeiro verificar esse
> teto e encaixar a mudança dentro dele** (reduzindo a altura de outras seções se
> necessário), nunca excedendo o total. Antes de publicar, o script gerador deve
> imprimir a soma final de `gridPos` e conferir contra o teto documentado daquele
> dashboard (ver `console.log` de bounding box em `generate_dashboard.js`).

## Workflow geral (leia esta seção primeiro, antes de tudo mais)

### Alterar um dashboard existente

1. `GET /api/dashboards/uid/<uid>` → salvar/atualizar o backup/snapshot bruto em
   `scripts/<nome>/*.json` antes de qualquer mudança.
2. Escrever/editar o script gerador em `scripts/<nome-dashboard>/generate_dashboard.js`
   (Node puro, sem dependências externas) que produz o payload completo
   `{dashboard, folderId, overwrite:true, message}` a partir do backup + das
   definições de cada painel (HTML/CSS/JS se for HTML Graphics, ou JSON de painel
   nativo se não for — ver critério de escolha abaixo).
3. Validar antes de publicar:
   - O script deve **falhar** (`process.exit(1)`), não só avisar, se a soma final
     de `gridPos` ultrapassar o teto de grid documentado daquele dashboard (ver
     exemplo em `scripts/monitoramento-de-cameras/generate_dashboard.js`).
   - Se usar HTML Graphics: validar sintaxe de cada `onInit`/`onRender` gerado
     (`new Function(...)`) e, se a mudança envolveu lógica de dados, rodar o
     harness de mock (ver seção do plugin abaixo) contra uma amostra real via
     `POST /api/ds/query` antes de publicar.
4. Publicar: `POST /api/dashboards/db` com o payload gerado.
5. Pedir para o usuário conferir visualmente na TV/navegador real — **não há
   acesso a browser remoto na rede dele**, então toda validação visual depende do
   retorno dele (prints, descrição).
6. **Atualizar o markdown do dashboard correspondente em `dashboards/`** com o que
   mudou, por quê, e a nova versão publicada. Se a mudança alterou um padrão
   **compartilhado** (cor, tipografia, algoritmo de eixo, workflow, etc.),
   atualizar também este `STANDARDS.md`.
7. **Commitar em português** (ver `CLAUDE.md`) — não encerrar a tarefa com
   trabalho publicado mas não commitado.

### Criar um dashboard novo do zero

> ⚠️ **HTML Graphics é obrigatório em todo dashboard novo, sem exceção.** Não é
> uma decisão a se fazer por painel — é regra fixa do projeto, definida pelo
> usuário. Todo painel de um dashboard novo (cards, tabelas, gráficos de série
> temporal, timelines, o que for) é construído como `gapit-htmlgraphics-panel`,
> aplicando a paleta/tipografia/padrões da seção "Identidade visual" abaixo —
> nunca `stat`/`bargauge`/`table`/`state-timeline` nativos num dashboard novo.
> (O dashboard de Monitoramento de Câmeras foi feito com painéis nativos numa
> sessão anterior, por um mal-entendido — está sendo refeito em HTML Graphics;
> não o use como modelo de "quando usar nativo", só como referência das queries
> SQL/Zabbix que ele já tinha mapeado.)

1. Pedir ao usuário a URL/UID do dashboard-base já existente no Grafana (via de
   regra já existe algo "cru" feito pela equipe que o usuário quer reorganizar/
   redesenhar) e a pasta/folder de destino.
2. `GET /api/dashboards/uid/<uid>` — mesmo primeiro passo de "alterar um
   existente" acima; isso vira o backup/snapshot inicial. Isso também serve pra
   extrair as queries (Zabbix e/ou SQL) que já existem e que os painéis novos em
   HTML Graphics vão reaproveitar — só muda a renderização, não o dado.
3. Confirmar que o plugin HTML Graphics está instalado e habilitado
   (`GET /api/plugins/gapit-htmlgraphics-panel/settings` → `"enabled":true`) antes
   de desenhar qualquer painel — ver passos de instalação na seção do plugin.
4. Confirmar com o usuário o **teto de grid** (linhas×colunas) da TV onde vai ser
   exibido — não assumir 24×29 sem confirmar, a menos que seja a mesma classe de
   tela já documentada em outro dashboard.
5. Criar `scripts/<nome-dashboard>/` e o `generate_dashboard.js`, usando o
   dashboard Fronius como modelo de estrutura e reaproveitando os componentes
   visuais já prontos (header, card com barra de carga em gradiente, sparkline
   com hover, etc. — ver "Identidade visual" abaixo) em vez de reinventar do
   zero a cada dashboard novo. **Checklist de nível de acabamento** (a v3 do
   dashboard de Câmeras ficou "abaixo do nível do Fronius" por pular estes
   pontos — não repetir):
   - **Cabeçalho global obrigatório**, 1 painel só, full-width, no topo do
     dashboard — o mesmo design do Fronius (logo, marca, bloco de título,
     indicador ao vivo, intervalo de tempo, taxa de atualização), só muda o
     texto do título. Um título por seção/coluna **não substitui** isso.
   - **Unificar métricas relacionadas de uma mesma entidade num único card**,
     não fragmentar em vários mini-painéis lado a lado (ex.: um host com
     4-6 métricas relacionadas = 1 painel com layout interno organizado, não
     4-6 painéis separados). Dê ao card espaço de grid suficiente pra ficar
     com respiro — não force o mínimo técnico que cabe.
   - **Preservar o `gridPos`/layout do dashboard anterior não é obrigatório**
     quando a reclamação é sobre a organização visual, não só a tecnologia de
     renderização — redistribua o espaço livremente se o resultado ficar
     melhor (dentro do teto de grid).
   - Pra listas de status (tabela de itens com estado), usar **badge sólido
     colorido** por item, não fundo da linha inteira tintado/translúcido —
     fica com contraste mais fraco numa TV vista de longe.
6. Seguir os passos 3-7 de "Alterar um dashboard existente" acima (validar,
   publicar, pedir confirmação visual, documentar, commitar).
7. Criar `dashboards/<nome-dashboard>.md` do zero (estrutura dos exemplos
   existentes como modelo) e adicionar uma linha nas tabelas de dashboards em
   `CLAUDE.md` e `README.md`.

## Instância Grafana

- Acessada normalmente em `http://192.168.0.104:3000` (confirmar com o usuário caso
  tenha mudado — IP de rede local).
- Versão observada: Grafana 10.4.0.
- Autenticação: Service Account Token (`glsa_...`). **Nunca** salvar o valor do token
  em texto puro nestes arquivos — pedir ao usuário a cada sessão.
- `GET/POST /api/dashboards/...` funciona com role **Editor**.
- Habilitar/alterar plugin (`POST /api/plugins/:id/settings`) exige role **Admin**
  (Org Admin basta). Se o token for só Editor e isso for necessário, peça ao usuário
  para promover o Service Account antes.

## Plugin principal: HTML Graphics (Gapit)

- Nome no catálogo: **"HTML graphics"**. Não confundir com os painéis da VolkovLabs
  (`volkovlabs-text-panel`, `volkovlabs-echarts-panel`) — são plugins diferentes.
- **ID real**: `gapit-htmlgraphics-panel`. Repo:
  https://github.com/gapitio/gapit-htmlgraphics-panel
- Instalação: `grafana-cli plugins install gapit-htmlgraphics-panel` (ou copiar os
  arquivos manualmente para o diretório de plugins do Grafana). Depois de
  instalar/atualizar os arquivos, **reiniciar o processo do Grafana** é obrigatório
  para ele carregar o plugin na memória — só então ele aparece em
  `GET /api/plugins/gapit-htmlgraphics-panel/settings`.
- Depois do restart ele pode continuar com `"enabled": false`. Habilitar via API
  (token Admin): `POST /api/plugins/gapit-htmlgraphics-panel/settings` com body
  `{"enabled":true,"pinned":true}`.

### Schema de `panel.options` (direto do código-fonte, a doc oficial não lista as chaves)

```jsonc
options: {
  html: "...",              // HTML/SVG do painel
  css: "...",               // CSS escopado via Shadow DOM
  rootCSS: "",              // CSS fora do shadow root (fontes, @import)
  onInit: "...",            // JS executado 1x, ao montar o painel
  onRender: "...",          // JS executado a cada nova atualização de dados
  codeData: "{...}",        // JSON "Custom properties" -> vira `customProperties` no JS
  add100Percentage: true,   // força 100% w/h no primeiro elemento do HTML
  centerAlignContent: false,
  overflow: "hidden",       // 'visible'|'auto'|'scroll'|'hidden'
  useGrafanaScrollbar: false,
  SVGBaseFix: true,
  renderOnMount: true,
  panelupdateOnMount: true,
  onInitOnResize: false,
  dynamicData: false,
  dynamicFieldDisplayValues: false,
  dynamicProps: false,
  dynamicHtmlGraphics: false,
  calcsMutation: "standard",
  reduceOptions: { calcs: ["lastNotNull"], fields: "", values: false }
}
```

Globais disponíveis dentro de `onInit`/`onRender`: `htmlNode` (ShadowRoot — use como
`document` para `getElementById` etc.), `data` (PanelData: `data.series`,
`data.timeRange`), `customProperties`, `options`, `theme`/`theme2`,
`getTemplateSrv()`, `props`/`width`/`height` (PanelProps). `document`/`window`
globais do browser **também funcionam normalmente** (não é sandboxed) — útil para
`document.createElement`, e para a injeção de fundo global (ver abaixo).

### ⚠️ Gotcha crítico: `refId` não é confiável em painéis com múltiplas queries sobre datasource legado

Confirmado em produção com `alexanderzobnin-zabbix-datasource` (datasource Angular
"legado"): uma query com 3 `targets` (refId A/B/C) retornava os 3 frames certinhos,
com `refId` correto, quando testada via `POST /api/ds/query`. Mas no runtime real do
navegador (painel renderizado de verdade), **só o primeiro valor aparecia** — os
outros dois ficavam vazios. A causa exata não foi confirmada (suspeita: a forma como
esse datasource entrega resultado multi-target pro `PanelQueryRunner` do frontend
difere do caminho usado pela API HTTP), mas a correção é simples e resiliente a
qualquer uma das variações possíveis:

**Nunca procure o frame por `refId`.** Em vez disso, achate TODOS os campos
numéricos de TODOS os frames em uma lista única e pegue pela posição (0 = primeira
query declarada, 1 = segunda, etc.):

```js
function hg_allNumericFields(){
  var out = [];
  (data.series || []).forEach(function(fr){
    (fr.fields || []).forEach(function(f){ if (f.type === 'number') out.push(f); });
  });
  return out;
}
// uso: var fieldA = hg_allNumericFields()[0], fieldB = ...[1], fieldC = ...[2];
```

Isso funciona tanto se o datasource devolver frames separados por refId quanto se
mesclar tudo num frame largo com múltiplos campos — cobre as duas hipóteses sem
precisar saber qual é a real.

### Padrão de teste antes de publicar (não há devtools remoto na TV)

1. `new Function(<todos os parâmetros que o plugin injeta>, code)` para pegar erro de
   sintaxe antes de publicar.
2. Rodar a query real via `POST /api/ds/query` (mesmo token, mesmos `targets`) pra
   pegar uma amostra real de dados.
3. Montar um `data.series` mockado a partir dessa amostra (objetos simples
   `{refId, fields:[{name,type,values}]}`) e um DOM falso (`getElementById`,
   `createElement`, `querySelector` etc. devolvendo objetos mock com
   `textContent`/`style`/`setAttribute`) e executar o `onInit`/`onRender` gerado
   contra isso, conferindo o estado final dos elementos.
4. Testar pelo menos os cenários "dado normal", "refId ausente/errado" e (se
   aplicável) "múltiplas queries mescladas num frame só" antes de publicar uma
   correção relacionada a dados.

## Identidade visual ("TV ATALAIA")

- **Tema**: azul-marinho bem escuro, quase preto, com leve variação/animação — nunca
  preto puro, nunca um tom "claro"/acinzentado.
- **Fundo da página** (atrás/entre os painéis): não dá pra pintar o dashboard Grafana
  diretamente via JSON (sem branding Enterprise). Solução adotada: injetar
  `background-image`/`background-position` via JS diretamente em
  `document.documentElement` e `document.body`, usando
  `.style.setProperty(prop, valor, 'important')` — **nunca via `<style>` com
  `@keyframes`**, porque pode ser bloqueado por CSP (`style-src`) sem aviso nenhum.
  A animação é feita com `setInterval` recalculando `background-position` a partir de
  uma função seno lenta (ciclo de ~14-30s). Além disso, suba pelos ancestrais do
  próprio painel (`htmlNode.host.parentElement...`, limite ~14 níveis) zerando
  `background`/`background-image`/`box-shadow` via `setProperty(...,'important')`,
  pra não sobrar "caixas" com o fundo padrão do Grafana atrás dos cards.
- **Paleta**:
  - Fundo profundo (animado): `#02050a` → `#0a1526` → `#02050a`
  - Fundo de card/KPI: `linear-gradient(160deg,#0b1830 0%,#0a1428 55%,#081022 100%)`
  - Borda sutil: `rgba(96,165,250,0.18)` a `rgba(96,165,250,0.25)`
  - Texto principal/valores grandes: `#e8f1ff` a branco puro
  - Texto secundário/label: `#89a0c4` a `#93aad0`
  - Verde (ao vivo / alta): `#34d399`
  - Laranja/amarelo (potência / energia / alerta): `#fbbf24`, `#ffb648`
  - Vermelho (queda / carga baixa): `#f87171`
  - Azul (ícones/divisores/destaques): `#3b82f6`, `#9fc3ff`, `#bcd4ff`
- **Barra de progresso/carga**: gradiente **contínuo e suave** vermelho→amarelo→verde
  — `linear-gradient(90deg,#f87171 0%,#fbbf24 50%,#34d399 100%)`. **Nunca**
  segmentado/pontilhado e **nunca com paradas duplicadas** (ex.:
  `#f87171 0%,#f87171 38%,#fbbf24 38%,...`), que criam um corte abrupto de cor em
  vez de transição gradual — já foi tentado e o usuário pediu pra trocar (v10 do
  dashboard Fronius). Por cima do gradiente, uma máscara escura
  (`div.mask{position:absolute;right:0;...}`) encolhe da direita pra esquerda
  conforme o valor sobe (`mask.style.width = (100 - pct) + '%'`).
  - **Direção do gradiente depende da semântica da métrica**: vermelho→verde
    (esquerda pra direita) quando **valor alto é bom** (ex.: potência gerada,
    energia do dia). Para métricas onde **valor alto é ruim** (ex.: CPU,
    Memória, latência, taxa de erro), **inverter**:
    `linear-gradient(90deg,#34d399 0%,#fbbf24 50%,#f87171 100%)` (verde→vermelho)
    — senão a barra passa a mensagem errada de "quanto mais, melhor" pra uma
    métrica onde é o oposto. Usado em CPU/Memória no dashboard de Câmeras (v3).
- **Cabeçalho padrão**: logo (quadrado arredondado com gradiente azul + ícone
  branco) + nome do app + divisor fino + bloco de título (linha 1 maior/branca,
  linha 2 menor/azulada) à esquerda; à direita, itens separados por divisores finos
  (sem "pílulas"/chips com fundo): indicador ao vivo (ponto verde pulsante) + texto,
  intervalo de tempo selecionado (**calculado dinamicamente** a partir de
  `data.timeRange`/`props.timeRange`, nunca hardcoded), taxa de atualização.
- **Fonte**: `'Segoe UI', Roboto, Arial, sans-serif`.
- **Gráficos de série temporal (sparkline) em cards pequenos**: construir SVG manual
  (`path` com `M x,y L x,y ...`), sem biblioteca externa (evitar CDNs — o ambiente
  roda sem necessidade de internet). Sempre incluir:
  - Tooltip + linha de cursor ao passar o mouse (ver padrão de hover abaixo).
  - Eixo de tempo com **múltiplas marcações automáticas** (nunca só início/fim) —
    ver algoritmo de "nice step" abaixo.
- **Listas de status (ex.: tabela de câmeras/dispositivos online/offline)**:
  cada linha mostra o nome + um **badge sólido** colorido à direita
  (`border-radius:999px`, fundo verde/vermelho/cinza **sólido**, texto escuro
  em caixa alta pequena) — não um fundo translúcido na linha inteira. Fundo de
  linha tintado em baixa opacidade (ex.: `rgba(verde,0.1)`) fica com contraste
  fraco demais pra uma TV vista de longe; o badge sólido é o que dá o "golpe de
  vista" rápido de verde/vermelho que uma lista de status precisa. Zebra sutil
  (`rgba(255,255,255,0.02)` nas linhas pares) e uma borda fina entre linhas
  ajudam a separar visualmente sem precisar de cor de fundo forte.

### Padrão de hover em gráfico custom (sem biblioteca)

Como `onInit` e `onRender` são escopos JS separados (não compartilham closure), o elo
entre os dois é o próprio elemento DOM: `onRender` grava os pontos atuais numa
propriedade arbitrária do elemento (ex.: `svgEl.__hgPoints = points`), e o listener de
`mousemove`, registrado **uma única vez em `onInit`** (com uma flag tipo
`el.__hgBound` pra não duplicar o listener a cada remount), sempre lê a versão mais
recente via essa propriedade.

### Algoritmo de eixo de tempo automático ("nice step")

Dado o intervalo real de tempo mostrado (`t1 - t0`), calcular o passo de marcação que
resulta em ~7 marcações, arredondando para o próximo valor "bonito" de uma lista fixa
(em minutos): `[1,2,5,10,15,20,30,60,120,180,240,360,720,1440,2880]`. Com isso, um
intervalo de 6h gera marcações de 1h em 1h (7 marcações); 1h gera marcações de 10 em
10 min; 24h gera marcações de 4 em 4h — sempre proporcional ao período que o usuário
escolher no seletor de tempo do Grafana, nunca fixo.

## Painel com janela de tempo fixa (independente do seletor global)

Para um painel que deve sempre mostrar um período fixo (ex.: "últimos 7 dias")
**mesmo que o usuário mude o seletor de tempo do dashboard**, usar o campo nativo do
schema de painel do Grafana: `panel.timeFrom` (string de duração relativa, ex.:
`"7d"`, `"24h"`). Isso equivale a marcar "Override relative time" na edição do
painel. O `data.timeRange`/`props.timeRange` que o HTML Graphics recebe já vem com
esse intervalo aplicado — os mesmos algoritmos de eixo automático e formatação de
tempo (ver seções acima) funcionam sem nenhuma adaptação especial. Útil para
gráficos "de contexto" (ex.: tendência semanal) ao lado de um dashboard cujo
intervalo padrão é curto (ex.: 6h).

Ao formatar rótulos de eixo/tooltip para esses painéis, trocar o formato de
`HH:MM` para `DD/MM` (ou `DD/MM HH:MM` no tooltip) quando o intervalo total
ultrapassar ~1,5 dia — caso contrário as marcações de dias diferentes ficam
idênticas (todas mostrando só a hora).

## Agregando um contador que reseta diariamente (total por dia)

Para mostrar "quanto foi gerado/consumido/etc. em cada um dos últimos N dias" a
partir de um item Zabbix que **reseta à meia-noite e sobe ao longo do dia** (ex.:
`Energy Generated Day`), não dá pra simplesmente ler o último valor — é preciso
agrupar os pontos da série por dia-calendário local e pegar o **valor máximo** de
cada grupo (esse máximo é o total daquele dia; o dia corrente aparece com um total
parcial, ainda subindo):

```js
var byDay = {};
for (var i = 0; i < vals.length; i++) {
  if (vals[i] == null || isNaN(vals[i])) continue;
  var d = new Date(times[i]);
  var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  if (!byDay[key]) byDay[key] = { max: vals[i], t: times[i] };
  else { if (vals[i] > byDay[key].max) byDay[key].max = vals[i]; if (times[i] > byDay[key].t) byDay[key].t = times[i]; }
}
var days = Object.keys(byDay).sort(function(a,b){ return byDay[a].t - byDay[b].t; }).slice(-7);
```

**Sempre validar o resultado antes de publicar** comparando com o delta do contador
*acumulado/vida-útil* equivalente (se existir), ex.: `total_dia_2 - total_dia_1`
usando o item "Total" em vez do item "Day" — os dois devem bater na mesma ordem de
grandeza. Isso pegou uma suspeita de bug (valores "grandes demais") que na verdade
era só uma referência mental errada do que é um dia "completo" vs. uma leitura
parcial de manhã (ver changelog do dashboard Fronius, v11).

## Totais por período em pouco espaço: cards compactos (preferência confirmada)

Para mostrar "total de cada item de um período" (ex.: total por dia dos últimos 7
dias) junto de um gráfico de linha do mesmo tema, o dashboard Fronius passou por 3
formatos antes de chegar no que o usuário realmente queria — guarde esse histórico
pra não repetir as tentativas rejeitadas em outro dashboard:

1. **Barras verticais no mesmo painel do gráfico de linha** (v11) — rejeitado: o
   usuário achou que as barras "dividiam" visualmente o gráfico de linha abaixo.
2. **Linha de pontos horizontal, em painel separado** (v12) — tecnicamente mais
   discreta, mas acabou sendo pouco legível na TV real ("não dá pra visualizar os
   dados") e o usuário não gostou de ter dois painéis separados.
3. **Cards compactos, no mesmo painel do gráfico de linha, com o título colado o
   mais perto possível da seção acima** (v13, preferência confirmada) — cada card é
   uma caixinha com borda/fundo sutil (`rgba(cor,0.07-0.2)`, mesma paleta do item),
   rótulo (data ou "HOJE") em cima, valor embaixo. Destaque o item "atual/parcial"
   (ex.: hoje) com uma cor diferente (verde, consistente com o indicador "ao vivo"
   do resto do dashboard) trocando o fundo/borda do card, não só o texto.

**Lição**: nem sempre a opção mais "minimalista" (menos elementos visuais) é a mais
legível ou a preferida — confirme o resultado real com o usuário antes de assumir
que uma versão mais enxuta é automaticamente melhor.

## Sincronizar um valor com o intervalo de tempo global quando o painel usa `timeFrom`

`panel.timeFrom` (ver seção acima) vale pra TODAS as queries daquele painel — não dá
pra ter uma query no intervalo global do dashboard e outra numa janela fixa (ex.:
7 dias) no mesmo painel. Isso é um problema quando um elemento dentro desse painel
precisa mostrar o mesmo número que outro painel do dashboard (que usa o intervalo
global) está mostrando — ex.: um card "hoje" dentro de um gráfico semanal que
deveria bater com um KPI "hoje" que fica no topo do dashboard. Datasources como o
Zabbix legado também podem responder com **resolução diferente** (trends/agregado
por hora vs. raw/history) dependendo do tamanho da janela pedida, então mesmo a
"mesma" métrica pode vir com um valor levemente defasado se a janela for maior.

**Solução**: dentro do `onRender` desse elemento específico, disparar um
`fetch('/api/ds/query', {...})` direto pra API do próprio Grafana (mesma
sessão/cookie do navegador — `credentials: 'same-origin'`, sem precisar de token),
repetindo a query exata do painel que você quer igualar, mas com o intervalo de
tempo lido da URL atual (`new URLSearchParams(window.location.search).get('from'
| 'to')`, com fallback pro padrão salvo do dashboard se a URL não tiver esses
parâmetros) em vez do `timeFrom` fixo do painel. Ao responder, só substitui o texto
do elemento — o resto do painel (gráfico, outros cards históricos) continua usando
a query com `timeFrom` fixo normalmente. `fetch`/`window`/`URLSearchParams` são
globais de navegador normais aqui, não precisam ser passados como parâmetro (ver
seção do plugin acima — `document`/`window` já funcionam sem sandboxing).

## Cálculo de tamanho de fonte para TV (método AVIXA)

Sempre que for preciso definir/ajustar tamanho de fonte para exibição em TV,
**calcular, não chutar incrementalmente**:

1. Perguntar ao usuário: tamanho da tela (polegadas, diagonal), resolução e
   distância média de visualização.
2. Calcular largura/altura físicas da tela (cm) a partir da diagonal e do aspect
   ratio (ex.: 16:9 → largura = diagonal × 16/√(16²+9²)).
3. Calcular cm por pixel nativo da tela (largura física ÷ resolução horizontal).
4. Altura de caractere alvo (cm) = distância (cm) ÷ 100 a distância ÷ 150 — padrão
   AVIXA para conteúdo **"analítico"** (a pessoa precisa ler valores específicos, não
   é texto de detecção rápida tipo placa de trânsito, que usaria distância ÷ 50).
5. Converter cm → px da tela e dividir por ~0.7 (proporção típica cap-height/font-size)
   para chegar no `font-size` em CSS.
6. **Testar se cabe** na altura disponível do painel antes de aplicar. Altura do
   painel em px ≈ `h*30 + (h-1)*8`, onde `h` é a altura em unidades de grid do
   Grafana (linhas) e 30px/8px são a unidade de linha e a margem padrão do grid
   clássico do Grafana. Se não couber, ajustar o **layout** primeiro (ex.: trocar
   colunas lado a lado por linhas empilhadas, que dão largura total a cada valor) —
   só reduzir a fonte calculada como último recurso, e documentar o motivo.

Exemplo real (dashboard Fronius): TV 65" 4K, 16:9, vista a ~3,25m → ~2,2 a 3,3cm de
altura de caractere-alvo → fontes de valor principal entre 29-50px dependendo do
espaço disponível em cada painel (ver changelog em
`dashboards/paineis-solares-fronius.md` para o valor final de cada elemento).

## Histórico: painéis nativos no dashboard de Câmeras (v1-v2, descontinuado)

> ⚠️ **Não repita isto em nenhum dashboard novo.** Por um mal-entendido, a v2 do
> dashboard de Monitoramento de Câmeras foi feita 100% com painéis nativos do
> Grafana (`stat`, `bargauge`, `table`, `state-timeline`). O usuário corrigiu:
> **HTML Graphics é obrigatório em todo dashboard novo** (ver "Criar um dashboard
> novo do zero" no topo deste arquivo). A v3 trocou a tecnologia (HTML Graphics)
> mas **manteve o mesmo layout fragmentado da v2** (4 mini-painéis por NVR, sem
> cabeçalho global, lista com fundo tintado, timeline em várias trilhas) — o
> usuário rejeitou de novo, dessa vez por nível de acabamento abaixo do Fronius,
> não pela tecnologia. **A v4 corrigiu isso** (cabeçalho global, 1 card unificado
> por NVR, badges sólidos na lista, gráfico agregado em série temporal) — ver
> `dashboards/monitoramento-de-cameras.md` para a versão atual e o checklist de
> acabamento adicionado em "Criar um dashboard novo do zero" acima. Esta seção
> fica só como registro histórico de por que a v1→v2 foi feita daquele jeito e o
> que se aprendeu, caso ajude a entender decisões antigas ou dado herdado
> (queries SQL/Zabbix continuam as mesmas desde a v1, só a renderização muda).

Os gotchas de `refId` e o padrão de teste via `new Function(...)` descritos na
seção do plugin acima **só se aplicam** a painéis que de fato usam HTML
Graphics. Para os painéis nativos que ainda possam existir em dashboards
antigos, os riscos de dado errado costumam estar na própria `rawSql`/filtro do
painel (ex.: host/item filtrado errado numa query duplicada — foi o caso do
bug do NVR 05 na v1 do dashboard de Câmeras, copy/paste ao duplicar painéis),
não em JS de painel.

### Bar Gauge em gradiente nativo (abordagem descontinuada)

A barra de carga vermelho→amarelo→verde descrita na seção de paleta acima é
desenhada à mão (SVG + máscara) porque é assim que fica consistente com o resto
da identidade visual em HTML Graphics. A v2 do dashboard de Câmeras usou o
painel nativo `bargauge` (`displayMode: "gradient"`) como atalho pra CPU/Memória
— **não fazer isso em dashboards novos**; o componente de barra em HTML/CSS
(ver "Identidade visual") é obrigatório, mesmo custando um pouco mais de código
por painel.

### Dado categórico em formato "longo": agregar numa série única em vez de 1 linha por categoria

Quando uma query SQL retorna dado em formato "longo" — uma linha por
`(tempo, categoria, valor)`, ex.: `(TimestampStatus, Câmera, Status)` — a
tentação é desenhar **1 linha/faixa por categoria** (um state-timeline estilo
Gantt, uma trilha horizontal por item). **Evite isso quando o número de
categorias pode ser grande ou variável** (ex.: de 1 a 18 câmeras flagradas
dependendo do NVR): numa TV, muitas trilhas finas empilhadas ficam ilegíveis, e
o usuário explicitamente rejeitou esse formato no dashboard de Câmeras por
"parecer gráfico de barras horizontais" (v3→v4).

**Prefira agregar numa única série temporal** — ex.: em vez de "uma trilha por
câmera mostrando conectado/desconectado", uma linha só com "quantas câmeras
estão offline em cada instante", no mesmo estilo de sparkline com hover do
Fronius (`STANDARDS.md`, "Padrão de hover em gráfico custom"). O agrupamento é
feito no `onRender`, varrendo os eventos em ordem cronológica e mantendo o
estado de cada categoria pra computar a contagem agregada a cada mudança:

```js
raw.sort(function (a, b) { return a.t - b.t; }); // [{t, cat, v}, ...]
var state = {};
var points = [];
raw.forEach(function (p) {
  state[p.cat] = p.v;
  var affected = Object.keys(state).filter(function (c) { return state[c] === 0; });
  points.push({ t: p.t, v: affected.length, cats: affected });
});
```

Isso dá uma linha só, sempre legível **independente de quantas categorias
existam**, e o `cats` de cada ponto ainda deixa investigar o detalhe (quais
categorias especificamente) via tooltip no hover — sem precisar de uma trilha
visual por categoria. Desenhe o path em **"step" (degraus)**, não interpolação
direta ponto-a-ponto, já que é uma contagem discreta que muda em saltos, não
uma grandeza contínua: para cada par de pontos consecutivos, vá até
`(x_novo, y_antigo)` antes de subir/descer pra `(x_novo, y_novo)`.

⚠️ **Cuidado com timestamps `NULL`** nesse tipo de query (uma categoria com
nome mas sem valor correspondente, de um `LEFT JOIN` que não casou) — um `t`
nulo quebra o `sort` numérico (`null` vira `0` numa subtração em JS) e pode
jogar esse ponto pro início dos anos 1970, estourando o cálculo do eixo de
tempo (`hg_niceTicks`) pra milhares de marcações. **Sempre filtre** `t == null
|| isNaN(t)` antes de processar, e teste com o cenário de mais linhas de dado
antes de publicar — foi exatamente assim que esse bug foi pego (câmera
"Canal32" do NVR 05, ver `dashboards/monitoramento-de-cameras.md`).

Se um dia for mesmo necessário mostrar o estado de cada categoria
individualmente (não só o agregado), prefira uma **tabela/lista com badge por
item** (ver seção de identidade visual) a um timeline multi-trilha.

