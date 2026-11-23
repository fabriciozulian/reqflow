# Modelagem UML do Banco de Dados — ReqFlow (`marketplace_db`)

Este documento apresenta a modelagem completa do banco de dados relacional **`marketplace_db`** (MariaDB / InnoDB) em **notação de Diagrama de Classes UML (`classDiagram`)**, **Diagrama Entidade-Relacionamento (`erDiagram`)** e **Dicionário de Dados Técnico**.

---

## 1. Diagrama de Classes UML do Banco de Dados (`classDiagram`)

O diagrama abaixo representa as **12 tabelas** do banco de dados do **ReqFlow** em formato UML, destacando chaves primárias (`PK`), chaves estrangeiras (`FK`), chaves únicas (`UK`), tipos de dados e multiplicidades (`1`, `0..1`, `0..*`, `1..*`):

```mermaid
classDiagram
    direction TB

    class tipo_pessoa {
        <<Table>>
        +INT tipo_pessoa_id [PK]
        +VARCHAR(45) tipo [UK]
    }

    class pessoa {
        <<Table>>
        +INT pessoa_id [PK]
        +INT tipo_pessoa_id [FK]
        +VARCHAR(100) nome
        +VARCHAR(120) email
        +VARCHAR(10) cep
        +VARCHAR(150) logradouro
        +VARCHAR(20) numero
        +VARCHAR(60) complemento
        +VARCHAR(80) bairro
        +VARCHAR(80) cidade
        +CHAR(2) uf
        +VARCHAR(60) pais
        +VARCHAR(18) cpf_cnpj [UK]
        +VARCHAR(20) telefone
        +DECIMAL(12,2) limite
        +BOOLEAN ativo
    }

    class gersys_pessoa {
        <<Table>>
        +INT gersys_pessoa_id [PK]
        +INT pessoa_id [FK, UK]
        +VARCHAR(120) gersys_email [UK]
        +VARCHAR(255) gersys_senha_hash
        +ENUM gersys_perfil
        +BOOLEAN gersys_ativo
    }

    class categoria {
        <<Table>>
        +INT categoria_id [PK]
        +VARCHAR(80) categoria_nome [UK]
    }

    class mercadoria {
        <<Table>>
        +INT mercadoria_id [PK]
        +INT categoria_id [FK]
        +VARCHAR(40) codigo [UK]
        +VARCHAR(120) nome
        +VARCHAR(80) marca
        +DECIMAL(12,2) valor_venda
        +INT estoque
        +BOOLEAN ativo
    }

    class tipo_movimento {
        <<Table>>
        +INT tipo_movimento_id [PK]
        +VARCHAR(60) nome [UK]
        +ENUM tipo_interno
        +BOOLEAN ativo
    }

    class conta_financeira {
        <<Table>>
        +INT conta_financeira_id [PK]
        +VARCHAR(100) nome [UK]
        +ENUM tipo
        +DECIMAL(12,2) saldo_inicial
        +DECIMAL(12,2) saldo_atual
        +BOOLEAN ativo
        +TIMESTAMP data_criacao
    }

    class forma_pagamento {
        <<Table>>
        +INT forma_pagamento_id [PK]
        +VARCHAR(80) nome [UK]
        +INT conta_financeira_padrao_id [FK]
        +BOOLEAN tipo_pix
        +BOOLEAN baixa_automatica
        +ENUM tipo_conta_permitida
        +BOOLEAN ativo
    }

    class requisicao {
        <<Table>>
        +INT requisicao_id [PK]
        +INT pessoa_id [FK]
        +INT tipo_movimento_id [FK]
        +INT usuario_id [FK]
        +INT forma_pagamento_id [FK]
        +INT conta_financeira_id [FK]
        +DATE data_vencimento
        +ENUM requisicao_situacao
        +VARCHAR(255) observacao
        +TIMESTAMP data_criacao
    }

    class item_requisicao {
        <<Table>>
        +INT item_requisicao_id [PK]
        +INT requisicao_id [FK]
        +INT mercadoria_id [FK]
        +INT quantidade
        +DECIMAL(12,2) valor
        +DECIMAL(12,2) desconto
    }

    class movimentacao {
        <<Table>>
        +INT movimentacao_id [PK]
        +INT requisicao_id [FK]
        +INT item_requisicao_id [FK]
        +INT mercadoria_id [FK]
        +INT tipo_movimento_id [FK]
        +INT quantidade
        +DECIMAL(12,2) valor_unitario
        +TIMESTAMP data_movimentacao
    }

    class titulo_financeiro {
        <<Table>>
        +INT titulo_id [PK]
        +INT requisicao_id [FK]
        +INT pessoa_id [FK]
        +INT forma_pagamento_id [FK]
        +INT conta_financeira_id [FK]
        +ENUM tipo
        +VARCHAR(200) descricao
        +DECIMAL(12,2) valor
        +DATE data_vencimento
        +DATETIME data_pagamento
        +ENUM situacao
        +TIMESTAMP data_criacao
    }

    class movimento_financeiro {
        <<Table>>
        +INT movimento_financeiro_id [PK]
        +INT conta_financeira_id [FK]
        +INT titulo_id [FK]
        +ENUM tipo
        +DECIMAL(12,2) valor
        +VARCHAR(255) historico
        +TIMESTAMP data_movimento
    }

    %% Relacionamentos e Multiplicidades UML
    tipo_pessoa "1" --> "0..*" pessoa : classifica
    pessoa "1" --> "0..1" gersys_pessoa : credencial_acesso
    categoria "1" --> "0..*" mercadoria : agrupa
    pessoa "1" --> "0..*" requisicao : cliente_fornecedor
    gersys_pessoa "1" --> "0..*" requisicao : operador_responsavel
    tipo_movimento "1" --> "0..*" requisicao : define_fluxo
    forma_pagamento "0..1" --> "0..*" requisicao : condicao_pagto
    conta_financeira "0..1" --> "0..*" requisicao : conta_baixa_auto
    requisicao "1" *-- "1..*" item_requisicao : possui_itens
    mercadoria "1" --> "0..*" item_requisicao : referenciada_em
    requisicao "1" --> "0..*" movimentacao : gera_rastro
    item_requisicao "1" --> "0..1" movimentacao : origina_movimento
    mercadoria "1" --> "0..*" movimentacao : movimenta_saldo
    tipo_movimento "1" --> "0..*" movimentacao : classifica_movimento
    requisicao "0..1" --> "0..1" titulo_financeiro : gera_titulo
    pessoa "1" --> "0..*" titulo_financeiro : titular
    forma_pagamento "1" --> "0..*" titulo_financeiro : modalidade
    conta_financeira "0..1" --> "0..*" titulo_financeiro : liquidado_em
    conta_financeira "1" --> "0..*" movimento_financeiro : compoe_extrato
    titulo_financeiro "0..1" --> "0..*" movimento_financeiro : origina_lancamento
```

