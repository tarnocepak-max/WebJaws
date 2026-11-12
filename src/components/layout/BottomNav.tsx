import React from 'react';
import { LayoutDashboard, Headphones, FileSpreadsheet, Menu } from 'lucide-react';

interface BottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenMobileMenu: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentPath,
  onNavigate,
  onOpenMobileMenu,
}) => {
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Contact Center', path: '/contact-center', icon: Headphones },
    { label: 'Report WO', path: '/report-wo', icon: FileSpreadsheet },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 lg:hidden flex items-center justify-around px-2 py-1.5 shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath === item.path;

        return (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              isActive ? 'text-sky-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] tracking-tight truncate">{item.label}</span>
          </button>
        );
      })}

      {/* Menu Drawer Toggle Button */}
      <button
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Menu</span>
      </button>
    </nav>
  );
};
