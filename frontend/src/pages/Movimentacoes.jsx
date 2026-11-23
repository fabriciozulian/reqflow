import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
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

export default function Movimentacoes() {
  const toast = useToast();

  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    const loadMovimentacoes = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('/api/requisicoes/movimentacoes/todas');
        setMovimentacoes(Array.isArray(res) ? res : res.data || []);
      } catch (err) {
        toast.error('Erro ao carregar movimentações: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadMovimentacoes();
  }, []);

  const filtered = useMemo(() => {
    return movimentacoes.filter((m) => {
      if (filtroTipo && m.tipo_interno !== filtroTipo) return false;
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const hay = `${m.mercadoria_nome || ''} ${m.codigo || ''} ${
          m.pessoa_nome || ''
        } ${m.tipo_movimento_nome || ''} #${m.requisicao_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movimentacoes, busca, filtroTipo]);

  const columns = [
    {
      header: '#',
      key: 'movimentacao_id',
      render: (r) => (
        <span className="font-mono text-xs text-slate-500">
          #{r.movimentacao_id}
        </span>
      ),
    },
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
      header: 'Requisição',
      key: 'requisicao_id',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-indigo-600">
          Req #{r.requisicao_id}
        </span>
      ),
    },
    {
      header: 'Pessoa',
      key: 'pessoa_nome',
      render: (r) => (
        <span className="font-medium text-slate-800">{r.pessoa_nome}</span>
      ),
    },
    {
      header: 'Mercadoria',
      key: 'mercadoria_nome',
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">
            {r.mercadoria_nome}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            {r.codigo || '-'}
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
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <ArrowDownLeft className="w-3.5 h-3.5" /> {r.tipo_movimento_nome}
            </span>
          );
        }
        if (r.tipo_interno === 'SAIDA') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
              <ArrowUpRight className="w-3.5 h-3.5" /> {r.tipo_movimento_nome}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <Minus className="w-3.5 h-3.5" /> {r.tipo_movimento_nome}
          </span>
        );
      },
    },
    {
      header: 'Qtd',
      align: 'center',
      render: (r) => (
        <span className="font-bold text-slate-900">{r.quantidade}</span>
      ),
    },
    {
      header: 'Valor Unit.',
      align: 'right',
      render: (r) => formatCurrency(r.valor_unitario),
    },
    {
      header: 'Subtotal',
      align: 'right',
      render: (r) => (
        <span className="font-bold text-slate-900">
          {formatCurrency(
            (parseFloat(r.valor_unitario) || 0) *
              (parseInt(r.quantidade, 10) || 0)
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por mercadoria, código, pessoa ou requisição..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700"
        >
          <option value="">Todas as Operações</option>
          <option value="ENTRADA">Entradas de Estoque (+)</option>
          <option value="SAIDA">Saídas de Estoque (-)</option>
          <option value="NEUTRO">Movimentos Neutros</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        keyField="movimentacao_id"
        emptyTitle="Nenhuma movimentação encontrada"
        emptyDescription="As movimentações aparecem automaticamente quando uma requisição é finalizada."
      />
    </div>
  );
}
