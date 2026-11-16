# Grafana Claude — Dashboards TV ATALAIA

Repositório de apoio para criar e manter os dashboards Grafana customizados
exibidos nas TVs de monitoramento da ATALAIA. Cada dashboard é construído em cima
do plugin **HTML Graphics** (painéis com HTML/CSS/JS próprio, em vez dos painéis
nativos do Grafana), gerado a partir de um script Node e publicado via API — não
há edição manual pela UI do Grafana para essas mudanças.

Este repositório não guarda o Grafana em si, só os artefatos usados para
**gerar, versionar e documentar** os dashboards: scripts geradores, backups/
snapshots do que está publicado, e o histórico de decisões de cada um.

## Por que isso existe

Editar um dashboard feito de painéis HTML Graphics diretamente pela UI do Grafana é
inviável (o código de cada painel é extenso e repetitivo entre os 10+ cards de um
mesmo dashboard). O fluxo aqui é: um script Node monta o JSON completo do
dashboard a partir de templates de HTML/CSS/JS reutilizáveis, valida a sintaxe, e
publica via `POST /api/dashboards/db`. Isso também é o que permite que uma sessão
do Claude, meses depois, retome exatamente de onde parou — sem o histórico escrito,
cada ajuste de fonte/cor/layout viraria tentativa e erro do zero.

## Estrutura

```
.
├── CLAUDE.md                  # instruções que o Claude Code lê automaticamente nesta pasta
├── STANDARDS.md               # padrão visual e técnico compartilhado entre todos os dashboards
├── dashboards/                # 1 markdown por dashboard: contexto, arquitetura e changelog
│   └── paineis-solares-fronius.md
└── scripts/                   # 1 pasta por dashboard, com o script gerador e scripts de apoio
    └── paineis-solares-fronius/
        ├── generate_dashboard.js       # monta o JSON do dashboard
        ├── validate_js.js              # valida sintaxe do JS de cada painel antes de publicar
        ├── mock_weekly.js              # exemplo de harness pra testar lógica de dados sem navegador
        └── last-deployed-snapshot.json # snapshot da última versão publicada (referência/rollback)
```

## Por onde começar

- **Vai mexer em algum dashboard?** Leia `CLAUDE.md` primeiro (regras obrigatórias),
  depois `STANDARDS.md` (padrão visual/técnico) e o markdown específico em
  `dashboards/<nome>.md` (histórico daquele dashboard).
- **Só quer entender o que já existe?** A lista de dashboards documentados está em
  `dashboards/`; cada um tem sua URL, UID e arquitetura descritos no topo do
  respectivo markdown.

## Dashboards atuais

| Dashboard | Documento | Uso |
|---|---|---|
| Painéis Solares - Fronius | [`dashboards/paineis-solares-fronius.md`](dashboards/paineis-solares-fronius.md) | TV de monitoramento, geração solar em tempo real |

## Credenciais

O token de acesso ao Grafana (Service Account, prefixo `glsa_...`) **nunca** é
versionado neste repositório — é pedido ao usuário a cada sessão. A instância do
Grafana roda na rede local e não é acessível pela internet.
