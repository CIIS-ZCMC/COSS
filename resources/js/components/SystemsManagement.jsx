import React, { useState, useEffect } from 'react';
import { 
    Server, 
    Plus, 
    Search, 
    ShieldCheck, 
    RefreshCw, 
    Activity, 
    HardDrive, 
    Key, 
    Globe, 
    Copy, 
    Check, 
    Trash2, 
    Lock,
    Unlock,
    ExternalLink,
    AlertCircle
} from 'lucide-react';
import { fetchJson, formatBytes, formatDate } from '../api';

export default function SystemsManagement({ onRefreshStats }) {
    const [systems, setSystems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState(null);
    const [copiedKey, setCopiedKey] = useState(false);
    const [copiedSecret, setCopiedSecret] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // New system form state
    const [formData, setFormData] = useState({
        name: '',
        webhook_url: '',
        allowed_ips: '',
        rate_limit_per_minute: 120,
    });
    const [submitting, setSubmitting] = useState(false);

    const loadSystems = async () => {
        try {
            setLoading(true);
            const query = search ? `?search=${encodeURIComponent(search)}` : '';
            const data = await fetchJson(`/api/management/systems${query}`);
            setSystems(data.systems || []);
        } catch (err) {
            setErrorMsg(err.message || 'Failed to load connected systems');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSystems();
    }, [search]);

    const handleCreateSystem = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg('');

        try {
            const ipsArray = formData.allowed_ips
                ? formData.allowed_ips.split(',').map(s => s.trim()).filter(Boolean)
                : [];

            const res = await fetchJson('/api/management/systems', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.name,
                    webhook_url: formData.webhook_url || null,
                    allowed_ips: ipsArray,
                    rate_limit_per_minute: parseInt(formData.rate_limit_per_minute, 10),
                }),
            });

            setShowCreateModal(false);
            setCreatedCredentials({
                name: res.system.name,
                api_key: res.credentials.api_key,
                api_secret: res.credentials.api_secret,
            });
            setShowCredentialsModal(true);
            setFormData({
                name: '',
                webhook_url: '',
                allowed_ips: '',
                rate_limit_per_minute: 120,
            });
            loadSystems();
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            setErrorMsg(err.message || 'Failed to register system');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (system) => {
        try {
            await fetchJson(`/api/management/systems/${system.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    is_active: !system.is_active,
                }),
            });
            loadSystems();
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            alert('Error updating status: ' + err.message);
        }
    };

    const handleDeleteSystem = async (system) => {
        if (!confirm(`Are you sure you want to disconnect system "${system.name}"? This will disable its API access.`)) {
            return;
        }

        try {
            await fetchJson(`/api/management/systems/${system.id}`, {
                method: 'DELETE',
            });
            loadSystems();
            if (onRefreshStats) onRefreshStats();
        } catch (err) {
            alert('Error deleting system: ' + err.message);
        }
    };

    const handleRegenerateSecret = async (system) => {
        if (!confirm(`Regenerate API Secret for "${system.name}"? The existing secret will stop working immediately.`)) {
            return;
        }

        try {
            const res = await fetchJson(`/api/management/systems/${system.id}/regenerate-secret`, {
                method: 'POST',
            });
            setCreatedCredentials({
                name: system.name,
                api_key: res.api_key,
                api_secret: res.api_secret,
            });
            setShowCredentialsModal(true);
        } catch (err) {
            alert('Error regenerating secret: ' + err.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Server className="w-5 h-5 text-cyan-400" />
                        Connected Systems
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Manage authorized hospital applications (EHR, PACS, LIS, Billing) and their access credentials.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Filter by system name or key..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                        />
                    </div>
                    <button
                        onClick={loadSystems}
                        title="Reload"
                        className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg shadow-sm transition"
                    >
                        <Plus className="w-4 h-4" />
                        Register System
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Systems Grid */}
            {loading && systems.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                    Loading connected systems...
                </div>
            ) : systems.length === 0 ? (
                <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-xl">
                    <Server className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-300 font-medium">No systems connected yet</p>
                    <p className="text-slate-500 text-xs mt-1">Register your first client application to grant file storage access.</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 px-3 py-1.5 text-xs font-semibold bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition"
                    >
                        Register Client Now
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {systems.map((sys) => (
                        <div
                            key={sys.id}
                            className={`p-5 rounded-xl border transition-all ${
                                sys.is_active
                                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                                    : 'bg-slate-900/40 border-slate-800/40 opacity-75'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${sys.is_active ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'}`} />
                                        <h3 className="font-semibold text-white text-sm">{sys.name}</h3>
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-mono">UUID: {sys.uuid.substring(0, 13)}...</p>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wider ${
                                    sys.is_active
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}>
                                    {sys.is_active ? 'Active' : 'Disabled'}
                                </span>
                            </div>

                            {/* Credentials box */}
                            <div className="mt-4 p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-lg space-y-1 text-xs">
                                <div className="flex items-center justify-between text-slate-400">
                                    <span className="flex items-center gap-1.5 text-[11px]">
                                        <Key className="w-3.5 h-3.5 text-amber-400" />
                                        API Key:
                                    </span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(sys.api_key);
                                            alert('API Key copied to clipboard');
                                        }}
                                        title="Copy API Key"
                                        className="text-[11px] text-cyan-400 hover:text-cyan-300"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="font-mono text-slate-300 text-[11px] truncate">{sys.api_key}</p>
                            </div>

                            {/* Metrics */}
                            <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-b border-slate-800/60 py-2.5 text-xs">
                                <div>
                                    <span className="text-[10px] text-slate-500 block uppercase">Files</span>
                                    <span className="font-semibold text-slate-200">{sys.files_count}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-500 block uppercase">Clean</span>
                                    <span className="font-semibold text-emerald-400">{sys.clean_files_count}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-500 block uppercase">Storage</span>
                                    <span className="font-semibold text-slate-200">{formatBytes(sys.total_storage_bytes)}</span>
                                </div>
                            </div>

                            {/* Network Details */}
                            <div className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                                <div className="flex items-center justify-between">
                                    <span>IP Whitelist:</span>
                                    <span className="font-mono text-slate-300">
                                        {sys.allowed_ips?.length ? `${sys.allowed_ips.length} IPs` : 'Open (Any)'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Rate Limit:</span>
                                    <span className="text-slate-300">{sys.rate_limit_per_minute} req/min</span>
                                </div>
                                {sys.webhook_url && (
                                    <div className="flex items-center justify-between">
                                        <span>Webhook:</span>
                                        <span className="text-cyan-400 truncate max-w-[150px]" title={sys.webhook_url}>
                                            {sys.webhook_url}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                                <button
                                    onClick={() => handleRegenerateSecret(sys)}
                                    className="text-[11px] text-slate-400 hover:text-amber-400 transition"
                                >
                                    New Secret
                                </button>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggleActive(sys)}
                                        className={`px-2 py-1 text-[11px] rounded transition ${
                                            sys.is_active 
                                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                                                : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-400'
                                        }`}
                                    >
                                        {sys.is_active ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSystem(sys)}
                                        title="Disconnect System"
                                        className="p-1 text-slate-500 hover:text-red-400 transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Create Client Application */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Server className="w-4 h-4 text-cyan-400" />
                                Register Connected System
                            </h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateSystem} className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    System Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. ZCMC Central EHR, Billing Portal, PACS"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Webhook Destination URL (Optional)
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://client-system.local/api/coss/webhook"
                                    value={formData.webhook_url}
                                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Allowed IP Addresses (Comma-separated, Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="192.168.1.100, 10.0.4.12"
                                    value={formData.allowed_ips}
                                    onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
                                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Rate Limit (Requests / Minute)
                                </label>
                                <input
                                    type="number"
                                    min="10"
                                    max="5000"
                                    value={formData.rate_limit_per_minute}
                                    onChange={(e) => setFormData({ ...formData, rate_limit_per_minute: e.target.value })}
                                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div className="pt-3 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition disabled:opacity-50"
                                >
                                    {submitting ? 'Registering...' : 'Register & Generate Keys'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: View Generated Credentials */}
            {showCredentialsModal && createdCredentials && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                            <Lock className="w-5 h-5" />
                            System Credentials Generated
                        </div>
                        <p className="text-xs text-slate-300">
                            Please save the secret now for <strong>{createdCredentials.name}</strong>. For Zero-Trust security, the <strong>API Secret is hashed</strong> in the database and cannot be retrieved again.
                        </p>

                        <div className="space-y-3 bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <div>
                                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                    <span>COSS-API-Key:</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(createdCredentials.api_key);
                                            setCopiedKey(true);
                                            setTimeout(() => setCopiedKey(false), 2000);
                                        }}
                                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                                    >
                                        {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copiedKey ? 'Copied' : 'Copy Key'}
                                    </button>
                                </div>
                                <code className="block p-2 bg-slate-900 rounded border border-slate-800 text-xs font-mono text-cyan-300 break-all select-all">
                                    {createdCredentials.api_key}
                                </code>
                            </div>

                            <div>
                                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                    <span className="text-amber-400 font-semibold">COSS-API-Secret (Secret Token):</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(createdCredentials.api_secret);
                                            setCopiedSecret(true);
                                            setTimeout(() => setCopiedSecret(false), 2000);
                                        }}
                                        className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px]"
                                    >
                                        {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copiedSecret ? 'Copied' : 'Copy Secret'}
                                    </button>
                                </div>
                                <code className="block p-2 bg-slate-900 rounded border border-amber-900/40 text-xs font-mono text-amber-300 break-all select-all">
                                    {createdCredentials.api_secret}
                                </code>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setShowCredentialsModal(false)}
                                className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
                            >
                                I Have Saved These Credentials
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
