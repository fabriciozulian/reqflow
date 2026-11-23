import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check } from 'lucide-react';

function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * AutocompleteSelect
 * Suporta:
 * - multiple = false (seleção única): value é o item selecionado (ou id), onChange(item)
 * - multiple = true  (múltipla seleção em tags/chips): value é array de itens (ou ids), onChange(itemsArray)
 */
export default function AutocompleteSelect({
  items = [],
  value,
  onChange,
  multiple = false,
  minChars = 2,
  placeholder = 'Digite pelo menos 2 caracteres para buscar...',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Resolve itens selecionados
  const selectedItems = useMemo(() => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      return arr
        .map((v) =>
          typeof v === 'object' && v !== null
            ? v
            : items.find((i) => String(i.id) === String(v))
        )
        .filter(Boolean);
    } else {
      if (!value) return [];
      const found =
        typeof value === 'object' && value !== null
          ? value
          : items.find((i) => String(i.id) === String(value));
      return found ? [found] : [];
    }
  }, [value, items, multiple]);

  // Sincroniza texto do input no modo single
  useEffect(() => {
    if (!multiple) {
      if (selectedItems.length > 0) {
        setQuery(selectedItems[0].label || '');
      } else {
        setQuery('');
      }
    }
  }, [multiple, selectedItems]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (!multiple && selectedItems.length > 0) {
          setQuery(selectedItems[0].label || '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [multiple, selectedItems]);

  // Filtra opções a partir de minChars
  const filteredOptions = useMemo(() => {
    const term = normalizeText(query);
    if (term.length < minChars) return [];

    const selectedIds = new Set(selectedItems.map((s) => String(s.id)));

    return items
      .filter((item) => {
        if (multiple && selectedIds.has(String(item.id))) return false;
        const hay = normalizeText(
          `${item.label || ''} ${item.subtext || ''} ${item.code || ''} ${item.id || ''}`
        );
        return hay.includes(term);
      })
      .slice(0, 40);
  }, [items, query, minChars, multiple, selectedItems]);

  const handleSelect = (item) => {
    if (multiple) {
      const next = [...selectedItems, item];
      onChange?.(next);
      setQuery('');
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    } else {
      onChange?.(item);
      setQuery(item.label || '');
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleRemoveChip = (idToRemove) => {
    if (!multiple) {
      onChange?.(null);
      setQuery('');
      return;
    }
    const next = selectedItems.filter((item) => String(item.id) !== String(idToRemove));
    onChange?.(next);
  };

  const handleClearSingle = () => {
    onChange?.(null);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && multiple && !query && selectedItems.length > 0) {
      e.preventDefault();
      const last = selectedItems[selectedItems.length - 1];
      handleRemoveChip(last.id);
      return;
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && filteredOptions[activeIndex]) {
        e.preventDefault();
        handleSelect(filteredOptions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const termLength = normalizeText(query).length;

  return (
    <div ref={containerRef} className="relative w-full">
      {multiple ? (
        <div
          onClick={() => !disabled && inputRef.current?.focus()}
          className={`min-h-[40px] w-full flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white text-sm transition-all ${
            disabled
              ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
              : 'border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20'
          }`}
        >
          {selectedItems.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80"
            >
              <span className="truncate max-w-[190px]">
                {chip.chipLabel || chip.label}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveChip(chip.id);
                  }}
                  className="text-indigo-400 hover:text-indigo-700 rounded-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          ))}
          <div className="flex-1 flex items-center min-w-[140px]">
            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={query}
              placeholder={selectedItems.length === 0 ? placeholder : 'Adicionar mais...'}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
                setActiveIndex(0);
              }}
              onFocus={() => {
                if (query.trim().length > 0) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          {selectedItems.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange?.([]);
                setQuery('');
              }}
              title="Limpar todos"
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (selectedItems.length > 0) {
                onChange?.(null);
              }
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => {
              if (query.trim().length > 0 && selectedItems.length === 0) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            className={`w-full pl-9 pr-8 py-2 rounded-lg border text-sm transition-all focus:outline-none ${
              disabled
                ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                : selectedItems.length > 0
                ? 'border-indigo-300 bg-indigo-50/30 text-slate-900 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            }`}
          />
          {(query || selectedItems.length > 0) && !disabled && (
            <button
              type="button"
              onClick={handleClearSingle}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              title="Limpar seleção"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown de sugestões */}
      {isOpen && !disabled && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100">
          {termLength < minChars ? (
            <div className="px-3.5 py-3 text-xs text-slate-500 text-center">
              Digite pelo menos <strong>{minChars} caracteres</strong> para pesquisar...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-slate-500 text-center">
              Nenhum resultado encontrado para "{query}".
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = selectedItems.some(
                (s) => String(s.id) === String(opt.id)
              );
              return (
                <button
                  type="button"
                  key={opt.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                    idx === activeIndex ? 'bg-indigo-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {opt.label}
                    </div>
                    {opt.subtext && (
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {opt.subtext}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
