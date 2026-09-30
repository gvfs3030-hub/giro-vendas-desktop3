# Mapeamento entre o código-fonte mobile e o desktop

## Navegação e módulos encontrados

- `app/tabs/home.tsx` → Dashboard desktop
- `app/tabs/sell.tsx` → Nova venda
- `app/tabs/clients/index.tsx` → Clientes
- `app/tabs/orders/index.tsx` → Pedidos
- `app/products.tsx` → Produtos
- `app/product-add.tsx` → Cadastro de produto
- `app/product/[id]/index.tsx` → Detalhe do produto
- `app/product/[id]/edit.tsx` → Edição de produto
- `app/client-add.tsx` → Cadastro de cliente
- `app/client/[id]/index.tsx` → Detalhe do cliente
- `app/client/[id]/edit.tsx` → Edição de cliente
- `app/new-sale/index.tsx` → Etapa 1: cliente
- `app/new-sale/products.tsx` → Etapa 2: produtos
- `app/new-sale/cart.tsx` → Etapa 3: carrinho
- `app/new-sale/payment.tsx` → Etapa 4: pagamento
- `app/new-sale/confirmation.tsx` → Etapa 5: confirmação
- `app/financial.tsx` → Financeiro
- `app/expense-add.tsx` → Nova despesa
- `app/expenses.tsx` → Lista de despesas
- `app/reports.tsx` → Relatórios
- `app/visit-plan.tsx` → Diário/plano de visitas
- `app/routes.tsx` → Check-in/check-out
- `app/assistant.tsx` → Assistente offline
- `app/settings.tsx` → Configurações
- `app/import-backup.tsx` → Importação de clientes/produtos
- `app/setup/index.tsx` → Configuração inicial
- `app/onboarding/index.tsx` → Onboarding mobile

## Banco original

A estrutura foi copiada de `src/database/database.ts`, incluindo as tabelas de vendas e parcelas que são importantes para o financeiro.

## Regra do pagamento a prazo

O app original cria registros em `installments` somente quando:

- `paymentMethod === 'prazo'`
- `installmentCount > 1`

O valor das parcelas considera juros:

`totalComJuros = total * (1 + interestRate / 100)`

e:

`installmentValue = totalComJuros / installmentCount`

O desktop preserva essa regra.

## Regra de estoque

Na confirmação da venda o app original faz:

`stockCurrent = MAX(0, stockCurrent - quantity)`

Ao cancelar o pedido, o estoque dos itens é restaurado.

O desktop preserva essas duas operações.

## Compatibilidade de backup

O mobile gera JSON contendo as tabelas locais. O desktop importa o JSON por ID e usa `INSERT OR REPLACE`, o que permite atualizar registros que já existam.
