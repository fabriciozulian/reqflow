/**
 * Rotas de Pessoas (Clientes, Fornecedores, Funcionários)
 * e gerenciamento de logins (gersys_pessoa)
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const { query }                      = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
// Todas as rotas exigem autenticação
router.use(authenticate);

// ----------------------------------------------------------------
// TIPOS DE PESSOA
// ----------------------------------------------------------------
router.get('/tipos', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM tipo_pessoa ORDER BY tipo_pessoa_id');
    res.json(rows);
  } catch (err) {
    console.error('[PESSOAS] Erro ao listar tipos:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ----------------------------------------------------------------
// CRUD PESSOAS
// ----------------------------------------------------------------

// GET /api/pessoas?tipo=CLIENTE|FORNECEDOR|FUNCIONARIO&ativo=true
router.get('/', async (req, res) => {
  try {
    const { tipo, ativo } = req.query;
    let sql = `
      SELECT p.*, tp.tipo AS tipo_pessoa_nome
      FROM pessoa p
      INNER JOIN tipo_pessoa tp ON tp.tipo_pessoa_id = p.tipo_pessoa_id
      WHERE 1=1
    `;
    const params = [];
    if (tipo) {
      sql += ' AND tp.tipo = ?';
      params.push(tipo.toUpperCase());
    }
    if (ativo !== undefined && ativo !== '') {
      sql += ' AND p.ativo = ?';
      params.push(ativo === 'true' || ativo === '1' ? 1 : 0);
    }
    sql += ' ORDER BY p.nome';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[PESSOAS] Erro ao listar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/pessoas/:id
router.get('/:id', async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.*, tp.tipo AS tipo_pessoa_nome
       FROM pessoa p
       INNER JOIN tipo_pessoa tp ON tp.tipo_pessoa_id = p.tipo_pessoa_id
       WHERE p.pessoa_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pessoa não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PESSOAS] Erro ao buscar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/pessoas
router.post('/', async (req, res) => {
  try {
    const {
      tipo_pessoa_id, nome, email, cep, logradouro, numero, complemento,
      bairro, cidade, uf, pais, cpf_cnpj, telefone, limite, ativo
    } = req.body;

    if (!tipo_pessoa_id || !nome) {
      return res.status(400).json({ error: 'tipo_pessoa_id e nome são obrigatórios.' });
    }

    const result = await query(
      `INSERT INTO pessoa
         (tipo_pessoa_id, nome, email, cep, logradouro, numero, complemento,
          bairro, cidade, uf, pais, cpf_cnpj, telefone, limite, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo_pessoa_id, nome.trim(), email || null, cep || null, logradouro || null,
        numero || null, complemento || null, bairro || null, cidade || null, uf || null,
        pais || 'Brasil', cpf_cnpj || null, telefone || null,
        limite !== undefined ? limite : 0,
        ativo !== undefined ? (ativo ? 1 : 0) : 1,
      ]
    );

    const novaId = Number(result.insertId);
    const rows = await query(
      'SELECT p.*, tp.tipo AS tipo_pessoa_nome FROM pessoa p INNER JOIN tipo_pessoa tp ON tp.tipo_pessoa_id = p.tipo_pessoa_id WHERE p.pessoa_id = ?',
      [novaId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'CPF/CNPJ já cadastrado.' });
    }
    console.error('[PESSOAS] Erro ao criar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/pessoas/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      tipo_pessoa_id, nome, email, cep, logradouro, numero, complemento,
      bairro, cidade, uf, pais, cpf_cnpj, telefone, limite, ativo
    } = req.body;

    if (!tipo_pessoa_id || !nome) {
      return res.status(400).json({ error: 'tipo_pessoa_id e nome são obrigatórios.' });
    }

    await query(
      `UPDATE pessoa SET
         tipo_pessoa_id=?, nome=?, email=?, cep=?, logradouro=?, numero=?,
         complemento=?, bairro=?, cidade=?, uf=?, pais=?, cpf_cnpj=?,
         telefone=?, limite=?, ativo=?
       WHERE pessoa_id=?`,
      [
        tipo_pessoa_id, nome.trim(), email || null, cep || null, logradouro || null,
        numero || null, complemento || null, bairro || null, cidade || null, uf || null,
        pais || 'Brasil', cpf_cnpj || null, telefone || null,
        limite !== undefined ? limite : 0,
        ativo !== undefined ? (ativo ? 1 : 0) : 1,
        req.params.id,
      ]
    );

    const rows = await query(
      'SELECT p.*, tp.tipo AS tipo_pessoa_nome FROM pessoa p INNER JOIN tipo_pessoa tp ON tp.tipo_pessoa_id = p.tipo_pessoa_id WHERE p.pessoa_id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pessoa não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'CPF/CNPJ já cadastrado.' });
    }
    console.error('[PESSOAS] Erro ao atualizar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/pessoas/:id  (soft delete - seta ativo=false)
router.delete('/:id', async (req, res) => {
  try {
    await query('UPDATE pessoa SET ativo = FALSE WHERE pessoa_id = ?', [req.params.id]);
    res.json({ message: 'Pessoa desativada com sucesso.' });
  } catch (err) {
    console.error('[PESSOAS] Erro ao desativar:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ----------------------------------------------------------------
// GERENCIAMENTO DE LOGINS (gersys_pessoa)
// ----------------------------------------------------------------

// GET /api/pessoas/:id/login
router.get('/:id/login', async (req, res) => {
  try {
    const rows = await query(
      `SELECT g.gersys_pessoa_id, g.pessoa_id, g.gersys_email,
              g.gersys_perfil, g.gersys_ativo
       FROM gersys_pessoa g WHERE g.pessoa_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Login não encontrado para esta pessoa.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[LOGIN] Erro ao buscar login:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/pessoas/:id/login  - Cria login para um funcionário
router.post('/:id/login', requireAdmin, async (req, res) => {
  try {
    const { gersys_email, gersys_senha, gersys_perfil } = req.body;
    const pessoaId = req.params.id;

    if (!gersys_email || !gersys_senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    // Validar que a pessoa é do tipo FUNCIONARIO
    const pessoaRows = await query(
      `SELECT p.pessoa_id, tp.tipo FROM pessoa p
       INNER JOIN tipo_pessoa tp ON tp.tipo_pessoa_id = p.tipo_pessoa_id
       WHERE p.pessoa_id = ?`,
      [pessoaId]
    );
    if (!pessoaRows.length) {
      return res.status(404).json({ error: 'Pessoa não encontrada.' });
    }
    if (pessoaRows[0].tipo !== 'FUNCIONARIO') {
      return res.status(400).json({ error: 'Apenas funcionários podem ter login no sistema.' });
    }

    // Verificar se já tem login
    const existente = await query('SELECT gersys_pessoa_id FROM gersys_pessoa WHERE pessoa_id = ?', [pessoaId]);
    if (existente.length) {
      return res.status(409).json({ error: 'Esta pessoa já possui um login cadastrado.' });
    }

    const hash = await bcrypt.hash(gersys_senha, 10);
    const result = await query(
      `INSERT INTO gersys_pessoa (pessoa_id, gersys_email, gersys_senha_hash, gersys_perfil)
       VALUES (?, ?, ?, ?)`,
      [pessoaId, gersys_email.trim().toLowerCase(), hash, gersys_perfil || 'OPERADOR']
    );

    res.status(201).json({
      gersys_pessoa_id: Number(result.insertId),
      pessoa_id:        Number(pessoaId),
      gersys_email:     gersys_email.trim().toLowerCase(),
      gersys_perfil:    gersys_perfil || 'OPERADOR',
      gersys_ativo:     true,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email de login já cadastrado.' });
    }
    console.error('[LOGIN] Erro ao criar login:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/pessoas/:id/login  - Atualiza login (email, perfil, ativo; senha opcional)
router.put('/:id/login', requireAdmin, async (req, res) => {
  try {
    const { gersys_email, gersys_senha, gersys_perfil, gersys_ativo } = req.body;
    const pessoaId = req.params.id;

    const rows = await query('SELECT * FROM gersys_pessoa WHERE pessoa_id = ?', [pessoaId]);
    if (!rows.length) return res.status(404).json({ error: 'Login não encontrado.' });

    let hashFinal = rows[0].gersys_senha_hash;
    if (gersys_senha) {
      hashFinal = await bcrypt.hash(gersys_senha, 10);
    }

    await query(
      `UPDATE gersys_pessoa SET
         gersys_email=?, gersys_senha_hash=?, gersys_perfil=?, gersys_ativo=?
       WHERE pessoa_id=?`,
      [
        gersys_email ? gersys_email.trim().toLowerCase() : rows[0].gersys_email,
        hashFinal,
        gersys_perfil || rows[0].gersys_perfil,
        gersys_ativo !== undefined ? (gersys_ativo ? 1 : 0) : rows[0].gersys_ativo,
        pessoaId,
      ]
    );

    res.json({ message: 'Login atualizado com sucesso.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email de login já cadastrado.' });
    }
    console.error('[LOGIN] Erro ao atualizar login:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