---

## 2. Diagrama Entidade-Relacionamento (Notação Pé de Galinha / Crow's Foot)

```mermaid
erDiagram
    TIPO_PESSOA ||--o{ PESSOA : "1:N"
    PESSOA ||--o| GERSYS_PESSOA : "1:1"
    CATEGORIA ||--o{ MERCADORIA : "1:N"
    PESSOA ||--o{ REQUISICAO : "1:N"
    GERSYS_PESSOA ||--o{ REQUISICAO : "1:N"
    TIPO_MOVIMENTO ||--o{ REQUISICAO : "1:N"
    FORMA_PAGAMENTO |o--o{ REQUISICAO : "1:N"
    CONTA_FINANCEIRA |o--o{ REQUISICAO : "1:N"
    REQUISICAO ||--|{ ITEM_REQUISICAO : "1:N"
    MERCADORIA ||--o{ ITEM_REQUISICAO : "1:N"
    REQUISICAO ||--o{ MOVIMENTACAO : "1:N"
    ITEM_REQUISICAO ||--o| MOVIMENTACAO : "1:1"
    MERCADORIA ||--o{ MOVIMENTACAO : "1:N"
    TIPO_MOVIMENTO ||--o{ MOVIMENTACAO : "1:N"
    REQUISICAO |o--o| TITULO_FINANCEIRO : "1:1"
    PESSOA ||--o{ TITULO_FINANCEIRO : "1:N"
    FORMA_PAGAMENTO ||--o{ TITULO_FINANCEIRO : "1:N"
    CONTA_FINANCEIRA |o--o{ TITULO_FINANCEIRO : "1:N"
    CONTA_FINANCEIRA ||--o{ MOVIMENTO_FINANCEIRO : "1:N"
    TITULO_FINANCEIRO |o--o{ MOVIMENTO_FINANCEIRO : "1:N"
```

