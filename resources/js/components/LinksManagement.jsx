import React, { useState, useEffect } from 'react';
import {
    Link as LinkIcon,
    Clock,
    Lock,
    ShieldCheck,
    AlertTriangle,
    RefreshCw,
    Search,
    Copy,
    Check,
    ExternalLink,
    Slash,
    Trash2,
    Plus,
    FileText,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Key,
    ShieldAlert,
    Network,
    Edit2,
    Server,
    Layers,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { fetchJson, formatBytes, formatDate } from '../api';


export default function LinksManagement({ onRefreshStats }) {
    const [linksData, setLinksData] = useState({ data: [], current_page: 1, last_page: 1, total: 0 });
    const [systems, setSystems] = useState([]);
    const [systemFilter, setSystemFilter] = useState('all'); // 'all', 'direct', or system_id
    const [groupBySystem, setGroupBySystem] = useState(true);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'expired', 'revoked'
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [copiedToken, setCopiedToken] = useState(null);
    const [actionLoading, setActionLoading] = useState({});
    const [purgingExpired, setPurgingExpired] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Create Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        file_uuid: '',
        expires_in_minutes: 60,
        no_expiry: false,
        max_downloads: '',
        allowed_ips: '',
        password: '',
    });
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createdLinkResult, setCreatedLinkResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    // Edit Restrictions Modal state
    const [editingLink, setEditingLink] = useState(null);
    const [editFormData, setEditFormData] = useState({
        expires_at: '',
        no_expiry: false,
        max_downloads: '',
        allowed_ips: '',
        password: '',
        clear_password: false,
    });
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editErrorMessage, setEditErrorMessage] = useState('');
    const [updatedLinkResult, setUpdatedLinkResult] = useState(null);

    const loadSystemsList = async () => {
        try {
            const data = await fetchJson('/api/management/systems');
            setSystems(data.systems || []);
        } catch (err) {
            console.error('Failed to load systems for filter:', err);
        }
    };

    useEffect(() => {
        loadSystemsList();
    }, []);

    const [expandedSystems, setExpandedSystems] = useState({});

    const toggleSystemCollapse = (systemKey) => {
        setExpandedSystems(prev => ({
            ...prev,
            [systemKey]: !prev[systemKey]
        }));
    };

    const openEditModal = (link) => {
        setEditingLink(link);
        setEditErrorMessage('');
        setUpdatedLinkResult(null);
        
        let localExpires = '';
        if (link.expires_at) {
            try {
                const d = new Date(link.expires_at);
                const tzOffset = d.getTimezoneOffset() * 60000;
                localExpires = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
            } catch (e) {
                localExpires = '';
            }
        }

        setEditFormData({
            expires_at: localExpires,
            no_expiry: !link.expires_at,
            max_downloads: link.max_downloads !== null ? link.max_downloads.toString() : '',
            allowed_ips: link.allowed_ips && link.allowed_ips.length ? link.allowed_ips.join(', ') : '',
            password: '',
            clear_password: false,
        });
    };

    const handleUpdateLink = async (e) => {
        e.preventDefault();
        if (!editingLink) return;
        setEditSubmitting(true);
        setEditErrorMessage('');

        try {
            const ips = editFormData.allowed_ips.trim()
                ? editFormData.allowed_ips.split(',').map(s => s.trim()).filter(Boolean)
                : null;

            const payload = {
                expires_at: (!editFormData.no_expiry && editFormData.expires_at) ? new Date(editFormData.expires_at).toISOString() : null,
                clear_expires_at: editFormData.no_expiry,
                max_downloads: editFormData.max_downloads !== '' ? parseInt(editFormData.max_downloads, 10) : null,
                clear_max_downloads: editFormData.max_downloads === '',
                allowed_ips: ips,
                clear_allowed_ips: ips === null,
            };

            if (editFormData.clear_password) {
                payload.clear_password = true;
            } else if (editFormData.password.trim()) {
                payload.password = editFormData.password.trim();
            }

            const res = await fetchJson(`/api/management/links/${editingLink.token}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });

            setEditingLink(null);
            setToastMessage('Link restrictions and expiration updated successfully.');
            setTimeout(() => setToastMessage(''), 4000);
            loadLinks(page);
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            setEditErrorMessage(err.message || 'Failed to update restrictions');
        } finally {
            setEditSubmitting(false);
        }
    };


    const loadLinks = async (targetPage = page) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                status: statusFilter,
                page: targetPage.toString(),
            });
            if (systemFilter && systemFilter !== 'all') {
                params.append('system_id', systemFilter);
            }
            if (search) params.append('search', search);

            const res = await fetchJson(`/api/management/links?${params.toString()}`);
            setLinksData(res);
        } catch (err) {
            console.error('Failed to load links:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        loadLinks(1);
    }, [statusFilter, systemFilter, search]);

    const handleCopy = (text, token) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 2000);
    };

    const handleToggleRevoke = async (link) => {
        const action = link.is_revoked ? 'Re-activate' : 'Revoke';
        if (!confirm(`Are you sure you want to ${action} download link for "${link.file_record?.original_filename || link.token}"?`)) {
            return;
        }

        setActionLoading(prev => ({ ...prev, [link.token]: true }));
        try {
            await fetchJson(`/api/management/links/${link.token}/revoke-toggle`, { method: 'POST' });
            loadLinks(page);
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            alert('Revocation update failed: ' + err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [link.token]: false }));
        }
    };

    const handlePurgeExpiredLinks = async () => {
        if (!confirm('Purge all expired and revoked download links from the database?')) {
            return;
        }

        setPurgingExpired(true);
        try {
            const res = await fetchJson('/api/management/links/purge-expired', { method: 'POST' });
            alert(res.message);
            loadLinks(1);
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            alert('Purge failed: ' + err.message);
        } finally {
            setPurgingExpired(false);
        }
    };

    const handleCreateLink = async (e) => {
        e.preventDefault();
        setCreateSubmitting(true);
        setErrorMessage('');

        try {
            const allowedIps = createFormData.allowed_ips
                ? createFormData.allowed_ips.split(',').map(s => s.trim()).filter(Boolean)
                : null;

            const payload = {
                file_uuid: createFormData.file_uuid.trim(),
                expires_in_minutes: createFormData.no_expiry ? 0 : parseInt(createFormData.expires_in_minutes, 10),
                max_downloads: createFormData.max_downloads ? parseInt(createFormData.max_downloads, 10) : null,
                allowed_ips: allowedIps,
                password: createFormData.password || null,
            };

            const res = await fetchJson('/api/management/links', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            setCreatedLinkResult(res.link);
            setCreateFormData({
                file_uuid: '',
                expires_in_minutes: 60,
                no_expiry: false,
                max_downloads: '',
                allowed_ips: '',
                password: '',
            });
            loadLinks(1);
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            setErrorMessage(err.message || 'Failed to create link');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const getLinkStatusBadge = (link) => {
        if (link.is_revoked) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">
                    <Slash className="w-3 h-3" />
                    Revoked
                </span>
            );
        }

        if (link.is_expired) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-950/80 text-orange-400 border border-orange-800">
                    <Clock className="w-3 h-3" />
                    Expired
                </span>
            );
        }

        if (link.max_downloads && link.download_count >= link.max_downloads) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800">
                    <AlertTriangle className="w-3 h-3" />
                    Limit Reached
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                <Check className="w-3 h-3" />
                Active
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-medium">{toastMessage}</span>
                    </div>
                    <button
                        onClick={() => setToastMessage('')}
                        className="text-emerald-400 hover:text-white font-mono text-sm ml-2"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Header / Actions toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by token, filename, system..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-1.5 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
                        />
                    </div>

                    {/* System Filter Dropdown */}
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
                        <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <select
                            value={systemFilter}
                            onChange={(e) => setSystemFilter(e.target.value)}
                            className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer pr-1"
                        >
                            <option value="all" className="bg-slate-900 text-slate-200">All Systems</option>
                            <option value="direct" className="bg-slate-900 text-slate-200">Dashboard / Direct Uploads</option>
                            {systems.map((sys) => (
                                <option key={sys.id} value={sys.id.toString()} className="bg-slate-900 text-slate-200">
                                    {sys.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                        {[
                            { id: 'all', label: 'All Links' },
                            { id: 'active', label: 'Active' },
                            { id: 'expired', label: 'Expired' },
                            { id: 'revoked', label: 'Revoked' },
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setStatusFilter(btn.id)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                                    statusFilter === btn.id
                                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Segregate by System toggle button */}
                    <button
                        onClick={() => setGroupBySystem(!groupBySystem)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                            groupBySystem
                                ? 'bg-indigo-950/70 border-indigo-700 text-indigo-300 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Toggle grouping and segregating file links by client system"
                    >
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Segregated by System</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${groupBySystem ? 'bg-indigo-400' : 'bg-slate-600'}`}></span>
                    </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={handlePurgeExpiredLinks}
                        disabled={purgingExpired}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-medium transition"
                    >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                        {purgingExpired ? 'Purging...' : 'Purge Expired Links'}
                    </button>

                    <button
                        onClick={() => {
                            setErrorMessage('');
                            setCreatedLinkResult(null);
                            setShowCreateModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                        <Plus className="w-4 h-4" />
                        Create Restricted Link
                    </button>

                    <button
                        onClick={() => loadLinks(page)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-lg transition"
                        title="Reload"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Links Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800/80 bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-4">File & System</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4">Restrictions</th>
                                <th className="py-3 px-4">Usage / Limits</th>
                                <th className="py-3 px-4">Expires</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
                                            <span>Loading link restrictions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : linksData.data.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <LinkIcon className="w-6 h-6 text-slate-600" />
                                            <p className="font-medium text-slate-400">No download links found</p>
                                            <p className="text-[11px]">
                                                {search || statusFilter !== 'all' || systemFilter !== 'all'
                                                    ? 'Try adjusting your search query, status, or system filter.'
                                                    : 'Create a restricted link using the button above or request via API.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : groupBySystem ? (
                                (() => {
                                    // Group links by client system
                                    const grouped = linksData.data.reduce((acc, link) => {
                                        const sysKey = link.client_application?.id ? String(link.client_application.id) : 'dashboard';
                                        const sysName = link.client_application?.name || 'Dashboard / Direct Uploads';
                                        if (!acc[sysKey]) {
                                            acc[sysKey] = {
                                                key: sysKey,
                                                name: sysName,
                                                system: link.client_application,
                                                links: [],
                                            };
                                        }
                                        acc[sysKey].links.push(link);
                                        return acc;
                                    }, {});

                                    const groups = Object.values(grouped);

                                    return groups.map((group) => {
                                        const isExpanded = Boolean(expandedSystems[group.key]);
                                        const activeCount = group.links.filter(l => !l.is_revoked && !l.is_expired).length;

                                        return (
                                            <React.Fragment key={group.key}>
                                                {/* System Group Header Row */}
                                                <tr className="bg-slate-950/90 border-t border-b border-cyan-900/40 select-none">
                                                    <td colSpan="6" className="py-2.5 px-4">
                                                        <div 
                                                            className="flex items-center justify-between cursor-pointer group"
                                                            onClick={() => toggleSystemCollapse(group.key)}
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                <button
                                                                    type="button"
                                                                    className="p-1 rounded bg-slate-900 text-slate-400 group-hover:text-cyan-300 border border-slate-800 transition"
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                                    ) : (
                                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                                    )}
                                                                </button>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-1.5 rounded-md bg-cyan-950/80 border border-cyan-800/80 text-cyan-400">
                                                                        <Server className="w-3.5 h-3.5" />
                                                                    </div>
                                                                    <span className="font-bold text-sm text-slate-100 tracking-wide group-hover:text-cyan-300 transition">
                                                                        {group.name}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 ml-2">
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-800">
                                                                        {group.links.length} {group.links.length === 1 ? 'file' : 'files'}
                                                                    </span>
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                                                                        {activeCount} active
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="text-[11px] text-slate-500 group-hover:text-slate-400 transition">
                                                                {isExpanded ? 'Click to collapse' : 'Click to expand'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Group links rows */}
                                                {isExpanded && group.links.map((link) => (
                                                    <tr key={link.id} className="hover:bg-slate-800/30 transition border-b border-slate-800/40">
                                                        {/* File & System */}
                                                        <td className="py-3.5 px-4 pl-8">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400">
                                                                    <FileText className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                                                        <span>{link.file_record?.original_filename || 'Unknown File'}</span>
                                                                        {link.file_record?.size_bytes && (
                                                                            <span className="text-[10px] text-slate-500 font-mono">
                                                                                ({formatBytes(link.file_record.size_bytes)})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                                                        <span>System: <strong className="text-cyan-400 font-medium">{link.client_application?.name || 'Dashboard'}</strong></span>
                                                                        <span>•</span>
                                                                        <span className="font-mono text-[10px] text-slate-600">Token: {link.token.slice(0, 8)}...</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Status */}
                                                        <td className="py-3.5 px-4">
                                                            {getLinkStatusBadge(link)}
                                                        </td>

                                                        {/* Restrictions */}
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex flex-col gap-1 text-[11px]">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Lock className={`w-3.5 h-3.5 ${link.has_password ? 'text-amber-400' : 'text-slate-600'}`} />
                                                                    <span>{link.has_password ? <span className="text-amber-300 font-medium">Password Protected</span> : <span className="text-slate-500">No Password</span>}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Network className={`w-3.5 h-3.5 ${link.allowed_ips?.length ? 'text-cyan-400' : 'text-slate-600'}`} />
                                                                    <span>
                                                                        {link.allowed_ips?.length ? (
                                                                            <span className="text-cyan-300 font-mono text-[10px]" title={link.allowed_ips.join(', ')}>
                                                                                IP Restricted ({link.allowed_ips.length})
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-slate-500">Any IP</span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Usage / Limits */}
                                                        <td className="py-3.5 px-4 font-mono text-xs">
                                                            <div>
                                                                <span className="text-white font-semibold">{link.download_count}</span>
                                                                <span className="text-slate-500">
                                                                    {link.max_downloads ? ` / ${link.max_downloads} max` : ' downloads (unlimited)'}
                                                                </span>
                                                            </div>
                                                            {link.last_accessed_at && (
                                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                                    Last used: {formatDate(link.last_accessed_at)}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Expires */}
                                                        <td className="py-3.5 px-4 text-[11px]">
                                                            {link.expires_at ? (
                                                                <div className={link.is_expired ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                                                                    {formatDate(link.expires_at)}
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                                                                    No Expiry (Permanent)
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="py-3.5 px-4 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {(link.portal_url || link.download_url) && (
                                                                    <button
                                                                        onClick={() => handleCopy(link.portal_url || link.download_url, link.token)}
                                                                        className="p-1.5 text-slate-400 hover:text-cyan-300 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md transition"
                                                                        title="Copy Short Portal URL (/d/{token})"
                                                                    >
                                                                        {copiedToken === link.token ? (
                                                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                                        ) : (
                                                                            <Copy className="w-3.5 h-3.5" />
                                                                        )}
                                                                    </button>
                                                                )}

                                                                <button
                                                                    onClick={() => openEditModal(link)}
                                                                    className="p-1.5 text-slate-400 hover:text-cyan-400 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md transition"
                                                                    title="Edit Restrictions & Expiration"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>

                                                                <button
                                                                    onClick={() => handleToggleRevoke(link)}
                                                                    disabled={actionLoading[link.token]}
                                                                    className={`px-2.5 py-1 text-xs rounded-md border font-medium transition ${
                                                                        link.is_revoked
                                                                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                                                                            : 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60'
                                                                    }`}
                                                                >
                                                                    {actionLoading[link.token]
                                                                        ? 'Updating...'
                                                                        : link.is_revoked
                                                                        ? 'Re-activate'
                                                                        : 'Revoke'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    });
                                })()
                            ) : (
                                linksData.data.map((link) => (
                                    <tr key={link.id} className="hover:bg-slate-800/30 transition">
                                        {/* File & System */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                                        <span>{link.file_record?.original_filename || 'Unknown File'}</span>
                                                        {link.file_record?.size_bytes && (
                                                             <span className="text-[10px] text-slate-500 font-mono">
                                                                ({formatBytes(link.file_record.size_bytes)})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                                        <span>System: <strong className="text-cyan-400 font-medium">{link.client_application?.name || 'Dashboard'}</strong></span>
                                                        <span>•</span>
                                                        <span className="font-mono text-[10px] text-slate-600">Token: {link.token.slice(0, 8)}...</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="py-3.5 px-4">
                                            {getLinkStatusBadge(link)}
                                        </td>

                                        {/* Restrictions */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex flex-col gap-1 text-[11px]">
                                                <div className="flex items-center gap-1.5">
                                                    <Lock className={`w-3.5 h-3.5 ${link.has_password ? 'text-amber-400' : 'text-slate-600'}`} />
                                                    <span>{link.has_password ? <span className="text-amber-300 font-medium">Password Protected</span> : <span className="text-slate-500">No Password</span>}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Network className={`w-3.5 h-3.5 ${link.allowed_ips?.length ? 'text-cyan-400' : 'text-slate-600'}`} />
                                                    <span>
                                                        {link.allowed_ips?.length ? (
                                                            <span className="text-cyan-300 font-mono text-[10px]" title={link.allowed_ips.join(', ')}>
                                                                IP Restricted ({link.allowed_ips.length})
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500">Any IP</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Usage / Limits */}
                                        <td className="py-3.5 px-4 font-mono text-xs">
                                            <div>
                                                <span className="text-white font-semibold">{link.download_count}</span>
                                                <span className="text-slate-500">
                                                    {link.max_downloads ? ` / ${link.max_downloads} max` : ' downloads (unlimited)'}
                                                </span>
                                            </div>
                                            {link.last_accessed_at && (
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    Last used: {formatDate(link.last_accessed_at)}
                                                </div>
                                            )}
                                        </td>

                                        {/* Expires */}
                                        <td className="py-3.5 px-4 text-[11px]">
                                            {link.expires_at ? (
                                                <div className={link.is_expired ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                                                    {formatDate(link.expires_at)}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                                                    No Expiry (Permanent)
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {(link.portal_url || link.download_url) && (
                                                    <button
                                                        onClick={() => handleCopy(link.portal_url || link.download_url, link.token)}
                                                        className="p-1.5 text-slate-400 hover:text-cyan-300 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md transition"
                                                        title="Copy Short Portal URL (/d/{token})"
                                                    >
                                                        {copiedToken === link.token ? (
                                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => openEditModal(link)}
                                                    className="p-1.5 text-slate-400 hover:text-cyan-400 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-md transition"
                                                    title="Edit Restrictions & Expiration"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>

                                                <button
                                                    onClick={() => handleToggleRevoke(link)}
                                                    disabled={actionLoading[link.token]}
                                                    className={`px-2.5 py-1 text-xs rounded-md border font-medium transition ${
                                                        link.is_revoked
                                                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                                                            : 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60'
                                                    }`}
                                                >
                                                    {actionLoading[link.token]
                                                        ? 'Updating...'
                                                        : link.is_revoked
                                                        ? 'Re-activate'
                                                        : 'Revoke'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {linksData.last_page > 1 && (
                    <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/50">
                        <span>
                            Showing page <strong className="text-white">{linksData.current_page}</strong> of{' '}
                            <strong className="text-white">{linksData.last_page}</strong> ({linksData.total} total links)
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    const next = page - 1;
                                    setPage(next);
                                    loadLinks(next);
                                }}
                                disabled={linksData.current_page <= 1}
                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40 hover:border-slate-700 text-slate-300"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    const next = page + 1;
                                    setPage(next);
                                    loadLinks(next);
                                }}
                                disabled={linksData.current_page >= linksData.last_page}
                                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40 hover:border-slate-700 text-slate-300"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Restricted Link Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                                    <LinkIcon className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-white text-base">Generate Restricted Download Link</h3>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-slate-400 hover:text-white text-lg font-mono"
                            >
                                ×
                            </button>
                        </div>

                        {errorMessage && (
                            <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                                {errorMessage}
                            </div>
                        )}

                        {createdLinkResult ? (
                            <div className="space-y-4">
                                <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                                    <Check className="w-4 h-4 shrink-0" />
                                    <span>Download link created successfully with specified restrictions!</span>
                                </div>

                                <div>
                                    <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1 block">
                                        Short Download Portal URL
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={createdLinkResult.portal_url || createdLinkResult.download_url}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
                                        />
                                        <button
                                            onClick={() => handleCopy(createdLinkResult.portal_url || createdLinkResult.download_url, 'new-link')}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
                                        >
                                            {copiedToken === 'new-link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            Copy
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5 text-slate-300 font-mono">
                                    <div>Expires: <strong className="text-cyan-400">{createdLinkResult.expires_at ? formatDate(createdLinkResult.expires_at) : 'No Expiry (Permanent)'}</strong></div>
                                    <div>Max Downloads: <strong className="text-amber-400">{createdLinkResult.max_downloads || 'Unlimited'}</strong></div>
                                    <div>Password: <strong className="text-indigo-400">{createdLinkResult.has_password ? 'Enabled (Hashed)' : 'None'}</strong></div>
                                </div>

                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateLink} className="space-y-4 text-xs">
                                <div>
                                    <label className="text-slate-300 font-medium block mb-1">
                                        File UUID <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                                        value={createFormData.file_uuid}
                                        onChange={(e) => setCreateFormData({ ...createFormData, file_uuid: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Must be an existing clean file UUID in storage.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-slate-300 font-medium">
                                                Expires In (Minutes)
                                            </label>
                                            <label className="flex items-center gap-1.5 text-[11px] text-cyan-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={createFormData.no_expiry}
                                                    onChange={(e) => setCreateFormData({ ...createFormData, no_expiry: e.target.checked })}
                                                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0"
                                                />
                                                <span>No Expiry</span>
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10080"
                                            disabled={createFormData.no_expiry}
                                            value={createFormData.no_expiry ? '' : createFormData.expires_in_minutes}
                                            placeholder={createFormData.no_expiry ? 'Never expires (Permanent)' : 'Minutes'}
                                            onChange={(e) => setCreateFormData({ ...createFormData, expires_in_minutes: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:bg-slate-900"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {createFormData.no_expiry ? 'Link will remain active permanently until revoked.' : 'e.g. 60 = 1 hr, 1440 = 24 hrs'}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-slate-300 font-medium block mb-1">
                                            Max Downloads Limit
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10000"
                                            placeholder="Unlimited"
                                            value={createFormData.max_downloads}
                                            onChange={(e) => setCreateFormData({ ...createFormData, max_downloads: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-0.5">e.g. 1 for one-time download</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-slate-300 font-medium block mb-1">
                                        Password / PIN Protection (Optional)
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Optional secret passcode for downloader"
                                        value={createFormData.password}
                                        onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-0.5">Downloader will be prompted for this password.</p>
                                </div>

                                <div>
                                    <label className="text-slate-300 font-medium block mb-1">
                                        Allowed Client IPs (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 192.168.1.50, 10.0.0.12"
                                        value={createFormData.allowed_ips}
                                        onChange={(e) => setCreateFormData({ ...createFormData, allowed_ips: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-0.5">Comma-separated IPv4 or IPv6 addresses</p>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createSubmitting}
                                        className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                                    >
                                        {createSubmitting ? 'Generating...' : 'Create Link'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Link Restrictions Modal */}
            {editingLink && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-400">
                                    <Edit2 className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">Edit Link Restrictions</h3>
                                    <p className="text-[11px] text-slate-400">
                                        File: <strong className="text-slate-200">{editingLink.file_record?.original_filename || 'Unknown'}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingLink(null)}
                                className="text-slate-400 hover:text-white text-lg font-mono"
                            >
                                ×
                            </button>
                        </div>

                        {editErrorMessage && (
                            <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                                {editErrorMessage}
                            </div>
                        )}

                        <form onSubmit={handleUpdateLink} className="space-y-4 text-xs">
                            {/* Expiration date & time picker */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-slate-300 font-medium">
                                        Expiration Date & Time (Local Time)
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[11px] text-cyan-400 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editFormData.no_expiry}
                                            onChange={(e) => setEditFormData({ ...editFormData, no_expiry: e.target.checked })}
                                            className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0"
                                        />
                                        <span>No Expiry (Permanent)</span>
                                    </label>
                                </div>
                                <input
                                    type="datetime-local"
                                    required={!editFormData.no_expiry}
                                    disabled={editFormData.no_expiry}
                                    value={editFormData.no_expiry ? '' : editFormData.expires_at}
                                    onChange={(e) => setEditFormData({ ...editFormData, expires_at: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 [color-scheme:dark] disabled:opacity-50 disabled:bg-slate-900"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    {editFormData.no_expiry
                                        ? 'Link will never expire and can be downloaded indefinitely.'
                                        : 'Adjust when this link will automatically expire and stop working.'}
                                </p>
                            </div>

                            {/* Max downloads */}
                            <div>
                                <label className="text-slate-300 font-medium block mb-1">
                                    Max Downloads Limit (Leave blank for unlimited)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10000"
                                    placeholder="Leave blank for unlimited"
                                    value={editFormData.max_downloads}
                                    onChange={(e) => setEditFormData({ ...editFormData, max_downloads: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Current download count: <strong className="text-cyan-400">{editingLink.download_count}</strong> downloads.
                                </p>
                            </div>

                            {/* IP Restrictions */}
                            <div>
                                <label className="text-slate-300 font-medium block mb-1">
                                    Allowed IP Addresses (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 192.168.1.50, 10.0.0.12 (Leave blank for any IP)"
                                    value={editFormData.allowed_ips}
                                    onChange={(e) => setEditFormData({ ...editFormData, allowed_ips: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Comma-separated IPv4 or IPv6 addresses. Empty allows all callers.</p>
                            </div>

                            {/* Password protection */}
                            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg space-y-2">
                                <label className="text-slate-300 font-medium block">
                                    Password / Passcode Protection
                                </label>

                                {editingLink.has_password && (
                                    <div className="flex items-center gap-2 text-[11px] text-amber-300 mb-2">
                                        <Lock className="w-3.5 h-3.5 shrink-0" />
                                        <span>This link is currently password protected.</span>
                                    </div>
                                )}

                                <div>
                                    <input
                                        type="password"
                                        placeholder={editingLink.has_password ? "Enter new password to change" : "Enter password to protect"}
                                        disabled={editFormData.clear_password}
                                        value={editFormData.password}
                                        onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-40"
                                    />
                                </div>

                                {editingLink.has_password && (
                                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                                        <input
                                            type="checkbox"
                                            checked={editFormData.clear_password}
                                            onChange={(e) => setEditFormData({ ...editFormData, clear_password: e.target.checked })}
                                            className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-0"
                                        />
                                        <span className="text-[11px] text-slate-300">Remove password protection completely</span>
                                    </label>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setEditingLink(null)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editSubmitting}
                                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                                >
                                    {editSubmitting ? 'Saving Changes...' : 'Save Restrictions'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

