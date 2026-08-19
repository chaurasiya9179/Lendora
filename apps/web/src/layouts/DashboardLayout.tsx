import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Banknote,
  Receipt,
  CalendarCheck,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.js';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { formatDateTime } from '../utils/formatters.js';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: notifications = [], refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.getNotifications();
      return Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    },
    refetchInterval: 30000,
  });

  const notifsList = Array.isArray(notifications) ? notifications : [];
  const unreadCount = notifsList.filter((n: any) => n && n.status !== 'READ').length;

  const navLinks = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Borrowers / Grahak', path: '/customers', icon: Users },
    { label: 'Loan Portfolio', path: '/loans', icon: Banknote },
    { label: 'Payment Ledger', path: '/payments', icon: Receipt },
    { label: 'Due Today & Vasooli', path: '/collections', icon: CalendarCheck },
    { label: 'Overdue & Bakiya', path: '/overdue', icon: AlertTriangle },
    { label: 'Reports & Hisaab', path: '/reports', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const filteredNavLinks = navLinks;

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/customers?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleMarkRead = async (id: string) => {
    await api.markNotificationRead(id);
    refetchNotifs();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center space-x-3 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Banknote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center">
              LENDORA
              <span className="ml-1.5 px-1.5 py-0.2 bg-brand-500/20 text-brand-400 text-[10px] rounded font-mono font-bold">PRO</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">FinTech Loan Platform</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavLinks.map(link => {
            const Icon = link.icon;
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-brand-400' : 'text-slate-500'}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-200 uppercase">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <span className="text-[10px] text-brand-400 font-mono font-medium tracking-wide">
                  {user?.role?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg md:hidden text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Global Search */}
            <form onSubmit={handleGlobalSearch} className="relative hidden sm:block w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search customers, loans, receipts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
              />
            </form>
          </div>

          <div className="flex items-center space-x-3">
            {/* Notification Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 relative transition"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-slate-900 animate-pulse" />
                )}
              </button>

              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">System Notifications</span>
                    <span className="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full font-mono">
                      {unreadCount} unread
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/50">
                    {notifsList.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">No new notifications</div>
                    ) : (
                      notifsList.map((n: any) => (
                        <div
                          key={n.id || Math.random()}
                          onClick={() => handleMarkRead(n.id)}
                          className={`p-3.5 hover:bg-slate-800/50 cursor-pointer transition flex items-start space-x-3 ${
                            n.status !== 'READ' ? 'bg-brand-500/5' : ''
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-200">{n.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{formatDateTime(n.createdAt)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Role indicator badge */}
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono font-medium rounded-lg">
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-1">
            {filteredNavLinks.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium ${
                    isActive ? 'bg-brand-500/10 text-brand-400 font-semibold' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {link.label}
                </Link>
              );
            })}
            <button
              onClick={logout}
              className="w-full flex items-center px-3 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </button>
          </div>
        )}

        {/* Main Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
