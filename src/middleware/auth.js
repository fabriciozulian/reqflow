/**
 * Middleware de autenticação JWT
 * Verifica o token Bearer no header Authorization
 */
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware que valida o JWT e injeta req.user com os dados do token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, perfil, nome }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

/**
 * Middleware que exige perfil ADMIN.
 * Deve ser usado após `authenticate`.
 */
function requireAdmin(req, res, next) {
  if (req.user && req.user.perfil === 'ADMIN') {
    return next();
  }
  return res.status(403).json({ error: 'Acesso negado. Requer perfil ADMIN.' });
}

module.exports = { authenticate, requireAdmin };
