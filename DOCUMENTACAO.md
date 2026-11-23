# Documentação Técnica e Funcional — Sistema ReqFlow

O **ReqFlow** é um sistema integrado de **Gestão Comercial, Controle de Estoque e Fluxo Financeiro (ERP/SaaS)** construído em arquitetura cliente-servidor moderna, com interface **Single Page Application (SPA) em React + Tailwind CSS** e back-end **Node.js + Express + MariaDB** operando com transações atômicas (`ACID`) e bloqueio pessimista (`SELECT ... FOR UPDATE`).

---

## 1. Visão Geral da Arquitetura

```mermaid
flowchart LR
    subgraph Client["Camada de Apresentação (SPA React + Vite)"]
        UI["Interface SaaS (Tailwind CSS + Lucide)"]
        AC["AutocompleteSelect (Single & Multi-Tags)"]
        PR["Módulo de Impressão (@media print)"]
        QR["Gerador SVG QR Code PIX (ISO 18004)"]
    end

    subgraph Server["Camada de Aplicação (Node.js + Express)"]
        AUTH["Middleware JWT (authenticate / requireAdmin)"]
        R_PESS["Rotas Pessoas & Acessos (/api/pessoas)"]
        R_MERC["Rotas Mercadorias & Categorias (/api/mercadorias)"]
        R_REQ["Rotas Requisições & Estoque (/api/requisicoes)"]
        R_FIN["Rotas Financeiro & Caixa (/api/financeiro)"]
        R_REL["Rotas Relatórios Gerenciais (/api/relatorios)"]
        U_PIX["Motor EMV® BR Code PIX + CRC16"]
        U_PAG["Validador Espécie Conta x Forma Pagto"]
    end

    subgraph DB["Camada de Persistência (MariaDB - marketplace_db)"]
        T_CAD[("Cadastros (pessoa, mercadoria, categoria)")]
        T_OPE[("Operacional (requisicao, item_requisicao, movimentacao)")]
        T_FIN[("Financeiro (conta_financeira, forma_pagamento, titulo_financeiro, movimento_financeiro)")]
    end

    UI --> AUTH
    AC --> R_REL
    AC --> R_FIN
    AC --> R_REQ
    AUTH --> R_PESS
    AUTH --> R_MERC
    AUTH --> R_REQ
    AUTH --> R_FIN
    AUTH --> R_REL
    R_REQ --> U_PIX
    R_REQ --> U_PAG
    R_FIN --> U_PAG
    R_PESS --> T_CAD
    R_MERC --> T_CAD
    R_REQ --> T_OPE
    R_REQ --> T_FIN
    R_FIN --> T_FIN
    R_REL --> T_OPE
```

### Stack Tecnológica
| Camada | Tecnologia | Papel no Sistema |
| :--- | :--- | :--- |
| **Front-end** | React 18 + Vite 5 + React Router 6 | SPA reativa com navegação instantânea e rotas protegidas |
| **Estilização** | Tailwind CSS 3 + Lucide React | Design System SaaS, badges semânticos e layout responsivo/impressão |
| **Back-end** | Node.js + Express | API RESTful com autenticação stateless via JSON Web Token (`JWT`) |
| **Segurança** | `bcryptjs` + `jsonwebtoken` | Hash de senhas com salt e controle de perfil (`ADMIN` e `OPERADOR`) |
| **Banco de Dados** | MariaDB (`InnoDB`, `utf8mb4`) | Integridade referencial, `CHECK` constraints e bloqueio `FOR UPDATE` |

---

## 2. Diagrama de Casos de Uso

O diagrama abaixo representa as interações dos atores (**Operador Comercial/Financeiro** e **Administrador**) com os módulos do **ReqFlow**:

