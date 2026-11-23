/**
 * Rotas de Mercadorias (Produtos)
 */
const express = require('express');
const { query }        = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/mercadorias?ativo=true&categoria_id=1&busca=texto
router.get('/', async (req, res) => {
  try {
    const { ativo, categoria_id, busca } = req.query;
    let sql = `
      SELECT m.*, c.categoria_nome
      FROM mercadoria m
      INNER JOIN categoria c ON c.categoria_id = m.categoria_id
      WHERE 1=1
    `;
    const params = [];
    if (ativo !== undefined) {
      sql += ' AND m.ativo = ?';
      params.push(ativo === 'true' || ativo === '1' ? 1 : 0);
    }
    if (categoria_id) {
      sql += ' AND m.categoria_id = ?';
      params.push(categoria_id);
    }
    if (busca) {
      sql += ' AND (m.nome LIKE ? OR m.codigo LIKE ? OR m.marca LIKE ?)';
      const like = `%${busca}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY m.nome';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[MERCADORIAS] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/mercadorias/:id
router.get('/:id', async (req, res) => {
  try {
    const rows = await query(
      `SELECT m.*, c.categoria_nome FROM mercadoria m
       INNER JOIN categoria c ON c.categoria_id = m.categoria_id
       WHERE m.mercadoria_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Mercadoria não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/mercadorias
router.post('/', async (req, res) => {
  try {
    const { categoria_id, codigo, nome, marca, valor_venda, estoque, ativo } = req.body;
    if (!categoria_id || !nome || valor_venda === undefined) {
      return res.status(400).json({ error: 'categoria_id, nome e valor_venda são obrigatórios.' });
    }
    const result = await query(
      `INSERT INTO mercadoria (categoria_id, codigo, nome, marca, valor_venda, estoque, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        categoria_id, codigo || null, nome.trim(), marca || null,
        valor_venda, estoque !== undefined ? estoque : 0,
        ativo !== undefined ? ativo : true,
      ]
    );
    const rows = await query(
      'SELECT m.*, c.categoria_nome FROM mercadoria m INNER JOIN categoria c ON c.categoria_id = m.categoria_id WHERE m.mercadoria_id = ?',
      [Number(result.insertId)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Código de mercadoria já cadastrado.' });
    }
    console.error('[MERCADORIAS] Erro ao criar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/mercadorias/:id
router.put('/:id', async (req, res) => {
  try {
    const { categoria_id, codigo, nome, marca, valor_venda, estoque, ativo } = req.body;
    if (!categoria_id || !nome || valor_venda === undefined) {
      return res.status(400).json({ error: 'categoria_id, nome e valor_venda são obrigatórios.' });
    }
    await query(
      `UPDATE mercadoria SET
         categoria_id=?, codigo=?, nome=?, marca=?, valor_venda=?, estoque=?, ativo=?
       WHERE mercadoria_id=?`,
      [
        categoria_id, codigo || null, nome.trim(), marca || null,
        valor_venda, estoque !== undefined ? estoque : 0,
        ativo !== undefined ? (ativo ? 1 : 0) : 1,
        req.params.id,
      ]
    );
    const rows = await query(
      'SELECT m.*, c.categoria_nome FROM mercadoria m INNER JOIN categoria c ON c.categoria_id = m.categoria_id WHERE m.mercadoria_id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Mercadoria não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Código de mercadoria já cadastrado.' });
    }
    console.error('[MERCADORIAS] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/mercadorias/:id (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await query('UPDATE mercadoria SET ativo = FALSE WHERE mercadoria_id = ?', [req.params.id]);
    res.json({ message: 'Mercadoria desativada com sucesso.' });
  } catch (err) {
    console.error('[MERCADORIAS] Erro ao desativar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
