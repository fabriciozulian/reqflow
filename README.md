# ReqFlow — Sistema Integrado de Gestão Comercial, Estoque e Financeiro

O **ReqFlow** é uma aplicação web completa (**Full-Stack ERP**) para controle de cadastros, estoque físico, requisições de compra e venda com **QR Code PIX estático (padrão BACEN)**, gestão de contas a pagar/receber por **espécie de conta (Caixa e Banco)** e relatórios gerenciais.

---

## Arquitetura e Tecnologias

- **Front-end (`frontend/`):** React 18, Vite 5, React Router DOM 6, Tailwind CSS 3 e Lucide Icons.
- **Back-end (`src/`):** Node.js, Express, autenticação JWT (`jsonwebtoken`) e criptografia de senhas (`bcryptjs`).
- **Banco de Dados (`database/`):** MariaDB (`InnoDB`, charset `utf8mb4`), com transações atômicas (`BEGIN / COMMIT / ROLLBACK`) e bloqueio pessimista (`SELECT ... FOR UPDATE`).

---

## Estrutura de Pastas do Projeto

```text
marketplace-app/
├── database/
│   └── init.sql                 # Script DDL completo do schema MariaDB
├── frontend/                    # Single Page Application (React + Vite + Tailwind CSS)
│   ├── dist/                    # Build otimizado de produção servido pelo Express
│   └── src/
│       ├── components/          # Layout, AutocompleteSelect, DataTable, Modal, Toast
│       ├── context/             # AuthContext (JWT) e ToastContext
│       ├── pages/               # 11 telas (Login, Dashboard, Pessoas, Mercadorias, etc.)
│       ├── services/            # Cliente HTTP (api.js) e formatadores
│       └── utils/               # Impressão (@media print) e Gerador SVG QR Code PIX
├── src/                         # Back-end Node.js + Express
│   ├── config/
│   │   └── database.js          # Pool de conexões MariaDB
│   ├── middleware/
│   │   └── auth.js              # Validação JWT e controle de perfil (ADMIN / OPERADOR)
│   ├── routes/                  # Endpoints REST (/api/auth, /pessoas, /requisicoes, /financeiro...)
│   └── utils/
│       ├── pagamento.js         # Regra de compatibilidade Espécie de Conta x Forma Pagto
│       └── pix.js               # Gerador de Payload EMV® BR Code PIX + CRC16-CCITT
├── DOCUMENTACAO.md              # Documentação de Casos de Uso e Diagramas (Mermaid/UML)
├── package.json                 # Scripts e dependências do servidor
├── server.js                    # Ponto de entrada da aplicação
└── start-dev.bat                # Inicializador rápido para desenvolvimento
```

---

## Como Executar

### 1. Modo Produção / Apresentação (Servidor Único na porta `3000`)
Com o serviço MariaDB ativo, execute na raiz do projeto:

```bash
npm start
```

Acesse no navegador: **`http://localhost:3000`**

### 2. Modo Desenvolvimento (API + Vite Hot Reload)
Execute o atalho `start-dev.bat` ou rode em dois terminais:

```bash
# Terminal 1 — API Back-end (porta 3000)
npm start

# Terminal 2 — Front-end React Vite (porta 5173)
npm run frontend:dev
```

---

## Credenciais de Acesso Padrão

| Perfil | E-mail | Senha |
| :--- | :--- | :--- |
| **Administrador** | `admin@marketplace.com` | `admin123` |
| **Operador** | `operador@reqflow.com` | `operador123` |
