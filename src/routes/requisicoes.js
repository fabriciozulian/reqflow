/**
 * Rotas de Requisições, Itens de Requisição e Movimentações de Estoque
 * Regras de negócio com transações atômicas (START TRANSACTION / COMMIT / ROLLBACK)
 * e bloqueio pessimista (SELECT ... FOR UPDATE).
 */
const express = require('express');
const { getConnection, query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { gerarPayloadPix } = require('../utils/pix');
const { formaCompativel, MSG_INCOMPATIVEL } = require('../utils/pagamento');

const router = express.Router();

// Todas as rotas exigem autenticação prévia
router.use(authenticate);

// ----------------------------------------------------------------
// TIPOS DE MOVIMENTO (Ativos para novas requisições)
// ----------------------------------------------------------------
router.get('/tipos-movimento', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM tipo_movimento WHERE ativo = TRUE ORDER BY nome ASC');
    res.json(rows);
  } catch (err) {
    console.error('[REQUISICOES] Erro ao listar tipos de movimento:', err);
    res.status(500).json({ error: 'Erro interno ao consultar tipos de movimento.' });
  }
});

// ----------------------------------------------------------------
// LISTAGEM DE REQUISIÇÕES
// ----------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { situacao, pessoa_id } = req.query;
    let sql = `
      SELECT r.*,
             p.nome AS pessoa_nome,
             tm.nome AS tipo_movimento_nome,
             tm.tipo_interno,
             gp.gersys_email AS usuario_email,
             resp.nome AS usuario_nome,
             fp.nome AS forma_pagamento_nome,
             fp.tipo_pix,
             fp.baixa_automatica,
             tf.titulo_id,
             tf.situacao AS titulo_situacao
      FROM requisicao r
      INNER JOIN pessoa p ON p.pessoa_id = r.pessoa_id
      INNER JOIN tipo_movimento tm ON tm.tipo_movimento_id = r.tipo_movimento_id
      INNER JOIN gersys_pessoa gp ON gp.gersys_pessoa_id = r.usuario_id
      INNER JOIN pessoa resp ON resp.pessoa_id = gp.pessoa_id
      LEFT JOIN forma_pagamento fp ON fp.forma_pagamento_id = r.forma_pagamento_id
      LEFT JOIN titulo_financeiro tf ON tf.requisicao_id = r.requisicao_id
      WHERE 1=1
    `;
    const params = [];
    if (situacao) {
      sql += ' AND r.requisicao_situacao = ?';
      params.push(situacao.toUpperCase());
    }
    if (pessoa_id) {
      sql += ' AND r.pessoa_id = ?';
      params.push(pessoa_id);
    }
    sql += ' ORDER BY r.data_criacao DESC, r.requisicao_id DESC';

    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[REQUISICOES] Erro ao listar requisições:', err);
    res.status(500).json({ error: 'Erro interno ao listar requisições.' });
  }
});

