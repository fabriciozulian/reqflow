import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  History,
  Landmark,
  CreditCard,
  Wallet,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Plus,
  Layers,
  Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navGroups = [
  {
    title: 'Visão Geral',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Cadastros & Estoque',
    items: [
      { to: '/pessoas', label: 'Pessoas', icon: Users },
      { to: '/mercadorias', label: 'Mercadorias', icon: Package },
      { to: '/tipos-movimento', label: 'Tipos de Movimento', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'Operação Comercial',
    items: [
      { to: '/requisicoes', label: 'Requisições', icon: ShoppingCart },
      { to: '/movimentacoes', label: 'Movimentações', icon: History },
    ],
  },
  {
    title: 'Gestão Financeira',
    items: [
      { to: '/contas-financeiras', label: 'Contas Financeiras', icon: Landmark },
      { to: '/formas-pagamento', label: 'Formas de Pagamento', icon: CreditCard },
      { to: '/financeiro', label: 'Financeiro & Caixa', icon: Wallet },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { to: '/relatorios', label: 'Relatórios Gerenciais', icon: BarChart3 },
    ],
  },
];

const routeTitles = {
  '/dashboard': {
    title: 'Dashboard Executivo',
    subtitle: 'Visão consolidada de estoque, requisições e fluxo financeiro',
  },
  '/pessoas': {
    title: 'Gestão de Pessoas',
    subtitle: 'Clientes, fornecedores, funcionários e credenciais de acesso',
  },
  '/mercadorias': {
    title: 'Catálogo de Mercadorias',
    subtitle: 'Produtos, categorias, preços de venda e controle de saldo em estoque',
  },
  '/tipos-movimento': {
    title: 'Tipos de Movimento',
    subtitle: 'Classificação de operações de entrada, saída e ajustes neutros',
  },
  '/requisicoes': {
    title: 'Requisições Comerciais',
    subtitle: 'Pedidos de venda, compras, faturamento PIX e impressão de documentos',
  },
  '/movimentacoes': {
    title: 'Histórico de Movimentações',
    subtitle: 'Rastreabilidade completa das entradas e saídas físicas de estoque',
  },
  '/contas-financeiras': {
    title: 'Contas Financeiras',
    subtitle: 'Caixas físicos e contas bancárias com saldo atualizado em tempo real',
  },
  '/formas-pagamento': {
    title: 'Formas de Pagamento & Recebimento',
    subtitle: 'Regras de espécie de conta permitida (Caixa, Banco ou Ambos) e modalidade PIX',
  },
  '/financeiro': {
    title: 'Gestão Financeira & Fluxo de Caixa',
    subtitle: 'Contas a pagar, contas a receber, baixas financeiras e extrato consolidado',
  },
  '/relatorios': {
    title: 'Relatórios Gerenciais',
    subtitle: 'Análise avançada com múltiplos filtros em tags, exportação CSV e impressão PDF',
  },
};

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentMeta = routeTitles[location.pathname] || {
    title: 'ReqFlow',
    subtitle: 'Sistema Integrado de Gestão',
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.nome || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Backdrop Mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-xs lg:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 relative flex flex-col bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-200 select-none no-print shrink-0 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Botão Flutuante de Recolher/Expandir na borda da Sidebar */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:flex absolute -right-3 top-5 z-50 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 items-center justify-center text-slate-300 hover:text-white hover:bg-indigo-600 hover:border-indigo-500 shadow-md transition-all"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Brand Header */}
        <div
          className={`h-16 flex items-center border-b border-slate-800/80 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <div
            onClick={() => collapsed && setCollapsed(false)}
            className={`flex items-center gap-3 ${
              collapsed ? 'cursor-pointer' : 'overflow-hidden'
            }`}
            title={collapsed ? 'Clique para expandir o menu' : undefined}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="leading-tight truncate">
                <span className="font-bold text-base text-white tracking-tight">
                  ReqFlow
                </span>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-indigo-400">
                  ERP & Financeiro
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                        } ${collapsed ? 'justify-center' : ''}`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div
            className={`flex items-center ${
              collapsed ? 'flex-col justify-center gap-2' : 'gap-3'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">
                  {user?.nome || 'Usuário'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {user?.perfil || 'OPERADOR'}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Sair do sistema"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {currentMeta.title}
              </h1>
              <p className="hidden sm:block text-xs text-slate-500 truncate">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
