/**
 * Rotas de Autenticação
 * POST /api/auth/login  - Login do usuário
 * GET  /api/auth/me     - Dados do usuário logado
 */
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { query }        = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const rows = await query(
      `SELECT g.gersys_pessoa_id, g.gersys_email, g.gersys_senha_hash,
              g.gersys_perfil, g.gersys_ativo,
              p.nome, p.pessoa_id
       FROM gersys_pessoa g
       INNER JOIN pessoa p ON p.pessoa_id = g.pessoa_id
       WHERE g.gersys_email = ?`,
      [email.trim().toLowerCase()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = rows[0];

    if (!user.gersys_ativo) {
      return res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
    }

    const senhaValida = await bcrypt.compare(senha, user.gersys_senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const payload = {
      id:        user.gersys_pessoa_id,
      pessoa_id: user.pessoa_id,
      email:     user.gersys_email,
      perfil:    user.gersys_perfil,
      nome:      user.nome,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    return res.json({
      token,
      user: { id: payload.id, nome: payload.nome, email: payload.email, perfil: payload.perfil },
    });
  } catch (err) {
    console.error('[AUTH] Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
