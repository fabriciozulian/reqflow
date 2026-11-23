import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  Printer,
  DollarSign,
  Filter,
  RotateCcw,
  FileText,
  History,
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
import { printRecibo } from '../utils/print';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import AutocompleteSelect from '../components/AutocompleteSelect';

export default function Financeiro() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('titulos');

  // Dados principais
  const [titulos, setTitulos] = useState([]);
  const [totais, setTotais] = useState({
    saldo_caixas_bancos: 0,
    total_a_receber: 0,
    total_a_pagar: 0,
  });
  const [extrato, setExtrato] = useState([]);
  const [contas, setContas] = useState([]);
  const [formas, setFormas] = useState([]);
  const [pessoas, setPessoas] = useState([]);

  const [loadingTitulos, setLoadingTitulos] = useState(true);
  const [loadingExtrato, setLoadingExtrato] = useState(false);

  // Filtros de Títulos
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroPessoas, setFiltroPessoas] = useState([]);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Filtros de Extrato
  const [extratoContaId, setExtratoContaId] = useState('');
  const [extratoTipo, setExtratoTipo] = useState('');
  const [extratoDataInicio, setExtratoDataInicio] = useState('');
  const [extratoDataFim, setExtratoDataFim] = useState('');

  // Modal Novo Lançamento Avulso
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [selectedPessoaModal, setSelectedPessoaModal] = useState(null);
  const [novoForm, setNovoForm] = useState({
    tipo: 'RECEBER',
    descricao: '',
    valor: '',
    data_vencimento: getTodayISO(),
    conta_financeira_id: '',
    forma_pagamento_id: '',
  });
  const [savingNovo, setSavingNovo] = useState(false);
  const [novoError, setNovoError] = useState('');

  // Modal Realizar Baixa
  const [baixaModalOpen, setBaixaModalOpen] = useState(false);
  const [tituloBaixa, setTituloBaixa] = useState(null);
  const [alterarFormaBaixa, setAlterarFormaBaixa] = useState(false);
  const [baixaForm, setBaixaForm] = useState({
    forma_pagamento_id: '',
    conta_financeira_id: '',
    data_pagamento: getTodayISO(),
    observacao: '',
  });
  const [savingBaixa, setSavingBaixa] = useState(false);
  const [baixaError, setBaixaError] = useState('');

  const loadAuxiliares = async () => {
    try {
      const [cRes, fRes, pRes] = await Promise.all([
        apiFetch('/api/financeiro/contas'),
        apiFetch('/api/financeiro/formas-pagamento'),
        apiFetch('/api/pessoas'),
      ]);
      setContas(Array.isArray(cRes) ? cRes : cRes.contas || cRes.data || []);
      setFormas(Array.isArray(fRes) ? fRes : fRes.formas || fRes.data || []);
      setPessoas(Array.isArray(pRes) ? pRes : pRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar dados auxiliares: ' + err.message);
    }
  };

  const loadTitulos = async (overrideFilters) => {
    try {
      setLoadingTitulos(true);
      const f = overrideFilters || {
        tipo: filtroTipo,
        situacao: filtroSituacao,
        pessoas: filtroPessoas,
        dataInicio: filtroDataInicio,
        dataFim: filtroDataFim,
      };

      const params = new URLSearchParams();
      if (f.tipo) params.append('tipo', f.tipo);
      if (f.situacao) params.append('situacao', f.situacao);
      if (f.pessoas && f.pessoas.length > 0) {
        params.append(
          'pessoa_ids',
          f.pessoas.map((p) => p.id).join(',')
        );
      }
      if (f.dataInicio) params.append('data_inicio', f.dataInicio);
      if (f.dataFim) params.append('data_fim', f.dataFim);

      const res = await apiFetch(`/api/financeiro/titulos?${params.toString()}`);
      const list = Array.isArray(res) ? res : res.titulos || res.data || [];
      setTitulos(list);
      if (res.totais) {
        setTotais(res.totais);
      }
    } catch (err) {
      toast.error('Erro ao consultar títulos financeiros: ' + err.message);
    } finally {
      setLoadingTitulos(false);
    }
  };

  const loadExtrato = async () => {
    try {
      setLoadingExtrato(true);
      const params = new URLSearchParams();
      if (extratoContaId) params.append('conta_financeira_id', extratoContaId);
      if (extratoTipo) params.append('tipo', extratoTipo);
      if (extratoDataInicio) params.append('data_inicio', extratoDataInicio);
      if (extratoDataFim) params.append('data_fim', extratoDataFim);

      const res = await apiFetch(
        `/api/financeiro/extrato?${params.toString()}`
      );
      setExtrato(Array.isArray(res) ? res : res.extrato || res.data || []);
    } catch (err) {
      toast.error('Erro ao carregar extrato: ' + err.message);
    } finally {
      setLoadingExtrato(false);
    }
  };

  useEffect(() => {
    loadAuxiliares();
    loadTitulos();
  }, []);

  useEffect(() => {
    if (activeTab === 'extrato') {
      loadExtrato();
    }
  }, [activeTab]);

  const pessoaOptions = useMemo(
    () =>
      pessoas.map((p) => ({
        id: p.pessoa_id,
        label: `[${p.tipo_pessoa_nome || 'PESSOA'}] ${p.nome}`,
        chipLabel: p.nome,
        subtext: `Doc: ${p.cpf_cnpj || 'S/D'} • ${p.cidade || ''}`,
      })),
    [pessoas]
  );

  // Formas compatíveis para o modal de Lançamento Avulso (quando conta opcional for informada)
  const formasParaNovoTitulo = useMemo(() => {
    const ativas = formas.filter((f) => isTrue(f.ativo));
    if (!novoForm.conta_financeira_id) return ativas;
    const contaSel = contas.find(
      (c) => String(c.conta_financeira_id) === String(novoForm.conta_financeira_id)
    );
    if (!contaSel) return ativas;
    return ativas.filter(
      (f) =>
        f.tipo_conta_permitida === 'AMBOS' ||
        f.tipo_conta_permitida === contaSel.tipo
    );
  }, [formas, contas, novoForm.conta_financeira_id]);

  // Contas compatíveis para o modal de Baixa (baseado na forma de pagamento selecionada)
  const { contasCompativeisBaixa, tipoPermitidoBaixa, formaSelecionadaBaixa } =
    useMemo(() => {
      const formaObj = formas.find(
        (f) => String(f.forma_pagamento_id) === String(baixaForm.forma_pagamento_id)
      );
      const tipoPermitido = formaObj
        ? formaObj.tipo_conta_permitida || 'AMBOS'
        : tituloBaixa?.tipo_conta_permitida || 'AMBOS';

      const compativeis = contas.filter((c) => {
        if (!isTrue(c.ativo)) return false;
        if (tipoPermitido === 'AMBOS') return true;
        return c.tipo === tipoPermitido;
      });

      return {
        contasCompativeisBaixa: compativeis,
        tipoPermitidoBaixa: tipoPermitido,
        formaSelecionadaBaixa: formaObj,
      };
    }, [formas, contas, baixaForm.forma_pagamento_id, tituloBaixa]);

  // Handlers de Lançamento Avulso
  const handleOpenNovoTitulo = () => {
    setSelectedPessoaModal(null);
    setNovoForm({
      tipo: 'RECEBER',
      descricao: '',
      valor: '',
      data_vencimento: getTodayISO(),
      conta_financeira_id: '',
      forma_pagamento_id: '',
    });
    setNovoError('');
    setNovoModalOpen(true);
  };

  const handleSaveNovoTitulo = async (e) => {
    e.preventDefault();
    setNovoError('');

    if (!selectedPessoaModal?.id) {
      setNovoError(
        'Selecione uma pessoa no campo Autocomplete (digite 2+ letras).'
      );
      return;
    }
    if (!novoForm.descricao.trim()) {
      setNovoError('Informe a descrição / histórico do título.');
      return;
    }
    const v = parseFloat(novoForm.valor);
    if (!v || v <= 0) {
      setNovoError('Informe um valor válido maior que zero.');
      return;
    }
    if (!novoForm.forma_pagamento_id) {
      setNovoError('Selecione a forma de pagamento / recebimento.');
      return;
    }

    try {
      setSavingNovo(true);
      await apiFetch('/api/financeiro/titulos', {
        method: 'POST',
        body: JSON.stringify({
          pessoa_id: selectedPessoaModal.id,
          tipo: novoForm.tipo,
          descricao: novoForm.descricao.trim(),
          valor: v,
          data_vencimento: novoForm.data_vencimento,
          conta_financeira_id: novoForm.conta_financeira_id
            ? Number(novoForm.conta_financeira_id)
            : null,
          forma_pagamento_id: Number(novoForm.forma_pagamento_id),
        }),
      });

      toast.success('Título financeiro lançado com sucesso!');
      setNovoModalOpen(false);
      await loadAuxiliares();
      await loadTitulos();
    } catch (err) {
      setNovoError(err.message);
    } finally {
      setSavingNovo(false);
    }
  };

  // Handlers de Realizar Baixa
  const handleOpenBaixa = (t) => {
    setTituloBaixa(t);
    const hasForma = Boolean(t.forma_pagamento_id);
    setAlterarFormaBaixa(!hasForma);
    setBaixaForm({
      forma_pagamento_id: t.forma_pagamento_id
        ? String(t.forma_pagamento_id)
        : '',
      conta_financeira_id: t.conta_financeira_id
        ? String(t.conta_financeira_id)
        : '',
      data_pagamento: getTodayISO(),
      observacao: '',
    });
    setBaixaError('');
    setBaixaModalOpen(true);
  };

  const handleToggleAlterarForma = (checked) => {
    setAlterarFormaBaixa(checked);
    if (!checked && tituloBaixa?.forma_pagamento_id) {
      const origFormaId = String(tituloBaixa.forma_pagamento_id);
      setBaixaForm((prev) => ({
        ...prev,
        forma_pagamento_id: origFormaId,
        conta_financeira_id: '',
      }));
    }
  };

  const handleChangeFormaBaixa = (novaFormaId) => {
    setBaixaForm((prev) => ({
      ...prev,
      forma_pagamento_id: novaFormaId,
      conta_financeira_id: '',
    }));
  };

  const handleConfirmarBaixa = async (e) => {
    e.preventDefault();
    setBaixaError('');

    if (!baixaForm.forma_pagamento_id) {
      setBaixaError('Selecione a forma de pagamento / recebimento.');
      return;
    }
    if (!baixaForm.conta_financeira_id) {
      setBaixaError(
        'Selecione a Conta Financeira (Caixa ou Banco compatível) onde ocorrerá o movimento.'
      );
      return;
    }
    if (!baixaForm.data_pagamento) {
      setBaixaError('Informe a data da liquidação / pagamento.');
      return;
    }

    const id = tituloBaixa.titulo_id || tituloBaixa.titulo_financeiro_id;

    try {
      setSavingBaixa(true);
      await apiFetch(`/api/financeiro/titulos/${id}/baixar`, {
        method: 'POST',
        body: JSON.stringify({
          forma_pagamento_id: Number(baixaForm.forma_pagamento_id),
          conta_financeira_id: Number(baixaForm.conta_financeira_id),
          data_pagamento: baixaForm.data_pagamento,
          observacao: baixaForm.observacao.trim() || null,
        }),
      });

      toast.success(`Baixa do título #${id} realizada com sucesso!`);
      setBaixaModalOpen(false);
      await loadAuxiliares();
      await loadTitulos();
      if (activeTab === 'extrato') {
        await loadExtrato();
      }
    } catch (err) {
      setBaixaError(err.message);
    } finally {
      setSavingBaixa(false);
    }
  };

  const handleCancelarTitulo = async (t) => {
    const id = t.titulo_id || t.titulo_financeiro_id;
    if (!window.confirm(`Deseja realmente cancelar o título #${id}?`)) return;
    try {
      await apiFetch(`/api/financeiro/titulos/${id}/cancelar`, {
        method: 'PATCH',
      });
      toast.success(`Título #${id} cancelado.`);
      loadTitulos();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const titulosColumns = [
    {
      header: '#',
      key: 'titulo_id',
      render: (r) => (
        <span className="font-mono font-bold text-slate-800">
          #{r.titulo_id || r.titulo_financeiro_id}
        </span>
      ),
    },
    {
      header: 'Natureza',
      key: 'tipo',
      render: (r) =>
        r.tipo === 'RECEBER' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            <ArrowDownRight className="w-3.5 h-3.5" /> A Receber
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            <ArrowUpRight className="w-3.5 h-3.5" /> A Pagar
          </span>
        ),
    },
    {
      header: 'Pessoa',
      key: 'pessoa_nome',
      render: (r) => (
        <span className="font-semibold text-slate-900">{r.pessoa_nome}</span>
      ),
    },
    {
      header: 'Descrição / Origem',
      key: 'descricao',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-800">{r.descricao}</div>
          {r.requisicao_id && (
            <span className="text-[11px] font-semibold text-indigo-600">
              Ref. Requisição #{r.requisicao_id}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Forma Pagto',
      key: 'forma_pagamento_nome',
      render: (r) => (
        <span className="text-xs font-medium text-slate-700">
          {r.forma_pagamento_nome || '-'}
        </span>
      ),
    },
    {
      header: 'Valor',
      align: 'right',
      render: (r) => (
        <span
          className={`font-extrabold ${
            r.tipo === 'RECEBER' ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {formatCurrency(r.valor)}
        </span>
      ),
    },
    {
      header: 'Vencimento',
      key: 'data_vencimento',
      render: (r) => {
        const vencStr = String(r.data_vencimento || '').slice(0, 10);
        const isVencido =
          r.situacao === 'PENDENTE' && vencStr && vencStr < getTodayISO();
        return (
          <div>
            <div className="text-xs font-medium text-slate-700">
              {formatDate(r.data_vencimento)}
            </div>
            {isVencido && (
              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                Vencido
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Situação',
      align: 'center',
      render: (r) => {
        if (r.situacao === 'PAGO') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Liquidado
            </span>
          );
        }
        if (r.situacao === 'PENDENTE') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              <Clock className="w-3.5 h-3.5" /> Pendente
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
            <XCircle className="w-3.5 h-3.5" /> Cancelado
          </span>
        );
      },
    },
    {
      header: 'Ações',
      align: 'right',
      render: (r) => {
        if (r.situacao === 'PENDENTE') {
          return (
            <div className="inline-flex items-center gap-1.5">
              <button
                onClick={() => handleOpenBaixa(r)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Realizar Baixa</span>
              </button>
              <button
                onClick={() => handleCancelarTitulo(r)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                title="Cancelar título"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          );
        }
        if (r.situacao === 'PAGO') {
          return (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => printRecibo(r)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Recibo</span>
              </button>
              <span className="text-[11px] text-slate-400">
                Pago em {formatDate(r.data_pagamento)}
                {r.conta_nome ? ` (${r.conta_nome})` : ''}
              </span>
            </div>
          );
        }
        return <span className="text-xs text-slate-400">-</span>;
      },
    },
  ];

  const extratoColumns = [
    {
      header: '#',
      key: 'movimento_financeiro_id',
      render: (r) => (
        <span className="font-mono text-xs text-slate-500">
          #{r.movimento_financeiro_id}
        </span>
      ),
    },
    {
      header: 'Data / Hora',
      key: 'data_movimento',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {formatDateTime(r.data_movimento)}
        </span>
      ),
    },
    {
      header: 'Conta Financeira',
      key: 'conta_nome',
      render: (r) => (
        <span className="font-semibold text-slate-900">
          {r.conta_nome || '-'}
        </span>
      ),
    },
    {
      header: 'Tipo',
      key: 'tipo',
      render: (r) =>
        r.tipo === 'ENTRADA' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            <ArrowDownRight className="w-3.5 h-3.5" /> ENTRADA
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            <ArrowUpRight className="w-3.5 h-3.5" /> SAÍDA
          </span>
        ),
    },
    {
      header: 'Histórico / Origem',
      key: 'historico',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-800">
            {r.historico || r.descricao || '-'}
          </div>
          {(r.titulo_id || r.titulo_financeiro_id) && (
            <span className="text-[11px] text-slate-500">
              Título #{r.titulo_id || r.titulo_financeiro_id}
              {r.pessoa_nome ? ` • ${r.pessoa_nome}` : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Forma Pagto',
      key: 'forma_pagamento_nome',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {r.forma_pagamento_nome || '-'}
        </span>
      ),
    },
    {
      header: 'Valor',
      align: 'right',
      render: (r) => (
        <span
          className={`font-extrabold ${
            r.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {r.tipo === 'ENTRADA' ? '+' : '-'} {formatCurrency(r.valor)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Saldo Caixas & Bancos
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 truncate">
              {formatCurrency(totais.saldo_caixas_bancos)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Disponibilidade imediata consolidada
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              A Receber (Pendente)
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1 truncate">
              {formatCurrency(totais.total_a_receber)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Previsão de entradas em aberto
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              A Pagar (Pendente)
            </p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1 truncate">
              {formatCurrency(totais.total_a_pagar)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Compromissos pendentes de baixa
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Abas + Botão Lançamento Avulso */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/70 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('titulos')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'titulos'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Títulos (Contas a Pagar / Receber)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extrato')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'extrato'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-indigo-600" />
            <span>Extrato de Caixa & Bancos</span>
          </button>
        </div>

        <button
          onClick={handleOpenNovoTitulo}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Lançamento Avulso</span>
        </button>
      </div>

      {/* ABA 1: TÍTULOS */}
      {activeTab === 'titulos' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                Natureza
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">Todos os Tipos</option>
                <option value="RECEBER">Contas a Receber</option>
                <option value="PAGAR">Contas a Pagar</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                Situação
              </label>
              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">Todas as Situações</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="PAGO">Liquidados (Pagos)</option>
                <option value="CANCELADO">Cancelados</option>
              </select>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                Pessoa (Múltipla Seleção em Tags)
              </label>
              <AutocompleteSelect
                items={pessoaOptions}
                value={filtroPessoas}
                onChange={setFiltroPessoas}
                multiple={true}
                minChars={2}
                placeholder="Digite 2+ letras para filtrar pessoas..."
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                Vencimento De / Até
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div className="lg:col-span-2 flex gap-2">
              <button
                type="button"
                onClick={() => loadTitulos()}
                className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtrar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltroTipo('');
                  setFiltroSituacao('');
                  setFiltroPessoas([]);
                  setFiltroDataInicio('');
                  setFiltroDataFim('');
                  loadTitulos({
                    tipo: '',
                    situacao: '',
                    pessoas: [],
                    dataInicio: '',
                    dataFim: '',
                  });
                }}
                className="py-2 px-2.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-medium"
                title="Limpar filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <DataTable
            columns={titulosColumns}
            data={titulos}
            loading={loadingTitulos}
            keyField="titulo_id"
            emptyTitle="Nenhum título financeiro encontrado"
            emptyDescription="Utilize o botão Lançamento Avulso ou finalize uma requisição comercial."
          />
        </div>
      )}

      {/* ABA 2: EXTRATO */}
      {activeTab === 'extrato' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                Conta Financeira
              </label>
              <select
                value={extratoContaId}
                onChange={(e) => setExtratoContaId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">Todas as Contas</option>
                {contas.map((c) => (
                  <option
                    key={c.conta_financeira_id}
                    value={c.conta_financeira_id}
                  >
                    {c.nome} ({c.tipo}) — {formatCurrency(c.saldo_atual)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                Tipo de Movimento
              </label>
              <select
                value={extratoTipo}
                onChange={(e) => setExtratoTipo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">Entradas e Saídas</option>
                <option value="ENTRADA">Apenas Entradas (+)</option>
                <option value="SAIDA">Apenas Saídas (-)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={extratoDataInicio}
                onChange={(e) => setExtratoDataInicio(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={extratoDataFim}
                onChange={(e) => setExtratoDataFim(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={loadExtrato}
              className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Filter className="w-4 h-4" />
              <span>Filtrar Extrato</span>
            </button>
          </div>

          <DataTable
            columns={extratoColumns}
            data={extrato}
            loading={loadingExtrato}
            keyField="movimento_financeiro_id"
            emptyTitle="Nenhuma movimentação no extrato"
            emptyDescription="As movimentações aparecem automaticamente ao realizar a baixa de títulos."
          />
        </div>
      )}

      {/* MODAL: Novo Lançamento Avulso */}
      <Modal
        isOpen={novoModalOpen}
        onClose={() => setNovoModalOpen(false)}
        title="Novo Lançamento Financeiro Avulso"
        subtitle="Cadastre uma conta a pagar ou a receber manualmente"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNovoModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="formNovoTitulo"
              disabled={savingNovo}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              {savingNovo ? 'Salvando...' : 'Salvar Título'}
            </button>
          </>
        }
      >
        <form
          id="formNovoTitulo"
          onSubmit={handleSaveNovoTitulo}
          className="space-y-4"
        >
          {novoError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {novoError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Natureza do Lançamento *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  novoForm.tipo === 'RECEBER'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="novoTipo"
                  value="RECEBER"
                  checked={novoForm.tipo === 'RECEBER'}
                  onChange={() => setNovoForm({ ...novoForm, tipo: 'RECEBER' })}
                  className="sr-only"
                />
                <ArrowDownRight className="w-4 h-4" />
                <span>Conta a Receber</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  novoForm.tipo === 'PAGAR'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="novoTipo"
                  value="PAGAR"
                  checked={novoForm.tipo === 'PAGAR'}
                  onChange={() => setNovoForm({ ...novoForm, tipo: 'PAGAR' })}
                  className="sr-only"
                />
                <ArrowUpRight className="w-4 h-4" />
                <span>Conta a Pagar</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pessoa (Cliente, Fornecedor ou Funcionário) *
            </label>
            <AutocompleteSelect
              items={pessoaOptions}
              value={selectedPessoaModal}
              onChange={setSelectedPessoaModal}
              multiple={false}
              minChars={2}
              placeholder="Digite 2+ letras para buscar pessoa..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição / Histórico *
            </label>
            <input
              type="text"
              value={novoForm.descricao}
              onChange={(e) =>
                setNovoForm({ ...novoForm, descricao: e.target.value })
              }
              placeholder="Ex: Aluguel mensal, Energia elétrica, Serviço avulso..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={novoForm.valor}
                onChange={(e) =>
                  setNovoForm({ ...novoForm, valor: e.target.value })
                }
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Vencimento *
              </label>
              <input
                type="date"
                value={novoForm.data_vencimento}
                onChange={(e) =>
                  setNovoForm({ ...novoForm, data_vencimento: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Forma de Pagamento / Recebimento *
            </label>
            <select
              value={novoForm.forma_pagamento_id}
              onChange={(e) =>
                setNovoForm({ ...novoForm, forma_pagamento_id: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              required
            >
              <option value="">Selecione...</option>
              {formasParaNovoTitulo.map((f) => (
                <option key={f.forma_pagamento_id} value={f.forma_pagamento_id}>
                  {f.nome} {isTrue(f.tipo_pix) ? '⚡ PIX' : ''}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* MODAL: Realizar Baixa (Com Forma Travada + Checkbox "Alterar forma" + Filtro de Contas Compatíveis) */}
      <Modal
        isOpen={baixaModalOpen}
        onClose={() => setBaixaModalOpen(false)}
        title="Realizar Baixa de Título Financeiro"
        subtitle="Confirme a forma de pagamento e selecione o Caixa ou Banco compatível"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setBaixaModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="formBaixaTitulo"
              disabled={savingBaixa}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {savingBaixa ? 'Processando...' : 'Confirmar Baixa'}
            </button>
          </>
        }
      >
        {tituloBaixa && (
          <form
            id="formBaixaTitulo"
            onSubmit={handleConfirmarBaixa}
            className="space-y-4"
          >
            {baixaError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {baixaError}
              </div>
            )}

            {/* Resumo do Título */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      tituloBaixa.tipo === 'RECEBER'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {tituloBaixa.tipo === 'RECEBER'
                      ? 'RECEBIMENTO'
                      : 'PAGAMENTO'}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Título #{tituloBaixa.titulo_id || tituloBaixa.titulo_financeiro_id}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-1 truncate">
                  {tituloBaixa.descricao}
                </div>
                <div className="text-xs text-slate-500">
                  Pessoa: <strong>{tituloBaixa.pessoa_nome}</strong>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">
                  Valor
                </div>
                <div
                  className={`text-xl font-extrabold ${
                    tituloBaixa.tipo === 'RECEBER'
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {formatCurrency(tituloBaixa.valor)}
                </div>
              </div>
            </div>

            {/* 1. Forma de Pagamento (Bloqueada por padrão + Checkbox "Alterar forma de pagamento/recebimento") */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Forma de Pagamento / Recebimento *
              </label>
              <select
                value={baixaForm.forma_pagamento_id}
                disabled={!alterarFormaBaixa}
                onChange={(e) => handleChangeFormaBaixa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                required
              >
                <option value="">Selecione...</option>
                {formas
                  .filter(
                    (f) =>
                      isTrue(f.ativo) ||
                      String(f.forma_pagamento_id) ===
                        String(tituloBaixa.forma_pagamento_id)
                  )
                  .map((f) => (
                    <option
                      key={f.forma_pagamento_id}
                      value={f.forma_pagamento_id}
                    >
                      {f.nome} ({f.tipo_conta_permitida})
                    </option>
                  ))}
              </select>

              <label className="inline-flex items-center gap-2 mt-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={alterarFormaBaixa}
                  onChange={(e) => handleToggleAlterarForma(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Alterar forma de pagamento/recebimento</span>
              </label>
            </div>

            {/* 2. Conta Financeira (Filtrada dinamicamente pela espécie compatível com a Forma selecionada) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Conta Financeira (Caixa / Banco de Destino ou Origem) *
              </label>
              <select
                value={baixaForm.conta_financeira_id}
                onChange={(e) =>
                  setBaixaForm({
                    ...baixaForm,
                    conta_financeira_id: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              >
                <option value="">
                  {contasCompativeisBaixa.length
                    ? 'Selecione a Conta...'
                    : 'Nenhuma conta compatível ativa'}
                </option>
                {contasCompativeisBaixa.map((c) => (
                  <option
                    key={c.conta_financeira_id}
                    value={c.conta_financeira_id}
                  >
                    {c.nome} ({c.tipo}) — Saldo: {formatCurrency(c.saldo_atual)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {tipoPermitidoBaixa === 'CAIXA' &&
                  `Exibindo apenas contas do tipo CAIXA compatíveis com "${
                    formaSelecionadaBaixa?.nome || 'a forma selecionada'
                  }".`}
                {tipoPermitidoBaixa === 'BANCO' &&
                  `Exibindo apenas contas do tipo BANCO compatíveis com "${
                    formaSelecionadaBaixa?.nome || 'a forma selecionada'
                  }".`}
                {tipoPermitidoBaixa === 'AMBOS' &&
                  `Exibindo contas CAIXA e BANCO compatíveis com "${
                    formaSelecionadaBaixa?.nome || 'a forma selecionada'
                  }".`}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data do Pagamento / Liquidação *
                </label>
                <input
                  type="date"
                  value={baixaForm.data_pagamento}
                  onChange={(e) =>
                    setBaixaForm({
                      ...baixaForm,
                      data_pagamento: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observação / Comprovante
                </label>
                <input
                  type="text"
                  value={baixaForm.observacao}
                  onChange={(e) =>
                    setBaixaForm({ ...baixaForm, observacao: e.target.value })
                  }
                  placeholder="Doc, autenticação, obs..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
