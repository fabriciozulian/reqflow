import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Layers,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@marketplace.com');
  const [senha, setSenha] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !senha) {
      setError('Informe seu e-mail e sua senha para continuar.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await login(email.trim(), senha);
      toast.success(`Bem-vindo(a), ${res.user?.nome || 'Administrador'}!`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Credenciais inválidas.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* Painel Esquerdo: Institucional SaaS */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">ReqFlow</span>
            <span className="block text-xs text-indigo-400 font-medium">
              Enterprise Resource & Cashflow
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plataforma Unificada v2.0</span>
          </div>
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
            Controle completo de estoque, requisições e fluxo financeiro.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Gerencie compras, vendas com QR Code PIX imediato, contas a pagar e a
            receber por espécie de conta e relatórios gerenciais em tempo real.
          </p>

          <div className="space-y-3 pt-2">
            {[
              'Transações de estoque com bloqueio pessimista e rastreabilidade',
              'Faturamento integrado com QR Code PIX estático padrão BACEN',
              'Conciliação de Caixas e Bancos por espécie de forma de pagamento',
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-sm text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-6">
          <span>© {new Date().getFullYear()} ReqFlow — Gestão Comercial</span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Ambiente Seguro JWT
          </span>
        </div>
      </div>

      {/* Painel Direito: Formulário de Login */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden inline-flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-2xl font-bold text-slate-900">ReqFlow</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Acesse sua conta
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Entre com suas credenciais para acessar o painel operacional.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@marketplace.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <span>{submitting ? 'Autenticando...' : 'Entrar no ReqFlow'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Credencial padrão de demonstração:</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@marketplace.com');
                  setSenha('admin123');
                }}
                className="font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Preencher Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
