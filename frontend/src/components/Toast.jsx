import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Toast({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;

  const styles = {
    success: {
      bg: 'bg-white border-emerald-200',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
      bar: 'bg-emerald-500',
    },
    error: {
      bg: 'bg-white border-rose-200',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
      bar: 'bg-rose-500',
    },
    warning: {
      bg: 'bg-white border-amber-200',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
      bar: 'bg-amber-500',
    },
    info: {
      bg: 'bg-white border-indigo-200',
      icon: <Info className="w-5 h-5 text-indigo-600 shrink-0" />,
      bar: 'bg-indigo-500',
    },
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0 no-print">
      {toasts.map((t) => {
        const cfg = styles[t.type] || styles.info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-xl border shadow-lg shadow-slate-900/5 transition-all duration-200 ${cfg.bg}`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar}`} />
            {cfg.icon}
            <div className="flex-1 text-sm font-medium text-slate-800 leading-snug">
              {t.message}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
