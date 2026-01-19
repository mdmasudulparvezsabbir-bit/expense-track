
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, LayoutDashboard, History, User as UserIcon, LogOut, Search, Download, 
  BrainCircuit, Trash2, X, ShieldCheck, UserPlus, CheckCircle2, 
  XCircle, Clock, Users as UsersIcon, Edit, UserCheck, AlertCircle, TrendingUp, TrendingDown, Wallet, Building2, Smartphone, Coins, Camera, Settings, Save, Calendar, Filter, XCircle as CancelIcon, Cloud, Check, ListChecks, ClipboardList, Moon, Sun
} from 'lucide-react';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { exportToExcel } from './services/exportService';
import { syncService } from './services/syncService';
import { 
  Transaction, TransactionType, AppState, AISuggestion, 
  UserRole, PaymentSource, TransactionStatus, User as UserType, ActivityLog 
} from './types';
import { 
  DEFAULT_CATEGORIES, INCOME_CATEGORIES, getIconComponent, 
  PAYMENT_SOURCES, CURRENCY, CONVEYANCE_SUB_CATEGORIES, 
  ADMIN_ONLY_CATEGORIES, ADMIN_ASSET_SUB_CATEGORIES 
} from './constants';
import { 
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  XAxis, YAxis, CartesianGrid, AreaChart, Area, BarChart, Bar
} from 'recharts';

