import React, { useState } from 'react';
import { ShieldCheck, User, Lock, AlertCircle, ArrowRight, HardDrive } from 'lucide-react';
import { fetchJson } from '../api';

export default function LoginPage({ onLoginSuccess }) {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!login.trim() || !password) {
            setErrorMsg('Please enter both username/email and password.');
            return;
        }

        try {
            setLoading(true);
            const res = await fetchJson('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    login: login.trim(),
                    password,
                    remember,
                }),
            });

            if (onLoginSuccess) {
                onLoginSuccess(res.user);
            }
        } catch (err) {
            setErrorMsg(err.message || 'Login failed. Please check credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/15 via-indigo-600/20 to-purple-600/10 blur-[120px] pointer-events-none rounded-full" />

            <div className="w-full max-w-md relative z-10">
                {/* Header branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-xl shadow-cyan-500/20 mb-4 ring-1 ring-cyan-400/30">
                        <HardDrive className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <h1 className="text-2xl font-extrabold tracking-tight text-white">COSS Management</h1>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                            v1.2 Secure
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Centralized Object Storage & Security Console
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
                    <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-slate-800">
                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-100">Administrator Sign In</h2>
                            <p className="text-xs text-slate-400">Authenticate to access storage management & nodes</p>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Username or Email
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <User className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={login}
                                    onChange={(e) => setLogin(e.target.value)}
                                    placeholder="Enter your username or email"
                                    autoFocus
                                    required
                                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold text-slate-300">
                                    Password
                                </label>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-950 text-cyan-600 focus:ring-cyan-500"
                                />
                                <span>Remember session</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-cyan-600/20 hover:shadow-cyan-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span>Verifying credentials...</span>
                            ) : (
                                <>
                                    <span>Sign In to Console</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                        <p className="text-[11px] text-slate-500">
                            ZCMC Centralized Object Storage Security Framework
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
