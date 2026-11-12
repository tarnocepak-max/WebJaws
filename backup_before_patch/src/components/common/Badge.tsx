import React from 'react';
import { AgentStatus, InstallerStatus, SystemStatus, UserRole } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'agent' | 'installer' | 'system' | 'role' | 'default';
  status?: AgentStatus | InstallerStatus | SystemStatus | UserRole | string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', status, size = 'sm' }) => {
  const value = status || (typeof children === 'string' ? children : '');
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs font-semibold' : 'px-2.5 py-1 text-xs font-bold';

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  if (variant === 'agent' || variant === 'installer') {
    switch (value) {
      case 'Approved':
      case 'Done':
        colorClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
        break;
      case 'Pending':
        colorClasses = 'bg-amber-950/80 text-amber-300 border-amber-500/40';
        break;
      case 'Cancel':
        colorClasses = 'bg-rose-950/80 text-rose-300 border-rose-500/40';
        break;
      case 'Reschedule':
        colorClasses = 'bg-purple-950/80 text-purple-300 border-purple-500/40';
        break;
      case 'Unhandled':
      default:
        colorClasses = 'bg-slate-800/80 text-slate-300 border-slate-600/40';
        break;
    }
  } else if (variant === 'system') {
    switch (value) {
      case 'Completed':
        colorClasses = 'bg-emerald-950 text-emerald-400 border-emerald-600/40';
        break;
      case 'In Progress':
        colorClasses = 'bg-amber-950 text-amber-400 border-amber-600/40';
        break;
      case 'Assigned':
        colorClasses = 'bg-blue-950 text-blue-400 border-blue-600/40';
        break;
      case 'Requested':
        colorClasses = 'bg-cyan-950 text-cyan-400 border-cyan-600/40';
        break;
      case 'Archived':
      default:
        colorClasses = 'bg-zinc-800 text-zinc-400 border-zinc-700';
        break;
    }
  } else if (variant === 'role') {
    switch (value) {
      case 'Superadmin':
        colorClasses = 'bg-rose-950/90 text-rose-300 border-rose-500/40';
        break;
      case 'Agent Dispatch':
        colorClasses = 'bg-sky-950/90 text-sky-300 border-sky-500/40';
        break;
      case 'Leader':
        colorClasses = 'bg-violet-950/90 text-violet-300 border-violet-500/40';
        break;
      case 'Installer':
        colorClasses = 'bg-orange-950/90 text-orange-300 border-orange-500/40';
        break;
      case 'Monitoring Data':
        colorClasses = 'bg-teal-950/90 text-teal-300 border-teal-500/40';
        break;
      case 'IT Support Application':
        colorClasses = 'bg-indigo-950/90 text-indigo-300 border-indigo-500/40';
        break;
      default:
        colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border tracking-wide whitespace-nowrap ${sizeClasses} ${colorClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {children || value}
    </span>
  );
};
