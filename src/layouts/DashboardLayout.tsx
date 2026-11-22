import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Bot,
  CalendarClock,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  Search,
  Settings,
  Store,
  UserCheck,
  Users,
  UsersRound,
  Workflow,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { NotificationItem, UserRole } from '../types';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  external?: boolean;
}

interface SearchResults {
  leads: Array<{ id: string; name: string; company: string; status: string; source: string }>;
  customers: Array<{ id: string; name: string; company: string; status: string }>;
  products: Array<{ id: string; name: string; category: string; price: number; sku: string }>;
  employees: Array<{ id: string; fullName: string; email: string; role: string }>;
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { showError } = useToast();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const storefrontSlug = user?.businessSlug || 'atelier-nord';

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'] },
    { label: 'Leads', to: '/leads', icon: Users, roles: ['ADMIN', 'MANAGER', 'SALES_EMPLOYEE'] },
    { label: 'Customers', to: '/customers', icon: UserCheck, roles: ['ADMIN', 'MANAGER', 'SALES_EMPLOYEE'] },
    { label: 'Follow-ups', to: '/follow-ups', icon: CalendarClock, roles: ['ADMIN', 'MANAGER', 'SALES_EMPLOYEE'] },
    { label: 'Products', to: '/products', icon: Package, roles: ['ADMIN', 'MANAGER'] },
    { label: 'Automation', to: '/automation', icon: Workflow, roles: ['ADMIN', 'MANAGER'] },
    { label: 'Brand Setup', to: '/brand-setup', icon: Palette, roles: ['ADMIN'] },
    { label: 'Storefront', to: `/store/${storefrontSlug}`, icon: Store, roles: ['ADMIN', 'MANAGER'], external: true },
    { label: 'Analytics', to: '/analytics', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
    { label: 'AI Assistant', to: '/ai-assistant', icon: Bot, roles: ['ADMIN', 'SALES_EMPLOYEE'] },
    { label: 'Team', to: '/team', icon: UsersRound, roles: ['ADMIN'] },
    { label: 'Settings', to: '/settings', icon: Settings, roles: ['ADMIN'] },
  ];

  const allowedNav = navItems.filter((item) => user && item.roles.includes(user.role));

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/api/notifications'
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Quietly ignore transient poll failure
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await apiRequest<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`);
        setSearchResults(res);
        setSearchOpen(true);
      } catch {
        setSearchResults(null);
      }
    }, 220);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const markRead = async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await apiRequest(`/api/notifications/${item.id}/read`, { method: 'PATCH' });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setNotifOpen(false);
      if (item.linkUrl) navigate(item.linkUrl);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update notification');
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to clear notifications');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const hasResults =
    searchResults &&
    (searchResults.leads.length > 0 ||
      searchResults.customers.length > 0 ||
      searchResults.products.length > 0 ||
      searchResults.employees.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-slate-950 text-slate-100 border-r border-slate-800">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80">
          <Link to="/dashboard" className="flex items-center gap-2.5 whitespace-nowrap">
            <div className="w-8 h-8 rounded-lg bg-sky-500 text-slate-950 flex items-center justify-center font-display font-bold text-sm">
              BP
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">
              BizPilot
            </span>
          </Link>
        </div>

        <div className="px-4 py-3 border-b border-slate-800/80">
          <p className="text-xs text-slate-400 truncate">{user?.businessName}</p>
          <p className="text-xs font-medium text-sky-400 mt-0.5">
            {user?.role.replace('_', ' ')}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            if (item.external) {
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                >
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <Icon className="w-4 h-4 text-slate-400" />
                    {item.label}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                </Link>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-full bg-slate-950 text-slate-100 flex flex-col h-full z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
              <span className="font-display font-bold text-lg text-white">BizPilot</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {allowedNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    target={item.external ? '_blank' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                        isActive && !item.external
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-900"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search */}
            <div ref={searchRef} className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => searchResults && setSearchOpen(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads, customers, products, team..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 transition-colors"
              />

              {searchOpen && searchQuery.trim() && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40 max-h-96 overflow-y-auto">
                  {!hasResults ? (
                    <div className="p-4 text-sm text-slate-500">
                      No matches found for "{searchQuery}".
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {searchResults!.leads.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-xs font-semibold text-slate-400">Leads</p>
                          {searchResults!.leads.map((l) => (
                            <button
                              key={l.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate('/leads');
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm"
                            >
                              <span className="font-medium text-slate-900 truncate">
                                {l.name} {l.company ? `· ${l.company}` : ''}
                              </span>
                              <span className="text-xs text-slate-500 shrink-0 ml-2">{l.status}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults!.customers.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-xs font-semibold text-slate-400">Customers</p>
                          {searchResults!.customers.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate('/customers');
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm"
                            >
                              <span className="font-medium text-slate-900 truncate">
                                {c.name} {c.company ? `· ${c.company}` : ''}
                              </span>
                              <span className="text-xs text-slate-500 shrink-0 ml-2">{c.status}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults!.products.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-xs font-semibold text-slate-400">Products</p>
                          {searchResults!.products.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate('/products');
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm"
                            >
                              <span className="font-medium text-slate-900 truncate">
                                {p.name} · {p.sku}
                              </span>
                              <span className="text-xs font-mono tabular-nums text-slate-600 shrink-0 ml-2">
                                ₹{p.price.toLocaleString('en-IN')}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults!.employees.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-xs font-semibold text-slate-400">Team</p>
                          {searchResults!.employees.map((e) => (
                            <button
                              key={e.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                navigate('/team');
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-sm"
                            >
                              <span className="font-medium text-slate-900 truncate">{e.fullName}</span>
                              <span className="text-xs text-slate-500 shrink-0 ml-2">{e.role}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={`/store/${storefrontSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Store className="w-3.5 h-3.5" />
              <span>View Storefront</span>
            </Link>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-600 text-white text-[11px] font-mono font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-medium text-sky-600 hover:text-sky-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">You are all caught up.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => markRead(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            n.isRead ? 'bg-white' : 'bg-sky-50/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{n.title}</p>
                            {!n.isRead && (
                              <span className="text-[11px] font-medium text-sky-600 shrink-0">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {n.category} · {new Date(n.createdAt).toLocaleDateString()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile summary */}
            <div className="hidden md:flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
                {user?.fullName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                  {user?.fullName}
                </p>
                <p className="text-[11px] text-slate-500 truncate max-w-[130px]">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors lg:hidden"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
