import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { FollowUp, Lead, TeamMember } from '../types';

type Tab = 'today' | 'upcoming' | 'overdue' | 'completed';

export function FollowUpsPage() {
  const { showError, showSuccess } = useToast();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10));
  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('today');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [form, setForm] = useState({
    leadId: '',
    assignedUserId: '',
    dueDate: new Date().toISOString().slice(0, 10),
    dueTime: '11:00',
    type: 'WhatsApp' as FollowUp['type'],
    notes: '',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [fuRes, leadsRes, teamRes] = await Promise.all([
        apiRequest<{ followUps: FollowUp[]; today: string }>('/api/follow-ups'),
        apiRequest<{ leads: Lead[] }>('/api/leads'),
        apiRequest<{ members: TeamMember[] }>('/api/team'),
      ]);
      setFollowUps(fuRes.followUps);
      setToday(fuRes.today);
      setLeads(leadsRes.leads);
      setTeam(teamRes.members);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = followUps.filter((f) => {
    if (tab === 'completed') return f.status === 'Completed';
    if (tab === 'overdue') return f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < today);
    if (tab === 'today') return f.status === 'Pending' && f.dueDate === today;
    return f.status === 'Pending' && f.dueDate > today;
  });

  const counts = {
    today: followUps.filter((f) => f.status === 'Pending' && f.dueDate === today).length,
    upcoming: followUps.filter((f) => f.status === 'Pending' && f.dueDate > today).length,
    overdue: followUps.filter((f) => f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < today)).length,
    completed: followUps.filter((f) => f.status === 'Completed').length,
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      leadId: leads[0]?.id || '',
      assignedUserId: '',
      dueDate: today,
      dueTime: '11:00',
      type: 'WhatsApp',
      notes: '',
    });
    setShowModal(true);
  };

  const openReschedule = (item: FollowUp) => {
    setEditing(item);
    setForm({
      leadId: item.leadId || '',
      assignedUserId: item.assignedUserId || '',
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      type: item.type,
      notes: item.notes,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiRequest(`/api/follow-ups/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            dueDate: form.dueDate,
            dueTime: form.dueTime,
            type: form.type,
            notes: form.notes,
            assignedUserId: form.assignedUserId || null,
          }),
        });
        showSuccess('Follow-up updated');
      } else {
        await apiRequest('/api/follow-ups', {
          method: 'POST',
          body: JSON.stringify({
            leadId: form.leadId || null,
            assignedUserId: form.assignedUserId || null,
            dueDate: form.dueDate,
            dueTime: form.dueTime,
            type: form.type,
            notes: form.notes,
          }),
        });
        showSuccess('Follow-up scheduled');
      }
      setShowModal(false);
      await loadAll();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save follow-up');
    }
  };

  const markCompleted = async (id: string) => {
    try {
      await apiRequest(`/api/follow-ups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Completed' }),
      });
      showSuccess('Follow-up marked complete');
      await loadAll();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to complete follow-up');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/follow-ups/${id}`, { method: 'DELETE' });
      showSuccess('Follow-up deleted');
      await loadAll();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete follow-up');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Follow-ups</h1>
          <p className="text-sm text-slate-600 mt-1">
            Stay ahead of scheduled calls, WhatsApp check-ins, emails, and meetings.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Follow-up</span>
        </button>
      </div>

      {/* Segmented Tabs */}
      <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-200/70 rounded-lg">
        {(
          [
            { key: 'today', label: "Today's", count: counts.today },
            { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { key: 'overdue', label: 'Overdue', count: counts.overdue },
            { key: 'completed', label: 'Completed', count: counts.completed },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              tab === item.key
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label} <span className="font-mono tabular-nums ml-1">({item.count})</span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No follow-ups in this view.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-900">
                    {item.leadName || item.customerName || 'General Task'}
                  </span>
                  {item.leadCompany && (
                    <span className="text-xs text-slate-500">· {item.leadCompany}</span>
                  )}
                  <span className="text-xs text-sky-700 font-medium">· {item.type}</span>
                </div>
                <p className="text-sm text-slate-600">{item.notes || 'No notes provided.'}</p>
                <p className="text-xs font-mono text-slate-500 tabular-nums">
                  Due {item.dueDate} at {item.dueTime} · Assigned to{' '}
                  {item.assignedUserName || 'Unassigned'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.status !== 'Completed' && (
                  <button
                    onClick={() => markCompleted(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete</span>
                  </button>
                )}
                <button
                  onClick={() => openReschedule(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Reschedule / Edit</span>
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  aria-label="Delete follow-up"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Reschedule / Edit Follow-up' : 'Schedule Follow-up'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lead</label>
                  <select
                    value={form.leadId}
                    onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">No specific lead</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.company || l.source})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={form.dueTime}
                    onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Channel</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as FollowUp['type'] })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assignee</label>
                  <select
                    value={form.assignedUserId}
                    onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Assign to me</option>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
