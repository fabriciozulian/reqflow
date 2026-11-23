import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Eye,
  Printer,
  Trash2,
  CheckCircle2,
  XCircle,
  Copy,
  QrCode,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  apiFetch,
  formatCurrency,
  formatDate,
  formatDateTime,
  isTrue,
  getTodayISO,
} from '../services/api';
import { useToast } from '../context/ToastContext';
import { printRequisicao } from '../utils/print';
import { generateQRCodeSVG } from '../utils/qrcode';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import AutocompleteSelect from '../components/AutocompleteSelect';

export default function Requisicoes() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [requisicoes, setRequisicoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroSituacao, setFiltroSituacao] = useState('');

  // Dados auxiliares para criação/adição de itens
  const [pessoas, setPessoas] = useState([]);
  const [tiposMovimento, setTiposMovimento] = useState([]);
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [contasFinanceiras, setContasFinanceiras] = useState([]);
  const [mercadorias, setMercadorias] = useState([]);

  // Modal Nova Requisição
  const [novaOpen, setNovaOpen] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState(null);
  const [novaForm, setNovaForm] = useState({
    tipo_movimento_id: '',
    forma_pagamento_id: '',
    conta_financeira_id: '',
    data_vencimento: getTodayISO(),
    observacao: '',
  });
  const [creatingReq, setCreatingReq] = useState(false);
  const [novaError, setNovaError] = useState('');

  // Modal Detalhes da Requisição
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [currentReq, setCurrentReq] = useState(null);
  const [detalheContaId, setDetalheContaId] = useState('');
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [detalheError, setDetalheError] = useState('');

  // Adicionar item no Detalhe
  const [selectedMercadoria, setSelectedMercadoria] = useState(null);
  const [itemQtd, setItemQtd] = useState('1');
  const [itemValor, setItemValor] = useState('');
  const [itemDesconto, setItemDesconto] = useState('0');
  const [addingItem, setAddingItem] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  // Modal PIX
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [pixContaId, setPixContaId] = useState('');
  const [confirmingPix, setConfirmingPix] = useState(false);

  const loadRequisicoes = async () => {
    try {
      setLoading(true);
      const q = filtroSituacao
        ? `?situacao=${encodeURIComponent(filtroSituacao)}`
        : '';
      const res = await apiFetch(`/api/requisicoes${q}`);
      setRequisicoes(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      toast.error('Erro ao carregar requisições: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAuxiliares = async () => {
    try {
      const [pRes, tmRes, fpRes, cfRes, mRes] = await Promise.all([
        apiFetch('/api/pessoas?ativo=true'),
        apiFetch('/api/requisicoes/tipos-movimento'),
        apiFetch('/api/financeiro/formas-pagamento?ativo=true'),
        apiFetch('/api/financeiro/contas?ativo=true'),
        apiFetch('/api/mercadorias?ativo=true'),
      ]);

      const pList = Array.isArray(pRes) ? pRes : pRes.data || [];
      setPessoas(pList.filter((p) => p.tipo_pessoa_nome !== 'FUNCIONARIO'));
      setTiposMovimento(Array.isArray(tmRes) ? tmRes : tmRes.data || []);
      setFormasPagamento(
        Array.isArray(fpRes) ? fpRes : fpRes.formas || fpRes.data || []
      );
      setContasFinanceiras(
        Array.isArray(cfRes) ? cfRes : cfRes.contas || cfRes.data || []
      );
      setMercadorias(Array.isArray(mRes) ? mRes : mRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar listas auxiliares: ' + err.message);
    }
  };

  useEffect(() => {
    loadRequisicoes();
  }, [filtroSituacao]);

  useEffect(() => {
    loadAuxiliares();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'nova') {
      handleOpenNova();
      setSearchParams({});
    }
  }, [searchParams]);

  const pessoaOptions = useMemo(
    () =>
      pessoas.map((p) => ({
        id: p.pessoa_id,
        label: `[${p.tipo_pessoa_nome}] ${p.nome}`,
        subtext: `CPF/CNPJ: ${p.cpf_cnpj || 'S/D'} • ${p.cidade || ''}`,
        raw: p,
      })),
    [pessoas]
  );

  const mercadoriaOptions = useMemo(
    () =>
      mercadorias.map((m) => ({
        id: m.mercadoria_id,
        label: `${m.codigo ? `[${m.codigo}] ` : ''}${m.nome}`,
        subtext: `Estoque: ${m.estoque} un. • Preço: ${formatCurrency(
          m.valor_venda
        )}`,
        raw: m,
      })),
    [mercadorias]
  );

  // Verifica se a forma selecionada no modal de Nova Requisição exige Conta Financeira (baixa_automatica = TRUE)
  const formaSelecionadaNova = useMemo(
    () =>
      formasPagamento.find(
        (f) => String(f.forma_pagamento_id) === String(novaForm.forma_pagamento_id)
      ),
    [formasPagamento, novaForm.forma_pagamento_id]
  );

  const exigeContaNova = Boolean(
    formaSelecionadaNova && isTrue(formaSelecionadaNova.baixa_automatica)
  );

  const contasCompativeisNova = useMemo(() => {
    if (!formaSelecionadaNova) return [];
    const permitido = formaSelecionadaNova.tipo_conta_permitida || 'AMBOS';
    return contasFinanceiras.filter(
      (c) =>
        isTrue(c.ativo) &&
        (permitido === 'AMBOS' || c.tipo === permitido)
    );
  }, [contasFinanceiras, formaSelecionadaNova]);

  // Contas compatíveis para o modal de Detalhes (quando requisição aberta é de baixa automática)
  const contasCompativeisDetalhe = useMemo(() => {
    if (!currentReq) return [];
    const permitido = currentReq.tipo_conta_permitida || 'AMBOS';
    return contasFinanceiras.filter(
      (c) =>
        isTrue(c.ativo) &&
        (permitido === 'AMBOS' || c.tipo === permitido)
    );
  }, [contasFinanceiras, currentReq]);

  // Contas compatíveis para o modal PIX
  const contasCompativeisPix = useMemo(() => {
    const permitido = pixData?.tipo_conta_permitida || 'AMBOS';
    return contasFinanceiras.filter(
      (c) =>
        isTrue(c.ativo) &&
        (permitido === 'AMBOS' || c.tipo === permitido)
    );
  }, [contasFinanceiras, pixData]);

  const handleOpenNova = () => {
    setSelectedPessoa(null);
    setNovaForm({
      tipo_movimento_id: '',
      forma_pagamento_id: '',
      conta_financeira_id: '',
      data_vencimento: getTodayISO(),
      observacao: '',
    });
    setNovaError('');
    setNovaOpen(true);
  };

  const handleCreateReq = async (e) => {
    e.preventDefault();
    setNovaError('');

    if (!selectedPessoa?.id) {
      setNovaError(
        'Selecione uma Pessoa no campo de busca (digite pelo menos 2 caracteres).'
      );
      return;
    }
    if (!novaForm.tipo_movimento_id) {
      setNovaError('Selecione o Tipo de Movimento.');
      return;
    }
    if (!novaForm.forma_pagamento_id) {
      setNovaError('Selecione a Forma de Pagamento / Recebimento.');
      return;
    }
    if (exigeContaNova && !novaForm.conta_financeira_id) {
      setNovaError(
        `A forma "${formaSelecionadaNova?.nome}" possui baixa automática. Selecione a Conta Financeira para Baixa.`
      );
      return;
    }
    if (!novaForm.data_vencimento) {
      setNovaError('Informe a Data de Vencimento.');
      return;
    }

    try {
      setCreatingReq(true);
      const nova = await apiFetch('/api/requisicoes', {
        method: 'POST',
        body: JSON.stringify({
          pessoa_id: selectedPessoa.id,
          tipo_movimento_id: novaForm.tipo_movimento_id,
          forma_pagamento_id: novaForm.forma_pagamento_id,
          conta_financeira_id: exigeContaNova
            ? Number(novaForm.conta_financeira_id)
            : null,
          data_vencimento: novaForm.data_vencimento,
          observacao: novaForm.observacao || null,
        }),
      });

      toast.success(`Requisição #${nova.requisicao_id} criada com sucesso!`);
      setNovaOpen(false);
      loadRequisicoes();
      handleOpenDetalhe(nova.requisicao_id);
    } catch (err) {
      setNovaError(err.message);
    } finally {
      setCreatingReq(false);
    }
  };

  const handleOpenDetalhe = async (id) => {
    setDetalheOpen(true);
    setLoadingDetalhe(true);
    setDetalheError('');
    setSelectedMercadoria(null);
    setItemQtd('1');
    setItemValor('');
    setItemDesconto('0');
    try {
      const req = await apiFetch(`/api/requisicoes/${id}`);
      setCurrentReq(req);
      setDetalheContaId(
        req.conta_financeira_id ? String(req.conta_financeira_id) : ''
      );
    } catch (err) {
      setDetalheError(err.message);
    } finally {
      setLoadingDetalhe(false);
    }
  };

  const handlePrint = async (id) => {
    try {
      const req = await apiFetch(`/api/requisicoes/${id}`);
      printRequisicao(req);
    } catch (err) {
      toast.error('Erro ao preparar impressão: ' + err.message);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setDetalheError('');

    if (!selectedMercadoria?.id) {
      setDetalheError('Selecione uma mercadoria no campo Autocomplete.');
      return;
    }

    const q = parseInt(itemQtd, 10);
    if (!q || q <= 0) {
      setDetalheError('A quantidade deve ser maior que zero.');
      return;
    }

    const v = parseFloat(itemValor);
    if (isNaN(v) || v < 0) {
      setDetalheError('Informe um valor unitário válido.');
      return;
    }

    try {
      setAddingItem(true);
      await apiFetch(`/api/requisicoes/${currentReq.requisicao_id}/itens`, {
        method: 'POST',
        body: JSON.stringify({
          mercadoria_id: selectedMercadoria.id,
          quantidade: q,
          valor: v,
          desconto: parseFloat(itemDesconto) || 0,
        }),
      });

      const updated = await apiFetch(
        `/api/requisicoes/${currentReq.requisicao_id}`
      );
      setCurrentReq(updated);
      setSelectedMercadoria(null);
      setItemQtd('1');
      setItemValor('');
      setItemDesconto('0');
      toast.success('Item adicionado à requisição!');
    } catch (err) {
      setDetalheError(err.message);
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await apiFetch(
        `/api/requisicoes/${currentReq.requisicao_id}/itens/${itemId}`,
        { method: 'DELETE' }
      );
      const updated = await apiFetch(
        `/api/requisicoes/${currentReq.requisicao_id}`
      );
      setCurrentReq(updated);
      toast.info('Item removido.');
    } catch (err) {
      setDetalheError(err.message);
    }
  };

  const handleFinalizar = async () => {
    if (isTrue(currentReq.baixa_automatica) && !detalheContaId) {
      setDetalheError(
        `A forma "${currentReq.forma_pagamento_nome}" possui baixa automática. Selecione a Conta Financeira para Baixa antes de finalizar.`
      );
      return;
    }

    if (
      !window.confirm(
        `Confirma a finalização da Requisição #${currentReq.requisicao_id}? Esta ação movimentará o estoque e gerará o título financeiro.`
      )
    )
      return;

    setDetalheError('');
    try {
      setFinalizando(true);
      const res = await apiFetch(
        `/api/requisicoes/${currentReq.requisicao_id}/finalizar`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            conta_financeira_id: detalheContaId ? Number(detalheContaId) : null,
          }),
        }
      );

      toast.success(
        isTrue(currentReq.baixa_automatica)
          ? `Requisição #${currentReq.requisicao_id} finalizada e baixada automaticamente no financeiro!`
          : `Requisição #${currentReq.requisicao_id} finalizada com sucesso!`
      );
      const updated = await apiFetch(
        `/api/requisicoes/${currentReq.requisicao_id}`
      );
      setCurrentReq(updated);
      loadRequisicoes();
      loadAuxiliares();

      if (res.pix && res.pix.payload) {
        setPixData(res.pix);
        const permitido = res.pix.tipo_conta_permitida || 'AMBOS';
        const comp = contasFinanceiras.filter(
          (c) =>
            isTrue(c.ativo) &&
            (permitido === 'AMBOS' || c.tipo === permitido)
        );
        const pref = comp.find((c) => c.tipo === 'BANCO') || comp[0];
        setPixContaId(pref ? String(pref.conta_financeira_id) : '');
        setPixModalOpen(true);
      }
    } catch (err) {
      setDetalheError(err.message);
    } finally {
      setFinalizando(false);
    }
  };

  const handleCancelarReq = async () => {
    if (
      !window.confirm(
        `Deseja realmente cancelar a Requisição #${currentReq.requisicao_id}?`
      )
    )
      return;

    try {
      await apiFetch(`/api/requisicoes/${currentReq.requisicao_id}/cancelar`, {
        method: 'PATCH',
      });
      toast.warning(`Requisição #${currentReq.requisicao_id} cancelada.`);
      const updated = await apiFetch(
        `/api/requisicoes/${currentReq.requisicao_id}`
      );
      setCurrentReq(updated);
      loadRequisicoes();
    } catch (err) {
      setDetalheError(err.message);
    }
  };

  const handleConfirmarPix = async () => {
    if (!pixData?.requisicao_id) return;
    if (!pixContaId) {
      toast.error('Selecione a Conta Financeira para creditar o recebimento PIX.');
      return;
    }
    try {
      setConfirmingPix(true);
      const res = await apiFetch(
        `/api/requisicoes/${pixData.requisicao_id}/confirmar-pix`,
        {
          method: 'POST',
          body: JSON.stringify({
            conta_financeira_id: Number(pixContaId),
          }),
        }
      );
      toast.success(res.message || 'Pagamento PIX confirmado!');
      setPixModalOpen(false);
      if (currentReq?.requisicao_id) {
        const updated = await apiFetch(
          `/api/requisicoes/${currentReq.requisicao_id}`
        );
        setCurrentReq(updated);
      }
      loadRequisicoes();
      loadAuxiliares();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmingPix(false);
    }
  };

  const totalCurrentReq = useMemo(() => {
    if (!currentReq?.itens) return 0;
    return currentReq.itens.reduce((acc, it) => {
      const b = (parseFloat(it.valor) || 0) * (parseInt(it.quantidade, 10) || 0);
      const d = parseFloat(it.desconto) || 0;
      return acc + Math.max(0, b - d);
    }, 0);
  }, [currentReq]);

  const columns = [
    {
      header: '#',
      key: 'requisicao_id',
      render: (r) => (
        <span className="font-mono font-bold text-slate-800">
          #{r.requisicao_id}
        </span>
      ),
    },
    {
      header: 'Pessoa (Cliente / Fornecedor)',
      key: 'pessoa_nome',
      render: (r) => (
        <span className="font-semibold text-slate-900">{r.pessoa_nome}</span>
      ),
    },
    {
      header: 'Tipo de Movimento',
      key: 'tipo_movimento_nome',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-slate-700 font-medium">
            {r.tipo_movimento_nome}
          </span>
          {r.tipo_interno === 'ENTRADA' && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
              <ArrowDownLeft className="w-3 h-3" /> ENTRADA
            </span>
          )}
          {r.tipo_interno === 'SAIDA' && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">
              <ArrowUpRight className="w-3 h-3" /> SAÍDA
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Forma Pagto',
      key: 'forma_pagamento_nome',
      render: (r) => (
        <span className="text-xs font-medium text-slate-600">
          {r.forma_pagamento_nome || '-'}
        </span>
      ),
    },
    {
      header: 'Situação',
      align: 'center',
      render: (r) => {
        if (r.requisicao_situacao === 'FINALIZADA') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Finalizada
            </span>
          );
        }
        if (r.requisicao_situacao === 'ABERTA') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              <Clock className="w-3.5 h-3.5" /> Aberta
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            <XCircle className="w-3.5 h-3.5" /> Cancelada
          </span>
        );
      },
    },
    {
      header: 'Responsável',
      key: 'usuario_nome',
      render: (r) => (
        <span className="text-xs text-slate-600">{r.usuario_nome || '-'}</span>
      ),
    },
    {
      header: 'Data Criação',
      key: 'data_criacao',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {formatDateTime(r.data_criacao)}
        </span>
      ),
    },
    {
      header: 'Ações',
      align: 'right',
      render: (r) => (
        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={() => handleOpenDetalhe(r.requisicao_id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Detalhes</span>
          </button>
          <button
            onClick={() => handlePrint(r.requisicao_id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors"
            title="Imprimir / Reimprimir Requisição"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={filtroSituacao}
            onChange={(e) => setFiltroSituacao(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700"
          >
            <option value="">Todas as Situações</option>
            <option value="ABERTA">Abertas</option>
            <option value="FINALIZADA">Finalizadas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>

        <button
          onClick={handleOpenNova}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Requisição</span>
        </button>
      </div>

      {/* Tabela */}
      <DataTable
        columns={columns}
        data={requisicoes}
        loading={loading}
        keyField="requisicao_id"
      />

      {/* MODAL: Nova Requisição (Sem Conta Financeira, apenas Forma de Pagamento e Vencimento) */}
      <Modal
        isOpen={novaOpen}
        onClose={() => setNovaOpen(false)}
        title="Nova Requisição Comercial"
        subtitle="Defina o cliente/fornecedor, tipo de movimento e condição de pagamento combinada"
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNovaOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="formNovaRequisicao"
              disabled={creatingReq}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {creatingReq ? 'Criando...' : 'Criar Requisição'}
            </button>
          </>
        }
      >
        <form
          id="formNovaRequisicao"
          onSubmit={handleCreateReq}
          className="space-y-4"
        >
          {novaError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {novaError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pessoa (Cliente / Fornecedor) *
              </label>
              <AutocompleteSelect
                items={pessoaOptions}
                value={selectedPessoa}
                onChange={setSelectedPessoa}
                multiple={false}
                minChars={2}
                placeholder="Digite 2+ letras ou CPF/CNPJ para buscar..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Movimento *
              </label>
              <select
                value={novaForm.tipo_movimento_id}
                onChange={(e) =>
                  setNovaForm({ ...novaForm, tipo_movimento_id: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              >
                <option value="">Selecione...</option>
                {tiposMovimento.map((tm) => (
                  <option
                    key={tm.tipo_movimento_id}
                    value={tm.tipo_movimento_id}
                  >
                    {tm.nome} ({tm.tipo_interno})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Forma de Pagamento / Recebimento *
              </label>
              <select
                value={novaForm.forma_pagamento_id}
                onChange={(e) =>
                  setNovaForm({
                    ...novaForm,
                    forma_pagamento_id: e.target.value,
                    conta_financeira_id: '',
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              >
                <option value="">Selecione...</option>
                {formasPagamento
                  .filter((f) => isTrue(f.ativo))
                  .map((f) => (
                    <option
                      key={f.forma_pagamento_id}
                      value={f.forma_pagamento_id}
                    >
                      {f.nome}
                      {isTrue(f.baixa_automatica) ? ' • Baixa Automática' : ''}
                      {isTrue(f.tipo_pix) ? ' ⚡ PIX' : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Vencimento *
              </label>
              <input
                type="date"
                value={novaForm.data_vencimento}
                onChange={(e) =>
                  setNovaForm({ ...novaForm, data_vencimento: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              />
            </div>
          </div>

          {/* Exibido dinamicamente APENAS quando a Forma selecionada possui baixa_automatica = TRUE */}
          {exigeContaNova && (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
              <label className="block text-xs font-bold text-emerald-900">
                Conta Financeira para Baixa *
              </label>
              <select
                value={novaForm.conta_financeira_id}
                onChange={(e) =>
                  setNovaForm({
                    ...novaForm,
                    conta_financeira_id: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-white text-sm text-slate-900"
                required
              >
                <option value="">
                  {contasCompativeisNova.length
                    ? 'Selecione a conta onde o saldo será movimentado...'
                    : 'Nenhuma conta compatível ativa'}
                </option>
                {contasCompativeisNova.map((c) => (
                  <option
                    key={c.conta_financeira_id}
                    value={c.conta_financeira_id}
                  >
                    {c.nome} ({c.tipo}) — Saldo: {formatCurrency(c.saldo_atual)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-emerald-800">
                Como <strong>{formaSelecionadaNova?.nome}</strong> possui baixa
                automática, ao finalizar a requisição o título já nascerá como{' '}
                <strong>PAGO</strong> e movimentará o saldo desta conta (espécie
                permitida: <strong>{formaSelecionadaNova?.tipo_conta_permitida}</strong>).
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observação
            </label>
            <input
              type="text"
              maxLength={255}
              value={novaForm.observacao}
              onChange={(e) =>
                setNovaForm({ ...novaForm, observacao: e.target.value })
              }
              placeholder="Observações comerciais ou condições de entrega..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
        </form>
      </Modal>

      {/* MODAL: Detalhes da Requisição */}
      <Modal
        isOpen={detalheOpen}
        onClose={() => setDetalheOpen(false)}
        title={
          currentReq
            ? `Requisição #${currentReq.requisicao_id}`
            : 'Detalhes da Requisição'
        }
        subtitle={
          currentReq
            ? `${currentReq.pessoa_nome} • ${currentReq.tipo_movimento_nome}`
            : ''
        }
        size="xl"
        footer={
          currentReq && (
            <div className="w-full flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => printRequisicao(currentReq)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Reimprimir</span>
              </button>

              <div className="flex items-center gap-2">
                {currentReq.requisicao_situacao === 'ABERTA' && (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelarReq}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold"
                    >
                      Cancelar Requisição
                    </button>
                    <button
                      type="button"
                      disabled={finalizando}
                      onClick={handleFinalizar}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {finalizando ? 'Finalizando...' : 'Finalizar Requisição'}
                      </span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setDetalheOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Fechar
                </button>
              </div>
            </div>
          )
        }
      >
        {loadingDetalhe || !currentReq ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Carregando dados da requisição...
          </div>
        ) : (
          <div className="space-y-6">
            {detalheError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {detalheError}
              </div>
            )}

            {/* Resumo Superior */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">Pessoa</span>
                <strong className="text-slate-900 text-sm">
                  {currentReq.pessoa_nome}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Forma Pagto</span>
                <strong className="text-slate-800">
                  {currentReq.forma_pagamento_nome || '-'}
                  {isTrue(currentReq.baixa_automatica) ? ' (À Vista)' : ''}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Conta Financeira</span>
                <strong className="text-slate-800">
                  {currentReq.conta_nome || 'Definir na Baixa'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Vencimento</span>
                <strong className="text-slate-800">
                  {formatDate(currentReq.data_vencimento)}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Situação / Título</span>
                <strong className="text-slate-900">
                  {currentReq.requisicao_situacao}
                  {currentReq.titulo_situacao
                    ? ` • ${currentReq.titulo_situacao}`
                    : ''}
                </strong>
              </div>
            </div>

            {/* Se ABERTA e forma tem baixa_automatica = TRUE, permite confirmar/alterar a Conta Financeira para Baixa */}
            {currentReq.requisicao_situacao === 'ABERTA' &&
              isTrue(currentReq.baixa_automatica) && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-900">
                      Conta Financeira para Baixa Automática ({currentReq.forma_pagamento_nome}) *
                    </div>
                    <div className="text-[11px] text-emerald-700">
                      Ao finalizar, o título será liquidado automaticamente nesta conta.
                    </div>
                  </div>
                  <select
                    value={detalheContaId}
                    onChange={(e) => setDetalheContaId(e.target.value)}
                    className="sm:w-72 px-3 py-2 rounded-lg border border-emerald-300 bg-white text-xs font-medium text-slate-900"
                  >
                    <option value="">Selecione a Conta...</option>
                    {contasCompativeisDetalhe.map((c) => (
                      <option
                        key={c.conta_financeira_id}
                        value={c.conta_financeira_id}
                      >
                        {c.nome} ({c.tipo}) — {formatCurrency(c.saldo_atual)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* Adicionar Item (apenas se ABERTA) */}
            {currentReq.requisicao_situacao === 'ABERTA' && (
              <form
                onSubmit={handleAddItem}
                className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Adicionar Mercadoria à Requisição
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mercadoria *
                    </label>
                    <AutocompleteSelect
                      items={mercadoriaOptions}
                      value={selectedMercadoria}
                      onChange={(opt) => {
                        setSelectedMercadoria(opt);
                        if (opt?.raw?.valor_venda !== undefined) {
                          setItemValor(String(opt.raw.valor_venda));
                        }
                      }}
                      multiple={false}
                      minChars={2}
                      placeholder="Digite 2+ letras ou código..."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Qtd *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={itemQtd}
                      onChange={(e) => setItemQtd(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Valor Unit. (R$) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemValor}
                      onChange={(e) => setItemValor(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Desconto (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemDesconto}
                      onChange={(e) => setItemDesconto(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="submit"
                      disabled={addingItem}
                      className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center"
                      title="Adicionar Item"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Tabela de Itens */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    <th className="px-4 py-2.5">Código</th>
                    <th className="px-4 py-2.5">Mercadoria</th>
                    <th className="px-4 py-2.5 text-center">Qtd</th>
                    <th className="px-4 py-2.5 text-right">Valor Unit.</th>
                    <th className="px-4 py-2.5 text-right">Desconto</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                    {currentReq.requisicao_situacao === 'ABERTA' && (
                      <th className="px-4 py-2.5 text-right">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!currentReq.itens || currentReq.itens.length === 0) ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-xs text-slate-400"
                      >
                        Nenhum item adicionado a esta requisição.
                      </td>
                    </tr>
                  ) : (
                    currentReq.itens.map((it) => {
                      const sub = Math.max(
                        0,
                        (parseFloat(it.valor) || 0) *
                          (parseInt(it.quantidade, 10) || 0) -
                          (parseFloat(it.desconto) || 0)
                      );
                      return (
                        <tr key={it.item_requisicao_id}>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                            {it.codigo || '-'}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {it.mercadoria_nome}
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold">
                            {it.quantidade}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {formatCurrency(it.valor)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-rose-600">
                            {parseFloat(it.desconto) > 0
                              ? `- ${formatCurrency(it.desconto)}`
                              : 'R$ 0,00'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                            {formatCurrency(sub)}
                          </td>
                          {currentReq.requisicao_situacao === 'ABERTA' && (
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() =>
                                  handleRemoveItem(it.item_requisicao_id)
                                }
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-right uppercase text-xs tracking-wider text-slate-500"
                    >
                      Total Líquido da Requisição:
                    </td>
                    <td className="px-4 py-3 text-right text-base text-indigo-700">
                      {formatCurrency(totalCurrentReq)}
                    </td>
                    {currentReq.requisicao_situacao === 'ABERTA' && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Pagamento PIX QR Code Estático */}
      <Modal
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        title="Pagamento Instantâneo via PIX"
        subtitle="Escaneie o QR Code oficial ou utilize o código Copia e Cola"
        size="sm"
        footer={
          pixData?.ja_baixado ? (
            <button
              type="button"
              onClick={() => setPixModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              Fechar (Baixa Automática Já Realizada)
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPixModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Receber Depois (Manter Pendente)
              </button>
              <button
                type="button"
                disabled={confirmingPix}
                onClick={handleConfirmarPix}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {confirmingPix
                    ? 'Confirmando...'
                    : 'Confirmar Recebimento PIX'}
                </span>
              </button>
            </>
          )
        }
      >
        {pixData && (
          <div className="text-center space-y-4">
            <div className="inline-flex flex-col items-center p-4 bg-white rounded-2xl border-2 border-emerald-500 shadow-sm">
              <div
                dangerouslySetInnerHTML={{
                  __html: generateQRCodeSVG(pixData.payload, 200),
                }}
              />
              <span className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" /> Padrão EMV® BR Code BACEN
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="text-slate-500">Valor a Receber</div>
              <div className="text-2xl font-extrabold text-emerald-600">
                {formatCurrency(pixData.valor)}
              </div>
              <div className="text-slate-600 pt-1">
                Chave PIX: <strong>{pixData.chave}</strong> • Favorecido:{' '}
                <strong>{pixData.recebedor}</strong> ({pixData.cidade})
              </div>
            </div>

            {!pixData.ja_baixado && (
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conta Financeira para Recebimento PIX *
                </label>
                <select
                  value={pixContaId}
                  onChange={(e) => setPixContaId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900"
                >
                  <option value="">Selecione a conta destino...</option>
                  {contasCompativeisPix.map((c) => (
                    <option
                      key={c.conta_financeira_id}
                      value={c.conta_financeira_id}
                    >
                      {c.nome} ({c.tipo}) — Saldo: {formatCurrency(c.saldo_atual)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-left">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                PIX Copia e Cola
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={pixData.payload}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 font-mono text-[11px] text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.payload);
                    toast.success('Código PIX Copia e Cola copiado!');
                  }}
                  className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
