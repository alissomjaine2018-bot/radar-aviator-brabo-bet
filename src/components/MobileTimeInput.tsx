import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, Minus, RotateCcw, Check, Sparkles } from 'lucide-react';

interface MobileTimeInputProps {
  id: string;
  label: string;
  value: string; // e.g. "14:30"
  onChange: (newValue: string) => void;
  placeholder?: string;
  badge?: string;
  helperText?: string;
  presets?: Array<{ label: string; time: string }>;
  accentColor?: 'pink' | 'amber' | 'cyan' | 'purple';
}

/**
 * Normalizes any string into a valid HH:MM format (00:00 to 23:59).
 */
export function normalizeTimeString(input: string, fallback = '00:00'): string {
  if (!input) return fallback;
  const cleaned = input.trim().replace(/[^0-9:]/g, '');

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h)) h = 0;
    if (isNaN(m)) m = 0;
    h = Math.max(0, Math.min(23, h));
    m = Math.max(0, Math.min(59, m));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Digits only
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 0) return fallback;
  if (digits.length <= 2) {
    let h = parseInt(digits, 10);
    if (isNaN(h)) h = 0;
    h = Math.max(0, Math.min(23, h));
    return `${String(h).padStart(2, '0')}:00`;
  }

  let h = parseInt(digits.slice(0, 2), 10);
  let m = parseInt(digits.slice(2, 4), 10);
  if (isNaN(h)) h = 0;
  if (isNaN(m)) m = 0;
  h = Math.max(0, Math.min(23, h));
  m = Math.max(0, Math.min(59, m));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const MobileTimeInput: React.FC<MobileTimeInputProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = '00:00',
  badge,
  helperText,
  presets = [],
  accentColor = 'amber',
}) => {
  // Local state to allow natural typing without cursor jumping or premature validation
  const [textValue, setTextValue] = useState<string>(value || '00:00');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const hiddenTimePickerRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external changes when not actively typing
  useEffect(() => {
    if (!isFocused && value) {
      setTextValue(value);
    }
  }, [value, isFocused]);

  // Adjust time by hours or minutes
  const adjustTime = (deltaHours: number, deltaMinutes: number = 0) => {
    const current = normalizeTimeString(textValue || value || '00:00');
    const [hStr, mStr] = current.split(':');
    let h = parseInt(hStr, 10) || 0;
    let m = parseInt(mStr, 10) || 0;

    let totalMinutes = h * 60 + m + deltaHours * 60 + deltaMinutes;
    // Handle wrap around 24 hours (1440 min)
    while (totalMinutes < 0) totalMinutes += 1440;
    totalMinutes = totalMinutes % 1440;

    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    const formatted = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;

    setTextValue(formatted);
    onChange(formatted);
  };

  // Set directly to current device time
  const handleSetCurrentTime = () => {
    const now = new Date();
    const formatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setTextValue(formatted);
    onChange(formatted);
  };

  // Handle typing with smart auto-colon formatting
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Filter only numbers and colon
    const sanitized = raw.replace(/[^0-9:]/g, '');

    // Auto-insert colon when user types 2 digits without colon
    let formatted = sanitized;
    if (sanitized.length === 2 && !sanitized.includes(':') && textValue.length < 2) {
      const h = parseInt(sanitized, 10);
      if (h <= 23) {
        formatted = `${sanitized}:`;
      }
    } else if (sanitized.length > 5) {
      formatted = sanitized.slice(0, 5);
    }

    setTextValue(formatted);

    // If complete HH:MM (5 chars), commit immediately
    if (formatted.length === 5 && formatted.includes(':')) {
      const valid = normalizeTimeString(formatted);
      onChange(valid);
    }
  };

  // On blur, strictly normalize and commit to parent
  const handleBlur = () => {
    setIsFocused(false);
    const normalized = normalizeTimeString(textValue, value || '00:00');
    setTextValue(normalized);
    onChange(normalized);
  };

  // Safe native time picker trigger if user clicks clock icon
  const handleOpenNativePicker = () => {
    try {
      if (hiddenTimePickerRef.current && typeof hiddenTimePickerRef.current.showPicker === 'function') {
        hiddenTimePickerRef.current.showPicker();
      } else {
        // Fallback: focus the text input and trigger Android keyboard
        inputRef.current?.focus();
      }
    } catch (e) {
      // If iframe blocks showPicker, focus text input instead
      inputRef.current?.focus();
    }
  };

  const getBorderFocusColor = () => {
    switch (accentColor) {
      case 'pink':
        return 'focus:border-pink-500 focus:ring-pink-500/30';
      case 'cyan':
        return 'focus:border-cyan-400 focus:ring-cyan-400/30';
      case 'purple':
        return 'focus:border-purple-400 focus:ring-purple-400/30';
      default:
        return 'focus:border-amber-400 focus:ring-amber-400/30';
    }
  };

  const getTextColor = () => {
    switch (accentColor) {
      case 'pink':
        return 'text-pink-300';
      case 'cyan':
        return 'text-cyan-300';
      case 'purple':
        return 'text-purple-300';
      default:
        return 'text-amber-300';
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      {/* Label and Badge */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{label}</span>
        </label>
        {badge && (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950 text-pink-300 border border-purple-800/60">
            {badge}
          </span>
        )}
      </div>

      {/* Main Input Container */}
      <div className="relative flex items-center">
        {/* The Text Input with inputMode="numeric" - ALWAYS OPENS KEYBOARD ON ANDROID */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9:]*"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={5}
          value={textValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`w-full bg-[#151028] border border-purple-800/60 rounded-xl pl-3 pr-20 py-2.5 text-sm sm:text-base font-mono font-black ${getTextColor()} focus:outline-none focus:ring-2 ${getBorderFocusColor()} transition-all shadow-inner`}
        />

        {/* Quick Stepper Buttons inside/beside the input */}
        <div className="absolute right-1.5 flex items-center gap-1">
          {/* Quick -1 Hour */}
          <button
            type="button"
            onClick={() => adjustTime(-1, 0)}
            title="Diminuir 1 hora (-1h)"
            className="w-7 h-7 rounded-lg bg-purple-950/90 hover:bg-purple-900 border border-purple-700/60 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <Minus className="w-3 h-3" />
          </button>

          {/* Quick +1 Hour */}
          <button
            type="button"
            onClick={() => adjustTime(1, 0)}
            title="Aumentar 1 hora (+1h)"
            className="w-7 h-7 rounded-lg bg-purple-950/90 hover:bg-purple-900 border border-purple-700/60 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3 h-3" />
          </button>

          {/* Clock Button to trigger system picker if supported */}
          <button
            type="button"
            onClick={handleOpenNativePicker}
            title="Abrir relógio do dispositivo"
            className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-900 to-indigo-900 hover:from-purple-800 hover:to-indigo-800 border border-purple-600/60 text-amber-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hidden native time input for browsers that support showPicker safely */}
        <input
          ref={hiddenTimePickerRef}
          type="time"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only opacity-0 pointer-events-none absolute w-0 h-0"
          value={normalizeTimeString(textValue)}
          onChange={(e) => {
            if (e.target.value) {
              setTextValue(e.target.value);
              onChange(e.target.value);
            }
          }}
        />
      </div>

      {/* Touch-Friendly Mobile Helper / Quick Increments */}
      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-mono">
        <button
          type="button"
          onClick={handleSetCurrentTime}
          className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer flex items-center gap-1 active:scale-95 py-0.5"
        >
          <span>🕒 Usar Agora ({new Date().toLocaleTimeString('pt-BR').slice(0, 5)})</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustTime(0, -15)}
            className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/50 hover:bg-purple-900 text-slate-300 hover:text-white active:scale-95"
            title="Voltar 15 minutos"
          >
            -15m
          </button>
          <button
            type="button"
            onClick={() => adjustTime(0, 15)}
            className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/50 hover:bg-purple-900 text-slate-300 hover:text-white active:scale-95"
            title="Avançar 15 minutos"
          >
            +15m
          </button>
        </div>
      </div>

      {/* Quick Presets row if provided */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {presets.map((p, idx) => (
            <button
              key={`${p.label}_${idx}`}
              type="button"
              onClick={() => {
                const norm = normalizeTimeString(p.time);
                setTextValue(norm);
                onChange(norm);
              }}
              className="px-2 py-0.5 rounded-lg bg-[#140e29] hover:bg-purple-900/60 border border-purple-800/40 text-[10px] font-mono text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {helperText && (
        <p className="text-[10px] text-slate-400 leading-tight">{helperText}</p>
      )}
    </div>
  );
};
