import React, { useEffect, useState, useMemo } from 'react';
import {
  Filter,
  RotateCcw,
  Download,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  Minus,
} from 'lucide-react';
import {
  apiFetch,
  formatCurrency,
  formatDateTime,
} from '../services/api';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import AutocompleteSelect from '../components/AutocompleteSelect';

export default function Relatorios() {
  const toast = useToast();

  const [itens, setItens] = useState([]);
  const [resumo, setResumo] = useState({
    total_registros: 0,
    total_itens: 0,
    total_bruto: '0.00',
    total_desconto: '0.00',
    total_liquido: '0.00',
    total_entradas: '0.00',
    total_saidas: '0.00',
  });
  const [loading, setLoading] = useState(true);

  // Listas para Autocomplete múltiplo
  const [pessoas, setPessoas] = useState([]);
  const [mercadorias, setMercadorias] = useState([]);

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoInterno, setTipoInterno] = useState('');
  const [selectedPessoas, setSelectedPessoas] = useState([]);
  const [selectedMercadorias, setSelectedMercadorias] = useState([]);

  const loadAuxiliares = async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        apiFetch('/api/pessoas'),
        apiFetch('/api/mercadorias'),
      ]);
      setPessoas(Array.isArray(pRes) ? pRes : pRes.data || []);
      setMercadorias(Array.isArray(mRes) ? mRes : mRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar filtros: ' + err.message);
    }
  };

  const loadRelatorio = async (override) => {
    try {
      setLoading(true);
      const f = override || {
        dataInicio,
        dataFim,
        tipoInterno,
        pessoas: selectedPessoas,
        mercadorias: selectedMercadorias,
      };

      const params = new URLSearchParams();
      if (f.dataInicio) params.append('data_inicio', f.dataInicio);
      if (f.dataFim) params.append('data_fim', f.dataFim);
      if (f.tipoInterno) params.append('tipo_interno', f.tipoInterno);
      if (f.pessoas && f.pessoas.length > 0) {
        params.append('pessoa_ids', f.pessoas.map((p) => p.id).join(','));
      }
      if (f.mercadorias && f.mercadorias.length > 0) {
        params.append(
          'mercadoria_ids',
          f.mercadorias.map((m) => m.id).join(',')
        );
      }

      const res = await apiFetch(
        `/api/relatorios/movimentacoes?${params.toString()}`
      );
      setItens(res.itens || []);
      if (res.resumo) setResumo(res.resumo);
    } catch (err) {
      toast.error('Erro ao gerar relatório: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuxiliares();
    loadRelatorio();
  }, []);

  const pessoaOptions = useMemo(
    () =>
      pessoas.map((p) => ({
        id: p.pessoa_id,
        label: `[${p.tipo_pessoa_nome || 'PESSOA'}] ${p.nome}`,
        chipLabel: p.nome,
        subtext: `CPF/CNPJ: ${p.cpf_cnpj || 'S/D'}`,
      })),
    [pessoas]
  );

  const mercadoriaOptions = useMemo(
    () =>
      mercadorias.map((m) => ({
        id: m.mercadoria_id,
        label: `${m.codigo ? `[${m.codigo}] ` : ''}${m.nome}`,
        chipLabel: m.codigo ? `${m.codigo} - ${m.nome}` : m.nome,
        subtext: `Marca: ${m.marca || '-'} • Estoque: ${m.estoque}`,
      })),
    [mercadorias]
  );

  const handleExportCSV = () => {
    if (!itens.length) {
      toast.warning('Não há dados para exportar.');
      return;
    }

    const headers = [
      'ID Mov',
      'Data',
      'Req ID',
      'Pessoa',
      'Tipo Pessoa',
      'Codigo Mercadoria',
      'Mercadoria',
      'Tipo Movimento',
      'Classificacao',
      'Quantidade',
      'Valor Unitario',
      'Desconto',
      'Valor Liquido',
    ];

    const rows = itens.map((r) => [
      r.movimentacao_id,
      formatDateTime(r.data_movimentacao),
      r.requisicao_id,
      `"${(r.pessoa_nome || '').replace(/"/g, '""')}"`,
      r.tipo_pessoa_nome,
      `"${(r.mercadoria_codigo || '').replace(/"/g, '""')}"`,
      `"${(r.mercadoria_nome || '').replace(/"/g, '""')}"`,
      `"${(r.tipo_movimento_nome || '').replace(/"/g, '""')}"`,
      r.tipo_interno,
      r.quantidade,
      String(r.valor_unitario).replace('.', ','),
      String(r.desconto).replace('.', ','),
      String(r.valor_liquido).replace('.', ','),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-reqflow-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo CSV exportado com sucesso!');
  };

  const columns = [
    {
      header: 'Data / Hora',
      key: 'data_movimentacao',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {formatDateTime(r.data_movimentacao)}
        </span>
      ),
    },
    {
      header: 'Req #',
      key: 'requisicao_id',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-indigo-600">
          #{r.requisicao_id}
        </span>
      ),
    },
    {
      header: 'Pessoa',
      key: 'pessoa_nome',
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.pessoa_nome}</div>
          <div className="text-[11px] text-slate-400">{r.tipo_pessoa_nome}</div>
        </div>
      ),
    },
    {
      header: 'Mercadoria',
      key: 'mercadoria_nome',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-800">{r.mercadoria_nome}</div>
          <div className="text-[11px] font-mono text-slate-400">
            {r.mercadoria_codigo || '-'}
          </div>
        </div>
      ),
    },
    {
      header: 'Operação',
      key: 'tipo_interno',
      render: (r) => {
        if (r.tipo_interno === 'ENTRADA') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <ArrowDownLeft className="w-3 h-3" /> {r.tipo_movimento_nome}
            </span>
          );
        }
        if (r.tipo_interno === 'SAIDA') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
              <ArrowUpRight className="w-3 h-3" /> {r.tipo_movimento_nome}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <Minus className="w-3 h-3" /> {r.tipo_movimento_nome}
          </span>
        );
      },
    },
    {
      header: 'Qtd',
      align: 'center',
      render: (r) => <span className="font-bold">{r.quantidade}</span>,
    },
    {
      header: 'Unitário',
      align: 'right',
      render: (r) => formatCurrency(r.valor_unitario),
    },
    {
      header: 'Desconto',
      align: 'right',
      render: (r) =>
        parseFloat(r.desconto) > 0 ? (
          <span className="text-rose-600">- {formatCurrency(r.desconto)}</span>
        ) : (
          'R$ 0,00'
        ),
    },
    {
      header: 'Valor Líquido',
      align: 'right',
      render: (r) => (
        <span className="font-extrabold text-slate-900">
          {formatCurrency(r.valor_liquido)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros Multi-tags */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Pessoas (Clientes / Fornecedores — Múltipla Seleção)
            </label>
            <AutocompleteSelect
              items={pessoaOptions}
              value={selectedPessoas}
              onChange={setSelectedPessoas}
              multiple={true}
              minChars={2}
              placeholder="Digite 2+ letras para adicionar uma ou mais pessoas..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Mercadorias (Múltipla Seleção em Tags)
            </label>
            <AutocompleteSelect
              items={mercadoriaOptions}
              value={selectedMercadorias}
              onChange={setSelectedMercadorias}
              multiple={true}
              minChars={2}
              placeholder="Digite 2+ letras ou código para adicionar mercadorias..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end pt-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Classificação
            </label>
            <select
              value={tipoInterno}
              onChange={(e) => setTipoInterno(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="">Todas (Entrada / Saída / Neutro)</option>
              <option value="ENTRADA">Somente Entradas (+)</option>
              <option value="SAIDA">Somente Saídas (-)</option>
              <option value="NEUTRO">Somente Neutros</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadRelatorio()}
              className="flex-1 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Gerar Relatório</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDataInicio('');
                setDataFim('');
                setTipoInterno('');
                setSelectedPessoas([]);
                setSelectedMercadorias([]);
                loadRelatorio({
                  dataInicio: '',
                  dataFim: '',
                  tipoInterno: '',
                  pessoas: [],
                  mercadorias: [],
                });
              }}
              className="py-2 px-3 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-medium inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="py-2 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards Totalizadores Responsivos (sem estouro de borda) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          {
            label: 'Registros',
            val: resumo.total_registros,
            color: 'text-slate-900',
          },
          {
            label: 'Unidades Mov.',
            val: resumo.total_itens,
            color: 'text-indigo-600',
          },
          {
            label: 'Total Entradas',
            val: formatCurrency(resumo.total_entradas),
            color: 'text-emerald-600',
          },
          {
            label: 'Total Saídas',
            val: formatCurrency(resumo.total_saidas),
            color: 'text-rose-600',
          },
          {
            label: 'Total Descontos',
            val: formatCurrency(resumo.total_desconto),
            color: 'text-amber-600',
          },
          {
            label: 'Volume Líquido',
            val: formatCurrency(resumo.total_liquido),
            color: 'text-slate-900',
          },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs min-w-0 overflow-hidden"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
              {card.label}
            </div>
            <div
              className={`text-base sm:text-lg font-extrabold mt-1 break-words leading-tight ${card.color}`}
            >
              {card.val}
            </div>
          </div>
        ))}
      </div>

      {/* Tabela Consolidada */}
      <DataTable
        columns={columns}
        data={itens}
        loading={loading}
        keyField="movimentacao_id"
        emptyTitle="Nenhuma movimentação encontrada para os filtros"
        emptyDescription="Altere o período ou remova filtros para ampliar os resultados."
      />
    </div>
  );
}
