import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImportWoPage } from './pages/ImportWoPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { InstallerDashboardPage } from './pages/InstallerDashboardPage';
import { ContactCenterPage } from './pages/ContactCenterPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { AppSettingPage } from './pages/AppSettingPage';
import { DroplistSettingPage } from './pages/DroplistSettingPage';
import { DatabaseAppPage } from './pages/DatabaseAppPage';
import { FirstSuperadminSetupPage } from './pages/FirstSuperadminSetupPage';
import { RefreshCw } from 'lucide-react';

function AppRouter() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('/dashboard');
  const [showSetup, setShowSetup] = useState(
    () => new URLSearchParams(window.location.search).get('setup') === '1'
  );

  useEffect(() => {
    // If installer logs in, default to installer dashboard
    if (user?.role === 'Installer' && currentPath === '/dashboard') {
      setCurrentPath('/installer/dashboard');
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center font-black text-white text-lg shadow-xl shadow-sky-500/20 mb-4 animate-pulse">
          WJ
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
          <span>Memuat WebJaws Operations Platform...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showSetup) {
      return (
        <FirstSuperadminSetupPage
          onComplete={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setShowSetup(false);
          }}
        />
      );
    }
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentPath) {
      // Standalone Menus
      case '/dashboard':
        return <DashboardPage onNavigate={setCurrentPath} />;
      case '/contact-center':
        return <ContactCenterPage />;
      case '/report-wo':
        return <WorkOrdersPage pageType="total" title="Report Work Order (All WO Data)" />;
      case '/management-user':
        return <UserManagementPage />;

      // Category 1: Management WO
      case '/management-wo/import-wo':
        return <ImportWoPage />;
      case '/management-wo/distribute-wo':
        return <WorkOrdersPage pageType="distribute" title="Distribute Work Order" />;
      case '/management-wo/wo-complete':
        return <WorkOrdersPage pageType="complete" title="WO Complete (Penyelesaian WO)" />;
      case '/management-wo/wo-pending':
        return <WorkOrdersPage pageType="pending" title="WO Pending (Tertunda Lapangan)" />;
      case '/management-wo/wo-reschedule':
        return <WorkOrdersPage pageType="reschedule" title="WO Reschedule (Jadwal Ulang)" />;
      case '/management-wo/wo-contractor':
        return <WorkOrdersPage pageType="contractor" title="WO Contractor" />;
      case '/management-wo/total-wo':
        return <WorkOrdersPage pageType="total" title="TOTAL WO" />;
      case '/management-wo/arsip-wo':
        return <WorkOrdersPage pageType="archive" title="ARSIP WO" />;

      // Category 2: Installer
      case '/installer/dashboard':
      case '/installer/list-ticket':
        return <InstallerDashboardPage />;
      case '/installer/contact-center':
        return <ContactCenterPage />;

      // Category 3: Setup
      case '/setup/setting-aplikasi':
      case '/setup/setting-kategori':
        return <AppSettingPage />;
      case '/setup/setting-droplist':
        return <DroplistSettingPage />;
      case '/setup/database-application':
        return <DatabaseAppPage />;

      default:
        return <DashboardPage onNavigate={setCurrentPath} />;
    }
  };

  return (
    <AppLayout currentPath={currentPath} onNavigate={setCurrentPath}>
      {renderContent()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
