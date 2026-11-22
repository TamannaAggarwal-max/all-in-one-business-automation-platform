import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Bot, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { AnalyticsData, BusinessInsight } from '../types';

export function AnalyticsPage() {
  const { showError } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [insightsFallback, setInsightsFallback] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AnalyticsData>('/api/analytics');
      setData(res);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await apiRequest<{ insights?: BusinessInsight[]; isDemoFallback?: boolean }>(
        '/api/ai/business-insights',
        { method: 'POST' }
      );
      setInsights(Array.isArray(res?.insights) ? res.insights : []);
      setInsightsFallback(Boolean(res?.isDemoFallback));
    } catch (err) {
      setInsights([]);
      showError(err instanceof Error ? err.message : 'Failed to generate AI recommendations');
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    generateInsights();
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const summary = data.summary ?? {
    conversionRate: 0,
    convertedLeads: 0,
    totalLeads: 0,
    followUpCompletionRate: 0,
    completedFollowUps: 0,
    overdueFollowUps: 0,
    totalProducts: 0,
  };
  const leadSources = Array.isArray(data.leadSources) ? data.leadSources : [];
  const monthlyTrend = Array.isArray(data.monthlyTrend) ? data.monthlyTrend : [];
  const productPerformance = Array.isArray(data.productPerformance) ? data.productPerformance : [];
  const employeePerformance = Array.isArray(data.employeePerformance) ? data.employeePerformance : [];
  const bestSource = leadSources[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Analytics & AI Insights</h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time funnel, source attribution, catalog inventory value, and team conversion metrics.
          </p>
        </div>
        <button
          onClick={() => {
            loadAnalytics();
            generateInsights();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Top Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Lead Conversion Rate</p>
          <p className="font-display text-3xl font-bold text-slate-900 mt-2 tabular-nums">
            {summary.conversionRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {summary.convertedLeads} of {summary.totalLeads} leads converted
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Best Lead Source</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-2 truncate">
            {bestSource?.source || '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {bestSource ? `${bestSource.count} leads · ${bestSource.converted} converted` : 'No data'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Follow-up Completion</p>
          <p className="font-display text-3xl font-bold text-slate-900 mt-2 tabular-nums">
            {summary.followUpCompletionRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {summary.completedFollowUps} completed · {summary.overdueFollowUps} overdue
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Catalog Stock Value</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            ₹
            {productPerformance
              .reduce((sum, p) => sum + p.inventoryValue, 0)
              .toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Across {summary.totalProducts} products
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-900 mb-1">
            Monthly Lead & Conversion Trend
          </h2>
          <p className="text-xs text-slate-500 mb-4">4-week rolling breakdown</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip />
                <Line type="monotone" dataKey="leads" name="Leads" stroke="#0284C7" strokeWidth={2.5} />
                <Line
                  type="monotone"
                  dataKey="conversions"
                  name="Conversions"
                  stroke="#0F172A"
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-900 mb-1">
            Product Inventory Value (₹)
          </h2>
          <p className="text-xs text-slate-500 mb-4">Stock valuation across active SKUs</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Bar dataKey="inventoryValue" name="Value (₹)" fill="#0F172A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Employee Performance Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Team Performance
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Team Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Leads Assigned</th>
                <th className="py-3 px-4 text-right">Contacted</th>
                <th className="py-3 px-4 text-right">Conversions</th>
                <th className="py-3 px-4 text-right">Pending Follow-ups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {employeePerformance.map((emp) => (
                <tr key={emp.id}>
                  <td className="py-3 px-4 font-medium text-slate-900">{emp.fullName}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {emp.role.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {emp.leadsAssigned}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {emp.leadsContacted}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                    {emp.conversions}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {emp.pendingFollowUps}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Business Insights */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-sky-600" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Gemini AI Business Recommendations
              </h2>
              <p className="text-xs text-slate-500">
                {insightsFallback
                  ? 'Demo Fallback active (configure GEMINI_API_KEY for live Gemini)'
                  : 'Generated from aggregated non-PII metrics'}
              </p>
            </div>
          </div>
          <button
            onClick={generateInsights}
            disabled={loadingInsights}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {loadingInsights ? 'Analyzing...' : 'Regenerate'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loadingInsights && (!insights || insights.length === 0) ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-slate-50 rounded-lg animate-pulse" />
            ))
          ) : !insights || insights.length === 0 ? (
            <div className="md:col-span-3 rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
              No recommendations generated yet. Click Regenerate to analyze your latest metrics.
            </div>
          ) : (
            insights.map((ins, i) => (
              <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-sky-700">{ins.category}</p>
                <p className="text-sm font-semibold text-slate-900">{ins.insight}</p>
                <p className="text-xs text-slate-600">Why: {ins.why}</p>
                <p className="text-xs font-medium text-slate-900 pt-1 border-t border-slate-200">
                  Action: {ins.action}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