```mermaid
flowchart LR
    OP["👤 Ator: Operador"]
    ADM["🛡️ Ator: Administrador"]

    subgraph ModuloCadastros["Módulo de Cadastros e Acesso"]
        UC01["UC01 - Autenticar no Sistema (JWT)"]
        UC02["UC02 - Manter Pessoas (Clientes, Fornecedores, Funcionários)"]
        UC03["UC03 - Gerenciar Credenciais de Login de Funcionários"]
        UC04["UC04 - Manter Categorias e Mercadorias"]
        UC05["UC05 - Manter Tipos de Movimento (Entrada, Saída, Neutro)"]
    end

    subgraph ModuloComercial["Módulo Comercial e Estoque"]
        UC06["UC06 - Criar e Gerenciar Requisições Comerciais"]
        UC07["UC07 - Finalizar Requisição (Estoque + Título Financeiro)"]
        UC08["UC08 - Receber via QR Code PIX Estático (BACEN)"]
        UC09["UC09 - Imprimir / Reimprimir Documento de Requisição"]
    end

    subgraph ModuloFinanceiro["Módulo Financeiro e Caixa"]
        UC10["UC10 - Manter Contas Financeiras (Caixas e Bancos)"]
        UC11["UC11 - Manter Formas de Pagamento por Espécie Permitida"]
        UC12["UC12 - Lançar Títulos Avulsos (Contas a Pagar / Receber)"]
        UC13["UC13 - Realizar Baixa de Título e Emitir Recibo"]
        UC14["UC14 - Consultar Extrato de Caixa eRelatórios Multi-Tags"]
    end

    OP --> UC01
    OP --> UC02
    OP --> UC04
    OP --> UC05
    OP --> UC06
    OP --> UC07
    OP --> UC08
    OP --> UC09
    OP --> UC10
    OP --> UC11
    OP --> UC12
    OP --> UC13
    OP --> UC14

    ADM --> OP
    ADM --> UC03
```

---

## 3. Especificação Detalhada dos Casos de Uso

### UC01 — Autenticar no Sistema
- **Ator Principal:** Operador / Administrador.
- **Pré-condições:** Usuário deve possuir registro ativo em `gersys_pessoa` vinculado a um funcionário em `pessoa`.
- **Fluxo Principal:**
  1. O usuário informa `email` e `senha` na tela `/login`.
  2. O sistema valida o hash da senha com `bcrypt.compare` e verifica `gersys_ativo = TRUE`.
  3. O sistema emite um token JWT assinado contendo `{ id, pessoa_id, email, perfil, nome }` e redireciona para `/dashboard`.

### UC02 & UC03 — Gestão de Pessoas e Credenciais de Funcionários
- **Ator Principal:** Operador (UC02) e Administrador (UC03).
- **Regras de Negócio:**
  - Toda pessoa pertence a um tipo (`CLIENTE`, `FORNECEDOR` ou `FUNCIONARIO`).
  - O campo `cpf_cnpj` é único na base.
  - Exclusões realizam *soft delete* (`ativo = FALSE`) para preservar o histórico fiscal/financeiro.
  - Apenas registros do tipo `FUNCIONARIO` podem receber credenciais de acesso (`ADMIN` ou `OPERADOR`) na tabela `gersys_pessoa`.

### UC04 & UC05 — Gestão de Mercadorias, Categorias e Tipos de Movimento
- **Ator Principal:** Operador.
- **Regras de Negócio:**
  - Mercadorias possuem controle estrito de `estoque >= 0` e alertas visuais no Dashboard quando `estoque <= 5`.
  - Tipos de Movimento determinam o comportamento operacional e financeiro na finalização da requisição:
    - `SAIDA`: reduz estoque da mercadoria e gera título `RECEBER`.
    - `ENTRADA`: incrementa estoque da mercadoria e gera título `PAGAR`.
    - `NEUTRO`: registra movimentação histórica sem alterar saldo físico nem gerar título financeiro.

### UC06 & UC07 — Criar e Finalizar Requisição Comercial
- **Ator Principal:** Operador.
- **Pré-condições:** Pessoa, Tipo de Movimento, Forma de Pagamento e Mercadorias devem estar ativos.
- **Fluxo Principal (Criação):**
  1. O operador seleciona o Cliente/Fornecedor via `AutocompleteSelect` (busca a partir de 2 caracteres), o Tipo de Movimento, a Forma de Pagamento e a Data de Vencimento.
  2. **Regra Condicional de Baixa Automática:**
     - Se a Forma de Pagamento possuir `baixa_automatica = FALSE` (a prazo), o campo **Conta Financeira** permanece oculto.
     - Se a Forma de Pagamento possuir `baixa_automatica = TRUE` (à vista, ex: *Dinheiro*), o sistema exibe e exige o campo **Conta Financeira para Baixa**, filtrando apenas as contas ativas compatíveis com `tipo_conta_permitida` (`CAIXA`, `BANCO` ou `AMBOS`).
  3. A requisição nasce com situação `ABERTA`, permitindo adicionar ou remover itens (`item_requisicao`).
