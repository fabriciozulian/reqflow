import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Power,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Minus,
} from 'lucide-react';
import { apiFetch, isTrue } from '../services/api';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

export default function TiposMovimento() {
  const toast = useToast();

  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAtivo, setFiltroAtivo] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nome: '',
    tipo_interno: 'SAIDA',
    ativo: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const q = filtroAtivo !== '' ? `?ativo=${filtroAtivo}` : '';
      const res = await apiFetch(`/api/tipos-movimento${q}`);
      setTipos(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      toast.error('Erro ao carregar tipos de movimento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filtroAtivo]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ nome: '', tipo_interno: 'SAIDA', ativo: true });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (t) => {
    setEditingId(t.tipo_movimento_id);
    setForm({
      nome: t.nome || '',
      tipo_interno: t.tipo_interno || 'SAIDA',
      ativo: isTrue(t.ativo),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.nome.trim()) {
      setFormError('O nome do tipo de movimento é obrigatório.');
      return;
    }

    try {
      setSaving(true);
      const url = editingId
        ? `/api/tipos-movimento/${editingId}`
        : '/api/tipos-movimento';
      const method = editingId ? 'PUT' : 'POST';

      await apiFetch(url, {
        method,
        body: JSON.stringify(form),
      });

      toast.success(
        editingId
          ? 'Tipo de movimento atualizado!'
          : 'Tipo de movimento criado!'
      );
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (t) => {
    try {
      const res = await apiFetch(
        `/api/tipos-movimento/${t.tipo_movimento_id}/toggle`,
        { method: 'PATCH' }
      );
      toast.success(res.message || 'Status atualizado.');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (t) => {
    if (
      !window.confirm(
        `Deseja remover ou desativar o tipo de movimento "${t.nome}"?`
      )
    )
      return;
    try {
      const res = await apiFetch(
        `/api/tipos-movimento/${t.tipo_movimento_id}`,
        { method: 'DELETE' }
      );
      toast.success(res.message || 'Operação concluída.');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const badgeInterno = (tipo) => {
    if (tipo === 'ENTRADA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
          <ArrowDownLeft className="w-3.5 h-3.5" /> ENTRADA (+ Estoque / A Pagar)
        </span>
      );
    }
    if (tipo === 'SAIDA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
          <ArrowUpRight className="w-3.5 h-3.5" /> SAÍDA (- Estoque / A Receber)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        <Minus className="w-3.5 h-3.5" /> NEUTRO (Sem impacto)
      </span>
    );
  };

  const columns = [
    {
      header: '#',
      key: 'tipo_movimento_id',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-500">
          #{r.tipo_movimento_id}
        </span>
      ),
    },
    {
      header: 'Descrição do Movimento',
      key: 'nome',
      render: (r) => (
        <span className="font-semibold text-slate-900">{r.nome}</span>
      ),
    },
    {
      header: 'Classificação Operacional',
      key: 'tipo_interno',
      render: (r) => badgeInterno(r.tipo_interno),
    },
    {
      header: 'Status',
      align: 'center',
      render: (r) =>
        isTrue(r.ativo) ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            Ativo
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
            Inativo
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
          <button
            onClick={() => handleDelete(r)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
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
          <option value="true">Somente Ativos</option>
          <option value="false">Somente Inativos</option>
        </select>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Tipo de Movimento</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={tipos}
        loading={loading}
        keyField="tipo_movimento_id"
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId
            ? `Editar Tipo de Movimento #${editingId}`
            : 'Novo Tipo de Movimento'
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
              form="formTipoMov"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <form id="formTipoMov" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Movimento *
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Venda, Compra / Entrada, Bonificação..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Classificação Interna *
            </label>
            <select
              value={form.tipo_interno}
              onChange={(e) =>
                setForm({ ...form, tipo_interno: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              <option value="SAIDA">
                SAÍDA (Baixa Estoque + Gera Conta a Receber)
              </option>
              <option value="ENTRADA">
                ENTRADA (Soma Estoque + Gera Conta a Pagar)
              </option>
              <option value="NEUTRO">
                NEUTRO (Não altera estoque nem gera título)
              </option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span>Ativo para novas requisições</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
