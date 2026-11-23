/**
 * Regras de compatibilidade entre Forma de Pagamento e Conta Financeira.
 * forma.tipo_conta_permitida: 'CAIXA' | 'BANCO' | 'AMBOS'
 * conta.tipo:                 'CAIXA' | 'BANCO'
 */
function formaCompativel(forma, conta) {
  if (!forma || !conta) return false;
  const permitido = forma.tipo_conta_permitida || 'AMBOS';
  return permitido === 'AMBOS' || permitido === conta.tipo;
}

const MSG_INCOMPATIVEL =
  'A forma de pagamento selecionada não é permitida para o tipo da conta financeira escolhida.';

module.exports = { formaCompativel, MSG_INCOMPATIVEL };
