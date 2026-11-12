import React, { useState } from 'react';
import {
  X,
  LayoutDashboard,
  Headphones,
  FileSpreadsheet,
  Users,
  Layers,
  Wrench,
  Settings,
  UploadCloud,
  Share2,
  CheckCircle2,
  Clock,
  Calendar,
  Briefcase,
  ListFilter,
  Archive,
  Activity,
  FileText,
  MessageSquare,
  Sliders,
  ListOrdered,
  FolderTree,
  Database,
  ChevronDown,
  ChevronRight,
  LogOut,
  Circle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Headphones,
  FileSpreadsheet,
  Users,
  Layers,
  Wrench,
  Settings,
  UploadCloud,
  Share2,
  CheckCircle2,
  Clock,
  Calendar,
  Briefcase,
  ListFilter,
  Archive,
  Activity,
  FileText,
  MessageSquare,
  Sliders,
  ListOrdered,
  FolderTree,
  Database,
};

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  currentPath,
  onNavigate,
}) => {
  const { user, appConfig, hasRole, logout } = useAuth();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'cat-wo': true,
    'cat-installer': true,
    'cat-setup': true,
  });

  if (!isOpen) return null;

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleSelect = (path: string) => {
    onNavigate(path);
    onClose();
  };

  const menuItems = appConfig?.menuItems || [];
  const menuCategories = appConfig?.menuCategories || [];

  const standaloneItems = menuItems.filter(
    (item) => item.isStandalone && item.isActive && (!item.allowedRoles?.length || hasRole(item.allowedRoles as any))
  );

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over Drawer */}
      <div className="relative w-4/5 max-w-xs bg-slate-950 border-r border-slate-800 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center font-black text-white text-sm">
              WJ
            </div>
            <div>
              <p className="font-extrabold text-white text-sm">WebJaws Menu</p>
              <p className="text-[10px] text-slate-400">Integrated Operations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* User profile card */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-xs font-bold text-white truncate">{user?.full_name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="role" status={user?.role} size="sm">
                {user?.role}
              </Badge>
            </div>
            {user?.contractor_name && (
              <p className="text-[11px] text-slate-400 mt-1 truncate">{user.contractor_name}</p>
            )}
            {user?.area && <p className="text-[10px] text-slate-400 truncate">Area: {user.area}</p>}
          </div>

          {/* Standalone items */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">Menu Mandiri</p>
            {standaloneItems.map((item) => {
              const Icon = iconMap[item.icon] || Circle;
              const isSelected = currentPath === item.path;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isSelected ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-800" />

          {/* Accordion Categories */}
          <div className="space-y-3">
            {menuCategories
              .filter((cat) => cat.isActive && (!cat.allowedRoles?.length || hasRole(cat.allowedRoles as any)))
              .sort((a, b) => a.order - b.order)
              .map((cat) => {
                const isOpen = openCategories[cat.id] ?? true;
                const CatIcon = iconMap[cat.icon] || Circle;
                const catItems = menuItems.filter(
                  (item) =>
                    item.categoryId === cat.id &&
                    item.isActive &&
                    (!item.allowedRoles?.length || hasRole(item.allowedRoles as any))
                );

                if (catItems.length === 0) return null;

                return (
                  <div key={cat.id} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400"
                    >
                      <div className="flex items-center gap-2">
                        <CatIcon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </div>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {isOpen && (
                      <div className="space-y-1 pl-2 border-l border-slate-800 ml-2">
                        {catItems.map((item) => {
                          const ItemIcon = iconMap[item.icon] || Circle;
                          const isSelected = currentPath === item.path;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelect(item.path)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                                isSelected ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <ItemIcon className="w-3.5 h-3.5" />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/40 text-xs font-semibold hover:bg-rose-900/80 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Akun (Logout)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
