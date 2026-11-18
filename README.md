# Grafana Claude — Dashboards TV ATALAIA

Repositório de apoio para criar e manter os dashboards Grafana customizados
exibidos nas TVs de monitoramento da ATALAIA. Cada dashboard é tratado como
artefato versionado: um script Node monta o JSON completo do dashboard e publica
via API (`POST /api/dashboards/db`) — não há edição manual pela UI do Grafana
para mudanças estruturais. **Todo dashboard é feito 100% com o plugin
HTML Graphics** (`gapit-htmlgraphics-panel` — HTML/CSS/JS customizado por
painel, em vez dos painéis nativos do Grafana) — regra fixa do projeto, sem
exceção (ver `STANDARDS.md`).

Este repositório não guarda o Grafana em si, só os artefatos usados para
**gerar, versionar e documentar** os dashboards: scripts geradores, backups/
snapshots do que está publicado, e o histórico de decisões de cada um.

## Por que isso existe

Editar um dashboard feito de painéis HTML Graphics diretamente pela UI do Grafana é
inviável (o código de cada painel é extenso e repetitivo entre dezenas de
painéis quase-idênticos de um mesmo dashboard, que só variam por host/query). O
fluxo aqui é: um script Node monta o JSON completo do dashboard a partir de
templates reutilizáveis, valida antes de publicar, e
publica via `POST /api/dashboards/db`. Isso também é o que permite que uma sessão
do Claude, meses depois, retome exatamente de onde parou — sem o histórico escrito,
cada ajuste de fonte/cor/layout viraria tentativa e erro do zero.

## Estrutura

```
.
├── CLAUDE.md                  # instruções que o Claude Code lê automaticamente nesta pasta
├── STANDARDS.md               # padrão visual e técnico compartilhado + workflow passo a passo
├── dashboards/                # 1 markdown por dashboard: contexto, arquitetura e changelog
│   ├── paineis-solares-fronius.md
│   └── monitoramento-de-cameras.md
└── scripts/                   # 1 pasta por dashboard, com o script gerador e backups/snapshots
    ├── paineis-solares-fronius/
    │   ├── generate_dashboard.js       # monta o JSON do dashboard
    │   ├── validate_js.js              # valida sintaxe do JS de cada painel antes de publicar
    │   ├── mock_single.js              # harness pra testar lógica de dados sem navegador
    │   └── last-deployed-snapshot.json # snapshot da última versão publicada (referência/rollback)
    └── monitoramento-de-cameras/
        ├── generate_dashboard.js
        ├── query_templates.json            # SQL reaproveitado da v2, extraído do dashboard ao vivo
        ├── mock_panel.js                   # harness de mock genérico
        ├── backup_v1.json
        └── last-deployed-snapshot.json
```

## Por onde começar

- **Vai mexer em algum dashboard, ou criar um novo?** Leia `CLAUDE.md` primeiro
  (visão geral + regras obrigatórias), depois `STANDARDS.md` (o workflow passo a
  passo está logo no topo) e o markdown específico em `dashboards/<nome>.md`
  (histórico daquele dashboard, se já existir).
- **Só quer entender o que já existe?** A lista de dashboards documentados está em
  `dashboards/`; cada um tem sua URL, UID e arquitetura descritos no topo do
  respectivo markdown.

## Dashboards atuais

Todos em HTML Graphics (ver "Por que isso existe" acima).

| Dashboard | Documento | Uso |
|---|---|---|
| Painéis Solares - Fronius | [`dashboards/paineis-solares-fronius.md`](dashboards/paineis-solares-fronius.md) | TV de monitoramento, geração solar em tempo real |
| Monitoramento de Câmeras | [`dashboards/monitoramento-de-cameras.md`](dashboards/monitoramento-de-cameras.md) | TV de monitoramento, status de NVRs e câmeras |

## Credenciais

O token de acesso ao Grafana (Service Account, prefixo `glsa_...`) **nunca** é
versionado neste repositório — é pedido ao usuário a cada sessão. A instância do
Grafana roda na rede local e não é acessível pela internet.
