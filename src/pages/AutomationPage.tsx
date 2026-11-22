import React, { useEffect, useState } from 'react';
import { ArrowRight, Edit2, Pause, Play, Plus, Trash2, Workflow, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Automation, AutomationAction } from '../types';

const TRIGGERS: Array<{ value: Automation['triggerType']; label: string }> = [
  { value: 'NEW_LEAD', label: 'Any New Lead' },
  { value: 'WHATSAPP_LEAD', label: 'WhatsApp Lead Received' },
  { value: 'WEBSITE_LEAD', label: 'Website Form Lead Received' },
  { value: 'CALL_LEAD', label: 'Inbound Call Lead Logged' },
  { value: 'STATUS_CHANGED', label: 'Lead Status Changed' },
  { value: 'FOLLOWUP_DUE', label: 'Follow-up Due' },
  { value: 'INACTIVE_LEAD', label: 'Inactive Lead (48h+)' },
];

const ACTION_OPTIONS: Array<{ value: AutomationAction['actionType']; label: string }> = [
  { value: 'ASSIGN_EMPLOYEE', label: 'Assign Employee (Round-Robin)' },
  { value: 'SEND_AUTOREPLY', label: 'Send AI Auto-Reply' },
  { value: 'CREATE_FOLLOWUP', label: 'Schedule Follow-up Task' },
  { value: 'CHANGE_STATUS', label: 'Update Lead Status' },
  { value: 'CREATE_NOTIFICATION', label: 'Create Team Notification' },
];

export function AutomationPage() {
  const { showError, showSuccess } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<Automation['triggerType']>('WHATSAPP_LEAD');
  const [selectedActions, setSelectedActions] = useState<AutomationAction['actionType'][]>([
    'ASSIGN_EMPLOYEE',
    'SEND_AUTOREPLY',
    'CREATE_FOLLOWUP',
    'CREATE_NOTIFICATION',
  ]);

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ automations: Automation[] }>('/api/automations');
      setAutomations(res.automations);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAutomations();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setTriggerType('NEW_LEAD');
    setSelectedActions(['ASSIGN_EMPLOYEE', 'SEND_AUTOREPLY', 'CREATE_FOLLOWUP', 'CREATE_NOTIFICATION']);
    setShowModal(true);
  };

  const openEdit = (auto: Automation) => {
    setEditing(auto);
    setName(auto.name);
    setDescription(auto.description);
    setTriggerType(auto.triggerType);
    setSelectedActions(auto.actions.map((a) => a.actionType));
    setShowModal(true);
  };

  const toggleActionChoice = (type: AutomationAction['actionType']) => {
    setSelectedActions((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedActions.length === 0) {
      showError('Select at least one THEN action.');
      return;
    }

    const payload = {
      name,
      description,
      triggerType,
      status: editing ? editing.status : 'ACTIVE',
      actions: selectedActions.map((actionType) => ({
        actionType,
        config:
          actionType === 'SEND_AUTOREPLY'
            ? { tone: 'Friendly' }
            : actionType === 'CREATE_FOLLOWUP'
              ? { offsetDays: 1, type: 'WhatsApp' }
              : {},
      })),
    };

    try {
      if (editing) {
        await apiRequest(`/api/automations/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showSuccess(`Updated "${name}"`);
      } else {
        await apiRequest('/api/automations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showSuccess(`Created workflow "${name}"`);
      }
      setShowModal(false);
      await loadAutomations();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save automation');
    }
  };

  const toggleStatus = async (auto: Automation) => {
    const nextStatus = auto.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await apiRequest(`/api/automations/${auto.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      showSuccess(`${auto.name} is now ${nextStatus}`);
      await loadAutomations();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to toggle workflow');
    }
  };

  const handleDelete = async (auto: Automation) => {
    try {
      await apiRequest(`/api/automations/${auto.id}`, { method: 'DELETE' });
      showSuccess(`Deleted "${auto.name}"`);
      await loadAutomations();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  const triggerLabel = (t: string) => TRIGGERS.find((x) => x.value === t)?.label || t;
  const actionLabel = (a: string) => ACTION_OPTIONS.find((x) => x.value === a)?.label || a;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Automation Engine</h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure WHEN → THEN rules that execute automatically on incoming leads and status changes.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Create Automation</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
          No automation rules configured yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-sky-600" />
                      <h3 className="font-display text-base font-semibold text-slate-900">
                        {auto.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{auto.description}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border shrink-0 ${
                      auto.status === 'ACTIVE'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {auto.status}
                  </span>
                </div>

                {/* Visual WHEN -> THEN pipeline */}
                <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">WHEN</p>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5">
                      {triggerLabel(auto.triggerType)}
                    </p>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">THEN EXECUTE</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {auto.actions.map((act, idx) => (
                        <React.Fragment key={act.id || `${act.actionType}-${idx}`}>
                          <span className="text-xs font-medium bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-800">
                            {actionLabel(act.actionType)}
                          </span>
                          {idx < auto.actions.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-mono tabular-nums">
                  Runs: {auto.runCount} · Last Run:{' '}
                  {auto.lastRunAt ? new Date(auto.lastRunAt).toLocaleString() : 'Never'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(auto)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {auto.status === 'ACTIVE' ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Activate</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(auto)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                    aria-label={`Edit ${auto.name}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(auto)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    aria-label={`Delete ${auto.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit Automation Rule' : 'Create Automation Rule'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Workflow Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Instant WhatsApp Concierge"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this workflow automate?"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">WHEN Trigger</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as Automation['triggerType'])}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  THEN Actions (executed in order)
                </label>
                <div className="space-y-2">
                  {ACTION_OPTIONS.map((opt) => {
                    const checked = selectedActions.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer text-sm ${
                          checked ? 'border-sky-500 bg-sky-50/40' : 'border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleActionChoice(opt.value)}
                        />
                        <span className="font-medium text-slate-800">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
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
                  Save Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