- **Fluxo Principal (Finalização Transacional):**
  1. O operador aciona **Finalizar Requisição** (`PATCH /api/requisicoes/:id/finalizar`).
  2. O sistema inicia uma transação SQL (`BEGIN`) e aplica `SELECT ... FOR UPDATE` na requisição, nos itens e em cada mercadoria.
  3. Para movimentos de `SAIDA`, valida se `mercadoria.estoque >= item.quantidade`. Caso haja saldo insuficiente em qualquer item, executa `ROLLBACK` imediato.
  4. Atualiza o estoque de cada mercadoria e grava o rastro em `movimentacao`.
  5. Calcula o valor líquido total $\sum (\text{quantidade} \times \text{valor} - \text{desconto})$ e gera o título em `titulo_financeiro`:
     - **Quando `baixa_automatica = TRUE`:** O título já nasce com `situacao = 'PAGO'`, `data_pagamento = NOW()` e `conta_financeira_id` preenchido; insere o lançamento em `movimento_financeiro` (`ENTRADA` ou `SAIDA`) e atualiza imediatamente o `saldo_atual` da `conta_financeira`.
     - **Quando `baixa_automatica = FALSE`:** O título nasce com `situacao = 'PENDENTE'` e `conta_financeira_id = NULL` para liquidação futura no Financeiro.
  6. Caso seja uma venda (`SAIDA`) com modalidade `tipo_pix = TRUE`, retorna o payload EMV® BR Code oficial do Banco Central (chave `19983354118`, recebedor `ReqFlow`, cidade `Americana`, CRC16-CCITT) e abre o modal de QR Code PIX.

### UC11 & UC13 — Regras de Espécie de Conta e Baixa de Títulos Financeiros
- **Ator Principal:** Operador Financeiro.
- **Regras de Negócio:**
  - Cada `forma_pagamento` define `tipo_conta_permitida ENUM('CAIXA', 'BANCO', 'AMBOS')`.
  - No modal **Realizar Baixa** (`/financeiro`):
    1. A **Forma de Pagamento** original do título vem pré-selecionada e bloqueada (`disabled`) por padrão.
    2. O seletor de **Conta Financeira** exibe exclusivamente as contas ativas compatíveis com a espécie permitida pela forma do título (ex: *Dinheiro* lista apenas `CAIXA`; *Boleto* lista apenas `BANCO`; *PIX/Cartão* lista `AMBOS`).
    3. Caso o operador marque o checkbox **"Alterar forma de pagamento/recebimento"**, o seletor de forma de pagamento é desbloqueado e a lista de contas financeiras se adapta dinamicamente à nova forma escolhida.
    4. Após a baixa, o operador pode emitir o **Recibo de Pagamento / Recebimento** formatado para impressão (`@media print`).

---

## 4. Diagrama Entidade-Relacionamento (DER)

```mermaid
erDiagram
    TIPO_PESSOA ||--o{ PESSOA : "classifica"
    PESSOA ||--o| GERSYS_PESSOA : "possui login"
    CATEGORIA ||--o{ MERCADORIA : "agrupa"
    PESSOA ||--o{ REQUISICAO : "solicita"
    GERSYS_PESSOA ||--o{ REQUISICAO : "registra"
    TIPO_MOVIMENTO ||--o{ REQUISICAO : "define operacao"
    FORMA_PAGAMENTO ||--o{ REQUISICAO : "condicao comercial"
    CONTA_FINANCEIRA |o--o{ REQUISICAO : "conta baixa auto"
    REQUISICAO ||--|{ ITEM_REQUISICAO : "contem"
    MERCADORIA ||--o{ ITEM_REQUISICAO : "compoe"
    REQUISICAO ||--o{ MOVIMENTACAO : "gera historico"
    ITEM_REQUISICAO ||--|| MOVIMENTACAO : "origina"
    REQUISICAO |o--o| TITULO_FINANCEIRO : "fatura"
    PESSOA ||--o{ TITULO_FINANCEIRO : "devedor ou credor"
    FORMA_PAGAMENTO ||--o{ TITULO_FINANCEIRO : "modalidade"
    CONTA_FINANCEIRA |o--o{ TITULO_FINANCEIRO : "liquidado em"
    CONTA_FINANCEIRA ||--o{ MOVIMENTO_FINANCEIRO : "extrato"
    TITULO_FINANCEIRO |o--o{ MOVIMENTO_FINANCEIRO : "gera lancamento"

    PESSOA {
        int pessoa_id PK
        int tipo_pessoa_id FK
        varchar nome
        varchar cpf_cnpj UK
        decimal limite
        boolean ativo
    }
    GERSYS_PESSOA {
        int gersys_pessoa_id PK
        int pessoa_id FK
        varchar gersys_email UK
        varchar gersys_senha_hash
        enum gersys_perfil "ADMIN, OPERADOR"
        boolean gersys_ativo
    }
    MERCADORIA {
        int mercadoria_id PK
        int categoria_id FK
        varchar codigo UK
        varchar nome
        decimal valor_venda
        int estoque
        boolean ativo
    }
    TIPO_MOVIMENTO {
        int tipo_movimento_id PK
        varchar nome UK
        enum tipo_interno "ENTRADA, SAIDA, NEUTRO"
        boolean ativo
    }
    CONTA_FINANCEIRA {
        int conta_financeira_id PK
        varchar nome UK
        enum tipo "CAIXA, BANCO"
        decimal saldo_inicial
        decimal saldo_atual
        boolean ativo
    }
    FORMA_PAGAMENTO {
        int forma_pagamento_id PK
        varchar nome UK
        boolean tipo_pix
        boolean baixa_automatica
        enum tipo_conta_permitida "CAIXA, BANCO, AMBOS"
        boolean ativo
    }
    REQUISICAO {
        int requisicao_id PK
        int pessoa_id FK
        int tipo_movimento_id FK
        int usuario_id FK
        int forma_pagamento_id FK
        int conta_financeira_id FK
        date data_vencimento
        enum requisicao_situacao "ABERTA, FINALIZADA, CANCELADA"
    }
    TITULO_FINANCEIRO {
        int titulo_id PK
        int requisicao_id FK
        int pessoa_id FK
        int forma_pagamento_id FK
        int conta_financeira_id FK
        enum tipo "PAGAR, RECEBER"
        decimal valor
        date data_vencimento
        datetime data_pagamento
        enum situacao "PENDENTE, PAGO, CANCELADO"
    }
    MOVIMENTO_FINANCEIRO {
        int movimento_financeiro_id PK
        int conta_financeira_id FK
        int titulo_id FK
        enum tipo "ENTRADA, SAIDA"
        decimal valor
        varchar historico
        timestamp data_movimento
    }
```

