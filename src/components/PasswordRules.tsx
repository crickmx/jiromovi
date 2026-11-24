import { Check, X, Lock } from 'lucide-react';
import { PASSWORD_RULES, passwordStrength, type PasswordRuleId } from '../lib/passwordPolicy';
import { cn } from '@/lib/utils';

/**
 * Requisitos de contraseña, marcados en vivo mientras se escribe.
 *
 * Va junto al campo en TODAS las pantallas donde se define una contraseña
 * (perfil y recuperación) para que las reglas se vean antes de enviar, no
 * después de que el servidor rechace: el usuario no debería descubrir los
 * requisitos por un error.
 */
export default function PasswordRules({
  value,
  className,
  title = 'La contraseña debe tener:',
  dark = false,
}: {
  value: string;
  className?: string;
  title?: string;
  dark?: boolean;
}) {
  const checks = PASSWORD_RULES.reduce((acc, rule) => {
    acc[rule.id] = rule.test(value);
    return acc;
  }, {} as Record<PasswordRuleId, boolean>);

  return (
    <div className={cn('rounded-xl px-3 py-2.5 space-y-1.5', dark ? 'bg-white/5 border border-white/10' : 'bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10', className)}>
      <p className={cn('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide', dark ? 'text-white/60' : 'text-neutral-500 dark:text-white/55')}>
        <Lock className="w-3 h-3" />
        {title}
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = checks[rule.id];
          return (
            <li
              key={rule.id}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                ok ? 'text-green-600 dark:text-green-400' : dark ? 'text-white/60' : 'text-neutral-500 dark:text-white/50',
              )}
            >
              {ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0 opacity-50" />}
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
      <p className={cn('text-[11px] leading-snug', dark ? 'text-white/45' : 'text-neutral-400 dark:text-white/40')}>
        Tampoco puede ser una contraseña que aparezca en filtraciones de datos conocidas. Recomendado: 12 caracteres o más.
      </p>
    </div>
  );
}

/** Barra de fortaleza. Es informativa: lo que decide es la lista de requisitos. */
export function PasswordStrengthBar({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  const strength = passwordStrength(value);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(strength.level / 4) * 100}%`, background: strength.color }}
        />
      </div>
      <span className="text-[11px] font-medium" style={{ color: strength.color }}>
        {strength.label}
      </span>
    </div>
  );
}
