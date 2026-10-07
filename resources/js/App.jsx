import React, { useState, useEffect } from 'react';
import { 
    Server, 
    ShieldAlert, 
    FileText, 
    HardDrive, 
    Clock, 
    Activity, 
    ShieldCheck, 
    RefreshCw, 
    ExternalLink,
    Zap,
    Lock,
    Link as LinkIcon
} from 'lucide-react';
import SystemsManagement from './components/SystemsManagement';
import LinksManagement from './components/LinksManagement';
import QuarantineAndExpiredManagement from './components/QuarantineAndExpiredManagement';
import { fetchJson, formatBytes } from './api';


export default function App() {
    const [activeTab, setActiveTab] = useState('systems'); // 'systems', 'quarantine'
    const [stats, setStats] = useState({
        total_systems: 0,
        active_systems: 0,
        quarantined_files: 0,
        expired_files: 0,
        total_storage_bytes: 0,
        clean_files_count: 0,
    });
    const [loadingStats, setLoadingStats] = useState(true);

    const loadStats = async () => {
        try {
            setLoadingStats(true);
            const data = await fetchJson('/api/management/stats');
            setStats(data);
        } catch (err) {
            console.error('Failed to load stats:', err);
        } finally {
            setLoadingStats(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <HardDrive className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold tracking-tight text-white text-base">COSS</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">v1.2</span>
                            </div>
                            <span className="text-[11px] text-slate-400 block -mt-0.5">Centralized Object Storage & Security Service</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>ClamAV Engine: Ready</span>
                        </div>
                        <button
                            onClick={loadStats}
                            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition"
                            title="Refresh statistics"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
                {/* Metrics Cards Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Systems Card */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Connected Systems</span>
                            <Server className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">{stats.total_systems}</span>
                            <span className="text-xs text-emerald-400">({stats.active_systems} active)</span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                            Hospital departmental client applications
                        </div>
                    </div>

                    {/* Quarantined Threats */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Quarantined Files</span>
                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className={`text-2xl font-bold ${stats.quarantined_files > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                                {stats.quarantined_files}
                            </span>
                            <span className="text-xs text-slate-400">threats</span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                            Infected or flagged by antivirus
                        </div>
                    </div>

                    {/* Expired Files */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Expired / Soft Deleted</span>
                            <Clock className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-200">{stats.expired_files}</span>
                            <span className="text-xs text-orange-400">awaiting purge</span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                            Passed retention window
                        </div>
                    </div>

                    {/* Storage Volume */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Total File Storage</span>
                            <HardDrive className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-200">
                                {formatBytes(stats.total_storage_bytes)}
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{stats.clean_files_count} clean files in NAS/storage</span>
                        </div>
                    </div>
                </div>

                {/* Primary Tabs Navigation */}
                <div className="border-b border-slate-800 flex items-center gap-6">
                    <button
                        onClick={() => setActiveTab('systems')}
                        className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                            activeTab === 'systems'
                                ? 'border-cyan-500 text-cyan-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Server className="w-4 h-4" />
                        Systems Connected ({stats.total_systems})
                    </button>
                    <button
                        onClick={() => setActiveTab('links')}
                        className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                            activeTab === 'links'
                                ? 'border-cyan-500 text-cyan-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <LinkIcon className="w-4 h-4" />
                        Link Restrictions & Active Links ({stats.active_links_count ?? 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('quarantine')}
                        className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                            activeTab === 'quarantine'
                                ? 'border-rose-500 text-rose-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Quarantined & Expired Files ({stats.quarantined_files + stats.expired_files})
                    </button>
                </div>

                {/* View Switch */}
                {activeTab === 'systems' && (
                    <SystemsManagement onRefreshStats={loadStats} />
                )}
                {activeTab === 'links' && (
                    <LinksManagement onRefreshStats={loadStats} />
                )}
                {activeTab === 'quarantine' && (
                    <QuarantineAndExpiredManagement onRefreshStats={loadStats} />
                )}

            </main>

            {/* Footer */}
            <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div>Zamboanga City Medical Center (ZCMC) • Centralized Object Storage Service (COSS)</div>
                    <div className="flex items-center gap-4 text-[11px]">
                        <span>Zero-Trust API Security</span>
                        <span>•</span>
                        <span>Chunked Resumable Uploads</span>
                        <span>•</span>
                        <span>Scheduled Automated Purging</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
