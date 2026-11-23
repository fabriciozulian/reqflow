import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Tags,
  Trash2,
  AlertTriangle,
  PackageX,
} from 'lucide-react';
import { apiFetch, formatCurrency, isTrue } from '../services/api';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

const emptyMercadoria = {
  categoria_id: '',
  codigo: '',
  nome: '',
  marca: '',
  valor_venda: '',
  estoque: '0',
  ativo: true,
};

export default function Mercadorias() {
  const toast = useToast();

  const [mercadorias, setMercadorias] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCat, setFiltroCat] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');

  // Modal Mercadoria
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyMercadoria);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal Categorias
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroCat) params.append('categoria_id', filtroCat);
      if (filtroAtivo !== '') params.append('ativo', filtroAtivo);
      if (busca.trim()) params.append('busca', busca.trim());

      const [mercRes, catRes] = await Promise.all([
        apiFetch(`/api/mercadorias?${params.toString()}`),
        apiFetch('/api/categorias'),
      ]);

      setMercadorias(Array.isArray(mercRes) ? mercRes : mercRes.data || []);
      setCategorias(Array.isArray(catRes) ? catRes : catRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar mercadorias: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filtroCat, filtroAtivo]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyMercadoria,
      categoria_id: categorias[0]?.categoria_id || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (m) => {
    setEditingId(m.mercadoria_id);
    setForm({
      categoria_id: m.categoria_id || '',
      codigo: m.codigo || '',
      nome: m.nome || '',
      marca: m.marca || '',
      valor_venda: m.valor_venda ?? '',
      estoque: String(m.estoque ?? 0),
      ativo: isTrue(m.ativo),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.categoria_id || !form.nome.trim() || form.valor_venda === '') {
      setFormError('Categoria, nome e valor de venda são obrigatórios.');
      return;
    }

    try {
      setSaving(true);
      const url = editingId ? `/api/mercadorias/${editingId}` : '/api/mercadorias';
      const method = editingId ? 'PUT' : 'POST';

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          ...form,
          valor_venda: parseFloat(form.valor_venda) || 0,
          estoque: parseInt(form.estoque, 10) || 0,
        }),
      });

      toast.success(
        editingId
          ? 'Mercadoria atualizada com sucesso!'
          : 'Mercadoria cadastrada com sucesso!'
      );
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (m) => {
    if (!window.confirm(`Deseja desativar a mercadoria "${m.nome}"?`)) return;
    try {
      await apiFetch(`/api/mercadorias/${m.mercadoria_id}`, { method: 'DELETE' });
      toast.success('Mercadoria desativada com sucesso.');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCreateCategoria = async (e) => {
    e.preventDefault();
    if (!novaCategoria.trim()) return;
    try {
      setSavingCat(true);
      await apiFetch('/api/categorias', {
        method: 'POST',
        body: JSON.stringify({ categoria_nome: novaCategoria.trim() }),
      });
      setNovaCategoria('');
      toast.success('Categoria adicionada!');
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategoria = async (cat) => {
    if (!window.confirm(`Excluir a categoria "${cat.categoria_nome}"?`)) return;
    try {
      await apiFetch(`/api/categorias/${cat.categoria_id}`, { method: 'DELETE' });
      toast.success('Categoria removida.');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      header: 'Código',
      key: 'codigo',
      render: (r) => (
        <span className="font-mono text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700">
          {r.codigo || `#${r.mercadoria_id}`}
        </span>
      ),
    },
    {
      header: 'Mercadoria',
      key: 'nome',
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.nome}</div>
          <div className="text-xs text-slate-500">{r.marca || 'Sem marca'}</div>
        </div>
      ),
    },
    {
      header: 'Categoria',
      key: 'categoria_nome',
      render: (r) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          {r.categoria_nome}
        </span>
      ),
    },
    {
      header: 'Valor de Venda',
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(r.valor_venda)}
        </span>
      ),
    },
    {
      header: 'Saldo em Estoque',
      align: 'center',
      render: (r) => {
        const est = Number(r.estoque);
        if (est <= 0) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
              <AlertTriangle className="w-3.5 h-3.5" /> Esgotado ({est})
            </span>
          );
        }
        if (est <= 5) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" /> Baixo ({est} un.)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
            {est} un.
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
            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {isTrue(r.ativo) && (
            <button
              onClick={() => handleDeactivate(r)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Desativar"
            >
              <PackageX className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Barra de Filtros e Ações */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadData();
            }}
            className="relative flex-1 min-w-[220px] max-w-md"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, código ou marca..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-500"
            />
          </form>

          <select
            value={filtroCat}
            onChange={(e) => setFiltroCat(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700"
          >
            <option value="">Todas as Categorias</option>
            {categorias.map((c) => (
              <option key={c.categoria_id} value={c.categoria_id}>
                {c.categoria_nome}
              </option>
            ))}
          </select>

          <select
            value={filtroAtivo}
            onChange={(e) => setFiltroAtivo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700"
          >
            <option value="">Todos os Status</option>
            <option value="true">Somente Ativas</option>
            <option value="false">Somente Inativas</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCatModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
          >
            <Tags className="w-4 h-4 text-indigo-600" />
            <span>Categorias</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Mercadoria</span>
          </button>
        </div>
      </div>

      {/* Tabela */}
      <DataTable
        columns={columns}
        data={mercadorias}
        loading={loading}
        keyField="mercadoria_id"
        emptyTitle="Nenhuma mercadoria encontrada"
        emptyDescription="Cadastre produtos e defina seus preços e saldos iniciais."
      />

      {/* Modal Mercadoria */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingId ? `Editar Mercadoria #${editingId}` : 'Nova Mercadoria'
        }
        subtitle="Informe código SKU, categoria, preço de venda e estoque"
        size="md"
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
              form="formMercadoria"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {saving ? 'Salvando...' : 'Salvar Mercadoria'}
            </button>
          </>
        }
      >
        <form id="formMercadoria" onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoria *
              </label>
              <select
                value={form.categoria_id}
                onChange={(e) =>
                  setForm({ ...form, categoria_id: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.categoria_id} value={c.categoria_id}>
                    {c.categoria_nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código / SKU
              </label>
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                placeholder="Ex: PRD-001"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Mercadoria *
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              placeholder="Descrição completa do produto"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Marca / Fabricante
              </label>
              <input
                type="text"
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor de Venda (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_venda}
                onChange={(e) =>
                  setForm({ ...form, valor_venda: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estoque Inicial / Atual
              </label>
              <input
                type="number"
                step="1"
                value={form.estoque}
                onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span>Mercadoria Ativa para Comercialização</span>
          </label>
        </form>
      </Modal>

      {/* Modal Categorias */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Categorias de Mercadorias"
        subtitle="Crie ou gerencie as categorias do catálogo"
        size="sm"
      >
        <div className="space-y-4">
          <form onSubmit={handleCreateCategoria} className="flex gap-2">
            <input
              type="text"
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              placeholder="Nome da nova categoria..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm"
              required
            />
            <button
              type="submit"
              disabled={savingCat}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              Adicionar
            </button>
          </form>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
            {categorias.map((c) => (
              <div
                key={c.categoria_id}
                className="px-4 py-2.5 flex items-center justify-between text-sm"
              >
                <span className="font-medium text-slate-800">
                  {c.categoria_nome}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCategoria(c)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                  title="Excluir categoria"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
