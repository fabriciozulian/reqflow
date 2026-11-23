/**
 * Rotas de Categorias de Mercadorias
 */
const express = require('express');
const { query }        = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/categorias
router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM categoria ORDER BY categoria_nome');
    res.json(rows);
  } catch (err) {
    console.error('[CATEGORIAS] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/categorias/:id
router.get('/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM categoria WHERE categoria_id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Categoria não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/categorias
router.post('/', async (req, res) => {
  try {
    const { categoria_nome } = req.body;
    if (!categoria_nome || !categoria_nome.trim()) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
    }
    const result = await query('INSERT INTO categoria (categoria_nome) VALUES (?)', [categoria_nome.trim()]);
    res.status(201).json({ categoria_id: Number(result.insertId), categoria_nome: categoria_nome.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Categoria já cadastrada.' });
    }
    console.error('[CATEGORIAS] Erro ao criar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/categorias/:id
router.put('/:id', async (req, res) => {
  try {
    const { categoria_nome } = req.body;
    if (!categoria_nome || !categoria_nome.trim()) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
    }
    await query('UPDATE categoria SET categoria_nome = ? WHERE categoria_id = ?', [categoria_nome.trim(), req.params.id]);
    res.json({ categoria_id: Number(req.params.id), categoria_nome: categoria_nome.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Categoria já cadastrada.' });
    }
    console.error('[CATEGORIAS] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/categorias/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM categoria WHERE categoria_id = ?', [req.params.id]);
    res.json({ message: 'Categoria removida com sucesso.' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Categoria em uso por mercadorias. Não é possível excluir.' });
    }
    console.error('[CATEGORIAS] Erro ao excluir:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
