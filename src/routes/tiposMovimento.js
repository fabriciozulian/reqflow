/**
 * ============================================================
 * Rotas de Tipos de Movimento
 * CRUD completo e ativação/desativação
 * ============================================================
 */
const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ------------------------------------------------------------
// GET /api/tipos-movimento - Listagem com filtros
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { ativo } = req.query;
    let sql = 'SELECT * FROM tipo_movimento WHERE 1=1';
    const params = [];

    if (ativo !== undefined && ativo !== '') {
      sql += ' AND ativo = ?';
      params.push(ativo === 'true' || ativo === '1' ? 1 : 0);
    }

    sql += ' ORDER BY nome ASC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[TIPOS_MOV] Erro ao listar tipos de movimento:', err);
    res.status(500).json({ error: 'Erro interno ao consultar tipos de movimento.' });
  }
});

// ------------------------------------------------------------
// GET /api/tipos-movimento/:id - Obter por ID
// ------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM tipo_movimento WHERE tipo_movimento_id = ?',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Tipo de movimento não encontrado.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[TIPOS_MOV] Erro ao buscar tipo de movimento:', err);
    res.status(500).json({ error: 'Erro interno ao consultar tipo de movimento.' });
  }
});

// ------------------------------------------------------------
// POST /api/tipos-movimento - Criar novo tipo
// ------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { nome, tipo_interno, ativo } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'O nome do tipo de movimento é obrigatório.' });
    }

    const tiposValidos = ['ENTRADA', 'SAIDA', 'NEUTRO'];
    if (!tipo_interno || !tiposValidos.includes(tipo_interno.toUpperCase())) {
      return res.status(400).json({ error: 'Tipo interno inválido. Deve ser ENTRADA, SAIDA ou NEUTRO.' });
    }

    // Verifica se já existe um tipo com o mesmo nome
    const existente = await query(
      'SELECT tipo_movimento_id FROM tipo_movimento WHERE LOWER(nome) = ?',
      [nome.trim().toLowerCase()]
    );
    if (existente.length > 0) {
      return res.status(409).json({ error: 'Já existe um tipo de movimento cadastrado com este nome.' });
    }

    const isAtivo = ativo !== undefined ? (ativo ? 1 : 0) : 1;

    const result = await query(
      `INSERT INTO tipo_movimento (nome, tipo_interno, ativo) VALUES (?, ?, ?)`,
      [nome.trim(), tipo_interno.toUpperCase(), isAtivo]
    );

    const novo = await query(
      'SELECT * FROM tipo_movimento WHERE tipo_movimento_id = ?',
      [Number(result.insertId)]
    );

    res.status(201).json(novo[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe um tipo de movimento com este nome.' });
    }
    console.error('[TIPOS_MOV] Erro ao criar tipo de movimento:', err);
    res.status(500).json({ error: 'Erro interno ao criar tipo de movimento.' });
  }
});

// ------------------------------------------------------------
// PUT /api/tipos-movimento/:id - Atualizar dados
// ------------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const { nome, tipo_interno, ativo } = req.body;
    const { id } = req.params;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'O nome do tipo de movimento é obrigatório.' });
    }

    const tiposValidos = ['ENTRADA', 'SAIDA', 'NEUTRO'];
    if (!tipo_interno || !tiposValidos.includes(tipo_interno.toUpperCase())) {
      return res.status(400).json({ error: 'Tipo interno inválido. Deve ser ENTRADA, SAIDA ou NEUTRO.' });
    }

    // Verifica duplicidade excluindo o atual
    const existente = await query(
      'SELECT tipo_movimento_id FROM tipo_movimento WHERE LOWER(nome) = ? AND tipo_movimento_id != ?',
      [nome.trim().toLowerCase(), id]
    );
    if (existente.length > 0) {
      return res.status(409).json({ error: 'Já existe outro tipo de movimento cadastrado com este nome.' });
    }

    const isAtivo = ativo !== undefined ? (ativo ? 1 : 0) : 1;

    await query(
      `UPDATE tipo_movimento SET nome = ?, tipo_interno = ?, ativo = ? WHERE tipo_movimento_id = ?`,
      [nome.trim(), tipo_interno.toUpperCase(), isAtivo, id]
    );

    const atualizado = await query(
      'SELECT * FROM tipo_movimento WHERE tipo_movimento_id = ?',
      [id]
    );

    if (!atualizado.length) {
      return res.status(404).json({ error: 'Tipo de movimento não encontrado.' });
    }

    res.json(atualizado[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Já existe um tipo de movimento com este nome.' });
    }
    console.error('[TIPOS_MOV] Erro ao atualizar tipo de movimento:', err);
    res.status(500).json({ error: 'Erro interno ao atualizar tipo de movimento.' });
  }
});

// ------------------------------------------------------------
// PATCH /api/tipos-movimento/:id/toggle - Alternar status ativo
// ------------------------------------------------------------
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query('SELECT ativo FROM tipo_movimento WHERE tipo_movimento_id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Tipo de movimento não encontrado.' });
    }

    const novoStatus = !rows[0].ativo;
    await query('UPDATE tipo_movimento SET ativo = ? WHERE tipo_movimento_id = ?', [novoStatus ? 1 : 0, id]);

    res.json({ message: `Tipo de movimento ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`, ativo: novoStatus });
  } catch (err) {
    console.error('[TIPOS_MOV] Erro ao alterar status do tipo de movimento:', err);
    res.status(500).json({ error: 'Erro interno ao alterar status.' });
  }
});

// ------------------------------------------------------------
// DELETE /api/tipos-movimento/:id - Desativar ou excluir
// ------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se possui requisições ou movimentações vinculadas
    const reqVinc = await query('SELECT COUNT(*) as cnt FROM requisicao WHERE tipo_movimento_id = ?', [id]);
    const movVinc = await query('SELECT COUNT(*) as cnt FROM movimentacao WHERE tipo_movimento_id = ?', [id]);

    const totalVinc = (Number(reqVinc[0].cnt) || 0) + (Number(movVinc[0].cnt) || 0);

    if (totalVinc > 0) {
      // Se houver histórico, aplica soft-delete (desativa)
      await query('UPDATE tipo_movimento SET ativo = FALSE WHERE tipo_movimento_id = ?', [id]);
      return res.json({
        message: 'Tipo de movimento possui histórico vinculado e foi desativado.',
        desativado: true
      });
    }

    // Se não tiver histórico, remove fisicamente
    await query('DELETE FROM tipo_movimento WHERE tipo_movimento_id = ?', [id]);
    res.json({ message: 'Tipo de movimento excluído com sucesso.', excluido: true });
  } catch (err) {
    console.error('[TIPOS_MOV] Erro ao remover tipo de movimento:', err);
    res.status(500).json({ error: 'Erro interno ao processar exclusão.' });
  }
});

module.exports = router;
