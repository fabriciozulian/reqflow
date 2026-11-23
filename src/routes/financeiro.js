/**
 * ============================================================
 * Rotas do Módulo Financeiro (ReqFlow)
 * Contas Financeiras, Formas de Pagamento, Contas a Pagar/Receber,
 * Baixa Transacional e Extrato de Caixa
 * ============================================================
 */
const express = require('express');
const { query, getConnection } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { formaCompativel, MSG_INCOMPATIVEL } = require('../utils/pagamento');

const router = express.Router();
router.use(authenticate);

// ============================================================
// 0. TOTAIS CONSOLIDADOS DO FINANCEIRO
// ============================================================

// GET /api/financeiro/totais
router.get('/totais', async (req, res) => {
  try {
    const totaisGerais = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'RECEBER' AND situacao = 'PENDENTE' THEN valor ELSE 0 END), 0) AS total_a_receber,
        COALESCE(SUM(CASE WHEN tipo = 'PAGAR'   AND situacao = 'PENDENTE' THEN valor ELSE 0 END), 0) AS total_a_pagar,
        COALESCE(SUM(CASE WHEN tipo = 'RECEBER' AND situacao = 'PAGO'     THEN valor ELSE 0 END), 0) AS total_recebido,
        COALESCE(SUM(CASE WHEN tipo = 'PAGAR'   AND situacao = 'PAGO'     THEN valor ELSE 0 END), 0) AS total_pago
      FROM titulo_financeiro
    `);

    const contasRes = await query(`
      SELECT COALESCE(SUM(saldo_atual), 0) as saldo_caixas_bancos 
      FROM conta_financeira 
      WHERE ativo = TRUE
    `);

    const resumo = {
      saldoConsolidado: parseFloat(contasRes[0].saldo_caixas_bancos || 0),
      aReceber: parseFloat(totaisGerais[0].total_a_receber || 0),
      aPagar: parseFloat(totaisGerais[0].total_a_pagar || 0),
      recebido: parseFloat(totaisGerais[0].total_recebido || 0),
      pago: parseFloat(totaisGerais[0].total_pago || 0),
    };

    res.json({
      success: true,
      ...resumo,
      data: resumo,
    });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao buscar totais:', err);
    res.status(500).json({ error: 'Erro interno ao consultar totais financeiros.' });
  }
});

// ============================================================
// 1. CONTAS FINANCEIRAS (Caixas & Bancos)
// ============================================================

// GET /api/financeiro/contas - Listar todas as contas com saldo
router.get('/contas', async (req, res) => {
  try {
    const { ativo } = req.query;
    let sql = 'SELECT * FROM conta_financeira WHERE 1=1';
    const params = [];

    if (ativo !== undefined && ativo !== '') {
      sql += ' AND ativo = ?';
      params.push(ativo === 'true' || ativo === '1' ? 1 : 0);
    }

    sql += ' ORDER BY conta_financeira_id ASC, nome ASC';
    const contas = await query(sql, params);

    const saldoTotal = contas
      .filter(c => !!c.ativo)
      .reduce((acc, c) => acc + parseFloat(c.saldo_atual || 0), 0);

    res.json({
      success: true,
      contas,
      data: contas,
      saldo_consolidado: saldoTotal.toFixed(2),
    });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao listar contas financeiras:', err);
    res.status(500).json({ error: 'Erro interno ao consultar contas financeiras.' });
  }
});

// GET /api/financeiro/contas/:id - Detalhes de uma conta
router.get('/contas/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM conta_financeira WHERE conta_financeira_id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Conta financeira não encontrada.' });
    res.json({ ...rows[0], data: rows[0] });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao buscar conta financeira:', err);
    res.status(500).json({ error: 'Erro interno ao consultar conta financeira.' });
  }
});

// POST /api/financeiro/contas - Criar nova conta
router.post('/contas', async (req, res) => {
  try {
    const { nome, tipo, saldo_inicial, ativo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'O nome da conta é obrigatório.' });
    }

    const tiposValidos = ['CAIXA', 'BANCO'];
    if (!tipo || !tiposValidos.includes(tipo.toUpperCase())) {
      return res.status(400).json({ error: 'Tipo inválido. Deve ser CAIXA ou BANCO.' });
    }

    const saldoNum = parseFloat(saldo_inicial || 0);
    const isAtivo = ativo !== undefined ? (ativo ? 1 : 0) : 1;

    const result = await query(
      `INSERT INTO conta_financeira (nome, tipo, saldo_inicial, saldo_atual, ativo)
       VALUES (?, ?, ?, ?, ?)`,
      [nome.trim(), tipo.toUpperCase(), saldoNum.toFixed(2), saldoNum.toFixed(2), isAtivo]
    );

    const novaConta = await query(
      'SELECT * FROM conta_financeira WHERE conta_financeira_id = ?',
      [Number(result.insertId)]
    );

    res.status(201).json({
      success: true,
      ...novaConta[0],
      data: novaConta[0],
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe uma conta financeira com este nome.' });
    }
    console.error('[FINANCEIRO] Erro ao criar conta financeira:', err);
    res.status(500).json({ error: 'Erro interno ao criar conta financeira.' });
  }
});

// PUT /api/financeiro/contas/:id - Atualizar conta
router.put('/contas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, tipo, ativo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'O nome da conta é obrigatório.' });
    }

    const tiposValidos = ['CAIXA', 'BANCO'];
    if (!tipo || !tiposValidos.includes(tipo.toUpperCase())) {
      return res.status(400).json({ error: 'Tipo inválido. Deve ser CAIXA ou BANCO.' });
    }

    const isAtivo = ativo !== undefined ? (ativo ? 1 : 0) : 1;

    await query(
      `UPDATE conta_financeira SET nome = ?, tipo = ?, ativo = ? WHERE conta_financeira_id = ?`,
      [nome.trim(), tipo.toUpperCase(), isAtivo, id]
    );

    const atualizada = await query('SELECT * FROM conta_financeira WHERE conta_financeira_id = ?', [id]);
    if (!atualizada.length) return res.status(404).json({ error: 'Conta financeira não encontrada.' });

    res.json({
      success: true,
      ...atualizada[0],
      data: atualizada[0],
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe uma conta financeira com este nome.' });
    }
    console.error('[FINANCEIRO] Erro ao atualizar conta financeira:', err);
    res.status(500).json({ error: 'Erro interno ao atualizar conta financeira.' });
  }
});

// PATCH /api/financeiro/contas/:id/toggle - Alternar ativo/inativo
router.patch('/contas/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT ativo FROM conta_financeira WHERE conta_financeira_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Conta financeira não encontrada.' });

    const novoStatus = !rows[0].ativo;
    await query('UPDATE conta_financeira SET ativo = ? WHERE conta_financeira_id = ?', [novoStatus ? 1 : 0, id]);
    res.json({
      success: true,
      message: `Conta ${novoStatus ? 'ativada' : 'desativada'} com sucesso.`,
      ativo: novoStatus,
    });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao alternar status da conta:', err);
    res.status(500).json({ error: 'Erro interno ao alternar status.' });
  }
});

// ============================================================
// 2. FORMAS DE PAGAMENTO / RECEBIMENTO
// ============================================================

// GET /api/financeiro/formas-pagamento - Listar todas
router.get('/formas-pagamento', async (req, res) => {
  try {
    const { ativo } = req.query;
    let sql = `
      SELECT fp.*, cf.nome AS conta_padrao_nome, cf.tipo AS conta_padrao_tipo
      FROM forma_pagamento fp
      LEFT JOIN conta_financeira cf ON cf.conta_financeira_id = fp.conta_financeira_padrao_id
      WHERE 1=1
    `;
    const params = [];

    if (ativo !== undefined && ativo !== '') {
      sql += ' AND fp.ativo = ?';
      params.push(ativo === 'true' || ativo === '1' ? 1 : 0);
    }

    // Filtro em cascata: formas compatíveis com o tipo da conta (CAIXA/BANCO)
    const contaTipo = String(req.query.conta_tipo || '').toUpperCase();
    if (['CAIXA', 'BANCO'].includes(contaTipo)) {
      sql += " AND (fp.tipo_conta_permitida = 'AMBOS' OR fp.tipo_conta_permitida = ?)";
      params.push(contaTipo);
    }

    sql += ' ORDER BY fp.forma_pagamento_id ASC, fp.nome ASC';
    const rows = await query(sql, params);
    res.json({
      success: true,
      formas: rows,
      data: rows,
    });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao listar formas de pagamento:', err);
    res.status(500).json({ error: 'Erro interno ao consultar formas de pagamento.' });
  }
});

// POST /api/financeiro/formas-pagamento - Criar forma de pagamento
router.post('/formas-pagamento', async (req, res) => {
  try {
    const { nome, tipo_pix, baixa_automatica, tipo_conta_permitida, ativo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'O nome da forma de pagamento é obrigatório.' });
    }

    const isPix = !!tipo_pix;
    const isBaixaAuto = !!baixa_automatica;
    const tipoConta = String(tipo_conta_permitida || 'AMBOS').toUpperCase();
    if (!['CAIXA', 'BANCO', 'AMBOS'].includes(tipoConta)) {
      return res.status(400).json({ error: 'Tipo de conta permitida inválido. Use CAIXA, BANCO ou AMBOS.' });
    }
    const isAtivo = ativo !== undefined ? (ativo ? 1 : 0) : 1;

    const result = await query(
      `INSERT INTO forma_pagamento (nome, tipo_pix, baixa_automatica, tipo_conta_permitida, ativo)
       VALUES (?, ?, ?, ?, ?)`,
      [nome.trim(), isPix ? 1 : 0, isBaixaAuto ? 1 : 0, tipoConta, isAtivo]
    );

    const nova = await query(
      `SELECT fp.*, cf.nome AS conta_padrao_nome
       FROM forma_pagamento fp
       LEFT JOIN conta_financeira cf ON cf.conta_financeira_id = fp.conta_financeira_padrao_id
       WHERE fp.forma_pagamento_id = ?`,
      [Number(result.insertId)]
    );

    res.status(201).json({
      success: true,
      ...nova[0],
      data: nova[0],
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe uma forma de pagamento com este nome.' });
    }
    console.error('[FINANCEIRO] Erro ao criar forma de pagamento:', err);
    res.status(500).json({ error: 'Erro interno ao criar forma de pagamento.' });
  }
});

// PUT /api/financeiro/formas-pagamento/:id - Editar forma de pagamento
router.put('/formas-pagamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, tipo_pix, baixa_automatica, tipo_conta_permitida, ativo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'O nome da forma de pagamento é obrigatório.' });
    }

    const isPix = !!tipo_pix;
    const isBaixaAuto = !!baixa_automatica;
    const tipoConta = String(tipo_conta_permitida || 'AMBOS').toUpperCase();
    if (!['CAIXA', 'BANCO', 'AMBOS'].includes(tipoConta)) {
      return res.status(400).json({ error: 'Tipo de conta permitida inválido. Use CAIXA, BANCO ou AMBOS.' });
    }
    const isAtivo = ativo !== undefined ? (ativo ? 1 : 0) : 1;

    await query(
      `UPDATE forma_pagamento
       SET nome = ?, tipo_pix = ?, baixa_automatica = ?, tipo_conta_permitida = ?, ativo = ?
       WHERE forma_pagamento_id = ?`,
      [nome.trim(), isPix ? 1 : 0, isBaixaAuto ? 1 : 0, tipoConta, isAtivo, id]
    );

    const atualizada = await query(
      `SELECT fp.*, cf.nome AS conta_padrao_nome
       FROM forma_pagamento fp
       LEFT JOIN conta_financeira cf ON cf.conta_financeira_id = fp.conta_financeira_padrao_id
       WHERE fp.forma_pagamento_id = ?`,
      [id]
    );

    if (!atualizada.length) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
    res.json({
      success: true,
      ...atualizada[0],
      data: atualizada[0],
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe uma forma de pagamento com este nome.' });
    }
    console.error('[FINANCEIRO] Erro ao atualizar forma de pagamento:', err);
    res.status(500).json({ error: 'Erro interno ao atualizar forma de pagamento.' });
  }
});

// PATCH /api/financeiro/formas-pagamento/:id/toggle - Alternar status
router.patch('/formas-pagamento/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT ativo FROM forma_pagamento WHERE forma_pagamento_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });

    const novoStatus = !rows[0].ativo;
    await query('UPDATE forma_pagamento SET ativo = ? WHERE forma_pagamento_id = ?', [novoStatus ? 1 : 0, id]);
    res.json({
      success: true,
      message: `Forma de pagamento ${novoStatus ? 'ativada' : 'desativada'} com sucesso.`,
      ativo: novoStatus,
    });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao alternar status da forma de pagamento:', err);
    res.status(500).json({ error: 'Erro interno ao alternar status.' });
  }
});

// ============================================================
// 3. TÍTULOS FINANCEIROS (Contas a Pagar / Receber)
// ============================================================

// GET /api/financeiro/titulos - Listagem com filtros e totalizadores
router.get('/titulos', async (req, res) => {
  try {
    const { tipo, situacao, pessoa_id, pessoa_ids, data_inicio, data_fim } = req.query;

    let sql = `
      SELECT tf.titulo_id,
             tf.titulo_id AS titulo_financeiro_id,
             tf.requisicao_id,
             tf.pessoa_id,
             tf.forma_pagamento_id,
             tf.conta_financeira_id,
             tf.tipo,
             tf.descricao,
             tf.valor,
             tf.data_vencimento,
             tf.data_pagamento,
             tf.situacao,
             tf.data_criacao,
             p.nome AS pessoa_nome,
             tp.tipo AS tipo_pessoa_nome,
             p.cpf_cnpj AS pessoa_documento,
             fp.nome AS forma_pagamento_nome,
             fp.tipo_pix,
             fp.tipo_conta_permitida,
             cf.nome AS conta_nome,
             cf.tipo AS conta_tipo
      FROM titulo_financeiro tf
      INNER JOIN pessoa p ON p.pessoa_id = tf.pessoa_id
      INNER JOIN tipo_pessoa tp ON tp.tipo_pessoa_id = p.tipo_pessoa_id
      LEFT JOIN forma_pagamento fp ON fp.forma_pagamento_id = tf.forma_pagamento_id
      LEFT JOIN conta_financeira cf ON cf.conta_financeira_id = tf.conta_financeira_id
      LEFT JOIN requisicao r ON r.requisicao_id = tf.requisicao_id
      WHERE 1=1
    `;
    const params = [];

    if (tipo && ['PAGAR', 'RECEBER'].includes(tipo.toUpperCase())) {
      sql += ' AND tf.tipo = ?';
      params.push(tipo.toUpperCase());
    }

    if (situacao && ['PENDENTE', 'PAGO', 'CANCELADO'].includes(situacao.toUpperCase())) {
      sql += ' AND tf.situacao = ?';
      params.push(situacao.toUpperCase());
    }

    if (pessoa_ids) {
      const ids = String(pessoa_ids)
        .split(',')
        .map(v => parseInt(v.trim(), 10))
        .filter(n => !isNaN(n));
      if (ids.length > 0) {
        sql += ` AND tf.pessoa_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    } else if (pessoa_id) {
      sql += ' AND tf.pessoa_id = ?';
      params.push(pessoa_id);
    }

    if (data_inicio) {
      sql += ' AND tf.data_vencimento >= ?';
      params.push(data_inicio);
    }

    if (data_fim) {
      sql += ' AND tf.data_vencimento <= ?';
      params.push(data_fim);
    }

    sql += ' ORDER BY tf.data_vencimento ASC, tf.titulo_id DESC';
    const titulos = await query(sql, params);

    const totaisGerais = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'RECEBER' AND situacao = 'PENDENTE' THEN valor ELSE 0 END), 0) AS total_a_receber,
        COALESCE(SUM(CASE WHEN tipo = 'PAGAR'   AND situacao = 'PENDENTE' THEN valor ELSE 0 END), 0) AS total_a_pagar,
        COALESCE(SUM(CASE WHEN tipo = 'RECEBER' AND situacao = 'PAGO'     THEN valor ELSE 0 END), 0) AS total_recebido,
        COALESCE(SUM(CASE WHEN tipo = 'PAGAR'   AND situacao = 'PAGO'     THEN valor ELSE 0 END), 0) AS total_pago
      FROM titulo_financeiro
    `);

    const contasRes = await query(`
      SELECT COALESCE(SUM(saldo_atual), 0) as saldo_caixas_bancos 
      FROM conta_financeira 
      WHERE ativo = TRUE
    `);

    res.json({
      success: true,
      titulos,
      data: titulos,
      totais: {
        total_a_receber: parseFloat(totaisGerais[0].total_a_receber).toFixed(2),
        total_a_pagar: parseFloat(totaisGerais[0].total_a_pagar).toFixed(2),
        total_recebido: parseFloat(totaisGerais[0].total_recebido).toFixed(2),
        total_pago: parseFloat(totaisGerais[0].total_pago).toFixed(2),
        saldo_caixas_bancos: parseFloat(contasRes[0].saldo_caixas_bancos).toFixed(2),
      },
    });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao listar títulos financeiros:', err);
    res.status(500).json({ error: 'Erro interno ao consultar títulos financeiros.' });
  }
});

// POST /api/financeiro/titulos - Criar título manual / avulso
router.post('/titulos', async (req, res) => {
  let conn;
  try {
    let { pessoa_id, forma_pagamento_id, conta_financeira_id, tipo, descricao, valor, data_vencimento } = req.body;

    if (!pessoa_id || !tipo || !descricao || valor === undefined || !data_vencimento) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios do lançamento financeiro.' });
    }

    if (!['PAGAR', 'RECEBER'].includes(tipo.toUpperCase())) {
      return res.status(400).json({ error: 'Tipo de título inválido. Deve ser PAGAR ou RECEBER.' });
    }

    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      return res.status(400).json({ error: 'O valor do título deve ser maior que zero.' });
    }

    // Se forma_pagamento_id não foi enviada, seleciona a primeira ativa
    if (!forma_pagamento_id) {
      const defaultFp = await query('SELECT forma_pagamento_id FROM forma_pagamento WHERE ativo = TRUE ORDER BY forma_pagamento_id ASC LIMIT 1');
      if (defaultFp.length) {
        forma_pagamento_id = defaultFp[0].forma_pagamento_id;
      }
    }

    const fpRows = await query('SELECT * FROM forma_pagamento WHERE forma_pagamento_id = ?', [forma_pagamento_id]);
    if (!fpRows.length) return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
    const fp = fpRows[0];

    // Conta financeira (opcional no lançamento avulso). Se informada, a forma precisa ser compatível.
    let contaSel = null;
    if (conta_financeira_id) {
      const cRows = await query('SELECT * FROM conta_financeira WHERE conta_financeira_id = ?', [conta_financeira_id]);
      if (!cRows.length) return res.status(404).json({ error: 'Conta financeira não encontrada.' });
      contaSel = cRows[0];
      if (!contaSel.ativo) return res.status(400).json({ error: 'A conta financeira selecionada está inativa.' });
      if (!formaCompativel(fp, contaSel)) return res.status(400).json({ error: MSG_INCOMPATIVEL });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const isBaixaAuto = !!fp.baixa_automatica && !!contaSel && !fp.tipo_pix;
    const situacaoInicial = isBaixaAuto ? 'PAGO' : 'PENDENTE';
    const dataPagamentoInicial = isBaixaAuto ? new Date() : null;
    const contaInicial = isBaixaAuto ? Number(contaSel.conta_financeira_id) : null;

    const result = await conn.query(
      `INSERT INTO titulo_financeiro
         (pessoa_id, forma_pagamento_id, conta_financeira_id, tipo, descricao, valor, data_vencimento, data_pagamento, situacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pessoa_id,
        forma_pagamento_id,
        contaInicial,
        tipo.toUpperCase(),
        descricao.trim(),
        valorNum.toFixed(2),
        data_vencimento,
        dataPagamentoInicial,
        situacaoInicial,
      ]
    );

    const tituloId = Number(result.insertId);

    if (isBaixaAuto) {
      const contaRows = await conn.query(
        'SELECT conta_financeira_id, saldo_atual, nome FROM conta_financeira WHERE conta_financeira_id = ? FOR UPDATE',
        [contaInicial]
      );

      if (contaRows.length) {
        if (tipo.toUpperCase() === 'RECEBER') {
          await conn.query(
            'UPDATE conta_financeira SET saldo_atual = saldo_atual + ? WHERE conta_financeira_id = ?',
            [valorNum.toFixed(2), contaInicial]
          );
          await conn.query(
            `INSERT INTO movimento_financeiro (conta_financeira_id, titulo_id, tipo, valor, historico)
             VALUES (?, ?, 'ENTRADA', ?, ?)`,
            [contaInicial, tituloId, valorNum.toFixed(2), `Recebimento à vista avulso #${tituloId} - ${descricao.trim()}`]
          );
        } else {
          await conn.query(
            'UPDATE conta_financeira SET saldo_atual = saldo_atual - ? WHERE conta_financeira_id = ?',
            [valorNum.toFixed(2), contaInicial]
          );
          await conn.query(
            `INSERT INTO movimento_financeiro (conta_financeira_id, titulo_id, tipo, valor, historico)
             VALUES (?, ?, 'SAIDA', ?, ?)`,
            [contaInicial, tituloId, valorNum.toFixed(2), `Pagamento à vista avulso #${tituloId} - ${descricao.trim()}`]
          );
        }
      }
    }

    await conn.commit();

    const novo = await query(
      `SELECT tf.*, tf.titulo_id AS titulo_financeiro_id, p.nome AS pessoa_nome, fp.nome AS forma_pagamento_nome
       FROM titulo_financeiro tf
       INNER JOIN pessoa p ON p.pessoa_id = tf.pessoa_id
       INNER JOIN forma_pagamento fp ON fp.forma_pagamento_id = tf.forma_pagamento_id
       WHERE tf.titulo_id = ?`,
      [tituloId]
    );

    res.status(201).json({
      success: true,
      ...novo[0],
      data: novo[0],
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('[FINANCEIRO] Erro ao criar título avulso:', err);
    res.status(500).json({ error: 'Erro interno ao lançar título financeiro.' });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/financeiro/titulos/:id/baixar - Realizar baixa com transação SQL segura
router.post('/titulos/:id/baixar', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { conta_financeira_id, forma_pagamento_id, data_pagamento, observacao } = req.body;

    if (!conta_financeira_id) {
      return res.status(400).json({ error: 'Selecione a conta financeira (Caixa ou Banco) para efetuar a baixa.' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const tituloRows = await conn.query(
      'SELECT * FROM titulo_financeiro WHERE titulo_id = ? FOR UPDATE',
      [id]
    );

    if (!tituloRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Título financeiro não encontrado.' });
    }

    const titulo = tituloRows[0];
    if (titulo.situacao !== 'PENDENTE') {
      await conn.rollback();
      return res.status(400).json({ error: `Este título já se encontra ${titulo.situacao} e não pode sofrer nova baixa.` });
    }

    const contaRows = await conn.query(
      'SELECT * FROM conta_financeira WHERE conta_financeira_id = ? FOR UPDATE',
      [conta_financeira_id]
    );

    if (!contaRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Conta financeira não encontrada.' });
    }

    const conta = contaRows[0];
    if (!conta.ativo) {
      await conn.rollback();
      return res.status(400).json({ error: 'A conta financeira selecionada está inativa.' });
    }

    const valorNum = parseFloat(titulo.valor);
    const dataPagto = data_pagamento || new Date();
    const formaPagtoId = forma_pagamento_id || titulo.forma_pagamento_id;

    // Regra de compatibilidade Forma de Pagamento x Tipo da Conta
    const fpRows = await conn.query('SELECT * FROM forma_pagamento WHERE forma_pagamento_id = ?', [formaPagtoId]);
    if (!fpRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Forma de pagamento não encontrada.' });
    }
    if (!formaCompativel(fpRows[0], conta)) {
      await conn.rollback();
      return res.status(400).json({ error: MSG_INCOMPATIVEL });
    }
    const obsTexto = observacao ? ` (${observacao})` : '';

    if (titulo.tipo === 'RECEBER') {
      await conn.query(
        'UPDATE conta_financeira SET saldo_atual = saldo_atual + ? WHERE conta_financeira_id = ?',
        [valorNum.toFixed(2), conta_financeira_id]
      );

      await conn.query(
        `INSERT INTO movimento_financeiro (conta_financeira_id, titulo_id, tipo, valor, historico)
         VALUES (?, ?, 'ENTRADA', ?, ?)`,
        [
          conta_financeira_id,
          id,
          valorNum.toFixed(2),
          `Baixa do título #${id} (Recebimento) - ${titulo.descricao}${obsTexto}`,
        ]
      );
    } else {
      await conn.query(
        'UPDATE conta_financeira SET saldo_atual = saldo_atual - ? WHERE conta_financeira_id = ?',
        [valorNum.toFixed(2), conta_financeira_id]
      );

      await conn.query(
        `INSERT INTO movimento_financeiro (conta_financeira_id, titulo_id, tipo, valor, historico)
         VALUES (?, ?, 'SAIDA', ?, ?)`,
        [
          conta_financeira_id,
          id,
          valorNum.toFixed(2),
          `Baixa do título #${id} (Pagamento) - ${titulo.descricao}${obsTexto}`,
        ]
      );
    }

    await conn.query(
      `UPDATE titulo_financeiro
       SET situacao = 'PAGO', data_pagamento = ?, conta_financeira_id = ?, forma_pagamento_id = ?
       WHERE titulo_id = ?`,
      [dataPagto, conta_financeira_id, formaPagtoId, id]
    );

    await conn.commit();

    const atualizado = await query(
      `SELECT tf.*, tf.titulo_id AS titulo_financeiro_id, p.nome AS pessoa_nome, cf.nome AS conta_nome, fp.nome AS forma_pagamento_nome
       FROM titulo_financeiro tf
       INNER JOIN pessoa p ON p.pessoa_id = tf.pessoa_id
       INNER JOIN forma_pagamento fp ON fp.forma_pagamento_id = tf.forma_pagamento_id
       LEFT JOIN conta_financeira cf ON cf.conta_financeira_id = tf.conta_financeira_id
       WHERE tf.titulo_id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: `Baixa do título #${id} realizada com sucesso!`,
      titulo: atualizado[0],
      data: atualizado[0],
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('[FINANCEIRO] Erro ao efetuar baixa do título:', err);
    res.status(500).json({ error: 'Erro interno ao realizar a baixa financeira.' });
  } finally {
    if (conn) conn.release();
  }
});

// PATCH /api/financeiro/titulos/:id/cancelar - Cancelar título pendente
router.patch('/titulos/:id/cancelar', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT situacao FROM titulo_financeiro WHERE titulo_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Título financeiro não encontrado.' });

    if (rows[0].situacao !== 'PENDENTE') {
      return res.status(400).json({ error: `Apenas títulos com situação PENDENTE podem ser cancelados.` });
    }

    await query(`UPDATE titulo_financeiro SET situacao = 'CANCELADO' WHERE titulo_id = ?`, [id]);
    res.json({
      success: true,
      message: `Título #${id} cancelado com sucesso.`,
    });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao cancelar título financeiro:', err);
    res.status(500).json({ error: 'Erro interno ao cancelar título.' });
  }
});

// ============================================================
// 4. EXTRATO DE CAIXA / MOVIMENTAÇÃO FINANCEIRA
// ============================================================

// GET /api/financeiro/extrato - Histórico das movimentações financeiras
router.get('/extrato', async (req, res) => {
  try {
    const { conta_financeira_id, data_inicio, data_fim, tipo } = req.query;

    let sql = `
      SELECT mf.*,
             mf.historico AS descricao,
             mf.titulo_id AS titulo_financeiro_id,
             cf.nome AS conta_nome,
             cf.tipo AS conta_tipo,
             tf.tipo AS titulo_tipo,
             tf.descricao AS titulo_descricao,
             fp.nome AS forma_pagamento_nome,
             p.nome AS pessoa_nome
      FROM movimento_financeiro mf
      INNER JOIN conta_financeira cf ON cf.conta_financeira_id = mf.conta_financeira_id
      LEFT JOIN titulo_financeiro tf ON tf.titulo_id = mf.titulo_id
      LEFT JOIN forma_pagamento fp ON fp.forma_pagamento_id = tf.forma_pagamento_id
      LEFT JOIN pessoa p ON p.pessoa_id = tf.pessoa_id
      WHERE 1=1
    `;
    const params = [];

    if (conta_financeira_id) {
      sql += ' AND mf.conta_financeira_id = ?';
      params.push(conta_financeira_id);
    }

    if (tipo && ['ENTRADA', 'SAIDA'].includes(tipo.toUpperCase())) {
      sql += ' AND mf.tipo = ?';
      params.push(tipo.toUpperCase());
    }

    if (data_inicio) {
      sql += ' AND DATE(mf.data_movimento) >= ?';
      params.push(data_inicio);
    }

    if (data_fim) {
      sql += ' AND DATE(mf.data_movimento) <= ?';
      params.push(data_fim);
    }

    sql += ' ORDER BY mf.data_movimento DESC, mf.movimento_financeiro_id DESC LIMIT 500';
    const rows = await query(sql, params);

    let totalEntradas = 0;
    let totalSaidas = 0;

    rows.forEach(r => {
      const val = parseFloat(r.valor) || 0;
      if (r.tipo === 'ENTRADA') totalEntradas += val;
      else totalSaidas += val;
    });

    res.json({
      success: true,
      extrato: rows,
      data: rows,
      totais: {
        total_entradas: totalEntradas.toFixed(2),
        total_saidas: totalSaidas.toFixed(2),
        saldo_periodo: (totalEntradas - totalSaidas).toFixed(2),
      },
    });
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao consultar extrato financeiro:', err);
    res.status(500).json({ error: 'Erro interno ao consultar extrato financeiro.' });
  }
});

module.exports = router;
