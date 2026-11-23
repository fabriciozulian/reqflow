/**
 * ============================================================
 * Utilitário de Geração de PIX Estático (EMV BR Code)
 * Padrão Oficial do Banco Central do Brasil
 * ============================================================
 */

/**
 * Formata um campo no padrão TLV (Tag, Length, Value)
 * @param {string} id - Tag com 2 dígitos
 * @param {string} value - Valor do campo
 * @returns {string} Campo formatado (ex: "000201")
 */
function formatField(id, value) {
  const strValue = String(value);
  const len = strValue.length.toString().padStart(2, '0');
  return `${id}${len}${strValue}`;
}

/**
 * Remove acentuações e caracteres especiais
 * @param {string} str
 * @returns {string}
 */
function normalizeString(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
}

/**
 * Calcula o checksum CRC-16-CCITT (Polinômio 0x1021, Init 0xFFFF)
 * @param {string} payload - String completa até a tag "6304"
 * @returns {string} 4 caracteres hexadecimais em maiúsculo (ex: "B71A")
 */
function calculateCRC16(payload) {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera o Payload do PIX Copia e Cola (BR Code)
 * @param {object} params
 * @param {string} params.chave - Chave PIX (Telefone celular, CPF, CNPJ, Email ou Aleatória)
 * @param {string} [params.nome='ReqFlow'] - Nome do recebedor (max 25 chars)
 * @param {string} [params.cidade='Americana'] - Cidade do recebedor (max 15 chars)
 * @param {number|string} params.valor - Valor da cobrança (formato decimal com 2 casas)
 * @param {string} [params.identificador='***'] - Identificador da transação (TXID max 25 chars)
 * @returns {string} Código PIX completo para leitura / cópia
 */
function gerarPayloadPix({ chave = '19983354118', nome = 'ReqFlow', cidade = 'Americana', valor = 0, identificador = '***' }) {
  // Limpa chave de telefone se contiver pontuação
  const cleanChave = String(chave).trim();
  const cleanNome = normalizeString(nome).slice(0, 25) || 'ReqFlow';
  const cleanCidade = normalizeString(cidade).slice(0, 15) || 'Americana';
  const cleanTxid = normalizeString(identificador).replace(/\s/g, '').slice(0, 25) || '***';

  const valorNum = parseFloat(valor);
  const valorFormatado = (!isNaN(valorNum) && valorNum > 0) ? valorNum.toFixed(2) : null;

  // 00 - Payload Format Indicator (01)
  const f00 = formatField('00', '01');

  // 26 - Merchant Account Information (PIX)
  const f26_gui   = formatField('00', 'BR.GOV.BCB.PIX');
  const f26_chave = formatField('01', cleanChave);
  const f26 = formatField('26', `${f26_gui}${f26_chave}`);

  // 52 - Merchant Category Code
  const f52 = formatField('52', '0000');

  // 53 - Transaction Currency (986 = Real Brasileiro BRL)
  const f53 = formatField('53', '986');

  // 54 - Transaction Amount (opcional, mas obrigatório para valor fixo)
  const f54 = valorFormatado ? formatField('54', valorFormatado) : '';

  // 58 - Country Code (BR)
  const f58 = formatField('58', 'BR');

  // 59 - Merchant Name
  const f59 = formatField('59', cleanNome);

  // 60 - Merchant City
  const f60 = formatField('60', cleanCidade);

  // 62 - Additional Data Field Template (TXID)
  const f62_txid = formatField('05', cleanTxid);
  const f62 = formatField('62', f62_txid);

  // 63 - CRC16 (Tag + Length "6304")
  const basePayload = `${f00}${f26}${f52}${f53}${f54}${f58}${f59}${f60}${f62}6304`;
  const checksum = calculateCRC16(basePayload);

  return `${basePayload}${checksum}`;
}

module.exports = {
  gerarPayloadPix,
  calculateCRC16,
};