// ----------------------------------------------------------------
// DETALHE DE UMA REQUISIÇÃO (COM SEUS ITENS)
// ----------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const reqRows = await query(
      `SELECT r.*,
              p.nome AS pessoa_nome,
              tm.nome AS tipo_movimento_nome,
              tm.tipo_interno,
              gp.gersys_email AS usuario_email,
              resp.nome AS usuario_nome,
              fp.nome AS forma_pagamento_nome,
              fp.tipo_pix,
              fp.baixa_automatica,
              fp.tipo_conta_permitida,
              fp.conta_financeira_padrao_id,
              tf.titulo_id,
              tf.situacao AS titulo_situacao,
              tf.valor AS titulo_valor,
              p.cpf_cnpj AS pessoa_documento, p.telefone AS pessoa_telefone, p.email AS pessoa_email,
              p.logradouro AS pessoa_logradouro, p.numero AS pessoa_numero, p.bairro AS pessoa_bairro,
              p.cidade AS pessoa_cidade, p.uf AS pessoa_uf, p.cep AS pessoa_cep,
              (SELECT cfx.nome FROM conta_financeira cfx WHERE cfx.conta_financeira_id = COALESCE(tf.conta_financeira_id, r.conta_financeira_id)) AS conta_nome,
              (SELECT cfx.tipo FROM conta_financeira cfx WHERE cfx.conta_financeira_id = COALESCE(tf.conta_financeira_id, r.conta_financeira_id)) AS conta_tipo
       FROM requisicao r
       INNER JOIN pessoa p ON p.pessoa_id = r.pessoa_id
       INNER JOIN tipo_movimento tm ON tm.tipo_movimento_id = r.tipo_movimento_id
       INNER JOIN gersys_pessoa gp ON gp.gersys_pessoa_id = r.usuario_id
       INNER JOIN pessoa resp ON resp.pessoa_id = gp.pessoa_id
       LEFT JOIN forma_pagamento fp ON fp.forma_pagamento_id = r.forma_pagamento_id
       LEFT JOIN titulo_financeiro tf ON tf.requisicao_id = r.requisicao_id
       WHERE r.requisicao_id = ?`,
      [req.params.id]
    );

    if (!reqRows.length) {
      return res.status(404).json({ error: 'Requisição não encontrada.' });
    }

    const itens = await query(
      `SELECT ir.*,
              m.nome AS mercadoria_nome,
              m.codigo,
              m.marca,
              m.estoque AS estoque_atual
       FROM item_requisicao ir
       INNER JOIN mercadoria m ON m.mercadoria_id = ir.mercadoria_id
       WHERE ir.requisicao_id = ?
       ORDER BY ir.item_requisicao_id ASC`,
      [req.params.id]
    );

    res.json({ ...reqRows[0], itens });
  } catch (err) {
    console.error('[REQUISICOES] Erro ao buscar requisição:', err);
    res.status(500).json({ error: 'Erro interno ao consultar requisição.' });
  }
});

// ----------------------------------------------------------------
// CRIAR REQUISIÇÃO (ABERTA)
// ----------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { pessoa_id, tipo_movimento_id, forma_pagamento_id, conta_financeira_id, data_vencimento, observacao } = req.body;
    const usuario_id = req.user.id; // gersys_pessoa_id autenticado

    if (!pessoa_id || !tipo_movimento_id) {
      return res.status(400).json({ error: 'Pessoa e tipo de movimento são obrigatórios.' });
    }

    if (!forma_pagamento_id) {
      return res.status(400).json({ error: 'A forma de pagamento/recebimento é obrigatória.' });
    }

    // Valida se a pessoa existe e está ativa
    const pessoaCheck = await query('SELECT pessoa_id, ativo FROM pessoa WHERE pessoa_id = ?', [pessoa_id]);
    if (!pessoaCheck.length) {
      return res.status(404).json({ error: 'Pessoa não encontrada.' });
    }
    if (!pessoaCheck[0].ativo) {
      return res.status(400).json({ error: 'Não é possível abrir requisição para uma pessoa inativa.' });
    }

    // Valida forma de pagamento
    const fpCheck = await query(
      'SELECT forma_pagamento_id, nome, ativo, tipo_conta_permitida, baixa_automatica, tipo_pix FROM forma_pagamento WHERE forma_pagamento_id = ?',
      [forma_pagamento_id]
    );
    if (!fpCheck.length || !fpCheck[0].ativo) {
      return res.status(400).json({ error: 'Forma de pagamento inválida ou inativa.' });
    }

    const fp = fpCheck[0];
    let contaIdFinal = null;

    if (fp.baixa_automatica) {
      if (!conta_financeira_id) {
        return res.status(400).json({
          error: `A forma de pagamento "${fp.nome}" possui baixa automática. Selecione a Conta Financeira para Baixa.`,
        });
      }
      const contaRows = await query(
        'SELECT conta_financeira_id, tipo, ativo FROM conta_financeira WHERE conta_financeira_id = ?',
        [conta_financeira_id]
      );
      if (!contaRows.length || !contaRows[0].ativo) {
        return res.status(400).json({ error: 'Conta financeira selecionada inválida ou inativa.' });
      }
      if (!formaCompativel(fp, contaRows[0])) {
        return res.status(400).json({ error: MSG_INCOMPATIVEL });
      }
      contaIdFinal = Number(conta_financeira_id);
    } else if (conta_financeira_id) {
      const contaRows = await query(
        'SELECT conta_financeira_id, tipo, ativo FROM conta_financeira WHERE conta_financeira_id = ?',
        [conta_financeira_id]
      );
      if (!contaRows.length || !contaRows[0].ativo) {
        return res.status(400).json({ error: 'Conta financeira selecionada inválida ou inativa.' });
      }
      if (!formaCompativel(fp, contaRows[0])) {
        return res.status(400).json({ error: MSG_INCOMPATIVEL });
      }
      contaIdFinal = Number(conta_financeira_id);
    }

    const vencimentoFinal = data_vencimento || new Date().toISOString().slice(0, 10);

    const result = await query(
      `INSERT INTO requisicao (pessoa_id, tipo_movimento_id, usuario_id, forma_pagamento_id, conta_financeira_id, data_vencimento, requisicao_situacao, observacao)
       VALUES (?, ?, ?, ?, ?, ?, 'ABERTA', ?)`,
      [pessoa_id, tipo_movimento_id, usuario_id, forma_pagamento_id, contaIdFinal, vencimentoFinal, observacao ? observacao.trim() : null]
    );

    const novaId = Number(result.insertId);

    const rows = await query(
      `SELECT r.*,
              p.nome AS pessoa_nome,
              tm.nome AS tipo_movimento_nome,
              tm.tipo_interno,
              fp.nome AS forma_pagamento_nome,
              fp.tipo_pix,
              fp.baixa_automatica,
              fp.tipo_conta_permitida
       FROM requisicao r
       INNER JOIN pessoa p ON p.pessoa_id = r.pessoa_id
       INNER JOIN tipo_movimento tm ON tm.tipo_movimento_id = r.tipo_movimento_id
       LEFT JOIN forma_pagamento fp ON fp.forma_pagamento_id = r.forma_pagamento_id
       WHERE r.requisicao_id = ?`,
      [novaId]
    );

    res.status(201).json({ ...rows[0], itens: [] });
  } catch (err) {
    console.error('[REQUISICOES] Erro ao criar requisição:', err);
    res.status(500).json({ error: 'Erro interno ao criar requisição.' });
  }
});

