import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pessoas from './pages/Pessoas';
import Mercadorias from './pages/Mercadorias';
import TiposMovimento from './pages/TiposMovimento';
import Requisicoes from './pages/Requisicoes';
import Movimentacoes from './pages/Movimentacoes';
import ContasFinanceiras from './pages/ContasFinanceiras';
import FormasPagamento from './pages/FormasPagamento';
import Financeiro from './pages/Financeiro';
import Relatorios from './pages/Relatorios';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
        Verificando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/pessoas"
              element={
                <PrivateRoute>
                  <Pessoas />
                </PrivateRoute>
              }
            />
            <Route
              path="/mercadorias"
              element={
                <PrivateRoute>
                  <Mercadorias />
                </PrivateRoute>
              }
            />
            <Route
              path="/tipos-movimento"
              element={
                <PrivateRoute>
                  <TiposMovimento />
                </PrivateRoute>
              }
            />
            <Route
              path="/requisicoes"
              element={
                <PrivateRoute>
                  <Requisicoes />
                </PrivateRoute>
              }
            />
            <Route
              path="/movimentacoes"
              element={
                <PrivateRoute>
                  <Movimentacoes />
                </PrivateRoute>
              }
            />
            <Route
              path="/contas-financeiras"
              element={
                <PrivateRoute>
                  <ContasFinanceiras />
                </PrivateRoute>
              }
            />
            <Route
              path="/formas-pagamento"
              element={
                <PrivateRoute>
                  <FormasPagamento />
                </PrivateRoute>
              }
            />
            <Route
              path="/financeiro"
              element={
                <PrivateRoute>
                  <Financeiro />
                </PrivateRoute>
              }
            />
            <Route
              path="/relatorios"
              element={
                <PrivateRoute>
                  <Relatorios />
                </PrivateRoute>
              }
            />

            {/* Redirecionamentos de compatibilidade e rota raiz */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
