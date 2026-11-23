-- ============================================================
-- REQFLOW (MARKETPLACE DB) - Script de Inicialização Completo
-- Banco: marketplace_db | MariaDB via XAMPP
-- ============================================================

-- Cria e seleciona o banco
CREATE DATABASE IF NOT EXISTS marketplace_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE marketplace_db;

-- ============================================================
-- TABELA: tipo_pessoa
-- ============================================================
CREATE TABLE IF NOT EXISTS tipo_pessoa (
  tipo_pessoa_id INT PRIMARY KEY AUTO_INCREMENT,
  tipo ENUM('CLIENTE','FORNECEDOR','FUNCIONARIO') NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: pessoa
-- ============================================================
CREATE TABLE IF NOT EXISTS pessoa (
  pessoa_id        INT PRIMARY KEY AUTO_INCREMENT,
  tipo_pessoa_id   INT NOT NULL,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  nome             VARCHAR(100) NOT NULL,
  email            VARCHAR(200),
  cep              CHAR(8),
  logradouro       VARCHAR(150),
  numero           VARCHAR(20),
  complemento      VARCHAR(100),
  bairro           VARCHAR(100),
  cidade           VARCHAR(100),
  uf               CHAR(2),
  pais             VARCHAR(100) NOT NULL DEFAULT 'Brasil',
  cpf_cnpj         VARCHAR(18) UNIQUE,
  telefone         VARCHAR(20),
  limite           DECIMAL(12,2) NOT NULL DEFAULT 0,
  data_criacao     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pessoa_tipo FOREIGN KEY (tipo_pessoa_id)
    REFERENCES tipo_pessoa(tipo_pessoa_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: gersys_pessoa (Usuários do sistema)
-- ============================================================
CREATE TABLE IF NOT EXISTS gersys_pessoa (
  gersys_pessoa_id  INT PRIMARY KEY AUTO_INCREMENT,
  pessoa_id         INT NOT NULL UNIQUE,
  gersys_email      VARCHAR(100) NOT NULL UNIQUE,
  gersys_senha_hash VARCHAR(255) NOT NULL,
  gersys_perfil     ENUM('ADMIN','OPERADOR') NOT NULL DEFAULT 'OPERADOR',
  gersys_ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_gersys_pessoa FOREIGN KEY (pessoa_id)
    REFERENCES pessoa(pessoa_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: categoria
-- ============================================================
CREATE TABLE IF NOT EXISTS categoria (
  categoria_id   INT PRIMARY KEY AUTO_INCREMENT,
  categoria_nome VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: mercadoria
-- ============================================================
CREATE TABLE IF NOT EXISTS mercadoria (
  mercadoria_id    INT PRIMARY KEY AUTO_INCREMENT,
  categoria_id     INT NOT NULL,
  codigo           VARCHAR(50) UNIQUE,
  nome             VARCHAR(100) NOT NULL,
  marca            VARCHAR(100),
  valor_venda      DECIMAL(12,2) NOT NULL,
  estoque          INT NOT NULL DEFAULT 0,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  data_criacao     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_estoque CHECK (estoque >= 0),
  CONSTRAINT fk_mercadoria_categoria FOREIGN KEY (categoria_id)
    REFERENCES categoria(categoria_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: tipo_movimento
-- ============================================================
CREATE TABLE IF NOT EXISTS tipo_movimento (
  tipo_movimento_id INT PRIMARY KEY AUTO_INCREMENT,
  nome              VARCHAR(100) NOT NULL UNIQUE,
  tipo_interno      ENUM('ENTRADA','SAIDA','NEUTRO') NOT NULL,
  ativo             BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: conta_financeira
-- ============================================================
CREATE TABLE IF NOT EXISTS conta_financeira (
  conta_financeira_id INT PRIMARY KEY AUTO_INCREMENT,
  nome                VARCHAR(100) NOT NULL UNIQUE,
  tipo                ENUM('CAIXA', 'BANCO') NOT NULL,
  saldo_inicial       DECIMAL(12,2) NOT NULL DEFAULT 0,
  saldo_atual         DECIMAL(12,2) NOT NULL DEFAULT 0,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: forma_pagamento
-- ============================================================
CREATE TABLE IF NOT EXISTS forma_pagamento (
  forma_pagamento_id         INT PRIMARY KEY AUTO_INCREMENT,
  nome                       VARCHAR(100) NOT NULL UNIQUE,
  tipo_pix                   BOOLEAN NOT NULL DEFAULT FALSE,
  baixa_automatica           BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_conta_permitida       ENUM('CAIXA','BANCO','AMBOS') NOT NULL DEFAULT 'AMBOS',
  conta_financeira_padrao_id INT NULL,
  ativo                      BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_forma_pagto_conta FOREIGN KEY (conta_financeira_padrao_id)
    REFERENCES conta_financeira(conta_financeira_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: requisicao
-- ============================================================
CREATE TABLE IF NOT EXISTS requisicao (
  requisicao_id       INT PRIMARY KEY AUTO_INCREMENT,
  pessoa_id           INT NOT NULL,
  tipo_movimento_id   INT NOT NULL,
  usuario_id          INT NOT NULL,
  forma_pagamento_id  INT NULL,
  conta_financeira_id INT NULL,
  data_vencimento     DATE NULL,
  requisicao_situacao ENUM('ABERTA','FINALIZADA','CANCELADA') NOT NULL DEFAULT 'ABERTA',
  observacao          VARCHAR(255),
  data_criacao        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_req_pessoa      FOREIGN KEY (pessoa_id)          REFERENCES pessoa(pessoa_id)                 ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_req_tipo_mov    FOREIGN KEY (tipo_movimento_id)  REFERENCES tipo_movimento(tipo_movimento_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_req_usuario     FOREIGN KEY (usuario_id)         REFERENCES gersys_pessoa(gersys_pessoa_id)   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_req_forma_pagto FOREIGN KEY (forma_pagamento_id) REFERENCES forma_pagamento(forma_pagamento_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: item_requisicao
-- ============================================================
CREATE TABLE IF NOT EXISTS item_requisicao (
  item_requisicao_id INT PRIMARY KEY AUTO_INCREMENT,
  requisicao_id      INT NOT NULL,
  mercadoria_id      INT NOT NULL,
  quantidade         INT NOT NULL,
  valor              DECIMAL(12,2) NOT NULL,
  desconto           DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT chk_item_qtd      CHECK (quantidade > 0),
  CONSTRAINT chk_item_desconto CHECK (desconto >= 0),
  CONSTRAINT fk_item_req        FOREIGN KEY (requisicao_id) REFERENCES requisicao(requisicao_id)   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_item_mercadoria FOREIGN KEY (mercadoria_id) REFERENCES mercadoria(mercadoria_id)   ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: movimentacao
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentacao (
  movimentacao_id    INT PRIMARY KEY AUTO_INCREMENT,
  requisicao_id      INT NOT NULL,
  item_requisicao_id INT NOT NULL,
  mercadoria_id      INT NOT NULL,
  tipo_movimento_id  INT NOT NULL,
  quantidade         INT NOT NULL,
  valor_unitario     DECIMAL(12,2) NOT NULL,
  data_movimentacao  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_mov_qtd CHECK (quantidade > 0),
  CONSTRAINT fk_mov_req      FOREIGN KEY (requisicao_id)      REFERENCES requisicao(requisicao_id)             ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mov_item     FOREIGN KEY (item_requisicao_id) REFERENCES item_requisicao(item_requisicao_id)   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mov_merc     FOREIGN KEY (mercadoria_id)      REFERENCES mercadoria(mercadoria_id)             ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mov_tipo     FOREIGN KEY (tipo_movimento_id)  REFERENCES tipo_movimento(tipo_movimento_id)     ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: titulo_financeiro
-- ============================================================
CREATE TABLE IF NOT EXISTS titulo_financeiro (
  titulo_id           INT PRIMARY KEY AUTO_INCREMENT,
  requisicao_id       INT NULL,
  pessoa_id           INT NOT NULL,
  forma_pagamento_id  INT NOT NULL,
  conta_financeira_id INT NULL,
  tipo                ENUM('PAGAR', 'RECEBER') NOT NULL,
  descricao           VARCHAR(200) NOT NULL,
  valor               DECIMAL(12,2) NOT NULL,
  data_vencimento     DATE NOT NULL,
  data_pagamento      DATETIME NULL,
  situacao            ENUM('PENDENTE', 'PAGO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
  data_criacao        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_titulo_req FOREIGN KEY (requisicao_id)
    REFERENCES requisicao(requisicao_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_titulo_pessoa FOREIGN KEY (pessoa_id)
    REFERENCES pessoa(pessoa_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_titulo_forma_pagto FOREIGN KEY (forma_pagamento_id)
    REFERENCES forma_pagamento(forma_pagamento_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_titulo_conta FOREIGN KEY (conta_financeira_id)
    REFERENCES conta_financeira(conta_financeira_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABELA: movimento_financeiro
-- ============================================================
CREATE TABLE IF NOT EXISTS movimento_financeiro (
  movimento_financeiro_id INT PRIMARY KEY AUTO_INCREMENT,
  conta_financeira_id     INT NOT NULL,
  titulo_id               INT NULL,
  tipo                    ENUM('ENTRADA', 'SAIDA') NOT NULL,
  valor                   DECIMAL(12,2) NOT NULL,
  historico               VARCHAR(255) NOT NULL,
  data_movimento          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movfin_conta FOREIGN KEY (conta_financeira_id)
    REFERENCES conta_financeira(conta_financeira_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_movfin_titulo FOREIGN KEY (titulo_id)
    REFERENCES titulo_financeiro(titulo_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEEDS COMPLETOS: Dados iniciais realistas para todas as tabelas
-- ============================================================

-- 1. Tipos de pessoa
INSERT IGNORE INTO tipo_pessoa (tipo_pessoa_id, tipo) VALUES
  (1, 'CLIENTE'),
  (2, 'FORNECEDOR'),
  (3, 'FUNCIONARIO');

-- 2. Tipos de movimento
INSERT IGNORE INTO tipo_movimento (tipo_movimento_id, nome, tipo_interno, ativo) VALUES
  (1, 'Venda',                'SAIDA',   TRUE),
  (2, 'Compra / Entrada',     'ENTRADA', TRUE),
  (3, 'Devolução de Cliente', 'ENTRADA', TRUE),
  (4, 'Ajuste / Perda',       'SAIDA',   TRUE),
  (5, 'Transferência',        'NEUTRO',  TRUE);

-- 3. Categorias
INSERT IGNORE INTO categoria (categoria_id, categoria_nome) VALUES
  (1, 'Eletrônicos'),
  (2, 'Informática'),
  (3, 'Periféricos'),
  (4, 'Papelaria'),
  (5, 'Limpeza');

-- 4. Pessoas (2 Funcionários, 4 Clientes, 3 Fornecedores = 9 registros)
INSERT IGNORE INTO pessoa (pessoa_id, tipo_pessoa_id, nome, email, cep, logradouro, numero, complemento, bairro, cidade, uf, cpf_cnpj, telefone, limite) VALUES
  (1, 3, 'Administrador Sistema',              'admin@marketplace.com',          '13465000', 'Av. Brasil',                    '1000', 'Sala 1',    'Centro',           'Americana',      'SP', '00000000000',    '(19) 98335-4118',     0.00),
  (2, 1, 'João da Silva',                      'joao@email.com',                 '01310100', 'Av. Paulista',                  '1578', 'Conj 42',   'Bela Vista',       'São Paulo',      'SP', '12345678901',    '(11) 91111-2222',  5000.00),
  (3, 1, 'Maria Oliveira',                     'maria@email.com',                '22041001', 'Av. Atlântica',                 '500',  'Bloco B',   'Copacabana',       'Rio de Janeiro', 'RJ', '98765432100',    '(21) 92222-3333',  8000.00),
  (4, 2, 'Tech Distribuidora LTDA',            'contato@techdistr.com.br',       '13080000', 'Rod. Dom Pedro I',              '132',  'Galpão 4',  'Parque Imperador', 'Campinas',       'SP', '12345678000199', '(11) 3333-4444',  50000.00),
  (5, 3, 'Carlos Eduardo Operador',            'operador@reqflow.com',           '13465100', 'Rua das Flores',                '250',  'Apto 12',   'Vila Rehder',      'Americana',      'SP', '11122233344',    '(19) 99123-4567',     0.00),
  (6, 1, 'Clínica Vida & Saúde LTDA',          'compras@clinicavida.com.br',     '13015000', 'Av. Francisco Glicério',        '890',  'Andar 3',   'Centro',           'Campinas',       'SP', '45678912000155', '(19) 3232-5566',  25000.00),
  (7, 1, 'Pedro Henrique Santos',              'pedro.santos@email.com',         '13400000', 'Rua do Porto',                  '120',  NULL,        'Centro',           'Piracicaba',     'SP', '32165498711',    '(19) 99888-7766',  3500.00),
  (8, 2, 'Papelaria & Suprimentos Brasil S/A', 'vendas@suprimentosbrasil.com.br','04578000', 'Av. Eng. Luís Carlos Berrini',  '1140', NULL,        'Itaim Bibi',       'São Paulo',      'SP', '23456789000188', '(11) 4004-8899',  30000.00),
  (9, 2, 'Mega Hardware Importadora LTDA',     'comercial@megahardware.com.br',  '80250000', 'Av. Sete de Setembro',          '3200', 'Torre Sul', 'Batel',            'Curitiba',       'PR', '34567890000177', '(41) 3030-9900',  80000.00);

-- 5. Usuários do sistema (Admin: admin@marketplace.com / admin123 | Operador: operador@reqflow.com / operador123)
INSERT INTO gersys_pessoa (gersys_pessoa_id, pessoa_id, gersys_email, gersys_senha_hash, gersys_perfil, gersys_ativo) VALUES
  (1, 1, 'admin@marketplace.com', '$2a$10$Onfi5Qm6R3Vc5Ek2/9B9nOEthrUUQdC7YOAzZ6ggZMoHXl0HLG/x6', 'ADMIN',    TRUE),
  (2, 5, 'operador@reqflow.com',  '$2a$10$a9GbdywOzavyyEuMOmjCm.IgbXrmWItYNa9zWU.cvQWupvti1m/uK', 'OPERADOR', TRUE)
ON DUPLICATE KEY UPDATE gersys_senha_hash = VALUES(gersys_senha_hash);

-- 6. Mercadorias (8 itens variados)
INSERT IGNORE INTO mercadoria (mercadoria_id, categoria_id, codigo, nome, marca, valor_venda, estoque, ativo) VALUES
  (1, 1, 'ELET-001', 'Smartphone Galaxy A54',     'Samsung',   1899.99,  24, TRUE),
  (2, 1, 'ELET-002', 'Fone Bluetooth WH-1000XM5', 'Sony',      2199.00,  15, TRUE),
  (3, 2, 'INFO-001', 'Notebook Aspire 5',         'Acer',      3499.90,   9, TRUE),
  (4, 2, 'INFO-002', 'SSD 1TB NVMe',              'Kingston',   399.90,  60, TRUE),
  (5, 3, 'PERI-001', 'Mouse sem fio M330',        'Logitech',   149.90,  88, TRUE),
  (6, 3, 'PERI-002', 'Teclado Mecânico K70',      'Corsair',    599.00,  30, TRUE),
  (7, 4, 'PAPE-001', 'Resma de Papel A4 500fls',  'Chamex',      29.90, 200, TRUE),
  (8, 5, 'LIMP-001', 'Álcool Isopropílico 1L',    'Implaflex',   35.50,  60, TRUE);

-- 7. Contas Financeiras (Caixas & Bancos)
INSERT IGNORE INTO conta_financeira (conta_financeira_id, nome, tipo, saldo_inicial, saldo_atual, ativo) VALUES
  (1, 'Caixa Interno (Loja)', 'CAIXA',  1500.00,  3599.80, TRUE),
  (2, 'Conta Banco Inter',    'BANCO', 10000.00, 10000.00, TRUE);

-- 8. Formas de Pagamento / Recebimento
INSERT IGNORE INTO forma_pagamento (forma_pagamento_id, nome, tipo_pix, baixa_automatica, tipo_conta_permitida, ativo) VALUES
  (1, 'Dinheiro',                FALSE, TRUE,  'CAIXA', TRUE),
  (2, 'PIX',                     TRUE,  FALSE, 'AMBOS', TRUE),
  (3, 'Boleto Bancário 30 Dias', FALSE, FALSE, 'BANCO', TRUE),
  (4, 'Cartão de Crédito',       FALSE, FALSE, 'AMBOS', TRUE);

-- 9. Requisições Iniciais (1 Compra Finalizada, 1 Venda em Dinheiro Finalizada, 1 Venda PIX Finalizada)
INSERT IGNORE INTO requisicao (requisicao_id, pessoa_id, tipo_movimento_id, usuario_id, forma_pagamento_id, data_vencimento, requisicao_situacao, observacao) VALUES
  (1, 4, 2, 1, 3, DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'FINALIZADA', 'Compra de reposição de estoque de informática e periféricos'),
  (2, 2, 1, 1, 1, CURDATE(),                            'FINALIZADA', 'Venda balcão à vista em dinheiro'),
  (3, 6, 1, 1, 2, DATE_ADD(CURDATE(), INTERVAL 5 DAY),  'FINALIZADA', 'Equipamentos para recepção da Clínica Vida & Saúde');

-- 10. Itens das Requisições
INSERT IGNORE INTO item_requisicao (item_requisicao_id, requisicao_id, mercadoria_id, quantidade, valor, desconto) VALUES
  (1, 1, 4, 10,  280.00,  0.00),
  (2, 1, 5, 10,   95.00, 50.00),
  (3, 2, 1,  1, 1899.99, 99.99),
  (4, 2, 5,  2,  149.90,  0.00),
  (5, 3, 3,  1, 3499.90,  0.00);

-- 11. Movimentações de Estoque
INSERT IGNORE INTO movimentacao (movimentacao_id, requisicao_id, item_requisicao_id, mercadoria_id, tipo_movimento_id, quantidade, valor_unitario) VALUES
  (1, 1, 1, 4, 2, 10,  280.00),
  (2, 1, 2, 5, 2, 10,   95.00),
  (3, 2, 3, 1, 1,  1, 1899.99),
  (4, 2, 4, 5, 1,  2,  149.90),
  (5, 3, 5, 3, 1,  1, 3499.90);

-- 12. Títulos Financeiros (Contas a Pagar e Contas a Receber)
INSERT IGNORE INTO titulo_financeiro (titulo_id, requisicao_id, pessoa_id, forma_pagamento_id, conta_financeira_id, tipo, descricao, valor, data_vencimento, data_pagamento, situacao) VALUES
  (1, 1, 4, 3, NULL, 'PAGAR',   'Compra Ref. Req #1 - Tech Distribuidora LTDA',        3700.00, DATE_ADD(CURDATE(), INTERVAL 15 DAY), NULL,  'PENDENTE'),
  (2, 2, 2, 1,    1, 'RECEBER', 'Venda Ref. Req #2 - João da Silva',                   2099.80, CURDATE(),                            NOW(), 'PAGO'),
  (3, 3, 6, 2, NULL, 'RECEBER', 'Venda Ref. Req #3 - Clínica Vida & Saúde LTDA (PIX)', 3499.90, DATE_ADD(CURDATE(), INTERVAL 5 DAY),  NULL,  'PENDENTE');

-- 13. Movimentações Financeiras (Extrato de Caixa)
INSERT IGNORE INTO movimento_financeiro (movimento_financeiro_id, conta_financeira_id, titulo_id, tipo, valor, historico) VALUES
  (1, 1, 2, 'ENTRADA', 2099.80, 'Baixa automática Ref. Req #2 (Recebimento à vista em Dinheiro)');

-- 14. Conta financeira das requisições de exemplo (idempotente)
UPDATE requisicao SET conta_financeira_id = 2 WHERE requisicao_id IN (1, 3) AND conta_financeira_id IS NULL;
UPDATE requisicao SET conta_financeira_id = 1 WHERE requisicao_id = 2 AND conta_financeira_id IS NULL;
