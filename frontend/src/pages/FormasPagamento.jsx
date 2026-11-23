import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Power,
  QrCode,
  Zap,
  Landmark,
  Banknote,
  Layers,
} from 'lucide-react';
import { apiFetch, isTrue } from '../services/api';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

export default function FormasPagamento() {
  const toast = useToast();

  const [formas, setFormas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAtivo, setFiltroAtivo] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nome: '',
    tipo_conta_permitida: 'AMBOS',
    tipo_pix: false,
    baixa_automatica: false,
    ativo: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const q = filtroAtivo !== '' ? `?ativo=${filtroAtivo}` : '';
      const res = await apiFetch(`/api/financeiro/formas-pagamento${q}`);
      setFormas(Array.isArray(res) ? res : res.formas || res.data || []);
    } catch (err) {
      toast.error('Erro ao carregar formas de pagamento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filtroAtivo]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      nome: '',
      tipo_conta_permitida: 'AMBOS',
      tipo_pix: false,
      baixa_automatica: false,
      ativo: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (f) => {
    setEditingId(f.forma_pagamento_id);
    setForm({
      nome: f.nome || '',
      tipo_conta_permitida: f.tipo_conta_permitida || 'AMBOS',
      tipo_pix: isTrue(f.tipo_pix),
      baixa_automatica: isTrue(f.baixa_automatica),
      ativo: isTrue(f.ativo),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.nome.trim()) {
      setFormError('O nome da forma de pagamento é obrigatório.');
      return;
    }

    try {
      setSaving(true);
      const url = editingId
        ? `/api/financeiro/formas-pagamento/${editingId}`
        : '/api/financeiro/formas-pagamento';
      const method = editingId ? 'PUT' : 'POST';

      await apiFetch(url, {
        method,
        body: JSON.stringify(form),
      });

      toast.success(
        editingId
          ? 'Forma de pagamento atualizada!'
          : 'Forma de pagamento criada!'
      );
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (f) => {
    try {
      const res = await apiFetch(
        `/api/financeiro/formas-pagamento/${f.forma_pagamento_id}/toggle`,
        { method: 'PATCH' }
      );
      toast.success(res.message || 'Status alterado.');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const badgeTipoConta = (tipo) => {
    if (tipo === 'CAIXA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Banknote className="w-3.5 h-3.5" /> Somente CAIXA
        </span>
      );
    }
    if (tipo === 'BANCO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Landmark className="w-3.5 h-3.5" /> Somente BANCO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Layers className="w-3.5 h-3.5" /> AMBOS (Caixa e Banco)
      </span>
    );
  };

  const columns = [
    {
      header: '#',
      key: 'forma_pagamento_id',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-500">
          #{r.forma_pagamento_id}
        </span>
      ),
    },
    {
      header: 'Forma de Pagamento / Recebimento',
      key: 'nome',
      render: (r) => (
        <span className="font-semibold text-slate-900">{r.nome}</span>
      ),
    },
    {
      header: 'Espécie de Conta Permitida',
      key: 'tipo_conta_permitida',
      render: (r) => badgeTipoConta(r.tipo_conta_permitida),
    },
    {
      header: 'Modalidade PIX',
      align: 'center',
      render: (r) =>
        isTrue(r.tipo_pix) ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            <QrCode className="w-3.5 h-3.5" /> Gera QR Code PIX
          </span>
        ) : (
          <span className="text-xs text-slate-400">Não</span>
        ),
    },
    {
      header: 'Baixa Automática (Avulso)',
      align: 'center',
      render: (r) =>
        isTrue(r.baixa_automatica) ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
            <Zap className="w-3.5 h-3.5" /> À Vista / Auto
          </span>
        ) : (
          <span className="text-xs text-slate-500">Baixa Manual</span>
        ),
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
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <select
          value={filtroAtivo}
          onChange={(e) => setFiltroAtivo(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700"
        >
          <option value="">Todos os Status</option>
          <option value="true">Somente Ativas</option>
          <option value="false">Somente Inativas</option>
        </select>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Forma de Pagamento</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={formas}
        loading={loading}
        keyField="forma_pagamento_id"
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId
            ? `Editar Forma de Pagamento #${editingId}`
            : 'Nova Forma de Pagamento'
        }
        subtitle="Configure a espécie de conta permitida (Caixa, Banco ou Ambos)"
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
              form="formFormaPagto"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              {saving ? 'Salvando...' : 'Salvar Forma'}
            </button>
          </>
        }
      >
        <form id="formFormaPagto" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Forma de Pagamento *
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Dinheiro, PIX, Boleto Bancário, Cartão..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Espécie de Conta Permitida *
            </label>
            <select
              value={form.tipo_conta_permitida}
              onChange={(e) =>
                setForm({ ...form, tipo_conta_permitida: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              <option value="CAIXA">
                Somente CAIXA (Ex: Dinheiro em espécie)
              </option>
              <option value="BANCO">
                Somente BANCO (Ex: Boleto, TED, Transferência)
              </option>
              <option value="AMBOS">
                AMBOS — Caixa e Banco (Ex: PIX, Cartão, Cheque)
              </option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              No momento da baixa financeira, apenas contas compatíveis com esta
              espécie serão listadas.
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.tipo_pix}
                onChange={(e) =>
                  setForm({ ...form, tipo_pix: e.target.checked })
                }
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span>Modalidade PIX (Exibe QR Code nas vendas)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.baixa_automatica}
                onChange={(e) =>
                  setForm({ ...form, baixa_automatica: e.target.checked })
                }
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span>Baixa Automática (quando conta informada no avulso)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span>Forma de Pagamento Ativa</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