type View = 'dashboard' | 'transactions' | 'insights' | 'profile' | 'users' | 'rejected' | 'logs' | 'requisitions';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(storageService.loadData());
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [aiTips, setAiTips] = useState<AISuggestion[]>([]);
  const [isLoadingTips, setIsLoadingTips] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storageService.saveData(state);
  }, [state]);

  // Dark Mode Application
  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.darkMode]);

  const toggleDarkMode = () => {
    setState(prev => {
      const newVal = !prev.darkMode;
      logActivity('System Theme Change', `Switched to ${newVal ? 'Dark' : 'Light'} Mode`, 'system');
      return { ...prev, darkMode: newVal };
    });
  };

  const logActivity = useCallback((action: string, details: string, type: ActivityLog['type'], username?: string) => {
    const newLog: ActivityLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      username: username || state.currentUser?.username || 'System',
      action,
      details,
      type
    };
    setState(prev => ({
      ...prev,
      activityLogs: [newLog, ...prev.activityLogs].slice(0, 1000) // Keep last 1000 logs
    }));
  }, [state.currentUser]);

  const fetchAiTips = useCallback(async () => {
    if (!state.currentUser) return;
    const isGlobal = state.currentUser.role === UserRole.ADMIN || state.currentUser.role === UserRole.MANAGER;
    const dataForAI = state.transactions.filter(t => 
      t.status === TransactionStatus.APPROVED && t.category !== 'Requisition' && (isGlobal ? true : t.userId === state.currentUser?.id)
    );

    setIsLoadingTips(true);
    const tips = await geminiService.getAnalysis(dataForAI);
    setAiTips(tips);
    setIsLoadingTips(false);
  }, [state.transactions, state.currentUser]);

  useEffect(() => {
    if (state.transactions.length > 0 && state.currentUser) {
      fetchAiTips();
    }
  }, [fetchAiTips]);

  const handleCloudSync = async () => {
    if (!state.sheetUrl) {
      alert("Please configure Cloud Sync URL in Settings first.");
      setCurrentView('users');
      return;
    }
    setIsSyncing(true);
    const success = await syncService.syncToSheets(state.sheetUrl, state);
    if (success) {
      setState(prev => ({ ...prev, lastSynced: new Date().toLocaleString() }));
      logActivity('Cloud Sync', 'Successfully synchronized data to Google Sheets', 'system');
    } else {
      alert("Failed to sync with Google Cloud.");
      logActivity('Cloud Sync', 'Failed to synchronize data to Google Sheets', 'system');
    }
    setIsSyncing(false);
  };

  const stats = useMemo(() => {
    const isGlobalViewer = state.currentUser?.role === UserRole.ADMIN || state.currentUser?.role === UserRole.MANAGER;
    
    const relevantTransactions = state.transactions.filter(t => {
      const isApproved = t.status === TransactionStatus.APPROVED;
      if (t.category === 'Requisition') return false; // Isolated category
      if (!isApproved) return false;
      return isGlobalViewer ? true : t.userId === state.currentUser?.id;
    });

    const income = relevantTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = relevantTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    const sourceBalances = PAYMENT_SOURCES.reduce((acc, source) => {
      const sIncome = relevantTransactions
        .filter(t => t.source === source && t.type === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);
      const sExpense = relevantTransactions
        .filter(t => t.source === source && t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);
      acc[source] = sIncome - sExpense;
      return acc;
    }, {} as Record<string, number>);
    
    return { income, expenses, balance: income - expenses, count: relevantTransactions.length, sourceBalances };
  }, [state.transactions, state.currentUser]);

  const filteredTransactions = useMemo(() => {
    let list = state.transactions;
    const isGlobalViewer = state.currentUser?.role === UserRole.ADMIN || state.currentUser?.role === UserRole.MANAGER;
    
    if (!isGlobalViewer) {
      list = list.filter(t => t.userId === state.currentUser?.id);
    }
    
    // Default view isolates Requisitions and Rejected
    if (currentView !== 'requisitions' && currentView !== 'rejected') {
        list = list.filter(t => t.category !== 'Requisition' && t.status !== TransactionStatus.REJECTED);
    } else if (currentView === 'requisitions') {
        list = list.filter(t => t.category === 'Requisition');
    } else if (currentView === 'rejected') {
        list = list.filter(t => t.status === TransactionStatus.REJECTED);
    }

    return list.filter(t => {
      const matchesSearch = t.note.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.createdBy.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUser = filterUser === 'all' || t.userId === filterUser;
      const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
      const matchesStartDate = !startDate || new Date(t.date) >= new Date(startDate);
      const matchesEndDate = !endDate || new Date(t.date) <= new Date(endDate);
      
      return matchesSearch && matchesUser && matchesCategory && matchesStartDate && matchesEndDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, searchQuery, state.currentUser, filterUser, filterCategory, startDate, endDate, currentView]);

  const filteredSummary = useMemo(() => {
    const revenue = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.APPROVED && t.category !== 'Requisition')
      .reduce((sum, t) => sum + t.amount, 0);
    const outflow = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.APPROVED && t.category !== 'Requisition')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Special requisition stats if viewing requisitions
    const reqTotal = filteredTransactions
      .filter(t => t.category === 'Requisition' && t.status !== TransactionStatus.REJECTED)
      .reduce((sum, t) => sum + t.amount, 0);
      
    return { revenue, outflow, reqTotal };
  }, [filteredTransactions]);

  const rejectedTransactions = useMemo(() => {
    return state.transactions
      .filter(t => t.status === TransactionStatus.REJECTED)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'profilePic') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (type === 'logo') {
          setState(prev => ({ ...prev, companyLogo: base64String }));
          logActivity('Branding Update', 'Company logo was updated', 'system');
        } else {
          setState(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, profilePic: base64String } : u),
            currentUser: prev.currentUser ? { ...prev.currentUser, profilePic: base64String } : null
          }));
          logActivity('Profile Update', 'Profile picture was updated', 'user');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const uid = formData.get('username') as string;
    const user = state.users.find(u => 
      u.username === uid && u.password === formData.get('password')
    );
    if (user) {
      setState(prev => ({ ...prev, currentUser: user }));
      setLoginError(false);
      logActivity('Login Success', `User ${uid} successfully entered the node gateway`, 'auth', uid);
    } else {
      setLoginError(true);
      logActivity('Login Failed', `Failed access attempt for UID: ${uid}`, 'auth', uid);
    }
  };

  const handleLogout = () => {
    const user = state.currentUser?.username;
    logActivity('Logout', `User ${user} terminated session`, 'auth');
    setState(prev => ({ ...prev, currentUser: null }));
    setCurrentView('dashboard');
  };

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as UserRole;

    if (editingUser) {
      setState(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === editingUser.id ? { ...u, username, password, role } : u),
        currentUser: prev.currentUser?.id === editingUser.id ? { ...prev.currentUser, username, password, role } : prev.currentUser
      }));
      logActivity('User Update', `Provisioning updated for agent: ${username} (${role})`, 'user');
      setEditingUser(null);
    } else {
      const newUser: UserType = {
        id: crypto.randomUUID(),
        username,
        password,
        role
      };
      setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
      logActivity('User Creation', `New agent provisioned: ${username} with role ${role}`, 'user');
    }
    e.currentTarget.reset();
  };

  const handleSaveTransaction = (tData: Omit<Transaction, 'id' | 'userId' | 'createdBy' | 'status'>) => {
    if (!state.currentUser) return;
    
    if (editingTransaction) {
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.map(item => 
          item.id === editingTransaction.id ? { ...item, ...tData } : item
        )
      }));
      logActivity('Transaction Edit', `Modified ledger node ${editingTransaction.id.slice(0,8)}...`, 'transaction');
      setEditingTransaction(null);
    } else {
      let status = tData.type === TransactionType.INCOME ? TransactionStatus.APPROVED : TransactionStatus.PENDING;
      if (tData.type === TransactionType.EXPENSE && state.currentUser.role === UserRole.ADMIN) {
        status = TransactionStatus.APPROVED;
      }

      const newT: Transaction = { 
        ...tData, 
        id: crypto.randomUUID(),
        userId: state.currentUser.id,
        createdBy: state.currentUser.username,
        status
      };
      setState(prev => ({ ...prev, transactions: [newT, ...prev.transactions] }));
      logActivity('Transaction Add', `New ${tData.type} node validated: ${tData.category} - ${CURRENCY}${tData.amount}`, 'transaction');
    }
    setIsAdding(false);
  };

  const setTransactionStatus = (id: string, status: TransactionStatus) => {
    const t = state.transactions.find(item => item.id === id);
    if (t) {
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.map(item => item.id === id ? { ...item, status } : item)
      }));
      logActivity(`Status Change: ${status}`, `Ledger node ${id.slice(0,8)}... set to ${status}`, 'transaction');
    }
  };

  const deleteTransaction = (id: string) => {
    if (state.currentUser?.role === UserRole.ADMIN && confirm('Delete permanently?')) {
      setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
      logActivity('Transaction Delete', `Permanently purged ledger node ${id.slice(0,8)}...`, 'transaction');
    }
  };

  const StatusBadge = ({ status }: { status: TransactionStatus }) => {
    const configs: Record<TransactionStatus, { color: string, label: string }> = {
      [TransactionStatus.PENDING]: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Pending Verification' },
      [TransactionStatus.VERIFIED]: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Verified (Admin Appr)' },
      [TransactionStatus.APPROVED]: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Settled Node' },
      [TransactionStatus.REJECTED]: { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', label: 'Cancelled/Rejected' },
    };
    const config = configs[status];
    return <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>;
  };

  const FilterBar = ({ title }: { title?: string }) => {
    const isGlobal = state.currentUser?.role === UserRole.ADMIN || state.currentUser?.role === UserRole.MANAGER;
    return (
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/20 space-y-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by note, agent or node metadata..."
              className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-2xl">
              <Calendar size={18} className="text-slate-400" />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-xs dark:text-white" />
              <span className="text-slate-300">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none outline-none font-bold text-xs dark:text-white" />
            </div>
            {isGlobal && (
              <select 
                value={filterUser} 
                onChange={(e) => setFilterUser(e.target.value)}
                className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold text-xs appearance-none cursor-pointer focus:ring-4 focus:ring-indigo-500/10 dark:text-white"
              >
                <option value="all">All Agents</option>
                {state.users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
            )}
            {currentView !== 'requisitions' && (
              <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold text-xs appearance-none cursor-pointer focus:ring-4 focus:ring-indigo-500/10 dark:text-white"
              >
                <option value="all">All Categories</option>
                {[...DEFAULT_CATEGORIES, ...ADMIN_ONLY_CATEGORIES, ...INCOME_CATEGORIES].map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
            {(searchQuery || startDate || endDate || filterUser !== 'all' || filterCategory !== 'all') && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setStartDate('');
                  setEndDate('');
                  setFilterUser('all');
                  setFilterCategory('all');
                }}
                className="p-4 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all"
              >
                <XCircle size={24} />
              </button>
            )}
          </div>
        </div>
        
        {currentView === 'requisitions' && (startDate || endDate) && (
          <div className="pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
             <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Isolated Requisition Amount</p>
                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{CURRENCY}{filteredSummary.reqTotal.toLocaleString()}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Filtered Node Health</p>
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">{filteredTransactions.length} Audit Entries</p>
             </div>
          </div>
        )}
      </div>
    );
  };

  const StatCard = ({ label, value, icon: Icon, color }: any) => {
    const colors: any = {
      indigo: 'bg-indigo-600 text-white shadow-indigo-100 dark:shadow-indigo-900/20',
      emerald: 'bg-emerald-500 text-white shadow-emerald-100 dark:shadow-emerald-900/20',
      rose: 'bg-rose-500 text-white shadow-rose-100 dark:shadow-rose-900/20',
    };
    return (
      <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/20 flex items-center gap-8 group hover:scale-[1.02] transition-all">
        <div className={`p-6 rounded-[2rem] shadow-2xl ${colors[color]}`}>
          <Icon size={32} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{CURRENCY}{value.toLocaleString()}</p>
        </div>
      </div>
    );
  };

  const DashboardView = () => {
    const pieData = useMemo(() => {
      const categoryData: Record<string, number> = {};
      state.transactions
        .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.APPROVED && t.category !== 'Requisition')
        .forEach(t => {
          categoryData[t.category] = (categoryData[t.category] || 0) + t.amount;
        });
      return Object.entries(categoryData).map(([name, value]) => ({ name, value }));
    }, [state.transactions]);

    return (
      <div className="space-y-12 animate-slide-in font-outfit">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">Node Summary</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg mt-2">Real-time status of your decentralized financial ledger</p>
          </div>
          <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
             <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Clock size={24} />
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Last Sync Trace</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{state.lastSynced || 'Never'}</p>
             </div>
             <button 
               onClick={handleCloudSync} 
               disabled={isSyncing}
               className={`ml-4 p-4 rounded-2xl transition-all ${isSyncing ? 'bg-slate-100 dark:bg-slate-800 text-slate-300' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 active:scale-95 shadow-xl shadow-slate-200 dark:shadow-none'}`}
             >
               {isSyncing ? <div className="w-6 h-6 border-2 border-slate-300 border-t-white rounded-full animate-spin"></div> : <Cloud size={24} />}
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <StatCard label="Total Liquidity" value={stats.balance} icon={Wallet} color="indigo" />
          <StatCard label="Revenue Inflow" value={stats.income} icon={TrendingUp} color="emerald" />
          <StatCard label="Asset Outflow" value={stats.expenses} icon={TrendingDown} color="rose" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-10">
            <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/40 dark:shadow-none">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Outflow Distribution</h3>
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-full">Neural Map</span>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={[`#6366f1`, `#10b981`, `#f43f5e`, `#f59e0b`, `#8b5cf6`, `#ec4899`][index % 6]} />
                      ))}
                    </Pie>
                    <ReTooltip 
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '20px', backgroundColor: state.darkMode ? '#1e293b' : '#fff' }}
                      itemStyle={{ fontWeight: '900', color: state.darkMode ? '#fff' : '#1e293b' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-4 space-y-10">
             <div className="bg-slate-900 dark:bg-indigo-950 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden group h-full border border-white/5">
                <h3 className="text-xl font-black mb-8 flex items-center gap-3"><BrainCircuit className="text-indigo-400" /> Neural Insight</h3>
                <div className="space-y-6 relative z-10">
                   {isLoadingTips ? (
                     <div className="space-y-4 animate-pulse">
                        <div className="h-4 bg-white/10 rounded-full w-3/4"></div>
                        <div className="h-4 bg-white/10 rounded-full w-1/2"></div>
                     </div>
                   ) : (
                     <p className="text-2xl font-black leading-tight">{aiTips[0]?.tip || "Process more nodes to initialize AI optimization."}</p>
                   )}
                   <button onClick={() => setCurrentView('insights')} className="mt-6 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all">Full Analysis</button>
                </div>
                <div className="absolute bottom-[-60px] right-[-60px] opacity-[0.05] group-hover:opacity-[0.08] transition-opacity">
                   <BrainCircuit size={300} />
                </div>
             </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-xl">
           <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-10">Settlement Asset Balances</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {PAYMENT_SOURCES.map(source => (
                <div key={source} className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100/50 dark:border-slate-700/50">
                   <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{source}</p>
                   <p className={`text-2xl font-black tracking-tighter ${stats.sourceBalances[source] >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                      {CURRENCY}{stats.sourceBalances[source].toLocaleString()}
                   </p>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  };

  const ActivityLogsView = () => (
    <div className="space-y-10 animate-slide-in font-outfit">
       <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">System Trace Log</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Immutable audit trail of all node operations and agent activities</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest">
             {state.activityLogs.length} Trace Entries
          </div>
       </div>
       <div className="bg-white dark:bg-slate-900 rounded-[4rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl shadow-slate-200/30 dark:shadow-none">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
             {state.activityLogs.length === 0 ? (
               <div className="p-32 text-center text-slate-200 dark:text-slate-800">
                  <ListChecks size={80} className="mx-auto mb-8 opacity-10" />
                  <p className="font-black uppercase tracking-[0.3em] text-sm">No trace data available</p>
               </div>
             ) : (
               state.activityLogs.map(log => (
                 <div key={log.id} className="p-10 flex items-center gap-10 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                    <div className={`p-5 rounded-3xl ${
                      log.type === 'auth' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                      log.type === 'transaction' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                      log.type === 'user' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                       {log.type === 'auth' ? <ShieldCheck size={28} /> : 
                        log.type === 'transaction' ? <Coins size={28} /> :
                        log.type === 'user' ? <UserCheck size={28} /> : <Settings size={28} />}
                    </div>
                    <div className="flex-1">
                       <div className="flex items-center gap-4 mb-2">
                          <p className="font-black text-slate-900 dark:text-white text-xl tracking-tight">{log.action}</p>
                          <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full">{log.type} event</span>
                       </div>
                       <p className="text-slate-500 dark:text-slate-400 font-medium">{log.details}</p>
                    </div>
                    <div className="text-right">
                       <p className="font-black text-slate-900 dark:text-slate-100 text-sm">{log.username}</p>
                       <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                 </div>
               ))
             )}
          </div>
       </div>
    </div>
  );

  const RequisitionsView = () => (
    <div className="space-y-10 animate-slide-in font-outfit">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
             <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Isolated Requisitions</h2>
             <p className="text-slate-500 dark:text-slate-400 font-medium">Standalone audit of operational requisitions (Non-reconciled data)</p>
          </div>
       </div>
       <FilterBar />
       <div className="bg-white dark:bg-slate-900 rounded-[4rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none">
          <div className="p-10 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/20 dark:bg-slate-800/20">
             <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Validated Node Trail</h4>
             <div className="flex gap-8">
                <span className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Standalone Audit</span>
             </div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
             {filteredTransactions.length === 0 ? (
               <div className="p-32 text-center text-slate-300 dark:text-slate-700">
                  <ClipboardList size={80} className="mx-auto mb-8 opacity-5" />
                  <p className="font-black uppercase tracking-[0.3em] text-sm">No requisition nodes found</p>
               </div>
             ) : (
               filteredTransactions.map(t => {
                 const isPending = t.status === TransactionStatus.PENDING;
                 const canVerify = state.currentUser?.role === UserRole.MANAGER && isPending;
                 const canApprove = state.currentUser?.role === UserRole.ADMIN && (t.status === TransactionStatus.VERIFIED || isPending);
                 return (
                  <div key={t.id} className="p-10 flex items-center gap-10 transition-all group hover:bg-slate-50/80 dark:hover:bg-slate-800/80">
                    <div className="p-6 rounded-[2rem] shadow-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                       <ClipboardList size={32} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 mb-2">
                        <p className="font-black text-slate-900 dark:text-white text-2xl truncate tracking-tight">{t.note || 'Audit Entry'}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-[12px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.1em]">{new Date(t.date).toLocaleDateString()} • {t.source} • Agent: {t.createdBy}</p>
                    </div>
                    <div className="text-right flex items-center gap-10">
                      <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{CURRENCY}{t.amount.toLocaleString()}</p>
                      <div className="flex items-center gap-2">
                        {canVerify && (
                          <div className="flex gap-2">
                             <button onClick={() => setTransactionStatus(t.id, TransactionStatus.VERIFIED)} className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-100 hover:scale-105 transition-all"><CheckCircle2 size={18} /><span className="text-[9px] font-black uppercase tracking-widest">Verify</span></button>
                             <button onClick={() => setTransactionStatus(t.id, TransactionStatus.REJECTED)} className="flex items-center gap-2 px-4 py-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"><XCircle size={18} /><span className="text-[9px] font-black uppercase tracking-widest">Cancel</span></button>
                          </div>
                        )}
                        {canApprove && (
                          <div className="flex gap-2">
                             <button onClick={() => setTransactionStatus(t.id, TransactionStatus.APPROVED)} className="flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:scale-105 transition-all"><Check size={18} strokeWidth={3} /><span className="text-[9px] font-black uppercase tracking-widest">Approve</span></button>
                             <button onClick={() => setTransactionStatus(t.id, TransactionStatus.REJECTED)} className="flex items-center gap-2 px-4 py-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"><XCircle size={18} /><span className="text-[9px] font-black uppercase tracking-widest">Cancel</span></button>
                          </div>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditingTransaction(t); setIsAdding(true); }} className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"><Edit size={24} /></button>
                          {state.currentUser?.role === UserRole.ADMIN && <button onClick={() => deleteTransaction(t.id)} className="p-3 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-all"><Trash2 size={24} /></button>}
                        </div>
                      </div>
                    </div>
                  </div>
                 );
               })
             )}
          </div>
       </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${state.darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-32 md:pb-8 md:pl-32 transition-colors duration-500`}>
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-28 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 items-center py-12 gap-8 z-50">
        <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl cursor-pointer overflow-hidden border-4 border-white dark:border-slate-800">
           {state.companyLogo ? <img src={state.companyLogo} className="w-full h-full object-cover" /> : <BrainCircuit size={36} />}
        </div>
        <div className="flex flex-col gap-4 flex-1">
          <NavBtn icon={LayoutDashboard} active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} label="Summary" darkMode={state.darkMode} />
          <NavBtn icon={History} active={currentView === 'transactions'} onClick={() => setCurrentView('transactions')} label="Audit" darkMode={state.darkMode} />
          <NavBtn icon={ClipboardList} active={currentView === 'requisitions'} onClick={() => setCurrentView('requisitions')} label="Reqs" darkMode={state.darkMode} />
          {state.currentUser?.role === UserRole.ADMIN && <NavBtn icon={UsersIcon} active={currentView === 'users'} onClick={() => setCurrentView('users')} label="Nodes" darkMode={state.darkMode} />}
          {state.currentUser?.role === UserRole.ADMIN && <NavBtn icon={ListChecks} active={currentView === 'logs'} onClick={() => setCurrentView('logs')} label="Trace" darkMode={state.darkMode} />}
          <NavBtn icon={BrainCircuit} active={currentView === 'insights'} onClick={() => setCurrentView('insights')} label="Neural" darkMode={state.darkMode} />
          <NavBtn icon={UserIcon} active={currentView === 'profile'} onClick={() => setCurrentView('profile')} label="Identity" darkMode={state.darkMode} />
        </div>
        <button onClick={handleLogout} className="p-5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-3xl transition-all"><LogOut size={32} /></button>
      </nav>

      <main className="max-w-7xl mx-auto px-10 pt-12 md:pt-20 pb-20">
        {!state.currentUser ? (
          <div className="max-w-md mx-auto mt-20 p-10 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl font-outfit">
             <div className="text-center mb-10">
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl mx-auto mb-6">
                   <ShieldCheck size={44} />
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">Node Authentication</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Identity verification required</p>
             </div>
             <form onSubmit={handleLogin} className="space-y-6">
                <input name="username" type="text" required className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 dark:text-white" placeholder="Identity UID" />
                <input name="password" type="password" required className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 dark:text-white" placeholder="Access Key" />
                {loginError && <p className="text-rose-500 text-xs font-black uppercase text-center tracking-widest flex items-center justify-center gap-2"><AlertCircle size={14} /> Unauthorized credentials</p>}
                <button type="submit" className="w-full py-6 bg-slate-900 dark:bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-2xl shadow-slate-200 dark:shadow-none hover:scale-[1.02] transition-all">Establish Link</button>
             </form>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'requisitions' && <RequisitionsView />}
            {currentView === 'logs' && <ActivityLogsView />}
            {currentView === 'transactions' && (
              <div className="space-y-10 animate-slide-in font-outfit">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Ledger Trace log</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Audit of historical nodes, verified assets, and settlements</p>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={() => setCurrentView('rejected')} className="flex items-center gap-2 px-6 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm border border-rose-100 dark:border-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all">
                       <CancelIcon size={18} /> Rejected nodes
                     </button>
                     <button onClick={() => exportToExcel(state.transactions)} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200/50 dark:shadow-none"><Download className="dark:text-white" size={24} /></button>
                  </div>
                </div>
                <FilterBar />
                <div className="bg-white dark:bg-slate-900 rounded-[4rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none">
                  <div className="p-10 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/20 dark:bg-slate-800/20">
                     <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Validated nodes</h4>
                     <div className="flex gap-8">
                        <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> settled</span>
                        <span className="flex items-center gap-1.5 text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-rose-500"></div> outflow</span>
                     </div>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredTransactions.map(t => {
                      const Icon = getIconComponent([...DEFAULT_CATEGORIES, ...ADMIN_ONLY_CATEGORIES, ...INCOME_CATEGORIES].find(c => c.name === t.category)?.icon || 'Plus');
                      const isPending = t.status === TransactionStatus.PENDING;
                      const canVerify = state.currentUser?.role === UserRole.MANAGER && isPending && t.type === TransactionType.EXPENSE;
                      const canApprove = state.currentUser?.role === UserRole.ADMIN && t.type === TransactionType.EXPENSE && (t.status === TransactionStatus.VERIFIED || isPending);
                      return (
                        <div key={t.id} className="p-10 flex items-center gap-10 transition-all group hover:bg-slate-50/80 dark:hover:bg-slate-800/80">
                          <div className={`p-6 rounded-[2rem] shadow-sm transition-transform group-hover:scale-110 ${t.type === TransactionType.INCOME ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'}`}>
                             <Icon size={32} strokeWidth={2.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-4 mb-2">
                              <p className="font-black text-slate-900 dark:text-white text-2xl truncate tracking-tight">{t.note || t.category}</p>
                              <StatusBadge status={t.status} />
                            </div>
                            <p className="text-[12px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.1em]">{new Date(t.date).toLocaleDateString()} • {t.source} • Agent: {t.createdBy}</p>
                          </div>
                          <div className="text-right flex items-center gap-10">
                            <p className={`text-4xl font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'} tracking-tighter`}>{t.type === TransactionType.INCOME ? '+' : '-'}{CURRENCY}{t.amount.toLocaleString()}</p>
                            <div className="flex items-center gap-2">
                               {canVerify && (
                                 <div className="flex gap-2">
                                    <button onClick={() => setTransactionStatus(t.id, TransactionStatus.VERIFIED)} className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-100 hover:scale-105 transition-all"><CheckCircle2 size={18} /><span className="text-[9px] font-black uppercase tracking-widest">Verify</span></button>
                                    <button onClick={() => setTransactionStatus(t.id, TransactionStatus.REJECTED)} className="flex items-center gap-2 px-4 py-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"><XCircle size={18} /><span className="text-[9px] font-black uppercase tracking-widest">Reject</span></button>
                                 </div>
                               )}
                               {canApprove && (
                                 <div className="flex gap-2">
                                    <button onClick={() => setTransactionStatus(t.id, TransactionStatus.APPROVED)} className="flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:scale-105 transition-all"><Check size={18} strokeWidth={3} /><span className="text-[9px] font-black uppercase tracking-widest">Approve</span></button>
                                    <button onClick={() => setTransactionStatus(t.id, TransactionStatus.REJECTED)} className="flex items-center gap-2 px-4 py-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"><XCircle size={18} /><span className="text-[9px] font-black uppercase tracking-widest">Reject</span></button>
                                 </div>
                               )}
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                 <button onClick={() => { setEditingTransaction(t); setIsAdding(true); }} className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"><Edit size={24} /></button>
                                 {state.currentUser?.role === UserRole.ADMIN && <button onClick={() => deleteTransaction(t.id)} className="p-3 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-all"><Trash2 size={24} /></button>}
                               </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {currentView === 'rejected' && (
              <div className="space-y-10 animate-slide-in font-outfit">
                 <div className="flex items-center gap-6">
                    <button onClick={() => setCurrentView('transactions')} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"><CancelIcon size={28} className="rotate-45 dark:text-white" /></button>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Purged Ledger Nodes</h2>
                 </div>
                 <div className="bg-white dark:bg-slate-900 rounded-[4rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl shadow-rose-100/20 dark:shadow-none">
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                       {rejectedTransactions.map(t => {
                         const Icon = getIconComponent([...DEFAULT_CATEGORIES, ...ADMIN_ONLY_CATEGORIES, ...INCOME_CATEGORIES].find(c => c.name === t.category)?.icon || 'Plus');
                         return (
                          <div key={t.id} className="p-10 flex items-center gap-10 bg-rose-50/20 dark:bg-rose-900/10">
                            <div className="p-6 rounded-[2rem] bg-rose-100 dark:bg-rose-900/30 text-rose-400 opacity-40"><Icon size={32} strokeWidth={2.5} /></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-slate-900 dark:text-slate-100 text-2xl truncate tracking-tight line-through opacity-20">{t.note || t.category}</p>
                              <StatusBadge status={t.status} />
                            </div>
                            <div className="text-right">
                               <p className="text-3xl font-black text-slate-200 dark:text-slate-800 tracking-tighter line-through">{CURRENCY}{t.amount.toLocaleString()}</p>
                               <p className="text-[10px] font-black uppercase text-rose-300 dark:text-rose-800 tracking-widest mt-1">operator: {t.createdBy}</p>
                            </div>
                          </div>
                         );
                       })}
                    </div>
                 </div>
              </div>
            )}
            {currentView === 'users' && state.currentUser?.role === UserRole.ADMIN && (
              <UsersView state={state} setState={setState} editingUser={editingUser} setEditingUser={setEditingUser} handleSaveUser={handleSaveUser} handleFileUpload={handleFileUpload} logoInputRef={logoInputRef} logActivity={logActivity} />
            )}
            {currentView === 'insights' && <InsightsView aiTips={aiTips} isLoadingTips={isLoadingTips} setCurrentView={setCurrentView} darkMode={state.darkMode} />}
            {currentView === 'profile' && <ProfileView state={state} handleFileUpload={handleFileUpload} handleLogout={handleLogout} profilePicInputRef={profilePicInputRef} toggleDarkMode={toggleDarkMode} />}
          </>
        )}
      </main>
      {state.currentUser && (
        <>
          <button onClick={() => { setEditingTransaction(null); setIsAdding(true); }} className="fixed bottom-32 right-10 md:bottom-14 md:right-14 w-24 h-24 bg-slate-900 dark:bg-indigo-600 text-white rounded-[2.5rem] shadow-2xl flex items-center justify-center hover:scale-110 hover:-rotate-12 active:scale-90 transition-all z-40"><Plus size={48} /></button>
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 flex justify-around items-center h-28 px-8 z-50">
            <NavBtn icon={LayoutDashboard} active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} darkMode={state.darkMode} />
            <NavBtn icon={History} active={currentView === 'transactions'} onClick={() => setCurrentView('transactions')} darkMode={state.darkMode} />
            <NavBtn icon={ClipboardList} active={currentView === 'requisitions'} onClick={() => setCurrentView('requisitions')} darkMode={state.darkMode} />
            <NavBtn icon={BrainCircuit} active={currentView === 'insights'} onClick={() => setCurrentView('insights')} darkMode={state.darkMode} />
            <NavBtn icon={UserIcon} active={currentView === 'profile'} onClick={() => setCurrentView('profile')} darkMode={state.darkMode} />
          </nav>
        </>
      )}
      {isAdding && <AddModal role={state.currentUser?.role || UserRole.EMPLOYEE} initialData={editingTransaction} onClose={() => { setIsAdding(false); setEditingTransaction(null); }} onSubmit={handleSaveTransaction} darkMode={state.darkMode} />}
    </div>
  );
};