---

## 5. Diagramas de Sequência dos Fluxos Críticos

### 5.1. Finalização de Requisição (Com Baixa Automática vs. A Prazo / PIX)

```mermaid
sequenceDiagram
    autonumber
    actor OP as Operador
    participant SPA as React SPA (/requisicoes)
    participant API as API Express (requisicoes.js)
    participant DB as MariaDB (Transação ACID)

    OP->>SPA: Clica em "Finalizar Requisição"
    SPA->>API: PATCH /api/requisicoes/:id/finalizar { conta_financeira_id? }
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT requisicao, itens, mercadoria FOR UPDATE

    alt Estoque insuficiente (quando SAIDA)
        API->>DB: ROLLBACK
        API-->>SPA: HTTP 400 (Estoque insuficiente)
    else Estoque válido
        API->>DB: UPDATE mercadoria (estoque +/- qtd)
        API->>DB: INSERT INTO movimentacao

        alt Forma com baixa_automatica = TRUE (Ex: Dinheiro)
            API->>DB: Valida formaCompativel(forma, conta)
            API->>DB: INSERT INTO titulo_financeiro (situacao = 'PAGO', conta_id)
            API->>DB: UPDATE conta_financeira (saldo_atual +/- valor)
            API->>DB: INSERT INTO movimento_financeiro (ENTRADA / SAIDA)
        else Forma com baixa_automatica = FALSE (Ex: Boleto / PIX)
            API->>DB: INSERT INTO titulo_financeiro (situacao = 'PENDENTE', conta_id = NULL)
        end

        API->>DB: UPDATE requisicao SET requisicao_situacao = 'FINALIZADA'
        API->>DB: COMMIT
        API-->>SPA: HTTP 200 { requisicao, titulo_id, pix? }
    end

    opt Venda com Forma PIX (tipo_pix = TRUE)
        SPA->>OP: Exibe Modal com QR Code PIX SVG + Copia e Cola
        OP->>SPA: Seleciona Conta Compatível e clica em "Confirmar Recebimento PIX"
        SPA->>API: POST /api/requisicoes/:id/confirmar-pix { conta_financeira_id }
        API->>DB: Baixa título para PAGO + Credita saldo_atual + Gera Extrato
        API-->>SPA: HTTP 200 (PIX Confirmado)
    end
```

### 5.2. Baixa Financeira com Validação de Espécie de Conta

