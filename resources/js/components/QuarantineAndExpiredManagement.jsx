import React, { useState, useEffect } from 'react';
import { 
    AlertTriangle, 
    Clock, 
    Trash2, 
    RotateCcw, 
    ShieldAlert, 
    FileText, 
    Search, 
    RefreshCw, 
    CheckCircle2, 
    Flame,
    Filter,
    HardDrive,
    Info,
    Calendar,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { fetchJson, formatBytes, formatDate } from '../api';

export default function QuarantineAndExpiredManagement({ onRefreshStats }) {
    const [tab, setTab] = useState('all'); // 'all', 'quarantine', 'expired', 'soft_deleted'
    const [filesData, setFilesData] = useState({ data: [], current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [purgingAll, setPurgingAll] = useState(false);
    const [actionLoading, setActionLoading] = useState({});
    const [selectedDetailFile, setSelectedDetailFile] = useState(null);

    const loadFiles = async (targetPage = page) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                tab,
                page: targetPage.toString(),
            });
            if (search) params.append('search', search);

            const res = await fetchJson(`/api/management/files?${params.toString()}`);
            setFilesData(res);
        } catch (err) {
            console.error('Failed to load files:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        loadFiles(1);
    }, [tab, search]);

    const handleRestore = async (file) => {
        if (!confirm(`Restore soft-deleted file "${file.original_filename}" and extend retention?`)) return;

        setActionLoading(prev => ({ ...prev, [file.uuid]: true }));
        try {
            await fetchJson(`/api/management/files/${file.uuid}/restore`, { method: 'POST' });
            loadFiles(page);
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            alert('Restore failed: ' + err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [file.uuid]: false }));
        }
    };

    const handleReleaseQuarantine = async (file) => {
        if (!confirm(`CAUTION: Are you sure you want to release "${file.original_filename}" from quarantine and promote it to NAS storage? Only do this if it is a verified false positive.`)) {
            return;
        }

        setActionLoading(prev => ({ ...prev, [file.uuid]: true }));
        try {
            await fetchJson(`/api/management/files/${file.uuid}/release`, { method: 'POST' });
            loadFiles(page);
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            alert('Release failed: ' + err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [file.uuid]: false }));
        }
    };

    const handlePurgePermanently = async (file) => {
        if (!confirm(`PERMANENT DELETE: Are you sure you want to permanently purge "${file.original_filename}" from physical disk and database? This action cannot be undone.`)) {
            return;
        }

        setActionLoading(prev => ({ ...prev, [file.uuid]: true }));
        try {
            await fetchJson(`/api/management/files/${file.uuid}/purge`, { method: 'DELETE' });
            loadFiles(page);
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            alert('Purge failed: ' + err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [file.uuid]: false }));
        }
    };

    const handlePurgeAllExpired = async () => {
        if (!confirm('Run Automated Purge: Permanently purge ALL files that have expired or reached retention expiration right now?')) {
            return;
        }

        setPurgingAll(true);
        try {
            const res = await fetchJson('/api/management/files/purge-expired', { method: 'POST' });
            alert(res.message);
            loadFiles(1);
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            alert('Purge failed: ' + err.message);
        } finally {
            setPurgingAll(false);
        }
    };

    const getStatusBadge = (file) => {
        const isQuarantined = file.status === 'infected' || file.disk === 'quarantine';
        const isExpired = file.purge_at && new Date(file.purge_at) <= new Date();
        const isDeleted = Boolean(file.deleted_at);

        if (isQuarantined) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/80 text-red-400 border border-red-800">
                    <ShieldAlert className="w-3 h-3" />
                    Quarantined
                </span>
            );
        }

        if (isDeleted) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800">
                    <Trash2 className="w-3 h-3" />
                    Soft Deleted
                </span>
            );
        }

        if (isExpired) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-950/80 text-orange-400 border border-orange-800">
                    <Clock className="w-3 h-3" />
                    Expired Retention
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                {file.status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                        Quarantined & Expired Files Management
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Review infected threat detections, audit retention expiries, restore files, or permanently purge storage.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handlePurgeAllExpired}
                        disabled={purgingAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg shadow-sm transition disabled:opacity-50"
                    >
                        <Flame className={`w-3.5 h-3.5 text-rose-400 ${purgingAll ? 'animate-bounce' : ''}`} />
                        {purgingAll ? 'Purging Overdue...' : 'Purge All Expired'}
                    </button>
                    <button
                        onClick={() => loadFiles(page)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filter Bar & Category Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                {/* Tabs */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setTab('all')}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                            tab === 'all' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        All Flagged
                    </button>
                    <button
                        onClick={() => setTab('quarantine')}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                            tab === 'quarantine' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Quarantined Threats
                    </button>
                    <button
                        onClick={() => setTab('expired')}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                            tab === 'expired' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Expired Files
                    </button>
                    <button
                        onClick={() => setTab('soft_deleted')}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                            tab === 'soft_deleted' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Soft Deleted
                    </button>
                </div>

                {/* Search */}
                <div className="relative sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search file name, UUID, checksum..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                </div>
            </div>

            {/* Files Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">File / System</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Size & Hash</th>
                                <th className="px-4 py-3">Disk Location</th>
                                <th className="px-4 py-3">Retention / Purge</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                                        Loading file records...
                                    </td>
                                </tr>
                            ) : filesData.data.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                                        <p className="text-slate-300 font-medium">No flagged files found</p>
                                        <p className="text-slate-500 text-[11px] mt-0.5">Everything is clean or purged according to current filter.</p>
                                    </td>
                                </tr>
                            ) : (
                                filesData.data.map((file) => {
                                    const isQuarantined = file.status === 'infected' || file.disk === 'quarantine';
                                    const isExpired = file.purge_at && new Date(file.purge_at) <= new Date();
                                    const isTrashed = Boolean(file.deleted_at);

                                    return (
                                        <tr key={file.uuid} className="hover:bg-slate-800/40 transition">
                                            <td className="px-4 py-3">
                                                <div className="flex items-start gap-2.5">
                                                    <FileText className={`w-4 h-4 mt-0.5 ${isQuarantined ? 'text-rose-400' : 'text-slate-400'}`} />
                                                    <div className="space-y-0.5">
                                                        <span className="font-semibold text-slate-200 block truncate max-w-xs" title={file.original_filename}>
                                                            {file.original_filename}
                                                        </span>
                                                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                            <span className="text-cyan-400 font-medium">{file.client_application?.name || 'Unknown Client'}</span>
                                                            <span>•</span>
                                                            <span className="font-mono text-slate-500">{file.uuid.substring(0, 8)}...</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    {getStatusBadge(file)}
                                                    {file.scan_result?.threat && (
                                                        <p className="text-[11px] text-rose-400 font-medium">
                                                            Threat: {file.scan_result.threat}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3 text-slate-300">
                                                <div>{formatBytes(file.size_bytes)}</div>
                                                <div className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]" title={file.sha256_checksum}>
                                                    SHA: {file.sha256_checksum.substring(0, 10)}...
                                                </div>
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                                                    file.disk === 'quarantine' 
                                                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                                        : file.disk === 'nas'
                                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                                        : 'bg-slate-800 text-slate-300'
                                                }`}>
                                                    {file.disk}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3 text-slate-300 text-[11px]">
                                                {file.purge_at ? (
                                                    <div>
                                                        <span className={isExpired ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                                                            {formatDate(file.purge_at)}
                                                        </span>
                                                        <span className="block text-[10px] text-slate-500">
                                                            {isExpired ? 'Overdue for purge' : 'Scheduled purge'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500">—</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* View Detail button */}
                                                    <button
                                                        onClick={() => setSelectedDetailFile(file)}
                                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                                                        title="View File Details"
                                                    >
                                                        Details
                                                    </button>

                                                    {/* Release Quarantine button */}
                                                    {isQuarantined && (
                                                        <button
                                                            onClick={() => handleReleaseQuarantine(file)}
                                                            disabled={actionLoading[file.uuid]}
                                                            className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded text-[11px] font-medium transition disabled:opacity-50"
                                                            title="False Positive: Release to NAS Storage"
                                                        >
                                                            Release
                                                        </button>
                                                    )}

                                                    {/* Restore Trashed button */}
                                                    {isTrashed && (
                                                        <button
                                                            onClick={() => handleRestore(file)}
                                                            disabled={actionLoading[file.uuid]}
                                                            className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-[11px] font-medium transition disabled:opacity-50"
                                                            title="Restore file"
                                                        >
                                                            <RotateCcw className="w-3 h-3 inline mr-1" />
                                                            Restore
                                                        </button>
                                                    )}

                                                    {/* Permanent Purge */}
                                                    <button
                                                        onClick={() => handlePurgePermanently(file)}
                                                        disabled={actionLoading[file.uuid]}
                                                        className="p-1 text-slate-500 hover:text-rose-400 transition disabled:opacity-50"
                                                        title="Purge Permanently"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filesData.last_page > 1 && (
                    <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div>
                            Showing page <span className="font-semibold text-slate-200">{filesData.current_page}</span> of{' '}
                            <span className="font-semibold text-slate-200">{filesData.last_page}</span> ({filesData.total} items)
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={filesData.current_page <= 1}
                                onClick={() => {
                                    const p = filesData.current_page - 1;
                                    setPage(p);
                                    loadFiles(p);
                                }}
                                className="p-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-40 transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={filesData.current_page >= filesData.last_page}
                                onClick={() => {
                                    const p = filesData.current_page + 1;
                                    setPage(p);
                                    loadFiles(p);
                                }}
                                className="p-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-40 transition"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: File Details */}
            {selectedDetailFile && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Info className="w-4 h-4 text-cyan-400" />
                                File Security & Storage Details
                            </h3>
                            <button
                                onClick={() => setSelectedDetailFile(null)}
                                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3 bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-slate-500 block uppercase text-[10px]">Original Filename</span>
                                    <span className="font-semibold text-slate-200">{selectedDetailFile.original_filename}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block uppercase text-[10px]">System Owner</span>
                                    <span className="font-semibold text-cyan-400">{selectedDetailFile.client_application?.name}</span>
                                </div>
                            </div>

                            <div>
                                <span className="text-slate-500 block uppercase text-[10px]">UUID</span>
                                <code className="text-slate-300 font-mono text-[11px]">{selectedDetailFile.uuid}</code>
                            </div>

                            <div>
                                <span className="text-slate-500 block uppercase text-[10px]">SHA-256 Checksum</span>
                                <code className="text-slate-300 font-mono text-[11px] break-all">{selectedDetailFile.sha256_checksum}</code>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                                <div>
                                    <span className="text-slate-500 block uppercase text-[10px]">Disk</span>
                                    <span className="text-slate-300 uppercase font-mono">{selectedDetailFile.disk}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block uppercase text-[10px]">Status</span>
                                    <span className="text-slate-300">{selectedDetailFile.status}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block uppercase text-[10px]">Size</span>
                                    <span className="text-slate-300">{formatBytes(selectedDetailFile.size_bytes)}</span>
                                </div>
                            </div>

                            {selectedDetailFile.scan_result && (
                                <div className="mt-2 pt-2 border-t border-slate-800/80">
                                    <span className="text-slate-500 block uppercase text-[10px] mb-1">Scan Engine Diagnostic</span>
                                    <pre className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                                        {JSON.stringify(selectedDetailFile.scan_result, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setSelectedDetailFile(null)}
                                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
