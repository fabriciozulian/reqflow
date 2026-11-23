/**
 * ============================================================
 * Rotas de Relatórios Gerenciais
 * Relatório detalhado e consolidado de movimentações e estoque
 * Suporta filtro único e filtro múltiplo (IN) para Pessoas e Mercadorias
 * ============================================================
 */
const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ------------------------------------------------------------
// GET /api/relatorios/movimentacoes
// Consulta consolidada de movimentações com múltiplos filtros
// ------------------------------------------------------------
router.get('/movimentacoes', async (req, res) => {
  try {
    const {
      data_inicio,
      data_fim,
      mercadoria_id,
      mercadoria_ids,
      tipo_interno,
      pessoa_id,
      pessoa_ids,
    } = req.query;

    let sql = `
      SELECT 
        mv.movimentacao_id,
        mv.requisicao_id,
        mv.data_movimentacao,
        mv.quantidade,
        mv.valor_unitario,
        r.requisicao_situacao,
        r.data_criacao AS data_requisicao,
        p.pessoa_id,
        p.nome AS pessoa_nome,
        tp.tipo AS tipo_pessoa_nome,
        m.mercadoria_id,
        m.nome AS mercadoria_nome,
        m.codigo AS mercadoria_codigo,
        m.marca AS mercadoria_marca,
        tm.tipo_movimento_id,
        tm.nome AS tipo_movimento_nome,
        tm.tipo_interno,
        COALESCE(ir.desconto, 0) AS desconto
      FROM movimentacao mv
      INNER JOIN requisicao r ON r.requisicao_id = mv.requisicao_id
      INNER JOIN pessoa p ON p.pessoa_id = r.pessoa_id
      INNER JOIN tipo_pessoa tp ON tp.tipo_pessoa_id = p.tipo_pessoa_id
      INNER JOIN mercadoria m ON m.mercadoria_id = mv.mercadoria_id
      INNER JOIN tipo_movimento tm ON tm.tipo_movimento_id = mv.tipo_movimento_id
      LEFT JOIN item_requisicao ir ON ir.item_requisicao_id = mv.item_requisicao_id
      WHERE 1=1
    `;
    const params = [];

    // Filtro por Data Inicial
    if (data_inicio) {
      sql += ' AND DATE(mv.data_movimentacao) >= ?';
      params.push(data_inicio);
    }

    // Filtro por Data Final
    if (data_fim) {
      sql += ' AND DATE(mv.data_movimentacao) <= ?';
      params.push(data_fim);
    }

    // Filtro por Múltiplas Mercadorias ou Mercadoria Única
    const mercIdsParam = mercadoria_ids || mercadoria_id;
    if (mercIdsParam) {
      const mIds = String(mercIdsParam)
        .split(',')
        .map(v => parseInt(v.trim(), 10))
        .filter(n => !isNaN(n));
      if (mIds.length === 1) {
        sql += ' AND mv.mercadoria_id = ?';
        params.push(mIds[0]);
      } else if (mIds.length > 1) {
        sql += ` AND mv.mercadoria_id IN (${mIds.map(() => '?').join(',')})`;
        params.push(...mIds);
      }
    }

    // Filtro por Tipo Interno (ENTRADA, SAIDA, NEUTRO)
    if (tipo_interno) {
      sql += ' AND tm.tipo_interno = ?';
      params.push(tipo_interno.toUpperCase());
    }

    // Filtro por Múltiplas Pessoas ou Pessoa Única
    const pessIdsParam = pessoa_ids || pessoa_id;
    if (pessIdsParam) {
      const pIds = String(pessIdsParam)
        .split(',')
        .map(v => parseInt(v.trim(), 10))
        .filter(n => !isNaN(n));
      if (pIds.length === 1) {
        sql += ' AND r.pessoa_id = ?';
        params.push(pIds[0]);
      } else if (pIds.length > 1) {
        sql += ` AND r.pessoa_id IN (${pIds.map(() => '?').join(',')})`;
        params.push(...pIds);
      }
    }

    sql += ' ORDER BY mv.data_movimentacao DESC, mv.movimentacao_id DESC';

    const rows = await query(sql, params);

    // Cálculos de totais consolidados
    let totalItens = 0;
    let totalBruto = 0;
    let totalDesconto = 0;
    let totalLiquido = 0;
    let totalEntradas = 0;
    let totalSaidas = 0;

    const detalhado = rows.map(r => {
      const qtd = parseInt(r.quantidade, 10) || 0;
      const unitario = parseFloat(r.valor_unitario) || 0;
      const desc = parseFloat(r.desconto) || 0;
      const bruto = qtd * unitario;
      const liquido = Math.max(0, bruto - desc);

      totalItens += qtd;
      totalBruto += bruto;
      totalDesconto += desc;
      totalLiquido += liquido;

      if (r.tipo_interno === 'ENTRADA') {
        totalEntradas += liquido;
      } else if (r.tipo_interno === 'SAIDA') {
        totalSaidas += liquido;
      }

      return {
        ...r,
        valor_bruto: bruto.toFixed(2),
        valor_liquido: liquido.toFixed(2),
      };
    });

    res.json({
      resumo: {
        total_registros: detalhado.length,
        total_itens: totalItens,
        total_bruto: totalBruto.toFixed(2),
        total_desconto: totalDesconto.toFixed(2),
        total_liquido: totalLiquido.toFixed(2),
        total_entradas: totalEntradas.toFixed(2),
        total_saidas: totalSaidas.toFixed(2),
      },
      itens: detalhado,
    });
  } catch (err) {
    console.error('[RELATORIOS] Erro ao gerar relatório de movimentações:', err);
    res.status(500).json({ error: 'Erro interno ao gerar relatório.' });
  }
});

module.exports = router;
