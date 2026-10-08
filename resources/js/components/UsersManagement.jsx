import React, { useState, useEffect } from 'react';
import { 
    Users, 
    UserPlus, 
    Search, 
    ShieldCheck, 
    Key, 
    Trash2, 
    Edit2, 
    Check, 
    AlertCircle, 
    X, 
    Lock, 
    Mail, 
    User as UserIcon,
    Shield
} from 'lucide-react';
import { fetchJson, formatDate } from '../api';

export default function UsersManagement({ currentUser }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Form inputs
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'admin',
    });

    const loadUsers = async () => {
        try {
            setLoading(true);
            setErrorMsg('');
            const data = await fetchJson('/api/management/users');
            setUsers(data || []);
        } catch (err) {
            setErrorMsg(err.message || 'Failed to load users list');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({
            name: '',
            username: '',
            email: '',
            password: '',
            role: 'admin',
        });
        setErrorMsg('');
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setFormData({
            name: user.name || '',
            username: user.username || '',
            email: user.email || '',
            password: '', // leave empty to keep unchanged
            role: user.role || 'user',
        });
        setErrorMsg('');
        setShowModal(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');
        setSubmitting(true);

        try {
            if (editingUser) {
                // Update
                const payload = { ...formData };
                if (!payload.password) {
                    delete payload.password;
                }
                await fetchJson(`/api/management/users/${editingUser.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                setSuccessMsg(`User ${formData.username} successfully updated.`);
            } else {
                // Create
                await fetchJson('/api/management/users', {
                    method: 'POST',
                    body: JSON.stringify(formData),
                });
                setSuccessMsg(`User ${formData.username} created successfully.`);
            }

            setShowModal(false);
            loadUsers();
        } catch (err) {
            setErrorMsg(err.message || 'Action failed. Please verify inputs.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Are you sure you want to delete user "${user.username || user.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            setErrorMsg('');
            setSuccessMsg('');
            await fetchJson(`/api/management/users/${user.id}`, {
                method: 'DELETE',
            });
            setSuccessMsg(`User ${user.username || user.name} deleted successfully.`);
            loadUsers();
        } catch (err) {
            setErrorMsg(err.message || 'Failed to delete user.');
        }
    };

    const filteredUsers = users.filter((u) => {
        const query = search.toLowerCase();
        return (
            (u.name && u.name.toLowerCase().includes(query)) ||
            (u.username && u.username.toLowerCase().includes(query)) ||
            (u.email && u.email.toLowerCase().includes(query)) ||
            (u.role && u.role.toLowerCase().includes(query))
        );
    });

    const isSuperAdmin = currentUser?.role === 'superadmin';

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                <div>
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-cyan-400" />
                        <h2 className="text-base font-bold text-white">User Access & Security Management</h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Manage administrative credentials, system operators, and privilege levels for the COSS console.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Add New User</span>
                    </button>
                </div>
            </div>

            {/* Notification messages */}
            {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                </div>
            )}
            {successMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Filter toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, username, email..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                    />
                </div>
                <span className="text-xs text-slate-400">
                    Total Users: <strong className="text-slate-200 font-mono">{filteredUsers.length}</strong>
                </span>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="px-5 py-3.5 font-semibold">User Details</th>
                                <th className="px-5 py-3.5 font-semibold">Username</th>
                                <th className="px-5 py-3.5 font-semibold">Role</th>
                                <th className="px-5 py-3.5 font-semibold">Created Date</th>
                                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-5 py-8 text-center text-slate-500">
                                        Loading user accounts...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-5 py-8 text-center text-slate-500">
                                        No users matching query found.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => {
                                    const isSelf = currentUser?.id === user.id;
                                    return (
                                        <tr key={user.id} className="hover:bg-slate-800/30 transition">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400">
                                                        {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                                                            <span>{user.name}</span>
                                                            {isSelf && (
                                                                <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.2 rounded font-medium">
                                                                    You
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-3 h-3 text-slate-500" />
                                                            {user.email}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 font-mono text-cyan-300">
                                                @{user.username || '—'}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                                                        user.role === 'superadmin'
                                                            ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                                                            : user.role === 'admin'
                                                            ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80'
                                                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                                                    }`}
                                                >
                                                    <Shield className="w-3 h-3" />
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-400">
                                                {formatDate(user.created_at)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openEditModal(user)}
                                                        className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition"
                                                        title="Edit user"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        disabled={isSelf}
                                                        className={`p-1.5 rounded-lg transition ${
                                                            isSelf 
                                                                ? 'text-slate-600 cursor-not-allowed' 
                                                                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                                                        }`}
                                                        title={isSelf ? 'Cannot delete logged in user' : 'Delete user'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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
            </div>

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2.5 mb-5">
                            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">
                                    {editingUser ? 'Edit User Account' : 'Create New User'}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {editingUser
                                        ? `Modifying credentials for ${editingUser.username || editingUser.name}`
                                        : 'Configure administrative operator credentials'}
                                </p>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <form onSubmit={handleFormSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Full Name <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. John Doe"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Username <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="e.g. jdoe"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Email Address <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="jdoe@hospital.gov.ph"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-semibold text-slate-300">
                                        Password {editingUser ? '(leave blank to keep unchanged)' : <span className="text-rose-400">*</span>}
                                    </label>
                                </div>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={editingUser ? '••••••••' : 'Enter strong password'}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Role Privilege
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition"
                                >
                                    <option value="superadmin">Super Administrator (Full System & User Control)</option>
                                    <option value="admin">Administrator (Storage & Links Control)</option>
                                    <option value="user">Auditor / Operator (Standard Access)</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
