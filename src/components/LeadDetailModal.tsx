import React, { useEffect, useState } from 'react';
import { Bot, CalendarPlus, Check, Copy, Send, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Activity, Lead, TeamMember } from '../types';

const STATUSES: Lead['status'][] = [
  'New',
  'Contacted',
  'Interested',
  'Follow-up',
  'Converted',
  'Lost',
];

const TONES = ['Friendly', 'Professional', 'Short', 'Sales-focused'] as const;

export function LeadDetailModal({
  leadId,
  team,
  onClose,
  onUpdated,
}: {
  leadId: string;
  team: TeamMember[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [tone, setTone] = useState<(typeof TONES)[number]>('Friendly');
  const [replyDraft, setReplyDraft] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [copied, setCopied] = useState(false);

  const [followDate, setFollowDate] = useState(new Date().toISOString().slice(0, 10));
  const [followTime, setFollowTime] = useState('11:00');
  const [followType, setFollowType] = useState<'WhatsApp' | 'Call' | 'Email' | 'Meeting'>('WhatsApp');
  const [followNotes, setFollowNotes] = useState('');

  const loadDetails = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ lead: Lead; activities: Activity[] }>(`/api/leads/${leadId}`);
      setLead(res.lead);
      setActivities(res.activities);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load lead details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [leadId]);

  const updateLeadField = async (patch: Partial<Lead>) => {
    try {
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      showSuccess('Lead updated');
      await loadDetails();
      onUpdated();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update lead');
    }
  };

  const handleGenerateReply = async () => {
    if (!lead) return;
    setGeneratingReply(true);
    try {
      const res = await apiRequest<{ reply: string; isDemoFallback: boolean }>(
        '/api/ai/generate-reply',
        {
          method: 'POST',
          body: JSON.stringify({
            customerMessage: lead.notes || `Inquiry from ${lead.name} via ${lead.source}`,
            leadName: lead.name,
            tone,
          }),
        }
      );
      setReplyDraft(res.reply);
      if (res.isDemoFallback) {
        showSuccess('Generated demo fallback reply');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate reply');
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleSaveReplyToTimeline = async () => {
    if (!replyDraft.trim()) return;
    try {
      await apiRequest(`/api/leads/${leadId}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'CUSTOMER_CONTACTED',
          title: `AI Reply Sent (${tone})`,
          description: replyDraft,
        }),
      });
      showSuccess('Reply logged to lead activity timeline');
      setReplyDraft('');
      await loadDetails();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to log reply');
    }
  };

  const handleScheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/follow-ups', {
        method: 'POST',
        body: JSON.stringify({
          leadId,
          assignedUserId: lead?.assignedUserId || null,
          dueDate: followDate,
          dueTime: followTime,
          type: followType,
          notes: followNotes || `Follow up with ${lead?.name}`,
        }),
      });
      showSuccess('Follow-up scheduled');
      setFollowNotes('');
      await loadDetails();
      onUpdated();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to schedule follow-up');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto border-l border-slate-200 flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {lead?.name || 'Lead Details'}
            </h2>
            {lead && (
              <p className="text-xs text-slate-500 mt-0.5">
                {lead.company ? `${lead.company} · ` : ''}
                {lead.source} · {lead.phone}
                {lead.isSimulated ? ' · Simulated Demo Lead' : ''}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close lead details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !lead ? (
          <div className="p-6 space-y-4">
            <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-40 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {/* Status & Assignment Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Pipeline Status
                </label>
                <select
                  value={lead.status}
                  onChange={(e) =>
                    updateLeadField({ status: e.target.value as Lead['status'] })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Assigned Employee
                </label>
                <select
                  value={lead.assignedUserId || ''}
                  onChange={(e) =>
                    updateLeadField({ assignedUserId: e.target.value || null })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Unassigned</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lead Notes */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-700">Lead Context & Notes</p>
              <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">
                {lead.notes || 'No notes recorded yet.'}
              </p>
              {lead.email && (
                <p className="text-xs text-slate-500 mt-2 font-mono">{lead.email}</p>
              )}
            </div>

            {/* AI Reply Draft */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-semibold text-slate-900">AI Reply Assistant</h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleGenerateReply}
                    disabled={generatingReply}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {generatingReply ? 'Drafting...' : replyDraft ? 'Regenerate' : 'Generate Reply'}
                  </button>
                </div>
              </div>

              {replyDraft && (
                <div className="space-y-2.5">
                  <textarea
                    rows={3}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(replyDraft);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveReplyToTimeline}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Save to Timeline</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Follow-up */}
            <form onSubmit={handleScheduleFollowUp} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">Schedule Follow-up</h3>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <input
                  type="date"
                  value={followDate}
                  onChange={(e) => setFollowDate(e.target.value)}
                  required
                  className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="time"
                  value={followTime}
                  onChange={(e) => setFollowTime(e.target.value)}
                  required
                  className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <select
                  value={followType}
                  onChange={(e) =>
                    setFollowType(e.target.value as 'WhatsApp' | 'Call' | 'Email' | 'Meeting')
                  }
                  className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={followNotes}
                  onChange={(e) => setFollowNotes(e.target.value)}
                  placeholder="Follow-up note..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  Add Follow-up
                </button>
              </div>
            </form>

            {/* Activity Timeline */}
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                Activity Timeline ({activities.length})
              </h3>
              <div className="space-y-3 border-l border-slate-200 ml-2 pl-4">
                {activities.map((act) => (
                  <div key={act.id} className="relative pb-2">
                    <span className="w-2 h-2 rounded-full bg-sky-600 absolute -left-[21px] top-1.5" />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{act.title}</p>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {new Date(act.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{act.description}</p>
                    {act.userName && (
                      <p className="text-[11px] text-slate-400 mt-0.5">By {act.userName}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