const UsersView = ({ state, setState, editingUser, setEditingUser, handleSaveUser, handleFileUpload, logoInputRef, logActivity }: any) => {
  const [compName, setCompName] = useState(state.companyName || '');
  const [sheetUrl, setSheetUrl] = useState(state.sheetUrl || '');
  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-slide-in font-outfit">
      <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-xl">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-10 flex items-center gap-3"><Settings size={28} className="text-indigo-600 dark:text-indigo-400" /> Branding settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
             <div className="space-y-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Enterprise name</label>
                   <div className="flex gap-4">
                      <input type="text" value={compName} onChange={(e) => setCompName(e.target.value)} className="flex-1 px-8 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 dark:text-white" placeholder="Business Alias" />
                      <button onClick={() => { setState((p: any) => ({ ...p, companyName: compName })); logActivity('Branding Update', `Company name changed to ${compName}`, 'system'); }} className="px-6 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 dark:shadow-none">Commit</button>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Enterprise logo</label>
                   <input type="file" ref={logoInputRef} className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'logo')} />
                   <div className="flex items-center gap-6">
                      <button onClick={() => logoInputRef.current?.click()} className="flex items-center gap-3 px-8 py-5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all border border-indigo-100 dark:border-indigo-900/50"><Camera size={20} /> Upload PNG/JPEG</button>
                      {state.companyLogo && <div className="w-20 h-20 rounded-[1.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-inner"><img src={state.companyLogo} className="w-full h-full object-cover" /></div>}
                   </div>
                </div>
             </div>
             <div className="bg-slate-50 dark:bg-slate-800 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center space-y-4 border border-slate-100 dark:border-slate-700">
                <div className="w-36 h-36 bg-white dark:bg-slate-900 rounded-[2rem] flex items-center justify-center shadow-2xl overflow-hidden border-8 border-white dark:border-slate-900">
                   {state.companyLogo ? <img src={state.companyLogo} className="w-full h-full object-cover" /> : <Building2 size={64} className="text-slate-200 dark:text-slate-700" />}
                </div>
                <div>
                   <p className="font-black text-slate-900 dark:text-white text-2xl tracking-tight">{state.companyName || 'Undefined'}</p>
                   <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-2">Brand Identity Vector</p>
                </div>
             </div>
          </div>
          <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800">
             <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3"><Cloud size={28} className="text-indigo-600 dark:text-indigo-400" /> Cloud Sync Integration</h2>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Google Apps Script Web App URL</label>
                <div className="flex gap-4">
                   <input type="text" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} className="flex-1 px-8 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 dark:text-white" placeholder="https://script.google.com/macros/s/.../exec" />
                   <button onClick={() => { setState((p: any) => ({ ...p, sheetUrl: sheetUrl })); logActivity('System Config', 'Google Sheet URL updated', 'system'); }} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none">Link Sheets</button>
                </div>
             </div>
          </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl dark:shadow-none h-fit sticky top-10">
           <h3 className="text-xl font-black mb-10 flex items-center gap-4 dark:text-white">{editingUser ? <Edit size={28} className="text-amber-500" /> : <UserPlus size={28} className="text-indigo-600" />}{editingUser ? 'Update Node' : 'Provision agent'}</h3>
           <form onSubmit={handleSaveUser} className="space-y-6">
              <input name="username" type="text" required defaultValue={editingUser?.username} className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 dark:text-white" placeholder="Identity UID" />
              <input name="password" type="text" required defaultValue={editingUser?.password} className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 dark:text-white" placeholder="Access key" />
              <select name="role" required defaultValue={editingUser?.role} className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none font-bold appearance-none cursor-pointer focus:ring-4 focus:ring-indigo-500/10 dark:text-white">{Object.values(UserRole).map(role => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select>
              <button type="submit" className="w-full py-6 bg-slate-900 dark:bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-2xl shadow-slate-200 dark:shadow-none hover:scale-[1.02] transition-all mt-4">{editingUser ? 'Commit Update' : 'Initialize Agent'}</button>
           </form>
        </div>
        <div className="lg:col-span-8 space-y-6">
           {state.users.map((u: any) => (
             <div key={u.id} className="bg-white dark:bg-slate-900 p-10 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-none flex items-center justify-between group">
                <div className="flex items-center gap-8">
                   <div className="w-24 h-24 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center font-black text-slate-300 dark:text-slate-600 text-4xl overflow-hidden shadow-inner transition-transform group-hover:scale-105">{u.profilePic ? <img src={u.profilePic} className="w-full h-full object-cover" /> : u.username.charAt(0).toUpperCase()}</div>
                   <div>
                      <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{u.username}</p>
                      <div className="flex items-center gap-4 mt-2"><span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-4 py-1.5 rounded-full">{u.role} identity</span></div>
                   </div>
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setEditingUser(u)} className="p-5 text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-[1.5rem] transition-all"><Edit size={28} /></button>
                   {u.role !== UserRole.ADMIN && <button onClick={() => { if(confirm('Purge user node?')) { setState((prev: any) => ({ ...prev, users: prev.users.filter((usr: any) => usr.id !== u.id) })); logActivity('User Purge', `Agent node purged: ${u.username}`, 'user'); } }} className="p-5 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-[1.5rem] transition-all"><Trash2 size={28} /></button>}
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

const ProfileView = ({ state, handleFileUpload, handleLogout, profilePicInputRef, toggleDarkMode }: any) => (
  <div className="max-w-2xl mx-auto space-y-12 animate-slide-in font-outfit">
    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight text-center">Identity Configuration</h2>
    <div className="bg-white dark:bg-slate-900 p-16 rounded-[4.5rem] border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-none flex flex-col items-center relative overflow-hidden">
       <div className="relative group cursor-pointer" onClick={() => profilePicInputRef.current?.click()}>
          <div className="w-64 h-64 bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-[4rem] flex items-center justify-center mb-12 shadow-inner overflow-hidden border-[12px] border-white dark:border-slate-900 group-hover:opacity-90 transition-all">{state.currentUser?.profilePic ? <img src={state.currentUser.profilePic} className="w-full h-full object-cover" /> : <UserIcon size={120} />}</div>
          <div className="absolute bottom-16 right-4 w-16 h-16 bg-slate-900 dark:bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl border-8 border-white dark:border-slate-900 transition-transform group-hover:scale-110"><Camera size={28} /></div>
          <input type="file" ref={profilePicInputRef} className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'profilePic')} />
       </div>
       <h3 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">{state.currentUser?.username}</h3>
       <span className="mt-6 px-10 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-[0.3em]">{state.currentUser?.role.replace('_', ' ')} NODE</span>
       
       <div className="w-full mt-16 pt-12 border-t border-slate-50 dark:border-slate-800 space-y-8">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem]">
             <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${state.darkMode ? 'bg-indigo-600 text-white' : 'bg-amber-100 text-amber-600'}`}>
                   {state.darkMode ? <Moon size={24} /> : <Sun size={24} />}
                </div>
                <div>
                   <p className="font-black text-slate-900 dark:text-white">Dark Interface</p>
                   <p className="text-xs text-slate-500 dark:text-slate-400">Optimize node visualization for low-light</p>
                </div>
             </div>
             <button 
               onClick={toggleDarkMode}
               className={`w-16 h-8 rounded-full transition-all relative ${state.darkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
             >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${state.darkMode ? 'left-9' : 'left-1'}`}></div>
             </button>
          </div>

          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-6 py-8 text-rose-600 bg-rose-50 dark:bg-rose-900/10 rounded-[2.5rem] font-black text-2xl hover:bg-rose-100 dark:hover:bg-rose-900/20 hover:scale-[1.02] transition-all shadow-xl shadow-rose-100/30 dark:shadow-none"><LogOut size={36} /> Terminate Session</button>
       </div>
    </div>
  </div>
);

const InsightsView = ({ aiTips, isLoadingTips, setCurrentView, darkMode }: any) => (
  <div className="space-y-12 animate-slide-in font-outfit">
    <div className="flex items-center gap-8"><div className="p-8 bg-indigo-600 text-white rounded-[2.5rem] shadow-2xl shadow-indigo-100 dark:shadow-none"><BrainCircuit size={56} /></div><div><h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">Neural Finance Analysis</h2></div></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
       <div className="bg-white dark:bg-slate-900 p-16 rounded-[4.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-2xl dark:hover:shadow-none transition-all duration-700">
          <p className="text-3xl font-black text-slate-900 dark:text-white leading-tight">{isLoadingTips ? "Decoding node patterns..." : (aiTips[0]?.tip || "Provide more validated transaction data to initialize the neural optimization model.")}</p>
       </div>
       <div className="bg-slate-900 dark:bg-indigo-950 p-16 rounded-[4.5rem] text-white shadow-2xl dark:shadow-none relative overflow-hidden group"><h4 className="text-[11px] font-black text-indigo-300 dark:text-indigo-400 uppercase tracking-[0.4em] mb-10">Liquidity Prediction</h4><p className="text-3xl font-black leading-tight text-white">Node integrity remains optimal. No critical fractures detected.</p><div className="absolute bottom-[-80px] right-[-80px] opacity-[0.05] group-hover:opacity-[0.08] transition-opacity"><TrendingUp size={350} /></div></div>
    </div>
  </div>
);

const NavBtn = ({ icon: Icon, active, onClick, label, darkMode }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-3 group relative">
    <div className={`p-6 rounded-[2rem] transition-all duration-500 ${active ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl scale-110 rotate-0' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Icon size={34} strokeWidth={2.5} /></div>
    {label && <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${active ? 'text-slate-900 dark:text-white opacity-100' : 'text-slate-300 dark:text-slate-700 group-hover:text-slate-500 dark:group-hover:text-slate-400 opacity-0 group-hover:opacity-100'} transition-all`}>{label}</span>}
  </button>
);

const AddModal = ({ role, initialData, onClose, onSubmit, darkMode }: { role: UserRole, initialData: Transaction | null, onClose: () => void, onSubmit: (t: any) => void, darkMode?: boolean }) => {
  const [type, setType] = useState<TransactionType>(initialData?.type || TransactionType.EXPENSE);
  const [category, setCategory] = useState(initialData?.category || '');
  const availableCategories = useMemo(() => {
    const isSpecialRole = role === UserRole.ADMIN || role === UserRole.MANAGER;
    if (type === TransactionType.INCOME) return INCOME_CATEGORIES;
    let cats = [...DEFAULT_CATEGORIES];
    if (isSpecialRole) cats = [...cats, ...ADMIN_ONLY_CATEGORIES];
    if (role === UserRole.EMPLOYEE) return cats.filter(c => c.name === 'Conveyance' || c.name === 'Requisition');
    return cats;
  }, [type, role]);
  useEffect(() => {
    if (!initialData && availableCategories.length > 0) setCategory(availableCategories[0].name);
  }, [availableCategories, initialData]);
  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-10 z-[100] animate-in fade-in duration-500 font-outfit">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[4.5rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-in border border-white/20 dark:border-slate-800">
        <div className="p-16">
          <div className="flex items-center justify-between mb-12"><div><h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{initialData ? 'Edit Node' : 'Ledger Node Submission'}</h3></div><button onClick={onClose} className="p-4 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-white"><X size={44} /></button></div>
          <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); onSubmit({ amount: Number(formData.get('amount')), type: type, category: formData.get('category'), subCategory: formData.get('subCategory') || undefined, source: formData.get('source') as PaymentSource, date: formData.get('date'), note: formData.get('note') }); }} className="space-y-10">
            {role !== UserRole.EMPLOYEE && (<div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800 p-3 rounded-[2.5rem] border border-slate-100 dark:border-slate-700"><button type="button" onClick={() => setType(TransactionType.EXPENSE)} className={`py-5 rounded-[2rem] font-black text-xs transition-all tracking-[0.2em] ${type === TransactionType.EXPENSE ? 'bg-white dark:bg-slate-700 shadow-2xl text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>OUTFLOW</button><button type="button" onClick={() => setType(TransactionType.INCOME)} className={`py-5 rounded-[2rem] font-black text-xs transition-all tracking-[0.2em] ${type === TransactionType.INCOME ? 'bg-white dark:bg-slate-700 shadow-2xl text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>REVENUE</button></div>)}
            <div className="relative group"><span className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700 font-black text-7xl group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors tracking-tighter">{CURRENCY}</span><input name="amount" type="number" step="0.01" required autoFocus defaultValue={initialData?.amount} className="w-full pl-36 pr-12 py-12 bg-slate-50 dark:bg-slate-800 border-none rounded-[3rem] text-8xl font-black outline-none ring-[12px] ring-transparent focus:ring-indigo-500/5 transition-all placeholder:text-slate-100 dark:placeholder:text-slate-700 tracking-tighter dark:text-white" placeholder="0.00" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Node Asset Cat</label><select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-10 py-6 bg-slate-50 dark:bg-slate-800 rounded-[2.25rem] outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer border-none appearance-none dark:text-white">{availableCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</select></div>
              <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Settlement Asset</label><select name="source" defaultValue={initialData?.source} className="w-full px-10 py-6 bg-slate-50 dark:bg-slate-800 rounded-[2.25rem] outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer border-none appearance-none dark:text-white">{PAYMENT_SOURCES.map(src => <option key={src} value={src}>{src}</option>)}</select></div>
            </div>
            {(category === 'Conveyance' || ['Family', 'Marjan', 'Admin Own'].includes(category)) && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-4"><label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Node Classification (Sub-Cat)</label><select name="subCategory" defaultValue={initialData?.subCategory} className="w-full px-10 py-6 bg-slate-50 dark:bg-slate-800 rounded-[2.25rem] outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer border-none appearance-none dark:text-white">{category === 'Conveyance' ? CONVEYANCE_SUB_CATEGORIES.map(sub => <option key={sub} value={sub}>{sub}</option>) : ADMIN_ASSET_SUB_CATEGORIES.map(sub => <option key={sub} value={sub}>{sub}</option>)}</select></div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Audit Timestamp</label><input name="date" type="date" defaultValue={initialData?.date || new Date().toISOString().split('T')[0]} required className="w-full px-10 py-6 bg-slate-50 dark:bg-slate-800 rounded-[2.25rem] outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all border-none dark:text-white" /></div>
              <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Trace metadata (Note)</label><input name="note" type="text" defaultValue={initialData?.note} className="w-full px-10 py-6 bg-slate-50 dark:bg-slate-800 rounded-[2.25rem] outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all border-none dark:text-white" placeholder="Contextual audit info..." /></div>
            </div>
            <button type="submit" className={`w-full py-8 rounded-[3rem] font-black text-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-all active:scale-95 ${type === TransactionType.INCOME ? 'bg-emerald-500 shadow-emerald-100 dark:shadow-none' : 'bg-rose-500 shadow-rose-100 dark:shadow-none'} text-white mt-8 tracking-tighter`}>{initialData ? 'COMMIT MODIFICATION' : 'VALIDATE & COMMIT NODE'}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;