---

## 3. Dicionário de Dados e Restrições de Integridade

### 3.1. Domínio de Cadastros e Segurança
| Tabela | Chave Primária (`PK`) | Chaves Estrangeiras (`FK`) | Restrições (`UNIQUE` / `CHECK`) |
| :--- | :--- | :--- | :--- |
| **`tipo_pessoa`** | `tipo_pessoa_id` | — | `UK(tipo)` (`CLIENTE`, `FORNECEDOR`, `FUNCIONARIO`) |
| **`pessoa`** | `pessoa_id` | `tipo_pessoa_id -> tipo_pessoa` (`RESTRICT`) | `UK(cpf_cnpj)` |
| **`gersys_pessoa`** | `gersys_pessoa_id` | `pessoa_id -> pessoa` (`RESTRICT`) | `UK(pessoa_id)`, `UK(gersys_email)`, `ENUM('ADMIN','OPERADOR')` |
| **`categoria`** | `categoria_id` | — | `UK(categoria_nome)` |
| **`mercadoria`** | `mercadoria_id` | `categoria_id -> categoria` (`RESTRICT`) | `UK(codigo)`, `CHECK(estoque >= 0)`, `CHECK(valor_venda >= 0)` |

### 3.2. Domínio Operacional (Requisições e Estoque)
| Tabela | Chave Primária (`PK`) | Chaves Estrangeiras (`FK`) | Restrições (`UNIQUE` / `CHECK`) |
| :--- | :--- | :--- | :--- |
| **`tipo_movimento`** | `tipo_movimento_id` | — | `UK(nome)`, `ENUM('ENTRADA','SAIDA','NEUTRO')` |
| **`requisicao`** | `requisicao_id` | `pessoa_id -> pessoa`, `tipo_movimento_id -> tipo_movimento`, `usuario_id -> gersys_pessoa`, `forma_pagamento_id -> forma_pagamento`, `conta_financeira_id -> conta_financeira` | `ENUM('ABERTA','FINALIZADA','CANCELADA')` |
| **`item_requisicao`** | `item_requisicao_id` | `requisicao_id -> requisicao` (`RESTRICT`), `mercadoria_id -> mercadoria` (`RESTRICT`) | `CHECK(quantidade > 0)`, `CHECK(desconto >= 0)` |
| **`movimentacao`** | `movimentacao_id` | `requisicao_id -> requisicao`, `item_requisicao_id -> item_requisicao`, `mercadoria_id -> mercadoria`, `tipo_movimento_id -> tipo_movimento` | `CHECK(quantidade > 0)` |

### 3.3. Domínio Financeiro e Fluxo de Caixa
| Tabela | Chave Primária (`PK`) | Chaves Estrangeiras (`FK`) | Restrições (`UNIQUE` / `CHECK`) |
| :--- | :--- | :--- | :--- |
| **`conta_financeira`** | `conta_financeira_id` | — | `UK(nome)`, `ENUM('CAIXA','BANCO')` |
| **`forma_pagamento`** | `forma_pagamento_id` | `conta_financeira_padrao_id -> conta_financeira` (`SET NULL`) | `UK(nome)`, `tipo_conta_permitida ENUM('CAIXA','BANCO','AMBOS')` |
| **`titulo_financeiro`** | `titulo_id` | `requisicao_id -> requisicao` (`SET NULL`), `pessoa_id -> pessoa` (`RESTRICT`), `forma_pagamento_id -> forma_pagamento` (`RESTRICT`), `conta_financeira_id -> conta_financeira` (`RESTRICT`) | `tipo ENUM('PAGAR','RECEBER')`, `situacao ENUM('PENDENTE','PAGO','CANCELADO')` |
| **`movimento_financeiro`** | `movimento_financeiro_id` | `conta_financeira_id -> conta_financeira` (`RESTRICT`), `titulo_id -> titulo_financeiro` (`SET NULL`) | `tipo ENUM('ENTRADA','SAIDA')` |
