/**
 * ============================================================
 * REQFLOW — Servidor Principal (API REST + SPA React)
 * Node.js + Express | MariaDB | React + Vite + Tailwind CSS
 * ============================================================
 */
require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { initDatabase } = require('./src/config/database');

const app  = express();
const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // 1. Conecta ao Pool de conexões do MariaDB
    await initDatabase();

    // 2. Middlewares globais
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });

    // 3. Rotas da API REST
    app.use('/api/auth',            require('./src/routes/auth'));
    app.use('/api/pessoas',         require('./src/routes/pessoas'));
    app.use('/api/categorias',      require('./src/routes/categorias'));
    app.use('/api/mercadorias',     require('./src/routes/mercadorias'));
    app.use('/api/tipos-movimento', require('./src/routes/tiposMovimento'));
    app.use('/api/requisicoes',     require('./src/routes/requisicoes'));
    app.use('/api/financeiro',      require('./src/routes/financeiro'));
    app.use('/api/relatorios',      require('./src/routes/relatorios'));

    // 4. Servir Front-end SPA (React build em frontend/dist)
    const reactDistPath = path.join(__dirname, 'frontend', 'dist');
    const reactIndexHtml = path.join(reactDistPath, 'index.html');

    if (fs.existsSync(reactDistPath)) {
      app.use(express.static(reactDistPath));
    }

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint da API não encontrado.' });
      }
      if (fs.existsSync(reactIndexHtml)) {
        return res.sendFile(reactIndexHtml);
      }
      return res.status(503).send('Front-end ainda não compilado. Execute: npm run build');
    });

    // 5. Inicia o servidor HTTP
    app.listen(PORT, () => {
      console.log('\n============================================================');
      console.log(`🚀 ReqFlow — ERP Comercial, Estoque & Financeiro`);
      console.log(`   URL:      http://localhost:${PORT}`);
      console.log(`   Banco:    ${process.env.DB_NAME || 'marketplace_db'} (${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306})`);
      console.log('   Login:    admin@marketplace.com / admin123');
      console.log('============================================================\n');
    });
  } catch (err) {
    console.error('\n❌ [ERRO NA INICIALIZAÇÃO DO SERVIDOR]');
    console.error(`   Motivo: ${err.message}\n`);
    process.exit(1);
  }
}

bootstrap();
