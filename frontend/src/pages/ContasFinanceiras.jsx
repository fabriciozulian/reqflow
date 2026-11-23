import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Power,
  Landmark,
  Banknote,
  Wallet,
} from 'lucide-react';
import { apiFetch, formatCurrency, isTrue } from '../services/api';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

export default function ContasFinanceiras() {
  const toast = useToast();

  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAtivo, setFiltroAtivo] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nome: '',
    tipo: 'CAIXA',
    saldo_inicial: '0.00',
    ativo: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const q = filtroAtivo !== '' ? `?ativo=${filtroAtivo}` : '';
      const res = await apiFetch(`/api/financeiro/contas${q}`);
      const list = Array.isArray(res) ? res : res.contas || res.data || [];
      setContas(list);
    } catch (err) {
      toast.error('Erro ao carregar contas financeiras: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filtroAtivo]);

  const totais = useMemo(() => {
    let caixas = 0;
    let bancos = 0;
    contas.forEach((c) => {
      if (!isTrue(c.ativo)) return;
      const s = parseFloat(c.saldo_atual) || 0;
      if (c.tipo === 'CAIXA') caixas += s;
      else bancos += s;
    });
    return {
      consolidado: caixas + bancos,
      caixas,
      bancos,
    };
  }, [contas]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      nome: '',
      tipo: 'CAIXA',
      saldo_inicial: '0.00',
      ativo: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingId(c.conta_financeira_id);
    setForm({
      nome: c.nome || '',
      tipo: c.tipo || 'CAIXA',
      saldo_inicial: c.saldo_inicial ?? '0.00',
      ativo: isTrue(c.ativo),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.nome.trim()) {
      setFormError('Informe o nome da conta financeira.');
      return;
    }

    try {
      setSaving(true);
      const url = editingId
        ? `/api/financeiro/contas/${editingId}`
        : '/api/financeiro/contas';
      const method = editingId ? 'PUT' : 'POST';

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          nome: form.nome.trim(),
          tipo: form.tipo,
          saldo_inicial: parseFloat(form.saldo_inicial) || 0,
          ativo: form.ativo,
        }),
      });

      toast.success(
        editingId
          ? 'Conta financeira atualizada!'
          : 'Conta financeira cadastrada!'
      );
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c) => {
    try {
      const res = await apiFetch(
        `/api/financeiro/contas/${c.conta_financeira_id}/toggle`,
        { method: 'PATCH' }
      );
      toast.success(res.message || 'Status atualizado.');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      header: '#',
      key: 'conta_financeira_id',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-500">
          #{r.conta_financeira_id}
        </span>
      ),
    },
    {
      header: 'Nome da Conta',
      key: 'nome',
      render: (r) => (
        <span className="font-semibold text-slate-900">{r.nome}</span>
      ),
    },
    {
      header: 'Espécie / Tipo',
      key: 'tipo',
      render: (r) =>
        r.tipo === 'CAIXA' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Banknote className="w-3.5 h-3.5" /> CAIXA FÍSICO
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Landmark className="w-3.5 h-3.5" /> CONTA BANCÁRIA
          </span>
        ),
    },
    {
      header: 'Saldo Inicial',
      align: 'right',
      render: (r) => (
        <span className="text-slate-600">{formatCurrency(r.saldo_inicial)}</span>
      ),
    },
    {
      header: 'Saldo Atual',
      align: 'right',
      render: (r) => {
        const s = parseFloat(r.saldo_atual) || 0;
        return (
          <span
            className={`font-extrabold ${
              s >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatCurrency(s)}
          </span>
        );
      },
    },
    {
      header: 'Status',
      align: 'center',
      render: (r) =>
        isTrue(r.ativo) ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            Ativa
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
            Inativa
          </span>
        ),
    },
    {
      header: 'Ações',
      align: 'right',
      render: (r) => (
        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={() => handleOpenEdit(r)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggle(r)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50"
            title={isTrue(r.ativo) ? 'Desativar' : 'Ativar'}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cards de Saldo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Saldo Total Consolidado
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {formatCurrency(totais.consolidado)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Soma de todas as contas ativas
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total em Caixas Físicos
            </p>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">
              {formatCurrency(totais.caixas)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Espécie / Gaveta</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <Banknote className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total em Contas Bancárias
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">
              {formatCurrency(totais.bancos)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Bancos & PIX</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <Landmark className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Ações */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <select
          value={filtroAtivo}
          onChange={(e) => setFiltroAtivo(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700"
        >
          <option value="">Todas as Contas</option>
          <option value="true">Somente Ativas</option>
          <option value="false">Somente Inativas</option>
        </select>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Conta Financeira</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={contas}
        loading={loading}
        keyField="conta_financeira_id"
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId
            ? `Editar Conta Financeira #${editingId}`
            : 'Nova Conta Financeira'
        }
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="formContaFin"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              {saving ? 'Salvando...' : 'Salvar Conta'}
            </button>
          </>
        }
      >
        <form id="formContaFin" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Conta / Caixa *
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Caixa Principal (Gaveta), Banco Itaú, Nubank PJ..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Espécie da Conta *
            </label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              <option value="CAIXA">CAIXA (Espécie / Gaveta Física)</option>
              <option value="BANCO">BANCO (Conta Corrente / Digital)</option>
            </select>
          </div>

          {!editingId && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saldo Inicial de Abertura (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.saldo_inicial}
                onChange={(e) =>
                  setForm({ ...form, saldo_inicial: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          )}

          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span>Conta Ativa para Movimentações</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
