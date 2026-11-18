# Instruções para este repositório (dashboards Grafana — TV ATALAIA)

## O que é este projeto

Este repositório **não é uma aplicação** — é o "código-fonte" de dashboards do
Grafana usados em TVs de monitoramento (sinalização digital) na empresa. Cada
dashboard do Grafana é tratado como artefato versionado: um script Node monta o
JSON completo do dashboard e publica via API (`POST /api/dashboards/db`). Não há
edição manual pela UI do Grafana para mudanças estruturais — a UI é só pra
visualização e para o usuário conferir o resultado na TV.

- **Instância Grafana**: `http://192.168.0.104:3000` (rede local, não acessível
  pela internet; confirme com o usuário se mudou).
- **Autenticação**: Service Account Token do Grafana (prefixo `glsa_...`).
  **Peça ao usuário no início de toda sessão** — nunca fica salvo em nenhum
  arquivo deste repositório (ver "Segurança" abaixo).
- Operações de dashboard (`GET/POST /api/dashboards/...`) funcionam com role
  **Editor**. Habilitar/alterar plugin exige role **Admin** — peça ao usuário pra
  promover o Service Account se precisar.

## Dashboards existentes

| Dashboard | Documento | Abordagem |
|---|---|---|
| Painéis Solares - Fronius | [`dashboards/paineis-solares-fronius.md`](dashboards/paineis-solares-fronius.md) | Plugin HTML Graphics (painéis 100% customizados em HTML/CSS/JS) |
| Monitoramento de Câmeras | [`dashboards/monitoramento-de-cameras.md`](dashboards/monitoramento-de-cameras.md) | Painéis nativos do Grafana (`stat`, `bargauge`, `table`, `state-timeline`) |

Cada um tem seu script gerador em `scripts/<nome-do-dashboard>/generate_dashboard.js`
e um backup/snapshot do JSON publicado na mesma pasta.

## Ao começar qualquer tarefa neste repositório

1. **Leia `STANDARDS.md` inteiro primeiro** — não é opcional nem "se sobrar
   tempo". Tem a paleta de cores, o schema de opções do plugin HTML Graphics (que
   não está documentado em lugar nenhum fora deste arquivo), gotchas de produção
   já resolvidos (ex.: `refId` não confiável — custou várias rodadas de
   diagnóstico pra descobrir da primeira vez) e o workflow de publicação passo a
   passo logo no topo do arquivo.
2. **Leia o markdown do dashboard específico** em `dashboards/<nome>.md` antes de
   mexer nele — tem meses de decisões, valores calibrados e pendências que não
   existem em nenhum outro lugar. Se a tarefa for sobre um dashboard que ainda não
   tem markdown, é um dashboard novo (ver seção abaixo).
3. Se o pedido do usuário citar um dashboard pelo nome/URL mas você não
   reconhecer de qual arquivo se trata, **pergunte antes de adivinhar** — ou peça
   a URL/UID do Grafana e confira contra a tabela acima.

## Pedido para criar um dashboard novo

Siga a seção "Workflow geral de alteração de dashboard" em `STANDARDS.md`
(inclui o passo específico pra dashboard novo: criar pasta em `scripts/<nome>/`,
decidir HTML Graphics vs. painéis nativos — critério na mesma seção — e criar
`dashboards/<nome>.md` do zero seguindo a estrutura dos exemplos existentes).
**Sempre feche a tarefa adicionando uma linha na tabela acima e na de
`README.md`.**

## Regra obrigatória de atualização da documentação

Sempre que você publicar uma nova versão de um dashboard (nova `version` no
Grafana) **ou** decidir/alterar algo que muda a identidade visual compartilhada:

- Atualize a seção "Histórico de versões" do markdown do dashboard em
  `dashboards/` com o que mudou e por quê.
- Se a mudança alterou um padrão **compartilhado** entre dashboards (cor,
  tipografia, algoritmo de eixo de tempo, técnica de fundo, workflow de teste,
  etc.), atualize também `STANDARDS.md`.
- **Sempre faça commit em português** (`git commit`) ao final de uma mudança
  publicada — não deixe trabalho pronto sem commitar. Isso não é opcional: é o
  que permite que uma sessão futura, meses depois, resgate o contexto sem
  precisar redescobrir tudo do zero ou repetir um diagnóstico já feito.

## Segurança

Nunca escreva o token de acesso do Grafana (`glsa_...`) em nenhum arquivo deste
repositório, nem em commits, nem em mensagens de commit. Peça ao usuário a cada
sessão nova.
