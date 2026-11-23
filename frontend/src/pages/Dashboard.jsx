import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Users,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  apiFetch,
  formatCurrency,
  formatDate,
  formatDateTime,
  isTrue,
} from '../services/api';
import { useToast } from '../context/ToastContext';

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPessoas: 0,
    totalMercadorias: 0,
    estoqueCritico: [],
    requisicoesRecentes: [],
    reqAbertas: 0,
    saldoConsolidado: 0,
    totalReceber: 0,
    totalPagar: 0,
    titulosPendentes: [],
  });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [pessoasRes, mercRes, reqRes, titRes] = await Promise.all([
          apiFetch('/api/pessoas?ativo=true'),
          apiFetch('/api/mercadorias?ativo=true'),
          apiFetch('/api/requisicoes'),
          apiFetch('/api/financeiro/titulos'),
        ]);

        const pessoas = Array.isArray(pessoasRes) ? pessoasRes : pessoasRes.data || [];
        const mercadorias = Array.isArray(mercRes) ? mercRes : mercRes.data || [];
        const requisicoes = Array.isArray(reqRes) ? reqRes : reqRes.data || [];
        const titulos = Array.isArray(titRes)
          ? titRes
          : titRes.titulos || titRes.data || [];
        const totaisFin = titRes.totais || {};

        const criticos = mercadorias.filter((m) => Number(m.estoque) <= 5);
        const abertas = requisicoes.filter(
          (r) => r.requisicao_situacao === 'ABERTA'
        ).length;

        setStats({
          totalPessoas: pessoas.length,
          totalMercadorias: mercadorias.length,
          estoqueCritico: criticos.slice(0, 6),
          requisicoesRecentes: requisicoes.slice(0, 6),
          reqAbertas: abertas,
          saldoConsolidado: Number(totaisFin.saldo_caixas_bancos || 0),
          totalReceber: Number(totaisFin.total_a_receber || 0),
          totalPagar: Number(totaisFin.total_a_pagar || 0),
          titulosPendentes: titulos
            .filter((t) => t.situacao === 'PENDENTE')
            .slice(0, 6),
        });
      } catch (err) {
        toast.error('Erro ao carregar indicadores: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const kpis = [
    {
      label: 'Saldo Caixas & Bancos',
      value: formatCurrency(stats.saldoConsolidado),
      sub: 'Disponível nas contas ativas',
      icon: Wallet,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      onClick: () => navigate('/contas-financeiras'),
    },
    {
      label: 'A Receber (Pendente)',
      value: formatCurrency(stats.totalReceber),
      sub: 'Títulos de clientes em aberto',
      icon: ArrowDownRight,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      valueColor: 'text-emerald-700',
      onClick: () => navigate('/financeiro'),
    },
    {
      label: 'A Pagar (Pendente)',
      value: formatCurrency(stats.totalPagar),
      sub: 'Compromissos com fornecedores',
      icon: ArrowUpRight,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      valueColor: 'text-rose-700',
      onClick: () => navigate('/financeiro'),
    },
    {
      label: 'Requisições em Aberto',
      value: String(stats.reqAbertas),
      sub: `${stats.totalMercadorias} mercadorias • ${stats.totalPessoas} pessoas`,
      icon: ShoppingCart,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      onClick: () => navigate('/requisicoes'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={kpi.onClick}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {kpi.label}
                </p>
                <p
                  className={`text-xl sm:text-2xl font-extrabold tracking-tight mt-1.5 truncate ${
                    kpi.valueColor || 'text-slate-900'
                  }`}
                >
                  {loading ? '...' : kpi.value}
                </p>
                <p className="text-xs text-slate-400 mt-1 truncate">{kpi.sub}</p>
              </div>
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${kpi.color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requisições Recentes */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Últimas Requisições Comerciais
              </h3>
              <p className="text-xs text-slate-500">
                Compras, vendas e movimentações recentes
              </p>
            </div>
            <button
              onClick={() => navigate('/requisicoes')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Pessoa</th>
                  <th className="px-5 py-3">Operação</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stats.requisicoesRecentes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-xs text-slate-400"
                    >
                      Nenhuma requisição registrada até o momento.
                    </td>
                  </tr>
                ) : (
                  stats.requisicoesRecentes.map((r) => (
                    <tr
                      key={r.requisicao_id}
                      onClick={() => navigate('/requisicoes')}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-mono font-bold text-slate-800">
                        #{r.requisicao_id}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {r.pessoa_nome}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-600">
                          {r.tipo_movimento_nome}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {r.requisicao_situacao === 'FINALIZADA' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Finalizada
                          </span>
                        )}
                        {r.requisicao_situacao === 'ABERTA' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3" /> Aberta
                          </span>
                        )}
                        {r.requisicao_situacao === 'CANCELADA' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            Cancelada
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {formatDateTime(r.data_criacao)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertas de Estoque Baixo + Próximos Vencimentos */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  Alerta de Estoque (≤ 5 un.)
                </h3>
              </div>
              <button
                onClick={() => navigate('/mercadorias')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Estoque
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {stats.estoqueCritico.length === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-600 font-medium">
                  ✓ Todas as mercadorias possuem estoque confortável.
                </div>
              ) : (
                stats.estoqueCritico.map((m) => (
                  <div
                    key={m.mercadoria_id}
                    className="px-5 py-3 flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {m.nome}
                      </div>
                      <div className="text-xs text-slate-400">
                        Cód: {m.codigo || '-'}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                        Number(m.estoque) === 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {m.estoque} un.
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Títulos Pendentes Próximos
              </h3>
              <button
                onClick={() => navigate('/financeiro')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Financeiro
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {stats.titulosPendentes.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhum título pendente no momento.
                </div>
              ) : (
                stats.titulosPendentes.map((t) => (
                  <div
                    key={t.titulo_id}
                    onClick={() => navigate('/financeiro')}
                    className="px-5 py-3 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {t.pessoa_nome}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Venc: {formatDate(t.data_vencimento)} • {t.forma_pagamento_nome || '-'}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 ${
                        t.tipo === 'RECEBER' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {t.tipo === 'RECEBER' ? '+' : '-'} {formatCurrency(t.valor)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
