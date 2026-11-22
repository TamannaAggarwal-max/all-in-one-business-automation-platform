import React, { useEffect, useState } from 'react';
import {
  Eye,
  Globe,
  MessageSquare,
  PhoneCall,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { LeadDetailModal } from '../components/LeadDetailModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Lead, TeamMember } from '../types';

const SOURCES = ['All', 'WhatsApp', 'Website Form', 'Call', 'Instagram', 'Referral'] as const;
const STATUSES = ['All', 'New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'] as const;

interface AutomationTrace {
  automationName: string;
  triggerType: string;
  executedActions: Array<{ actionType: string; summary: string }>;
}

export function LeadsPage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  const [simulatingChannel, setSimulatingChannel] = useState<string | null>(null);
  const [lastTrace, setLastTrace] = useState<{
    leadName: string;
    traces: AutomationTrace[];
  } | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    source: 'WhatsApp' as Lead['source'],
    status: 'New' as Lead['status'],
    assignedUserId: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (sourceFilter !== 'All') params.set('source', sourceFilter);
      params.set('sort', sortBy);

      const [leadsRes, teamRes] = await Promise.all([
        apiRequest<{ leads: Lead[] }>(`/api/leads?${params.toString()}`),
        apiRequest<{ members: TeamMember[] }>('/api/team'),
      ]);
      setLeads(leadsRes.leads);
      setTeam(teamRes.members);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadData, 150);
    return () => clearTimeout(t);
  }, [search, statusFilter, sourceFilter, sortBy]);

  const handleSimulate = async (channel: 'WhatsApp' | 'Website Form' | 'Call') => {
    setSimulatingChannel(channel);
    try {
      const res = await apiRequest<{ lead: Lead; automationTraces: AutomationTrace[] }>(
        '/api/leads/simulate',
        {
          method: 'POST',
          body: JSON.stringify({ channel }),
        }
      );
      setLastTrace({ leadName: res.lead.name, traces: res.automationTraces });
      showSuccess(
        `Simulated ${channel} lead "${res.lead.name}" created & ${res.automationTraces.length} automation(s) ran`
      );
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setSimulatingChannel(null);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ lead: Lead; automationTraces: AutomationTrace[] }>('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          ...newLead,
          assignedUserId: newLead.assignedUserId || null,
        }),
      });
      showSuccess(`Lead "${res.lead.name}" created`);
      if (res.automationTraces.length > 0) {
        setLastTrace({ leadName: res.lead.name, traces: res.automationTraces });
      }
      setShowAddModal(false);
      setNewLead({
        name: '',
        phone: '',
        email: '',
        company: '',
        source: 'WhatsApp',
        status: 'New',
        assignedUserId: '',
        notes: '',
      });
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create lead');
    }
  };

  const handleStatusChange = async (leadId: string, status: Lead['status']) => {
    try {
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showSuccess(
        status === 'Converted'
          ? 'Lead converted and added to Customers'
          : `Lead moved to ${status}`
      );
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async (leadId: string, name: string) => {
    try {
      await apiRequest(`/api/leads/${leadId}`, { method: 'DELETE' });
      showSuccess(`Deleted lead "${name}"`);
      await loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete lead');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Leads CRM</h1>
          <p className="text-sm text-slate-600 mt-1">
            Capture inquiries, run automations, assign team members, and track conversions.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Demo / Simulated Lead Capture Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-sky-700">DEMO / SIMULATED INTEGRATIONS</p>
            <p className="text-sm text-slate-700 mt-0.5">
              Simulate an inbound lead to create a real PostgreSQL record and trigger your active Automation Engine rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleSimulate('WhatsApp')}
              disabled={simulatingChannel !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {simulatingChannel === 'WhatsApp' ? 'Simulating...' : 'Simulate WhatsApp Lead'}
              </span>
            </button>
            <button
              onClick={() => handleSimulate('Website Form')}
              disabled={simulatingChannel !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              <span>
                {simulatingChannel === 'Website Form' ? 'Simulating...' : 'Simulate Website Lead'}
              </span>
            </button>
            <button
              onClick={() => handleSimulate('Call')}
              disabled={simulatingChannel !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <PhoneCall className="w-3.5 h-3.5 text-slate-700" />
              <span>{simulatingChannel === 'Call' ? 'Simulating...' : 'Simulate Call Lead'}</span>
            </button>
          </div>
        </div>

        {lastTrace && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                Automation Trace for "{lastTrace.leadName}":
              </p>
              {lastTrace.traces.length === 0 ? (
                <p className="text-slate-500">No active automation rules matched this channel.</p>
              ) : (
                lastTrace.traces.map((t, idx) => (
                  <p key={idx} className="text-slate-600">
                    <span className="font-medium text-slate-900">{t.automationName}</span> →{' '}
                    {t.executedActions.map((a) => a.summary).join(' · ')}
                  </p>
                ))
              )}
            </div>
            <button
              onClick={() => setLastTrace(null)}
              className="text-slate-400 hover:text-slate-700 self-start sm:self-center"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, email, or phone..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-600"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              Source: {s}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      {/* Leads Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Lead & Company</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="py-4 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-slate-500">
                    No leads match your filters. Try simulating a lead or adding one manually.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="font-semibold text-slate-900 hover:text-sky-700 text-left"
                      >
                        {lead.name}
                      </button>
                      <p className="text-xs text-slate-500">
                        {lead.company || 'Independent'}
                        {lead.isSimulated ? ' · Simulated' : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-mono text-xs text-slate-800 tabular-nums">{lead.phone}</p>
                      <p className="text-xs text-slate-500">{lead.email || '—'}</p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">{lead.source}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      {lead.assignedUserName || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={lead.status}
                        onChange={(e) =>
                          handleStatusChange(lead.id, e.target.value as Lead['status'])
                        }
                        className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-800"
                      >
                        {STATUSES.filter((s) => s !== 'All').map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                          <button
                            onClick={() => handleDelete(lead.id, lead.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            aria-label={`Delete ${lead.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">Add New Lead</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    required
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    required
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="+91 98..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                  <input
                    value={newLead.company}
                    onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Source</label>
                  <select
                    value={newLead.source}
                    onChange={(e) =>
                      setNewLead({ ...newLead, source: e.target.value as Lead['source'] })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {SOURCES.filter((s) => s !== 'All').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assign Employee
                  </label>
                  <select
                    value={newLead.assignedUserId}
                    onChange={(e) => setNewLead({ ...newLead, assignedUserId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Auto-assign via Automation</option>
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
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  placeholder="Customer inquiry details..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          team={team}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}
