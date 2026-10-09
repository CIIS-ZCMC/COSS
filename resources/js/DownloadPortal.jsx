import React, { useState, useEffect } from 'react';
import { 
    Download, 
    FileText, 
    Lock, 
    Clock, 
    ShieldCheck, 
    ShieldAlert, 
    AlertCircle, 
    CheckCircle2, 
    HardDrive, 
    Key, 
    ExternalLink, 
    RefreshCw,
    Eye,
    X,
    Maximize2
} from 'lucide-react';
import { fetchJson, formatBytes, formatDate } from './api';

export default function DownloadPortal() {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [password, setPassword] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [authError, setAuthError] = useState('');

    const [downloadComplete, setDownloadComplete] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);

    const currentUrl = window.location.href;
    const path = window.location.pathname; // e.g. /api/v1/files/download/{uuid}
    const search = window.location.search; // e.g. ?expires=...&link=...&signature=...

    // Construct info URL
    const infoUrl = `${path}/info${search}`;

    const getInlineViewUrl = (pass = '') => {
        const params = new URLSearchParams(window.location.search);
        params.set('view', '1');
        if (pass.trim()) {
            params.set('password', pass.trim());
        }
        return `${window.location.pathname}?${params.toString()}`;
    };

    const triggerDirectDownload = async (pass = '') => {
        setDownloading(true);
        setAuthError('');

        const params = new URLSearchParams(window.location.search);
        params.set('stream', '1');
        if (pass.trim()) {
            params.set('password', pass.trim());
        }

        const streamUrl = `${window.location.pathname}?${params.toString()}`;

        // If password is required or provided, verify it first using fetch
        if (info?.link?.has_password || pass.trim()) {
            try {
                const response = await fetch(streamUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    if (response.status === 401 || data?.error === 'PasswordRequired') {
                        setAuthError('Incorrect passcode. Please check the passcode and try again.');
                    } else {
                        setAuthError(data?.message || 'Download verification failed. Please try again.');
                    }
                    setDownloading(false);
                    return;
                }
            } catch (err) {
                setAuthError('Network error while verifying passcode. Please try again.');
                setDownloading(false);
                return;
            }
        }

        // Trigger file download
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = streamUrl;
        document.body.appendChild(iframe);

        setDownloadComplete(true);
        setDownloading(false);
    };

    const loadLinkInfo = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchJson(infoUrl);
            setInfo(data);

            // Check if file is directly downloadable:
            // Must not be revoked, not expired, not limit reached, IP authorized, and NO password required
            const isBlocked = data.link?.is_revoked || data.link?.is_expired || data.link?.limit_reached || !data.link?.ip_authorized;
            const requiresPassword = data.link?.has_password;

            if (!isBlocked && !requiresPassword && data.file?.status === 'clean') {
                // Auto trigger download immediately, then close page
                triggerDirectDownload();
            }
        } catch (err) {
            setError(err.message || 'Unable to verify download link.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLinkInfo();
    }, []);

    useEffect(() => {
        if (info?.file?.original_filename) {
            document.title = `${info.file.original_filename} - Secure Download | ZCMC COSS`;
        } else {
            document.title = 'Secure File Download | ZCMC COSS';
        }
    }, [info]);

    const handleDownload = (e) => {
        e.preventDefault();
        setAuthError('');

        if (info?.link?.has_password && !password.trim()) {
            setAuthError('Please enter the required passcode to download this file.');
            return;
        }

        triggerDirectDownload(password);
    };

    const handleOpenPreview = async () => {
        setAuthError('');

        if (info?.link?.has_password && !password.trim()) {
            setAuthError('Please enter the required passcode to preview this file.');
            return;
        }

        const previewUrl = getInlineViewUrl(password);

        // If password is required or provided, verify passcode before rendering preview
        if (info?.link?.has_password || password.trim()) {
            setPreviewLoading(true);
            try {
                const response = await fetch(previewUrl, {
                    method: 'GET',
                    headers: { 'Accept': '*/*' },
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    if (response.status === 401 || data?.error === 'PasswordRequired') {
                        setAuthError('Incorrect passcode. Please check the passcode and try again.');
                    } else {
                        setAuthError(data?.message || 'Access verification failed.');
                    }
                    setPreviewLoading(false);
                    return;
                }
            } catch (err) {
                setAuthError('Network error while verifying passcode. Please try again.');
                setPreviewLoading(false);
                return;
            }
            setPreviewLoading(false);
        }

        setShowPreview(true);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
            {/* Main Portal Container */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
                <div className="max-w-xl w-full">
                    {loading ? (
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl backdrop-blur-sm">
                            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
                            <div>
                                <h3 className="font-semibold text-white">Validating Security Signature...</h3>
                                <p className="text-xs text-slate-400 mt-1">Verifying expiration, HMAC signature, and access restrictions.</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="bg-slate-900/90 border border-rose-900/60 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
                            <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
                                <ShieldAlert className="w-7 h-7" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-white">Record / File Not Found</h3>
                                <p className="text-xs text-rose-300 font-medium mt-1">{error}</p>
                            </div>
                            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300 text-left space-y-2">
                                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                    Why is this happening?
                                </div>
                                <div className="space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
                                    <div>• <strong className="text-slate-300">External System Record:</strong> This file may belong to another hospital information system or was stored in a separate subsystem.</div>
                                    <div>• <strong className="text-slate-300">Expired or Purged:</strong> The file or temporary link token may have already been purged or expired according to hospital retention policies.</div>
                                    <div>• <strong className="text-slate-300">Invalid Identifier:</strong> The requested UUID or link token was not found in COSS.</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2 pt-1">
                                <button
                                    onClick={loadLinkInfo}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Retry Check
                                </button>
                                <a
                                    href="/"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                                >
                                    Return to Console
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-md">
                            {/* Status Banner */}
                            {info.link?.is_revoked ? (
                                <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
                                    <ShieldAlert className="w-5 h-5 shrink-0" />
                                    <div>
                                        <strong className="block font-semibold">Link Revoked</strong>
                                        This download link has been revoked by an administrator and can no longer be used.
                                    </div>
                                </div>
                            ) : info.link?.is_expired ? (
                                <div className="p-3.5 rounded-xl bg-orange-950/70 border border-orange-800 text-orange-300 text-xs flex items-center gap-2.5">
                                    <Clock className="w-5 h-5 shrink-0" />
                                    <div>
                                        <strong className="block font-semibold">Link Expired</strong>
                                        This download link expired on {formatDate(info.link?.expires_at)}.
                                    </div>
                                </div>
                            ) : info.link?.limit_reached ? (
                                <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-800 text-amber-300 text-xs flex items-center gap-2.5">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <div>
                                        <strong className="block font-semibold">Download Limit Reached</strong>
                                        This link has reached its maximum allowance of {info.link?.max_downloads} downloads.
                                    </div>
                                </div>
                            ) : !info.link?.ip_authorized ? (
                                <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
                                    <ShieldAlert className="w-5 h-5 shrink-0" />
                                    <div>
                                        <strong className="block font-semibold">IP Address Restricted</strong>
                                        Your IP ({info.link?.client_ip}) is not authorized to download this file.
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2.5">
                                    <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
                                    <div>
                                        <strong className="block font-semibold">Security Verified & Scanned Clean</strong>
                                        File passed ClamAV antivirus inspection. Ready for immediate download.
                                    </div>
                                </div>
                            )}

                            {/* File Card Box */}
                            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 flex items-center justify-center shrink-0">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="font-bold text-white text-base truncate" title={info.file?.original_filename}>
                                        {info.file?.original_filename}
                                    </h2>
                                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                        <span className="font-mono text-cyan-300">{formatBytes(info.file?.size_bytes)}</span>
                                        <span>•</span>
                                        <span>{info.file?.mime_type}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Restrictions & Details Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-1">
                                    <span className="text-[11px] text-slate-500 block uppercase tracking-wider font-semibold">Origin System</span>
                                    <span className="text-slate-200 font-medium block truncate">{info.file?.client_name}</span>
                                </div>

                                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-1">
                                    <span className="text-[11px] text-slate-500 block uppercase tracking-wider font-semibold">Expires</span>
                                    <span className={`font-medium block ${info.link?.is_expired ? 'text-rose-400' : 'text-slate-200'}`}>
                                        {info.link?.expires_at ? formatDate(info.link?.expires_at) : 'No Expiry (Permanent)'}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-1">
                                    <span className="text-[11px] text-slate-500 block uppercase tracking-wider font-semibold">Usage Limit</span>
                                    <span className="text-slate-200 font-medium block font-mono">
                                        {info.link?.max_downloads ? `${info.link.download_count} / ${info.link.max_downloads} used` : 'Unlimited'}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-1">
                                    <span className="text-[11px] text-slate-500 block uppercase tracking-wider font-semibold">Protection</span>
                                    <span className="text-slate-200 font-medium block flex items-center gap-1">
                                        {info.link?.has_password ? (
                                            <span className="text-amber-400 flex items-center gap-1">
                                                <Lock className="w-3.5 h-3.5" /> Passcode Required
                                            </span>
                                        ) : (
                                            <span className="text-emerald-400">Direct Access</span>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Download Complete Notification */}
                            {downloadComplete && (
                                <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800/90 text-emerald-200 text-xs space-y-2.5 shadow-lg">
                                    <div className="flex items-center gap-2.5">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                        <div>
                                            <strong className="block font-semibold text-emerald-100 text-sm">Download Started!</strong>
                                            <span>Your file is downloading directly to your device.</span>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-emerald-900/60 text-[11px] text-emerald-300/80 flex items-center justify-between">
                                        <span>Download is underway. You can now close this tab (<kbd className="px-1.5 py-0.5 bg-emerald-900/80 border border-emerald-700/60 rounded text-[10px] font-mono text-emerald-200">Ctrl + W</kbd> or <kbd className="px-1.5 py-0.5 bg-emerald-900/80 border border-emerald-700/60 rounded text-[10px] font-mono text-emerald-200">⌘ + W</kbd>).</span>
                                    </div>
                                </div>
                            )}

                            {/* Download Action Form */}
                            {(!info.link?.is_revoked && !info.link?.is_expired && !info.link?.limit_reached && info.link?.ip_authorized) && (
                                <form onSubmit={handleDownload} className="space-y-4 pt-2">
                                    {info.link?.has_password && (
                                        <div>
                                            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                                                <Key className="w-3.5 h-3.5 text-amber-400" />
                                                <span>Enter Passcode to Unlock File</span>
                                            </label>
                                            <input
                                                type="password"
                                                required
                                                placeholder="Enter password..."
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                    )}

                                    {authError && (
                                        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl">
                                            {authError}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={handleOpenPreview}
                                            disabled={downloading || previewLoading}
                                            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                                        >
                                            <Eye className="w-4 h-4 text-cyan-400" />
                                            {previewLoading ? 'Verifying...' : 'Stream / Preview'}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={downloading || previewLoading}
                                            className="py-3 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                                        >
                                            <Download className="w-4 h-4" />
                                            {downloading ? 'Preparing...' : (downloadComplete ? 'Download Again' : 'Download File')}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Modal Preview Dialog */}
            {showPreview && (
                <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm sm:text-base truncate max-w-md">
                                    {info?.file?.original_filename}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {info?.file?.mime_type} • {formatBytes(info?.file?.size_bytes)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={getInlineViewUrl(password)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-700"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open in New Tab
                            </a>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 mt-4 rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden flex items-center justify-center relative">
                        {info?.file?.mime_type?.startsWith('image/') ? (
                            <img
                                src={getInlineViewUrl(password)}
                                alt={info?.file?.original_filename}
                                className="max-h-full max-w-full object-contain mx-auto"
                            />
                        ) : info?.file?.mime_type?.startsWith('video/') ? (
                            <video
                                controls
                                autoPlay
                                className="max-h-full max-w-full mx-auto"
                                src={getInlineViewUrl(password)}
                            >
                                Your browser does not support HTML5 video preview.
                            </video>
                        ) : info?.file?.mime_type?.startsWith('audio/') ? (
                            <div className="p-8 text-center space-y-4">
                                <audio controls autoPlay className="w-full max-w-md mx-auto" src={getInlineViewUrl(password)}>
                                    Your browser does not support HTML5 audio.
                                </audio>
                            </div>
                        ) : (
                            <iframe
                                src={getInlineViewUrl(password)}
                                title={info?.file?.original_filename}
                                className="w-full h-full border-0 bg-white"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
                Zamboanga City Medical Center • Centralized Object Storage & Security Service (COSS)
            </footer>
        </div>
    );
}
