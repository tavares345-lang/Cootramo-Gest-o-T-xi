import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Car, 
  Ticket, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  CreditCard, 
  MapPin, 
  FileText, 
  TrendingUp,
  UserCheck,
  DollarSign
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Sector } from './types';
import { useAuth } from './contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Components
import Dashboard from './components/Dashboard';
import RideSales from './components/RideSales';
import Vouchers from './components/Vouchers';
import Registrations from './components/Registrations';
import Payments from './components/Payments';
import Reports from './components/Reports';
import MonthlyAnalysis from './components/MonthlyAnalysis';
import Login from './components/Login';

type Page = 'dashboard' | 'sales' | 'vouchers' | 'registrations' | 'payments' | 'reports' | 'analysis';

export default function App() {
  const { user, profile, loading, signOut } = useAuth();
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);

  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'sectors'), (snapshot) => {
      setSectors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector)));
    });
    return () => unsubscribe();
  }, [user]);

  const currentSector = sectors.find(s => s.id === profile?.sectorId);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    try {
      const { updatePassword } = await import('firebase/auth');
      if (user) {
        await updatePassword(user, newPassword);
        setIsChangePasswordOpen(false);
        setNewPassword('');
        setConfirmPassword('');
        alert('Senha alterada com sucesso!');
      }
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/requires-recent-login') {
        setPasswordError('Esta operação requer um login recente. Por favor, saia e entre novamente.');
      } else {
        setPasswordError('Erro ao alterar senha. Tente novamente.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMINISTRADOR', 'GERENTE', 'VENDEDOR'] },
    { id: 'sales', label: 'Vendas', icon: Car, roles: ['ADMINISTRADOR', 'VENDEDOR'] },
    { id: 'vouchers', label: 'Vouchers', icon: Ticket, roles: ['ADMINISTRADOR', 'GERENTE', 'VENDEDOR'] },
    { id: 'payments', label: 'Financeiro', icon: DollarSign, roles: ['ADMINISTRADOR', 'GERENTE'] },
    { id: 'registrations', label: 'Cadastros', icon: Users, roles: ['ADMINISTRADOR', 'GERENTE'] },
    { id: 'reports', label: 'Relatórios', icon: FileText, roles: ['ADMINISTRADOR', 'GERENTE'] },
    { id: 'analysis', label: 'Análise Mensal', icon: TrendingUp, roles: ['ADMINISTRADOR'] },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!profile?.role) return false;
    const userRole = profile.role.toUpperCase();
    // Handle old role names for backward compatibility
    const normalizedUserRole = userRole === 'ADMIN' ? 'ADMINISTRADOR' : 
                               userRole === 'MANAGER' ? 'GERENTE' : 
                               userRole === 'SELLER' ? 'VENDEDOR' : 
                               userRole === 'BALCONISTA' ? 'VENDEDOR' : userRole;
    
    return item.roles.some(r => r.toUpperCase() === normalizedUserRole);
  });

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard onNavigate={setActivePage} />;
      case 'sales': return <RideSales />;
      case 'vouchers': return <Vouchers />;
      case 'registrations': return <Registrations />;
      case 'payments': return <Payments />;
      case 'reports': return <Reports />;
      case 'analysis': return <MonthlyAnalysis onBack={() => setActivePage('dashboard')} />;
      default: return <Dashboard onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="flex h-screen bg-neutral-100 font-sans text-neutral-900">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-neutral-200">
        <div className="p-6 flex items-center gap-3 border-b border-neutral-100">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
            <Car size={24} />
          </div>
          <span className="font-bold text-lg tracking-tight">Táxi Gestão Pro</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id as Page)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activePage === item.id 
                  ? "bg-emerald-50 text-emerald-700 font-medium shadow-sm" 
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 bg-neutral-200 rounded-full flex items-center justify-center text-neutral-600 font-bold text-xs">
              {profile?.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.name}</p>
              <p className="text-xs text-neutral-400 capitalize">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 md:hidden flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                    <Car size={24} />
                  </div>
                  <span className="font-bold text-lg tracking-tight">Táxi Gestão Pro</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {filteredNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActivePage(item.id as Page);
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                      activePage === item.id 
                        ? "bg-emerald-50 text-emerald-700 font-medium" 
                        : "text-neutral-500 hover:bg-neutral-50"
                    )}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </button>
                ))}
              </nav>
              <div className="p-4 border-t border-neutral-100">
                <button 
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={20} />
                  Sair
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-neutral-100 rounded-lg md:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-semibold text-neutral-900 capitalize">
              {activePage.replace('registrations', 'Cadastros').replace('sales', 'Vendas').replace('payments', 'Pagamentos').replace('reports', 'Relatórios').replace('analysis', 'Análise Mensal')}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {currentSector && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                <MapPin size={14} />
                <span className="text-xs font-bold uppercase tracking-wider">{currentSector.name}</span>
              </div>
            )}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{profile?.name}</span>
              <span className="text-xs text-neutral-400 capitalize">{profile?.role}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsChangePasswordOpen(true)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold uppercase tracking-wider"
                >
                  Alterar Senha
                </button>
                <span className="text-[10px] text-neutral-300">|</span>
                <button 
                  onClick={signOut}
                  className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider"
                >
                  Sair
                </button>
              </div>
            </div>
            <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-600 font-bold border border-neutral-200">
              {profile?.name?.charAt(0) || '?'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto"
          >
            {renderPage()}
          </motion.div>
        </div>
      </main>

      {/* Change Password Modal */}
      <AnimatePresence>
        {isChangePasswordOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsChangePasswordOpen(false)} 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-xl font-bold text-neutral-900 mb-6">Alterar Senha</h3>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                    {passwordError}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Nova Senha</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Confirmar Senha</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required 
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                </div>
                <div className="flex gap-4 mt-8">
                  <button 
                    type="button" 
                    onClick={() => setIsChangePasswordOpen(false)} 
                    className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={passwordLoading}
                    className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:opacity-50"
                  >
                    {passwordLoading ? 'Alterando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
