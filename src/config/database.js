/**
 * ============================================================
 * ReqFlow — Pool de Conexões MariaDB
 * ============================================================
 */
const mariadb = require('mariadb');
require('dotenv').config();

let pool = null;

const dbConfig = {
  host:              process.env.DB_HOST     || 'localhost',
  port:              parseInt(process.env.DB_PORT || '3306', 10),
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASSWORD || '',
  database:          process.env.DB_NAME     || 'marketplace_db',
  connectionLimit:   10,
  connectTimeout:    10000,
  acquireTimeout:    10000,
  idleTimeoutMillis: 30000,
  charset:           'utf8mb4',
  checkDuplicate:    false,
};

/**
 * Inicializa o Pool principal de conexões com o banco MariaDB.
 */
async function initDatabase() {
  pool = mariadb.createPool(dbConfig);

  const conn = await pool.getConnection();
  conn.release();
  console.log(`✅ [DB] Conectado ao banco de dados '${dbConfig.database}' (${dbConfig.host}:${dbConfig.port}).`);
}

/**
 * Executa uma instrução SQL utilizando uma conexão do pool.
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<any>}
 */
async function query(sql, params = []) {
  if (!pool) {
    throw new Error('O pool de conexões com o banco de dados não foi inicializado.');
  }
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Obtém uma conexão dedicada do pool para controle manual de transações (BEGIN / COMMIT / ROLLBACK).
 */
async function getConnection() {
  if (!pool) {
    throw new Error('O pool de conexões com o banco de dados não foi inicializado.');
  }
  return pool.getConnection();
}

module.exports = {
  initDatabase,
  query,
  getConnection,
  get pool() {
    return pool;
  },
};
