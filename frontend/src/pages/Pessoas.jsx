import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  KeyRound,
  UserX,
  UserCheck,
  Filter,
} from 'lucide-react';
import { apiFetch, formatCurrency, isTrue } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

const emptyForm = {
  tipo_pessoa_id: '',
  nome: '',
  cpf_cnpj: '',
  email: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  pais: 'Brasil',
  limite: '0.00',
  ativo: true,
};

export default function Pessoas() {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [pessoas, setPessoas] = useState([]);
  const [tiposPessoa, setTiposPessoa] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('');

  // Modal Pessoa
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal Login (Funcionário)
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginPessoa, setLoginPessoa] = useState(null);
  const [hasExistingLogin, setHasExistingLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({
    gersys_email: '',
    gersys_senha: '',
    gersys_perfil: 'OPERADOR',
    gersys_ativo: true,
  });
  const [savingLogin, setSavingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroTipo) params.append('tipo', filtroTipo);
      if (filtroAtivo !== '') params.append('ativo', filtroAtivo);

      const [pessoasRes, tiposRes] = await Promise.all([
        apiFetch(`/api/pessoas?${params.toString()}`),
        apiFetch('/api/pessoas/tipos'),
      ]);

      setPessoas(Array.isArray(pessoasRes) ? pessoasRes : pessoasRes.data || []);
      setTiposPessoa(Array.isArray(tiposRes) ? tiposRes : tiposRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar pessoas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filtroTipo, filtroAtivo]);

  const filteredPessoas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pessoas;
    return pessoas.filter(
      (p) =>
        (p.nome || '').toLowerCase().includes(q) ||
        (p.cpf_cnpj || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.cidade || '').toLowerCase().includes(q)
    );
  }, [pessoas, busca]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      tipo_pessoa_id: tiposPessoa[0]?.tipo_pessoa_id || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingId(p.pessoa_id);
    setForm({
      tipo_pessoa_id: p.tipo_pessoa_id || '',
      nome: p.nome || '',
      cpf_cnpj: p.cpf_cnpj || '',
      email: p.email || '',
      telefone: p.telefone || '',
      cep: p.cep || '',
      logradouro: p.logradouro || '',
      numero: p.numero || '',
      complemento: p.complemento || '',
      bairro: p.bairro || '',
      cidade: p.cidade || '',
      uf: p.uf || '',
      pais: p.pais || 'Brasil',
      limite: p.limite ?? '0.00',
      ativo: isTrue(p.ativo),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSavePessoa = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.tipo_pessoa_id || !form.nome.trim()) {
      setFormError('Tipo de pessoa e Nome são obrigatórios.');
      return;
    }

    try {
      setSaving(true);
      const url = editingId ? `/api/pessoas/${editingId}` : '/api/pessoas';
      const method = editingId ? 'PUT' : 'POST';

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          ...form,
          limite: parseFloat(form.limite) || 0,
        }),
      });

      toast.success(
        editingId
          ? 'Cadastro atualizado com sucesso!'
          : 'Pessoa cadastrada com sucesso!'
      );
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (p) => {
    if (!window.confirm(`Deseja desativar o cadastro de "${p.nome}"?`)) return;
    try {
      await apiFetch(`/api/pessoas/${p.pessoa_id}`, { method: 'DELETE' });
      toast.success('Pessoa desativada com sucesso.');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleOpenLoginModal = async (p) => {
    setLoginPessoa(p);
    setLoginError('');
    try {
      const data = await apiFetch(`/api/pessoas/${p.pessoa_id}/login`);
      setHasExistingLogin(true);
      setLoginForm({
        gersys_email: data.gersys_email || p.email || '',
        gersys_senha: '',
        gersys_perfil: data.gersys_perfil || 'OPERADOR',
        gersys_ativo: isTrue(data.gersys_ativo),
      });
    } catch {
      setHasExistingLogin(false);
      setLoginForm({
        gersys_email: p.email || '',
        gersys_senha: '',
        gersys_perfil: 'OPERADOR',
        gersys_ativo: true,
      });
    }
    setLoginModalOpen(true);
  };

  const handleSaveLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginForm.gersys_email.trim()) {
      setLoginError('Informe o e-mail de login.');
      return;
    }
    if (!hasExistingLogin && !loginForm.gersys_senha) {
      setLoginError('Informe uma senha inicial para o novo login.');
      return;
    }

    try {
      setSavingLogin(true);
      await apiFetch(`/api/pessoas/${loginPessoa.pessoa_id}/login`, {
        method: hasExistingLogin ? 'PUT' : 'POST',
        body: JSON.stringify(loginForm),
      });
      toast.success('Credenciais de acesso salvas com sucesso!');
      setLoginModalOpen(false);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setSavingLogin(false);
    }
  };

  const tipoBadge = (tipo) => {
    const map = {
      CLIENTE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      FORNECEDOR: 'bg-amber-50 text-amber-700 border-amber-200',
      FUNCIONARIO: 'bg-purple-50 text-purple-700 border-purple-200',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
          map[tipo] || 'bg-slate-100 text-slate-700 border-slate-200'
        }`}
      >
        {tipo}
      </span>
    );
  };

  const columns = [
    {
      header: '#',
      key: 'pessoa_id',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-500">
          #{r.pessoa_id}
        </span>
      ),
    },
    {
      header: 'Nome / Razão Social',
      key: 'nome',
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.nome}</div>
          <div className="text-xs text-slate-500">{r.email || 'Sem e-mail'}</div>
        </div>
      ),
    },
    {
      header: 'Tipo',
      key: 'tipo_pessoa_nome',
      render: (r) => tipoBadge(r.tipo_pessoa_nome),
    },
    {
      header: 'CPF / CNPJ',
      key: 'cpf_cnpj',
      render: (r) => (
        <span className="font-mono text-xs text-slate-700">
          {r.cpf_cnpj || '-'}
        </span>
      ),
    },
    {
      header: 'Cidade / UF',
      key: 'cidade',
      render: (r) =>
        r.cidade ? `${r.cidade}${r.uf ? `/${r.uf}` : ''}` : '-',
    },
    {
      header: 'Limite Crédito',
      align: 'right',
      render: (r) => (
        <span className="font-medium text-slate-800">
          {formatCurrency(r.limite)}
        </span>
      ),
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
          {isAdmin && r.tipo_pessoa_nome === 'FUNCIONARIO' && (
            <button
              onClick={() => handleOpenLoginModal(r)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              title="Credenciais de Login"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          )}
          {isTrue(r.ativo) && (
            <button
              onClick={() => handleDeactivate(r)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Desativar"
            >
              <UserX className="w-4 h-4" />
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
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ, e-mail ou cidade..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Todos os Tipos</option>
            <option value="CLIENTE">Clientes</option>
            <option value="FORNECEDOR">Fornecedores</option>
            <option value="FUNCIONARIO">Funcionários</option>
          </select>

          <select
            value={filtroAtivo}
            onChange={(e) => setFiltroAtivo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Todos os Status</option>
            <option value="true">Somente Ativos</option>
            <option value="false">Somente Inativos</option>
          </select>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Pessoa</span>
        </button>
      </div>

      {/* Tabela */}
      <DataTable
        columns={columns}
        data={filteredPessoas}
        loading={loading}
        keyField="pessoa_id"
        emptyTitle="Nenhuma pessoa encontrada"
        emptyDescription="Cadastre novos clientes, fornecedores ou funcionários para iniciar."
      />

      {/* Modal Cadastro/Edição de Pessoa */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Editar Pessoa #${editingId}` : 'Cadastrar Nova Pessoa'}
        subtitle="Preencha os dados cadastrais, documento e endereço"
        size="lg"
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
              form="formPessoa"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {saving ? 'Salvando...' : 'Salvar Cadastro'}
            </button>
          </>
        }
      >
        <form id="formPessoa" onSubmit={handleSavePessoa} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Pessoa *
              </label>
              <select
                value={form.tipo_pessoa_id}
                onChange={(e) =>
                  setForm({ ...form, tipo_pessoa_id: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                required
              >
                <option value="">Selecione...</option>
                {tiposPessoa.map((t) => (
                  <option key={t.tipo_pessoa_id} value={t.tipo_pessoa_id}>
                    {t.tipo}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome / Razão Social *
              </label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                placeholder="Nome completo ou razão social"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CPF / CNPJ
              </label>
              <input
                type="text"
                value={form.cpf_cnpj}
                onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                placeholder="(19) 99999-9999"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Limite de Crédito (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.limite}
                onChange={(e) => setForm({ ...form, limite: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                placeholder="contato@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CEP
              </label>
              <input
                type="text"
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                placeholder="00000-000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Logradouro
              </label>
              <input
                type="text"
                value={form.logradouro}
                onChange={(e) =>
                  setForm({ ...form, logradouro: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número
              </label>
              <input
                type="text"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                UF
              </label>
              <input
                type="text"
                maxLength={2}
                value={form.uf}
                onChange={(e) =>
                  setForm({ ...form, uf: e.target.value.toUpperCase() })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                placeholder="SP"
              />
            </div>
            <div className="pt-4">
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) =>
                    setForm({ ...form, ativo: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Cadastro Ativo</span>
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Credenciais de Login (Funcionário) */}
      <Modal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        title={`Acesso ao Sistema — ${loginPessoa?.nome || ''}`}
        subtitle="Gerencie o login e perfil de permissão deste funcionário"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setLoginModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="formLoginFunc"
              disabled={savingLogin}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {savingLogin ? 'Salvando...' : 'Salvar Acesso'}
            </button>
          </>
        }
      >
        <form id="formLoginFunc" onSubmit={handleSaveLogin} className="space-y-4">
          {loginError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {loginError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail de Login *
            </label>
            <input
              type="email"
              value={loginForm.gersys_email}
              onChange={(e) =>
                setLoginForm({ ...loginForm, gersys_email: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {hasExistingLogin
                ? 'Nova Senha (deixe em branco para manter)'
                : 'Senha Inicial *'}
            </label>
            <input
              type="password"
              value={loginForm.gersys_senha}
              onChange={(e) =>
                setLoginForm({ ...loginForm, gersys_senha: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Perfil de Acesso
            </label>
            <select
              value={loginForm.gersys_perfil}
              onChange={(e) =>
                setLoginForm({ ...loginForm, gersys_perfil: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            >
              <option value="OPERADOR">OPERADOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={loginForm.gersys_ativo}
              onChange={(e) =>
                setLoginForm({ ...loginForm, gersys_ativo: e.target.checked })
              }
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span>Acesso Ativo</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
