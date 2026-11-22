import React, { useEffect, useState } from 'react';
import { Bot, Check, Copy, RefreshCw, Send } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Lead } from '../types';

const TONES = ['Friendly', 'Professional', 'Short', 'Sales-focused'] as const;

export function AiAssistantPage() {
  const { showError, showSuccess } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [customerMessage, setCustomerMessage] = useState(
    'Hi! Can you share pricing and bulk delivery timelines for 25 Everyday Totes?'
  );
  const [businessContext, setBusinessContext] = useState(
    'Atelier Nord sells handcrafted lifestyle goods. Bulk orders above 20 units qualify for 10% studio discount and 5-day dispatch.'
  );
  const [tone, setTone] = useState<(typeof TONES)[number]>('Friendly');

  const [generatedReply, setGeneratedReply] = useState('');
  const [isFallback, setIsFallback] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<{ leads: Lead[] }>('/api/leads');
        setLeads(res.leads);
        if (res.leads[0]) {
          setSelectedLeadId(res.leads[0].id);
          if (res.leads[0].notes) setCustomerMessage(res.leads[0].notes);
        }
      } catch {
        // Ignore if unavailable
      }
    })();
  }, []);

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const handleSelectLead = (id: string) => {
    setSelectedLeadId(id);
    const found = leads.find((l) => l.id === id);
    if (found?.notes) setCustomerMessage(found.notes);
  };

  const handleGenerate = async () => {
    if (!customerMessage.trim()) {
      showError('Enter a customer message first');
      return;
    }
    setGenerating(true);
    try {
      const res = await apiRequest<{ reply: string; isDemoFallback: boolean }>(
        '/api/ai/generate-reply',
        {
          method: 'POST',
          body: JSON.stringify({
            customerMessage,
            businessContext,
            leadName: selectedLead?.name || '',
            tone,
          }),
        }
      );
      setGeneratedReply(res.reply);
      setIsFallback(res.isDemoFallback);
      showSuccess(
        res.isDemoFallback ? 'Generated reply (Demo Fallback)' : 'Generated reply with Gemini AI'
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate reply');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToLead = async () => {
    if (!selectedLeadId || !generatedReply.trim()) return;
    setSaving(true);
    try {
      await apiRequest(`/api/leads/${selectedLeadId}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'AUTO_REPLY_SENT',
          title: `AI Assistant Reply (${tone})`,
          description: generatedReply,
        }),
      });
      showSuccess(`Saved reply to ${selectedLead?.name}'s activity timeline`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save reply');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">AI Assistant</h1>
        <p className="text-sm text-slate-600 mt-1">
          Draft, refine, copy, and log customer responses powered by server-side Gemini AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Select Lead (optional)
            </label>
            <select
              value={selectedLeadId}
              onChange={(e) => handleSelectLead(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Custom inquiry (not linked to a lead)</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.company ? `(${l.company})` : ''} · {l.source}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Customer Message / Inquiry
            </label>
            <textarea
              rows={4}
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Business Context / Offer Notes
            </label>
            <textarea
              rows={2}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Response Tone</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    tone === t
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            <Bot className="w-4 h-4" />
            <span>{generating ? 'Generating with Gemini...' : 'Generate Reply'}</span>
          </button>
        </div>

        {/* Editable Output */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Drafted Response
              </h2>
              {generatedReply && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  <span>Regenerate</span>
                </button>
              )}
            </div>

            {isFallback && generatedReply && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Demo Fallback mode: GEMINI_API_KEY is not configured on the server.
              </p>
            )}

            <textarea
              rows={9}
              value={generatedReply}
              onChange={(e) => setGeneratedReply(e.target.value)}
              placeholder="Click Generate Reply to draft an editable customer response..."
              className="w-full p-3.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={!generatedReply}
              onClick={() => {
                navigator.clipboard.writeText(generatedReply);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              disabled={!generatedReply || !selectedLeadId || saving}
              onClick={handleSaveToLead}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save to Lead Timeline'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
