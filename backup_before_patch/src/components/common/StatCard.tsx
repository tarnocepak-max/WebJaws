import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  colorScheme: 'sky' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate' | 'teal';
  isActive?: boolean;
  onClick?: () => void;
  subtext?: string;
}

const colorMap = {
  sky: {
    bg: 'bg-sky-950/40 border-sky-800/40 hover:border-sky-500/60',
    iconBg: 'bg-sky-500/10 text-sky-400',
    text: 'text-sky-300',
    activeBorder: 'ring-2 ring-sky-500 border-sky-400 bg-sky-950/70',
  },
  indigo: {
    bg: 'bg-indigo-950/40 border-indigo-800/40 hover:border-indigo-500/60',
    iconBg: 'bg-indigo-500/10 text-indigo-400',
    text: 'text-indigo-300',
    activeBorder: 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-950/70',
  },
  emerald: {
    bg: 'bg-emerald-950/40 border-emerald-800/40 hover:border-emerald-500/60',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
    text: 'text-emerald-300',
    activeBorder: 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-950/70',
  },
  amber: {
    bg: 'bg-amber-950/40 border-amber-800/40 hover:border-amber-500/60',
    iconBg: 'bg-amber-500/10 text-amber-400',
    text: 'text-amber-300',
    activeBorder: 'ring-2 ring-amber-500 border-amber-400 bg-amber-950/70',
  },
  rose: {
    bg: 'bg-rose-950/40 border-rose-800/40 hover:border-rose-500/60',
    iconBg: 'bg-rose-500/10 text-rose-400',
    text: 'text-rose-300',
    activeBorder: 'ring-2 ring-rose-500 border-rose-400 bg-rose-950/70',
  },
  purple: {
    bg: 'bg-purple-950/40 border-purple-800/40 hover:border-purple-500/60',
    iconBg: 'bg-purple-500/10 text-purple-400',
    text: 'text-purple-300',
    activeBorder: 'ring-2 ring-purple-500 border-purple-400 bg-purple-950/70',
  },
  slate: {
    bg: 'bg-slate-900/60 border-slate-800 hover:border-slate-600',
    iconBg: 'bg-slate-800 text-slate-400',
    text: 'text-slate-300',
    activeBorder: 'ring-2 ring-slate-400 border-slate-300 bg-slate-900',
  },
  teal: {
    bg: 'bg-teal-950/40 border-teal-800/40 hover:border-teal-500/60',
    iconBg: 'bg-teal-500/10 text-teal-400',
    text: 'text-teal-300',
    activeBorder: 'ring-2 ring-teal-500 border-teal-400 bg-teal-950/70',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  count,
  icon: Icon,
  colorScheme,
  isActive = false,
  onClick,
  subtext,
}) => {
  const c = colorMap[colorScheme] || colorMap.slate;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-150 relative overflow-hidden group cursor-pointer ${
        isActive ? c.activeBorder : c.bg
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{title}</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{count}</p>
          {subtext && <p className="text-[11px] text-slate-400 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2.5 rounded-lg border border-white/5 ${c.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
};