// ----------------------------------------------------------------
// ADICIONAR ITEM À REQUISIÇÃO (SOMENTE SE ABERTA)
// ----------------------------------------------------------------
router.post('/:id/itens', async (req, res) => {
  try {
    const requisicaoId = req.params.id;
    const { mercadoria_id, quantidade, valor, desconto } = req.body;

    if (!mercadoria_id || quantidade === undefined || valor === undefined) {
      return res.status(400).json({ error: 'Mercadoria, quantidade e valor unitário são obrigatórios.' });
    }

    const qtdNum = parseInt(quantidade, 10);
    if (isNaN(qtdNum) || qtdNum <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser um número inteiro maior que zero.' });
    }

    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum < 0) {
      return res.status(400).json({ error: 'Valor unitário inválido.' });
    }

    const descNum = desconto !== undefined && desconto !== null && desconto !== '' ? parseFloat(desconto) : 0;
    if (isNaN(descNum) || descNum < 0) {
      return res.status(400).json({ error: 'Desconto não pode ser negativo.' });
    }

    // Verifica situação da requisição
    const reqRows = await query(
      'SELECT requisicao_id, requisicao_situacao FROM requisicao WHERE requisicao_id = ?',
      [requisicaoId]
    );
    if (!reqRows.length) {
      return res.status(404).json({ error: 'Requisição não encontrada.' });
    }
    if (reqRows[0].requisicao_situacao !== 'ABERTA') {
      return res.status(400).json({ error: 'Itens só podem ser inseridos em requisições com situação ABERTA.' });
    }

    // Verifica mercadoria
    const mercRows = await query(
      'SELECT mercadoria_id, ativo FROM mercadoria WHERE mercadoria_id = ?',
      [mercadoria_id]
    );
    if (!mercRows.length) {
      return res.status(404).json({ error: 'Mercadoria não encontrada.' });
    }
    if (!mercRows[0].ativo) {
      return res.status(400).json({ error: 'Não é possível adicionar uma mercadoria inativa.' });
    }

    const result = await query(
      `INSERT INTO item_requisicao (requisicao_id, mercadoria_id, quantidade, valor, desconto)
       VALUES (?, ?, ?, ?, ?)`,
      [requisicaoId, mercadoria_id, qtdNum, valorNum.toFixed(2), descNum.toFixed(2)]
    );

    const novoItem = await query(
      `SELECT ir.*, m.nome AS mercadoria_nome, m.codigo
       FROM item_requisicao ir
       INNER JOIN mercadoria m ON m.mercadoria_id = ir.mercadoria_id
       WHERE ir.item_requisicao_id = ?`,
      [Number(result.insertId)]
    );

    res.status(201).json(novoItem[0]);
  } catch (err) {
    console.error('[REQUISICOES] Erro ao adicionar item:', err);
    res.status(500).json({ error: 'Erro interno ao adicionar item na requisição.' });
  }
});

