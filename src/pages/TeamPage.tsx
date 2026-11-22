import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { TeamMember, UserRole } from '../types';

export function TeamPage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'SALES_EMPLOYEE' as UserRole,
  });

  const loadTeam = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ members: TeamMember[] }>('/api/team');
      setMembers(res.members);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/team', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      showSuccess(`Added ${form.fullName} to your team`);
      setShowModal(false);
      setForm({ fullName: '', email: '', password: '', role: 'SALES_EMPLOYEE' });
      await loadTeam();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add employee');
    }
  };

  const updateMember = async (id: string, patch: { role?: UserRole; isActive?: boolean }) => {
    try {
      await apiRequest(`/api/team/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      showSuccess('Team member updated');
      await loadTeam();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update team member');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage roles, access status, and sales workload across your business.
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 whitespace-nowrap self-start"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Leads Assigned</th>
                <th className="py-3 px-4 text-right">Contacted</th>
                <th className="py-3 px-4 text-right">Conversions</th>
                <th className="py-3 px-4 text-right">Pending Follow-ups</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-4 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : (
                members.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{m.fullName}</p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {user?.role === 'ADMIN' ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            updateMember(m.id, { role: e.target.value as UserRole })
                          }
                          className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="SALES_EMPLOYEE">SALES_EMPLOYEE</option>
                        </select>
                      ) : (
                        <span className="text-xs text-slate-700">{m.role}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {m.stats.leadsAssigned}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {m.stats.leadsContacted}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {m.stats.conversions}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {m.stats.pendingFollowUps}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        disabled={user?.role !== 'ADMIN' || m.id === user?.id}
                        onClick={() => updateMember(m.id, { isActive: !m.isActive })}
                        className={`text-xs font-medium px-2.5 py-1 rounded-md border disabled:opacity-60 ${
                          m.isActive
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {m.isActive ? 'Active' : 'Deactivated'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">Add Team Member</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Temporary Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="SALES_EMPLOYEE">SALES_EMPLOYEE</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
