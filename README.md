# Giro Vendas Desktop — versão baseada no código-fonte original

Esta pasta já está preparada para ser colocada em um repositório GitHub e gerar o instalador Windows pelo GitHub Actions.

## O que esta versão preserva do aplicativo original

A adaptação usa o mesmo modelo de dados do projeto mobile, em SQLite:

- `config`
- `clients`
- `products`
- `sales`
- `sale_items`
- `installments`
- `visits`
- `visit_plans`
- `expenses`
- `goals`

Também reproduz as principais regras encontradas na fonte:

- dashboard diário/mensal;
- meta do mês;
- alerta de estoque mínimo;
- parcelas vencidas;
- produtos/clientes ativos;
- fluxo de nova venda em 5 etapas;
- desconto por item;
- cinco formas de pagamento;
- parcelamento para cartão e a prazo;
- juros em cartão/a prazo;
- criação de parcelas para venda a prazo;
- baixa de estoque na venda;
- restauração do estoque ao cancelar o pedido;
- alteração de status para entregue/cancelado;
- financeiro com registro de pagamentos;
- despesas;
- relatórios;
- top produtos e top clientes;
- plano de visitas;
- check-in/check-out;
- assistente offline;
- configuração de vendedor/empresa;
- meta mensal;
- backup JSON;
- importação de backup JSON do mobile;
- modo claro/escuro/sistema.

## Como gerar o .EXE sem terminal no seu computador

1. Crie um repositório no GitHub.
2. Envie todos os arquivos desta pasta pelo navegador do GitHub.
3. Abra **Actions**.
4. Selecione **Build Giro Vendas para Windows**.
5. Clique em **Run workflow**.
6. Espere o workflow terminar.
7. Abra a execução concluída.
8. Em **Artifacts**, baixe `Giro-Vendas-Windows`.
9. Dentro do ZIP estará `Giro-Vendas-Desktop-Setup.exe`.

O computador que vai usar o Giro Vendas não precisa ter Node.js, Electron, SQLite ou qualquer ferramenta de programação instalada.

## Migração dos dados do celular

O app mobile original já possui exportação de backup JSON. Nesta versão desktop existe uma opção para importar o JSON.

Quando o desktop estiver instalado:

**Configurações → Dados → Importar backup completo**

Isso permite transportar `config`, clientes, produtos, vendas, itens, parcelas, visitas, despesas e metas, desde que o JSON tenha sido exportado pelo Giro Vendas original.

## Observação sobre a versão 1.2.0

O projeto original enviado pelo usuário é Expo/React Native e foi usado como referência de comportamento e banco. A interface desktop não reaproveita os componentes React Native diretamente; ela foi redesenhada para mouse, teclado e telas grandes, usando Electron.

O banco, nomes das tabelas e principais regras de negócio foram mantidos para facilitar compatibilidade de dados.