// ----------------------------------------------------------------
// REMOVER ITEM DA REQUISIÇÃO (SOMENTE SE ABERTA)
// ----------------------------------------------------------------
router.delete('/:id/itens/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const reqRows = await query('SELECT requisicao_situacao FROM requisicao WHERE requisicao_id = ?', [id]);
    if (!reqRows.length) {
      return res.status(404).json({ error: 'Requisição não encontrada.' });
    }
    if (reqRows[0].requisicao_situacao !== 'ABERTA') {
      return res.status(400).json({ error: 'Itens só podem ser removidos de requisições ABERTAS.' });
    }

    await query(
      'DELETE FROM item_requisicao WHERE item_requisicao_id = ? AND requisicao_id = ?',
      [itemId, id]
    );

    res.json({ message: 'Item removido com sucesso.' });
  } catch (err) {
    console.error('[REQUISICOES] Erro ao remover item:', err);
    res.status(500).json({ error: 'Erro interno ao remover item.' });
  }
});

// ----------------------------------------------------------------
// FINALIZAR REQUISIÇÃO
// Transação estrita com SELECT ... FOR UPDATE e gravação em movimentacao
// ----------------------------------------------------------------
router.patch('/:id/finalizar', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    await conn.beginTransaction();

    const requisicaoId = req.params.id;

    // 1. Lock pessimista na requisição
    const reqRows = await conn.query(
      `SELECT r.*, tm.tipo_interno
       FROM requisicao r
       INNER JOIN tipo_movimento tm ON tm.tipo_movimento_id = r.tipo_movimento_id
       WHERE r.requisicao_id = ? FOR UPDATE`,
      [requisicaoId]
    );

    if (!reqRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Requisição não encontrada.' });
    }

    const reqData = reqRows[0];
    if (reqData.requisicao_situacao !== 'ABERTA') {
      await conn.rollback();
      return res.status(400).json({
        error: `Esta requisição já se encontra na situação '${reqData.requisicao_situacao}'. Não pode ser finalizada novamente.`
      });
    }

    // 2. Consulta itens da requisição
    const itens = await conn.query(
      'SELECT * FROM item_requisicao WHERE requisicao_id = ? FOR UPDATE',
      [requisicaoId]
    );

    if (!itens.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Não é possível finalizar uma requisição sem nenhum item adicionado.' });
    }

    const tipoInterno = reqData.tipo_interno;

    // 3. Processar cada item com validação e lock pessimista em mercadoria
    for (const item of itens) {
      const mercRows = await conn.query(
        'SELECT mercadoria_id, nome, estoque FROM mercadoria WHERE mercadoria_id = ? FOR UPDATE',
        [item.mercadoria_id]
      );

      if (!mercRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: `Mercadoria ID ${item.mercadoria_id} não encontrada.` });
      }

      const merc = mercRows[0];

      if (tipoInterno === 'SAIDA') {
        if (merc.estoque < item.quantidade) {
          await conn.rollback();
          return res.status(400).json({
            error: `Estoque insuficiente para a mercadoria "${merc.nome}". Saldo disponível: ${merc.estoque}, Quantidade solicitada: ${item.quantidade}.`
          });
        }

        await conn.query(
          'UPDATE mercadoria SET estoque = estoque - ? WHERE mercadoria_id = ?',
          [item.quantidade, item.mercadoria_id]
        );
      } else if (tipoInterno === 'ENTRADA') {
        await conn.query(
          'UPDATE mercadoria SET estoque = estoque + ? WHERE mercadoria_id = ?',
          [item.quantidade, item.mercadoria_id]
        );
      }
      // Se for NEUTRO, não altera estoque da mercadoria

      // 4. Inserir na tabela de histórico movimentacao
      await conn.query(
        `INSERT INTO movimentacao
           (requisicao_id, item_requisicao_id, mercadoria_id, tipo_movimento_id, quantidade, valor_unitario)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          requisicaoId,
          item.item_requisicao_id,
          item.mercadoria_id,
          reqData.tipo_movimento_id,
          item.quantidade,
          parseFloat(item.valor).toFixed(2)
        ]
      );
    }

    // 5. Integração com o Módulo Financeiro
    // Calcula total líquido da requisição: SUM((valor * qtd) - desconto)
    let totalLiquido = 0;
    itens.forEach(it => {
      const v = parseFloat(it.valor) || 0;
      const q = parseInt(it.quantidade, 10) || 0;
      const d = parseFloat(it.desconto) || 0;
      totalLiquido += Math.max(0, (v * q) - d);
    });

    let tituloGeradoId = null;
    let pixData = null;

    if (totalLiquido > 0 && ['ENTRADA', 'SAIDA'].includes(tipoInterno)) {
      const tipoTitulo = tipoInterno === 'SAIDA' ? 'RECEBER' : 'PAGAR';

      // Busca forma de pagamento da requisição ou assume a primeira disponível
      let fpId = reqData.forma_pagamento_id;
      if (!fpId) {
        const fpDefault = await conn.query('SELECT forma_pagamento_id FROM forma_pagamento WHERE ativo = TRUE ORDER BY forma_pagamento_id ASC LIMIT 1');
        if (fpDefault.length) fpId = fpDefault[0].forma_pagamento_id;
      }

      let fpInfo = null;
      if (fpId) {
        const fpRows = await conn.query('SELECT * FROM forma_pagamento WHERE forma_pagamento_id = ?', [fpId]);
        if (fpRows.length) fpInfo = fpRows[0];
      }

      const isPix = fpInfo ? !!fpInfo.tipo_pix : false;
      const isBaixaAuto = fpInfo ? !!fpInfo.baixa_automatica : false;
      const vencimentoTitulo = reqData.data_vencimento || new Date().toISOString().slice(0, 10);
      const descrTitulo = `${tipoInterno === 'SAIDA' ? 'Venda' : 'Compra'} Ref. Req #${requisicaoId}`;

      const contaIdInput =
        req.body && req.body.conta_financeira_id
          ? Number(req.body.conta_financeira_id)
          : reqData.conta_financeira_id
          ? Number(reqData.conta_financeira_id)
          : null;

      if (isBaixaAuto) {
        if (!contaIdInput) {
          await conn.rollback();
          return res.status(400).json({
            error: `A forma de pagamento "${fpInfo.nome}" possui baixa automática. Selecione a Conta Financeira (Caixa ou Banco) para efetuar a baixa.`,
          });
        }

        const contaRows = await conn.query(
          'SELECT * FROM conta_financeira WHERE conta_financeira_id = ? FOR UPDATE',
          [contaIdInput]
        );
        if (!contaRows.length || !contaRows[0].ativo) {
          await conn.rollback();
          return res.status(400).json({ error: 'Conta financeira selecionada inválida ou inativa.' });
        }

        const contaBaixa = contaRows[0];
        if (!formaCompativel(fpInfo, contaBaixa)) {
          await conn.rollback();
          return res.status(400).json({ error: MSG_INCOMPATIVEL });
        }

        await conn.query(
          'UPDATE requisicao SET conta_financeira_id = ? WHERE requisicao_id = ?',
          [contaIdInput, requisicaoId]
        );

        const titRes = await conn.query(
          `INSERT INTO titulo_financeiro
             (requisicao_id, pessoa_id, forma_pagamento_id, conta_financeira_id, tipo, descricao, valor, data_vencimento, data_pagamento, situacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'PAGO')`,
          [
            requisicaoId,
            reqData.pessoa_id,
            fpId,
            contaIdInput,
            tipoTitulo,
            descrTitulo,
            totalLiquido.toFixed(2),
            vencimentoTitulo,
          ]
        );

        tituloGeradoId = Number(titRes.insertId);

        if (tipoTitulo === 'RECEBER') {
          await conn.query(
            'UPDATE conta_financeira SET saldo_atual = saldo_atual + ? WHERE conta_financeira_id = ?',
            [totalLiquido.toFixed(2), contaIdInput]
          );
          await conn.query(
            `INSERT INTO movimento_financeiro (conta_financeira_id, titulo_id, tipo, valor, historico)
             VALUES (?, ?, 'ENTRADA', ?, ?)`,
            [
              contaIdInput,
              tituloGeradoId,
              totalLiquido.toFixed(2),
              `Baixa automática Ref. Req #${requisicaoId} (Recebimento - ${fpInfo.nome})`,
            ]
          );
        } else {
          await conn.query(
            'UPDATE conta_financeira SET saldo_atual = saldo_atual - ? WHERE conta_financeira_id = ?',
            [totalLiquido.toFixed(2), contaIdInput]
          );
          await conn.query(
            `INSERT INTO movimento_financeiro (conta_financeira_id, titulo_id, tipo, valor, historico)
             VALUES (?, ?, 'SAIDA', ?, ?)`,
            [
              contaIdInput,
              tituloGeradoId,
              totalLiquido.toFixed(2),
              `Baixa automática Ref. Req #${requisicaoId} (Pagamento - ${fpInfo.nome})`,
            ]
          );
        }
      } else {
        // Sem baixa automática (a prazo): título nasce PENDENTE e com conta_financeira_id = NULL
        const titRes = await conn.query(
          `INSERT INTO titulo_financeiro
             (requisicao_id, pessoa_id, forma_pagamento_id, conta_financeira_id, tipo, descricao, valor, data_vencimento, data_pagamento, situacao)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, 'PENDENTE')`,
          [
            requisicaoId,
            reqData.pessoa_id,
            fpId,
            tipoTitulo,
            descrTitulo,
            totalLiquido.toFixed(2),
            vencimentoTitulo,
          ]
        );

        tituloGeradoId = Number(titRes.insertId);
      }

      // Se for PIX em Venda (SAIDA), gera o payload oficial do Banco Central
      if (isPix && tipoInterno === 'SAIDA') {
        const payloadPixStr = gerarPayloadPix({
          chave: '19983354118',
          nome: 'ReqFlow',
          cidade: 'Americana',
          valor: totalLiquido.toFixed(2),
          identificador: `REQ${requisicaoId}`,
        });

        pixData = {
          chave: '19983354118',
          recebedor: 'ReqFlow',
          cidade: 'Americana',
          valor: totalLiquido.toFixed(2),
          titulo_id: tituloGeradoId,
          requisicao_id: Number(requisicaoId),
          tipo_conta_permitida: fpInfo.tipo_conta_permitida || 'AMBOS',
          ja_baixado: isBaixaAuto,
          payload: payloadPixStr,
        };
      }
    }

    // 6. Atualizar situação da requisição para FINALIZADA
    await conn.query(
      `UPDATE requisicao SET requisicao_situacao = 'FINALIZADA' WHERE requisicao_id = ?`,
      [requisicaoId]
    );

    await conn.commit();

    // Retorna a requisição atualizada
    const resFinal = await query(
      `SELECT r.*,
              p.nome AS pessoa_nome,
              tm.nome AS tipo_movimento_nome,
              tm.tipo_interno,
              fp.nome AS forma_pagamento_nome,
              fp.tipo_pix
       FROM requisicao r
       INNER JOIN pessoa p ON p.pessoa_id = r.pessoa_id
       INNER JOIN tipo_movimento tm ON tm.tipo_movimento_id = r.tipo_movimento_id
       LEFT JOIN forma_pagamento fp ON fp.forma_pagamento_id = r.forma_pagamento_id
       WHERE r.requisicao_id = ?`,
      [requisicaoId]
    );

    res.json({
      ...resFinal[0],
      titulo_id: tituloGeradoId,
      total_liquido: totalLiquido.toFixed(2),
      pix: pixData,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('[REQUISICOES] Erro ao finalizar requisição:', err);
    res.status(500).json({ error: 'Erro interno ao finalizar requisição.' });
  } finally {
    if (conn) conn.release();
  }
});

