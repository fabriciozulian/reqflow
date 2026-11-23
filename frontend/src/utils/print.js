/**
 * ReqFlow — Impressão de documentos (Requisição e Recibo Financeiro)
 * Monta o documento em #printArea e aciona window.print().
 */
const esc = (s) => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const money = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dateOnly = (v) => {
  if (!v) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
    const [y, m, d] = String(v).split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('pt-BR');
};

const dateTime = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

function enderecoPessoa(p) {
  const linha1 = [p.pessoa_logradouro, p.pessoa_numero].filter(Boolean).join(', ');
  const linha2 = [
    p.pessoa_bairro,
    [p.pessoa_cidade, p.pessoa_uf].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(' - ');
  const cep = p.pessoa_cep ? `CEP ${p.pessoa_cep}` : '';
  return [linha1, linha2, cep].filter(Boolean).join(' • ') || '-';
}

function getArea() {
  let area = document.getElementById('printArea');
  if (!area) {
    area = document.createElement('div');
    area.id = 'printArea';
    area.className = 'print-doc';
    document.body.appendChild(area);
  }
  return area;
}

function imprimir(html) {
  const area = getArea();
  area.innerHTML = html;
  document.body.classList.add('printing-doc');
  const limpar = () => {
    document.body.classList.remove('printing-doc');
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);
  window.print();
}

export function printRequisicao(req) {
  const itens = req.itens || [];
  let subtotal = 0;
  let descontos = 0;
  const linhas =
    itens
      .map((it) => {
        const bruto = (parseFloat(it.valor) || 0) * (parseInt(it.quantidade, 10) || 0);
        const desc = parseFloat(it.desconto) || 0;
        subtotal += bruto;
        descontos += desc;
        return `
        <tr>
          <td>${esc(it.codigo || '-')}</td>
          <td>${esc(it.mercadoria_nome)}</td>
          <td class="num">${it.quantidade}</td>
          <td class="num">${money(it.valor)}</td>
          <td class="num">${money(desc)}</td>
          <td class="num">${money(Math.max(0, bruto - desc))}</td>
        </tr>`;
      })
      .join('') ||
    '<tr><td colspan="6" style="text-align:center;">Nenhum item na requisição.</td></tr>';

  const total = Math.max(0, subtotal - descontos);

  imprimir(`
    <div class="doc-header">
      <div>
        <div class="doc-brand">ReqFlow</div>
        <div class="doc-sub">Gestão de Estoque e Requisições</div>
      </div>
      <div class="doc-header-right">
        <div class="doc-title">REQUISIÇÃO #${req.requisicao_id}</div>
        <div>Emitida em: ${dateTime(req.data_criacao)}</div>
        <div>Situação: <strong>${esc(req.requisicao_situacao)}</strong></div>
      </div>
    </div>

    <div class="doc-section">
      <div class="doc-section-title">${esc(req.tipo_movimento_nome || 'Pessoa')} — Dados da Pessoa</div>
      <div class="doc-grid">
        <div><span>Nome:</span> <strong>${esc(req.pessoa_nome)}</strong></div>
        <div><span>CPF/CNPJ:</span> ${esc(req.pessoa_documento || '-')}</div>
        <div><span>Telefone:</span> ${esc(req.pessoa_telefone || '-')}</div>
        <div><span>E-mail:</span> ${esc(req.pessoa_email || '-')}</div>
        <div class="full"><span>Endereço:</span> ${esc(enderecoPessoa(req))}</div>
      </div>
    </div>

    <div class="doc-section">
      <div class="doc-section-title">Itens</div>
      <table class="doc-table">
        <thead>
          <tr><th>Código</th><th>Mercadoria</th><th class="num">Qtd</th><th class="num">Valor Unit.</th><th class="num">Desconto</th><th class="num">Subtotal</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>

    <div class="doc-section doc-summary">
      <div class="doc-grid">
        <div><span>Forma de Pagamento:</span> ${esc(req.forma_pagamento_nome || '-')}</div>
        <div><span>Conta Financeira:</span> ${esc(req.conta_nome || 'Definir na Baixa')}</div>
        <div><span>Data de Vencimento:</span> ${dateOnly(req.data_vencimento)}</div>
        <div><span>Responsável:</span> ${esc(req.usuario_nome || req.usuario_email || '-')}</div>
      </div>
      <table class="doc-totals">
        <tr><td>Subtotal</td><td class="num">${money(subtotal)}</td></tr>
        <tr><td>Total de Descontos</td><td class="num">- ${money(descontos)}</td></tr>
        <tr class="doc-total-final"><td>Valor Total Líquido</td><td class="num">${money(total)}</td></tr>
      </table>
    </div>

    ${req.observacao ? `<div class="doc-section"><span class="doc-label">Observação:</span> ${esc(req.observacao)}</div>` : ''}

    <div class="doc-signatures">
      <div><div class="doc-sign-line"></div>Assinatura do responsável</div>
      <div><div class="doc-sign-line"></div>Assinatura do ${esc(req.pessoa_nome ? 'cliente/fornecedor' : 'recebedor')}</div>
    </div>
    <div class="doc-footer">ReqFlow — Documento impresso em ${dateTime(new Date())}</div>
  `);
}

export function printRecibo(t) {
  const id = t.titulo_id || t.titulo_financeiro_id;
  const receber = t.tipo === 'RECEBER';
  const titulo = receber ? 'RECIBO DE RECEBIMENTO' : 'RECIBO DE PAGAMENTO';
  const papel = receber ? 'Recebido de' : 'Pago a';
  const referencia = [
    t.descricao,
    t.requisicao_id ? `Requisição #${t.requisicao_id}` : null,
  ]
    .filter(Boolean)
    .join(' — ');

  imprimir(`
    <div class="doc-header">
      <div>
        <div class="doc-brand">ReqFlow</div>
        <div class="doc-sub">Gestão de Estoque e Requisições</div>
      </div>
      <div class="doc-header-right">
        <div class="doc-title">${titulo}</div>
        <div>Título <strong>#${id}</strong></div>
      </div>
    </div>

    <div class="doc-amount">${money(t.valor)}</div>

    <div class="doc-section">
      <div class="doc-grid">
        <div class="full"><span>${papel}:</span> <strong>${esc(t.pessoa_nome)}</strong></div>
        <div><span>CPF/CNPJ:</span> ${esc(t.pessoa_documento || '-')}</div>
        <div><span>Tipo:</span> ${esc(t.tipo_pessoa_nome || '-')}</div>
        <div class="full"><span>Referente a:</span> ${esc(referencia || '-')}</div>
        <div><span>Data da Baixa:</span> ${dateOnly(t.data_pagamento)}</div>
        <div><span>Vencimento:</span> ${dateOnly(t.data_vencimento)}</div>
        <div><span>Conta Financeira:</span> ${esc(t.conta_nome || '-')}</div>
        <div><span>Forma de Pagamento:</span> ${esc(t.forma_pagamento_nome || '-')}</div>
      </div>
    </div>

    <p class="doc-declaracao">
      ${
        receber
          ? `Declaramos ter recebido de <strong>${esc(t.pessoa_nome)}</strong> a importância de <strong>${money(t.valor)}</strong>, referente ao descrito acima, dando plena quitação.`
          : `Declaramos ter efetuado o pagamento a <strong>${esc(t.pessoa_nome)}</strong> no valor de <strong>${money(t.valor)}</strong>, referente ao descrito acima.`
      }
    </p>

    <div class="doc-signatures single">
      <div><div class="doc-sign-line"></div>Assinatura</div>
    </div>
    <div class="doc-footer">Recibo emitido em ${dateTime(new Date())} — ReqFlow</div>
  `);
}
