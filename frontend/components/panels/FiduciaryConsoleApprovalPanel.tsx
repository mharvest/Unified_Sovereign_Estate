import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

type RoleId = 'cpa' | 'treasury' | 'underwriter' | 'insurance' | 'minister' | 'se7en';

interface Role {
  id: RoleId;
  name: string;
}

interface AccentTokens {
  border: string;
  circleBorder: string;
  circleBg: string;
  text: string;
  shadow: string;
}

interface FiduciaryConsoleApprovalPanelProps {
  className?: string;
}

const roles: Role[] = [
  { id: 'cpa', name: 'CPA' },
  { id: 'treasury', name: 'Treasury' },
  { id: 'underwriter', name: 'Underwriter' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'minister', name: 'Minister' },
  { id: 'se7en', name: 'Se7en AI' }
];

const accentTokens: Record<RoleId, AccentTokens> = {
  cpa: {
    border: 'border-emerald-400/30',
    circleBorder: 'border-emerald-300/60',
    circleBg: 'bg-emerald-400',
    text: 'text-emerald-300',
    shadow: '0 0 24px rgba(16,185,129,0.45)'
  },
  treasury: {
    border: 'border-cyan-400/30',
    circleBorder: 'border-cyan-200/60',
    circleBg: 'bg-cyan-400',
    text: 'text-cyan-300',
    shadow: '0 0 24px rgba(34,211,238,0.45)'
  },
  underwriter: {
    border: 'border-violet-400/30',
    circleBorder: 'border-violet-300/60',
    circleBg: 'bg-violet-400',
    text: 'text-violet-300',
    shadow: '0 0 24px rgba(139,92,246,0.45)'
  },
  insurance: {
    border: 'border-amber-400/30',
    circleBorder: 'border-amber-300/60',
    circleBg: 'bg-amber-400',
    text: 'text-amber-300',
    shadow: '0 0 24px rgba(251,191,36,0.45)'
  },
  minister: {
    border: 'border-rose-400/30',
    circleBorder: 'border-rose-300/60',
    circleBg: 'bg-rose-400',
    text: 'text-rose-300',
    shadow: '0 0 24px rgba(244,114,182,0.45)'
  },
  se7en: {
    border: 'border-fuchsia-400/30',
    circleBorder: 'border-fuchsia-300/60',
    circleBg: 'bg-fuchsia-400',
    text: 'text-fuchsia-300',
    shadow: '0 0 24px rgba(217,70,239,0.45)'
  }
};

export default function FiduciaryConsoleApprovalPanel({ className }: FiduciaryConsoleApprovalPanelProps) {
  const [activeRole, setActiveRole] = useState<RoleId | null>(null);
  const [approvedRoles, setApprovedRoles] = useState<RoleId[]>([]);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      const nextRole = roles[index];
      if (!nextRole) {
        clearInterval(timer);
        setActiveRole(null);
        return;
      }

      setActiveRole(nextRole.id);
      setApprovedRoles((prev) => {
        if (prev.includes(nextRole.id)) {
          return prev;
        }
        return [...prev, nextRole.id];
      });
      index += 1;
    }, 2200);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const approvalsComplete = approvedRoles.length === roles.length;
  const approvalsStatus = useMemo(
    () => `${approvedRoles.length} / ${roles.length} Approvals Confirmed`,
    [approvedRoles.length]
  );

  return (
    <section
      className={clsx(
        'relative w-full rounded-3xl border border-white/10 bg-obsidian/60 px-6 py-8 text-white/80 shadow-neon backdrop-blur-md',
        'transition-colors duration-700',
        className
      )}
    >
      <h2 className="mb-10 text-center text-2xl font-semibold uppercase tracking-[0.35em] text-orchid">
        Fiduciary Console — Multi-Signature Validation
      </h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => {
          const accent = accentTokens[role.id];
          const isActive = activeRole === role.id;
          const isApproved = approvedRoles.includes(role.id);

          return (
            <motion.div
              key={role.id}
              className={clsx(
                'relative rounded-2xl border bg-midnight/70 p-6 text-center shadow-inner',
                accent.border
              )}
              animate={{
                scale: isActive ? 1.05 : 1,
                boxShadow: isApproved ? accent.shadow : '0 0 0 rgba(0,0,0,0)'
              }}
              transition={{ duration: 0.6 }}
            >
              <div
                className={clsx(
                  'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm transition-colors',
                  accent.circleBorder,
                  isApproved ? accent.circleBg : 'bg-transparent text-white/40'
                )}
              >
                {isApproved ? (
                  <motion.span
                    className="text-black"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.35 }}
                    aria-hidden="true"
                  >
                    ✓
                  </motion.span>
                ) : (
                  <span className="text-xs text-white/40">...</span>
                )}
              </div>

              <h3
                className={clsx(
                  'text-lg font-semibold transition-colors',
                  isApproved ? accent.text : 'text-white/60'
                )}
              >
                {role.name}
              </h3>
              <p className="mt-1 text-xs text-white/50">
                {isApproved ? 'Approval complete' : isActive ? 'Reviewing...' : 'Pending'}
              </p>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-10 text-center text-xs uppercase tracking-[0.25em] text-white/50" aria-live="polite">
        {approvalsComplete ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-emerald-300"
          >
            ✅ All signatories approved · Sovereign execution authorised
          </motion.p>
        ) : (
          <p>
            Transaction cycle: <span className="text-amber-300">{approvalsStatus}</span>
          </p>
        )}
      </div>
    </section>
  );
}