// ----------------------------------------------------------------
// CONFIRMAR RECEBIMENTO PIX DA REQUISIÇÃO
// Realiza a baixa do título financeiro na conta destino ou no banco/caixa padrão compatível
// ----------------------------------------------------------------
router.post('/:id/confirmar-pix', async (req, res) => {
  let conn;
  try {
    const requisicaoId = req.params.id;
    const { conta_financeira_id } = req.body || {};

    conn = await getConnection();
    await conn.beginTransaction();

    // Busca o título financeiro pendente vinculado à requisição
    const titulos = await conn.query(
      `SELECT tf.*, fp.tipo_pix, fp.tipo_conta_permitida
       FROM titulo_financeiro tf
       INNER JOIN forma_pagamento fp ON fp.forma_pagamento_id = tf.forma_pagamento_id
       WHERE tf.requisicao_id = ? FOR UPDATE`,
      [requisicaoId]
    );

    if (!titulos.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Nenhum título financeiro encontrado para esta requisição.' });
    }

    const titulo = titulos[0];
    if (titulo.situacao === 'PAGO') {
      await conn.rollback();
      return res.json({ message: 'O pagamento PIX desta requisição já foi confirmado anteriormente.', titulo });
    }

    // Identifica conta financeira enviada no modal PIX ou usa a conta padrão compatível
    let contaId = conta_financeira_id ? Number(conta_financeira_id) : null;
    if (contaId) {
      const contaRows = await conn.query('SELECT conta_financeira_id, tipo, ativo FROM conta_financeira WHERE conta_financeira_id = ?', [contaId]);
      if (!contaRows.length || !contaRows[0].ativo) {
        await conn.rollback();
        return res.status(400).json({ error: 'Conta financeira selecionada inválida ou inativa.' });
      }
      if (!formaCompativel({ tipo_conta_permitida: titulo.tipo_conta_permitida }, contaRows[0])) {
        await conn.rollback();
        return res.status(400).json({ error: MSG_INCOMPATIVEL });
      }
    } else {
      const tipoPermitido = titulo.tipo_conta_permitida || 'AMBOS';
      const filtroTipo = tipoPermitido === 'CAIXA' ? "AND tipo = 'CAIXA'" : "AND tipo = 'BANCO'";
      let contaDefault = await conn.query(`SELECT conta_financeira_id FROM conta_financeira WHERE ativo = TRUE ${filtroTipo} ORDER BY conta_financeira_id ASC LIMIT 1`);
      if (!contaDefault.length) {
        contaDefault = await conn.query('SELECT conta_financeira_id FROM conta_financeira WHERE ativo = TRUE ORDER BY conta_financeira_id ASC LIMIT 1');
      }
      contaId = contaDefault.length ? contaDefault[0].conta_financeira_id : 1;
    }

    const valorNum = parseFloat(titulo.valor);

    // Atualiza saldo da conta financeira (crédito no banco)
    await conn.query(
      'UPDATE conta_financeira SET saldo_atual = saldo_atual + ? WHERE conta_financeira_id = ?',
      [valorNum.toFixed(2), contaId]
    );

    // Registra no extrato
    await conn.query(
      `INSERT INTO movimento_financeiro (conta_financeira_id, titulo_id, tipo, valor, historico)
       VALUES (?, ?, 'ENTRADA', ?, ?)`,
      [contaId, titulo.titulo_id, valorNum.toFixed(2), `Recebimento PIX Ref. Req #${requisicaoId}`]
    );

    // Marca título como PAGO
    await conn.query(
      `UPDATE titulo_financeiro
       SET situacao = 'PAGO', data_pagamento = NOW(), conta_financeira_id = ?
       WHERE titulo_id = ?`,
      [contaId, titulo.titulo_id]
    );

    await conn.commit();

    res.json({
      message: 'Recebimento PIX confirmado com sucesso! Título baixado e saldo creditado.',
      titulo_id: titulo.titulo_id,
      valor: valorNum.toFixed(2),
      conta_id: contaId,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('[REQUISICOES] Erro ao confirmar recebimento PIX:', err);
    res.status(500).json({ error: 'Erro interno ao confirmar recebimento PIX.' });
  } finally {
    if (conn) conn.release();
  }
});

// ----------------------------------------------------------------
// CANCELAR REQUISIÇÃO (SOMENTE SE ABERTA)
// ----------------------------------------------------------------
router.patch('/:id/cancelar', async (req, res) => {
  try {
    const requisicaoId = req.params.id;

    const reqRows = await query('SELECT requisicao_situacao FROM requisicao WHERE requisicao_id = ?', [requisicaoId]);
    if (!reqRows.length) {
      return res.status(404).json({ error: 'Requisição não encontrada.' });
    }
    if (reqRows[0].requisicao_situacao !== 'ABERTA') {
      return res.status(400).json({
        error: `Não é possível cancelar uma requisição já ${reqRows[0].requisicao_situacao}.`
      });
    }

    await query(
      `UPDATE requisicao SET requisicao_situacao = 'CANCELADA' WHERE requisicao_id = ?`,
      [requisicaoId]
    );

    res.json({ message: 'Requisição cancelada com sucesso.' });
  } catch (err) {
    console.error('[REQUISICOES] Erro ao cancelar requisição:', err);
    res.status(500).json({ error: 'Erro interno ao cancelar requisição.' });
  }
});

// ----------------------------------------------------------------
// HISTÓRICO DE MOVIMENTAÇÕES DE UMA REQUISIÇÃO ESPECÍFICA
// ----------------------------------------------------------------
router.get('/:id/movimentacoes', async (req, res) => {
  try {
    const rows = await query(
      `SELECT mv.*,
              m.nome AS mercadoria_nome,
              m.codigo,
              tm.nome AS tipo_movimento_nome,
              tm.tipo_interno
       FROM movimentacao mv
       INNER JOIN mercadoria m ON m.mercadoria_id = mv.mercadoria_id
       INNER JOIN tipo_movimento tm ON tm.tipo_movimento_id = mv.tipo_movimento_id
       WHERE mv.requisicao_id = ?
       ORDER BY mv.movimentacao_id ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[REQUISICOES] Erro ao buscar movimentações da requisição:', err);
    res.status(500).json({ error: 'Erro interno ao buscar movimentações.' });
  }
});

// ----------------------------------------------------------------
// HISTÓRICO GERAL DE TODAS AS MOVIMENTAÇÕES
// ----------------------------------------------------------------
router.get('/movimentacoes/todas', async (req, res) => {
  try {
    const rows = await query(
      `SELECT mv.*,
              m.nome AS mercadoria_nome,
              m.codigo,
              tm.nome AS tipo_movimento_nome,
              tm.tipo_interno,
              r.requisicao_situacao,
              p.nome AS pessoa_nome
       FROM movimentacao mv
       INNER JOIN mercadoria m ON m.mercadoria_id = mv.mercadoria_id
       INNER JOIN tipo_movimento tm ON tm.tipo_movimento_id = mv.tipo_movimento_id
       INNER JOIN requisicao r ON r.requisicao_id = mv.requisicao_id
       INNER JOIN pessoa p ON p.pessoa_id = r.pessoa_id
       ORDER BY mv.data_movimentacao DESC, mv.movimentacao_id DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error('[REQUISICOES] Erro ao buscar todas movimentações:', err);
    res.status(500).json({ error: 'Erro interno ao buscar movimentações.' });
  }
});

module.exports = router;
