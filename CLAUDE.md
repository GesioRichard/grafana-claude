# Instruções para este repositório (dashboards Grafana — TV ATALAIA)

Esta pasta guarda os dashboards Grafana customizados usados em TVs de monitoramento.
Cada dashboard tem um script gerador de JSON e um documento de histórico próprio.

## Antes de alterar qualquer dashboard

1. Leia `STANDARDS.md` — padrões visuais e técnicos compartilhados (paleta, schema do
   plugin HTML Graphics, gotchas conhecidos, workflow de publicação, método de
   cálculo de fonte para TV).
2. Leia o markdown específico em `dashboards/<nome-do-dashboard>.md` — contexto e
   histórico daquele dashboard (ele pode ter meses de decisões que não estão em
   nenhum outro lugar).
3. O script gerador de cada dashboard fica em `scripts/<nome-do-dashboard>/`.

## Regra obrigatória de atualização da documentação

Sempre que você (Claude) publicar uma nova versão de um dashboard (nova `version` no
Grafana) **ou** decidir/alterar algo que muda a identidade visual compartilhada:

- Atualize a seção "Histórico de versões" do markdown do dashboard em `dashboards/`
  com o que mudou e por quê.
- Se a mudança alterou um padrão **compartilhado** entre dashboards (cor, tipografia,
  algoritmo de eixo de tempo, técnica de fundo, etc.), atualize também `STANDARDS.md`.
- Isso não é opcional — é o que permite que uma sessão futura, meses depois, resgate
  o contexto sem precisar redescobrir tudo do zero (ex.: o gotcha do `refId` levou
  várias rodadas de diagnóstico pra ser encontrado da primeira vez).

## Segurança

Nunca escreva o token de acesso do Grafana (`glsa_...`) em nenhum arquivo deste
repositório. Peça ao usuário a cada sessão.
