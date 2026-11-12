import React, { useState } from 'react';
import {
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
  ChevronLeft,
  Shield,
  Circle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Map icon string names to Lucide components
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
  Shield,
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { user, appConfig, hasRole } = useAuth();

  // Accordion state for categories
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'cat-wo': true,
    'cat-installer': true,
    'cat-setup': true,
  });

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const menuItems = appConfig?.menuItems || [];
  const menuCategories = appConfig?.menuCategories || [];

  // Filter standalone menus
  const standaloneItems = menuItems.filter(
    (item) => item.isStandalone && item.isActive && (!item.allowedRoles?.length || hasRole(item.allowedRoles as any))
  );

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-slate-950 border-r border-slate-800 transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/50">
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-sky-500/20">
              WJ
            </div>
            <div>
              <div className="font-extrabold text-white text-base tracking-tight flex items-center gap-1.5">
                WebJaws
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  OPS
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 leading-none truncate max-w-[120px]">
                Operations Hub
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center font-black text-white text-base shadow-lg shadow-sky-500/20">
            WJ
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* SECTION: 4 STANDALONE TOP MENUS */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Menu Utama
            </div>
          )}

          {standaloneItems.map((item) => {
            const Icon = iconMap[item.icon] || Circle;
            const isSelected = currentPath === item.path;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.path)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Standalone Divider */}
        <div className="border-t border-slate-800/80 my-2" />

        {/* SECTION: ACCORDION CATEGORIES */}
        <div className="space-y-3">
          {menuCategories
            .filter((cat) => cat.isActive && (!cat.allowedRoles?.length || hasRole(cat.allowedRoles as any)))
            .sort((a, b) => a.order - b.order)
            .map((cat) => {
              const isOpen = openCategories[cat.id] ?? true;
              const CatIcon = iconMap[cat.icon] || Circle;

              // Items belonging to this category
              const catItems = menuItems.filter(
                (item) =>
                  item.categoryId === cat.id &&
                  item.isActive &&
                  (!item.allowedRoles?.length || hasRole(item.allowedRoles as any))
              );

              if (catItems.length === 0) return null;

              return (
                <div key={cat.id} className="space-y-1">
                  {/* Category Header (Accordion Toggle) */}
                  {!isCollapsed ? (
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <CatIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cat.label}</span>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  ) : (
                    <div className="w-full flex justify-center py-1 text-slate-400" title={cat.label}>
                      <CatIcon className="w-4 h-4" />
                    </div>
                  )}

                  {/* Submenu Items */}
                  {(isOpen || isCollapsed) && (
                    <div className={`space-y-1 ${!isCollapsed ? 'pl-2 border-l border-slate-800/60 ml-3' : ''}`}>
                      {catItems.map((item) => {
                        const ItemIcon = iconMap[item.icon] || Circle;
                        const isSelected = currentPath === item.path;

                        return (
                          <button
                            key={item.id}
                            onClick={() => onNavigate(item.path)}
                            title={isCollapsed ? item.label : undefined}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                              isSelected
                                ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                            } ${isCollapsed ? 'justify-center' : ''}`}
                          >
                            <ItemIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                            {!isCollapsed && <span className="truncate text-left flex-1">{item.label}</span>}
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

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-sky-400">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Staff'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="role" status={user?.role} size="sm">
                  {user?.role}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={`${user?.full_name} (${user?.role})`}>
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-sky-400">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
