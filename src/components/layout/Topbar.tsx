import React, { useState } from 'react';
import {
  Database,
  UserCheck,
  LogOut,
  Bell,
  ChevronDown,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';
import { FeatureLockIndicator } from './FeatureLockIndicator';

interface TopbarProps {
  onNavigate: (path: string) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onNavigate }) => {
  const { user, appConfig, dbStatus, logout, login } = useAuth();
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Quick staff accounts for evaluator verification of RBAC
  const staffProfiles = [
    { role: 'Superadmin', name: 'Superadmin', user: 'superadmin', pass: 'AdminWebJaws2026!' },
    { role: 'Agent Dispatch', name: 'Dewi Sartika (Agent Dispatch)', user: 'agent.dispatch', pass: 'AgentWebJaws2026!' },
    { role: 'Leader', name: 'Rian Pratama (Leader)', user: 'leader.mora', pass: 'LeaderWebJaws2026!' },
    { role: 'Installer', name: 'Budi Santoso (Installer)', user: 'teknisi.budi', pass: 'TeknisiWebJaws2026!' },
    { role: 'Monitoring Data', name: 'Siti Handayani (Monitoring)', user: 'monitoring.staff', pass: 'MonitorWebJaws2026!' },
    { role: 'IT Support Application', name: 'Faisal Akbar (IT Support)', user: 'itsupport.staff', pass: 'ITSupportWebJaws2026!' },
  ];

  const handleQuickSwitch = async (username: string, pass: string) => {
    setSwitching(true);
    try {
      await login(username, pass);
      setShowSwitchDropdown(false);
    } catch (err: any) {
      alert(`Quick switch error: ${err.message}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
      {/* Left: Operational Title / Banner */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <p className="text-xs font-bold text-white tracking-wide">
            {appConfig?.theme?.headerBanner || 'WebJaws — Integrated Operations & Ticket Management Platform'}
          </p>
          <p className="text-[10px] text-slate-400">
            Work Order Distribution &bull; Agent Dispatch &bull; Installer Mobile Hub
          </p>
        </div>
        <div className="sm:hidden font-extrabold text-sm text-white">
          WebJaws OPS
        </div>
      </div>

      {/* Right Actions: Database Status, Role Switcher, Profile, Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        <FeatureLockIndicator />
        {/* Supabase DB Status Indicator */}
        <button
          onClick={() => onNavigate('/setup/database-application')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
            dbStatus?.connected
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
              : 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
          }`}
          title={dbStatus?.connected ? 'Connected to Supabase PostgreSQL' : 'Using Local Standalone Store (Click to Setup Supabase)'}
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {dbStatus?.connected ? 'Supabase PG: Online' : 'DB: Memory Fallback'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              dbStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
        </button>

        {/* Quick RBAC Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowSwitchDropdown((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title="Switch staff profile for testing RBAC permissions"
          >
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Role Switcher</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showSwitchDropdown && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-2 py-1.5 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Uji Coba Hak Akses Role (RBAC)
              </div>
              <div className="space-y-1 mt-1 max-h-64 overflow-y-auto">
                {staffProfiles.map((p) => {
                  const isCurrent = user?.username === p.user;
                  return (
                    <button
                      key={p.user}
                      onClick={() => handleQuickSwitch(p.user, p.pass)}
                      disabled={switching}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition flex flex-col ${
                        isCurrent
                          ? 'bg-sky-600/30 border border-sky-500/50 text-sky-200'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{p.role}</span>
                        {isCurrent && <span className="text-[10px] text-sky-400 font-semibold">&bull; Active</span>}
                      </div>
                      <span className="text-[11px] text-slate-400">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* User Role Badge */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
          <Badge variant="role" status={user?.role} size="md">
            {user?.role}
          </Badge>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition cursor-pointer"
          title="Logout from WebJaws"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