```mermaid
sequenceDiagram
    autonumber
    actor OP as Operador Financeiro
    participant SPA as React SPA (/financeiro)
    participant API as API Express (financeiro.js)
    participant DB as MariaDB (Transação ACID)

    OP->>SPA: Clica em "Realizar Baixa" em título PENDENTE
    SPA->>SPA: Bloqueia Forma de Pagto original (disabled = true)
    SPA->>SPA: Filtra Contas Ativas compatíveis com tipo_conta_permitida

    opt Operador marca "Alterar forma de pagamento/recebimento"
        OP->>SPA: Marca checkbox e escolhe nova Forma de Pagamento
        SPA->>SPA: Recalcula dropdown de Contas Financeiras compatíveis
    end

    OP->>SPA: Seleciona Conta Financeira compatível e confirma
    SPA->>API: POST /api/financeiro/titulos/:id/baixar
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT titulo_financeiro, conta_financeira FOR UPDATE
    API->>API: Valida formaCompativel(forma, conta)

    alt Conta incompatível com a Forma de Pagamento
        API->>DB: ROLLBACK
        API-->>SPA: HTTP 400 ("A conta selecionada não é compatível...")
    else Compatível
        API->>DB: UPDATE conta_financeira (saldo_atual +/- valor)
        API->>DB: INSERT INTO movimento_financeiro (ENTRADA / SAIDA)
        API->>DB: UPDATE titulo_financeiro SET situacao = 'PAGO', data_pagamento, conta_financeira_id, forma_pagamento_id
        API->>DB: COMMIT
        API-->>SPA: HTTP 200 (Título Liquidado)
    end
```

---

## 6. Diagramas de Estados

### Ciclo de Vida da Requisição e do Título Financeiro

```mermaid
stateDiagram-v2
    direction LR
    [*] --> ABERTA: POST /api/requisicoes
    ABERTA --> ABERTA: Adicionar / Remover Itens
    ABERTA --> CANCELADA: PATCH /:id/cancelar
    ABERTA --> FINALIZADA: PATCH /:id/finalizar

    state FINALIZADA {
        [*] --> VerificaForma
        VerificaForma --> TITULO_PAGO: baixa_automatica = TRUE
        VerificaForma --> TITULO_PENDENTE: baixa_automatica = FALSE
        TITULO_PENDENTE --> TITULO_PAGO: Baixa Manual ou Confirmação PIX
        TITULO_PENDENTE --> TITULO_CANCELADO: PATCH /titulos/:id/cancelar
    }
```

---

## 7. Mapa de Endpoints da API REST

| Módulo | Método e Rota | Descrição |
| :--- | :--- | :--- |
| **Autenticação** | `POST /api/auth/login` | Autentica credenciais e retorna token JWT |
| | `GET /api/auth/me` | Retorna dados do usuário autenticado |
| **Pessoas** | `GET /api/pessoas` | Lista clientes, fornecedores e funcionários |
| | `POST / PUT / DELETE /api/pessoas` | Cria, atualiza ou desativa pessoa |
| | `GET / POST / PUT /api/pessoas/:id/login` | Gerencia login de funcionário (`requireAdmin`) |
| **Mercadorias** | `GET / POST / PUT / DELETE /api/categorias` | CRUD de categorias de produtos |
| | `GET / POST / PUT / DELETE /api/mercadorias` | CRUD de mercadorias com filtro de busca e categoria |
| **Tipos de Mov.** | `GET / POST / PUT / DELETE /api/tipos-movimento` | CRUD de tipos (`ENTRADA`, `SAIDA`, `NEUTRO`) |
| | `PATCH /api/tipos-movimento/:id/toggle` | Ativa/desativa tipo de movimento |
| **Requisições** | `GET / POST /api/requisicoes` | Lista e cria requisições comerciais |
| | `POST / DELETE /api/requisicoes/:id/itens` | Gerencia itens de requisições `ABERTA` |
| | `PATCH /api/requisicoes/:id/finalizar` | Finaliza requisição, movimenta estoque e gera financeiro |
| | `POST /api/requisicoes/:id/confirmar-pix` | Liquida título PIX imediatamente na conta escolhida |
| | `GET /api/requisicoes/movimentacoes/todas` | Histórico geral de movimentações de estoque |
| **Financeiro** | `GET / POST / PUT /api/financeiro/contas` | CRUD de Contas Financeiras (`CAIXA` e `BANCO`) |
| | `GET / POST / PUT /api/financeiro/formas-pagamento` | CRUD de Formas de Pagamento (`CAIXA`, `BANCO`, `AMBOS`) |
| | `GET / POST /api/financeiro/titulos` | Lista títulos com totalizadores e cria lançamento avulso |
| | `POST /api/financeiro/titulos/:id/baixar` | Liquida título pendente, atualiza saldo e gera extrato |
| | `GET /api/financeiro/extrato` | Consulta extrato consolidado de entradas e saídas |
| **Relatórios** | `GET /api/relatorios/movimentacoes` | Relatório multi-filtro (`pessoa_ids`, `mercadoria_ids`, período) |
