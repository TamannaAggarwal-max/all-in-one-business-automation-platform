import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Bot,
  CalendarClock,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { AnalyticsData, BusinessInsight } from '../types';

const CHART_COLORS = ['#0F172A', '#0284C7', '#38BDF8', '#64748B', '#16A34A'];

export function DashboardPage() {
  const { user } = useAuth();
  const { showError } = useToast();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [insightsFallback, setInsightsFallback] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AnalyticsData>('/api/analytics');
      setData(res);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
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
      showError(err instanceof Error ? err.message : 'Failed to generate AI insights');
    } finally {
      setLoadingInsights(false);
    }
  };

  const canViewInsights = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    loadDashboard();
    if (canViewInsights) {
      loadInsights();
    }
  }, [canViewInsights]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const summary = data.summary ?? {
    totalLeads: 0,
    newLeads: 0,
    followUpsDue: 0,
    convertedLeads: 0,
    totalCustomers: 0,
    totalProducts: 0,
    conversionRate: 0,
    followUpCompletionRate: 0,
    completedFollowUps: 0,
    overdueFollowUps: 0,
  };
  const funnel = Array.isArray(data.funnel) ? data.funnel : [];
  const leadSources = Array.isArray(data.leadSources) ? data.leadSources : [];
  const weeklyTrend = Array.isArray(data.weeklyTrend) ? data.weeklyTrend : [];
  const followUpBreakdown = Array.isArray(data.followUpBreakdown) ? data.followUpBreakdown : [];

  const kpis = [
    { label: 'Total Leads', value: summary.totalLeads, to: '/leads' },
    { label: 'New Leads', value: summary.newLeads, to: '/leads' },
    { label: 'Follow-ups Due', value: summary.followUpsDue, to: '/follow-ups' },
    { label: 'Converted Leads', value: summary.convertedLeads, to: '/leads' },
    { label: 'Customers', value: summary.totalCustomers, to: '/customers' },
    { label: 'Products', value: summary.totalProducts, to: '/products' },
    { label: 'Conversion Rate', value: `${summary.conversionRate}%`, to: '/analytics' },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            {data.businessName} Overview
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Signed in as {user?.fullName} · Live operational metrics from PostgreSQL
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/leads"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Users className="w-4 h-4" />
            <span>Capture / Manage Leads</span>
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            to={kpi.to}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-300 transition-colors"
          >
            <p className="text-xs font-medium text-slate-500 truncate">{kpi.label}</p>
            <p className="font-display text-2xl font-bold text-slate-900 mt-2 tabular-nums">
              {kpi.value}
            </p>
          </Link>
        ))}
      </div>

      {/* AI Business Insights */}
      {canViewInsights && (
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                AI Business Insights
              </h2>
              <p className="text-xs text-slate-500">
                Generated from your live pipeline, follow-ups, and inventory metrics
                {insightsFallback ? ' (Demo Fallback — configure GEMINI_API_KEY for live Gemini)' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={loadInsights}
            disabled={loadingInsights}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
            <span>{loadingInsights ? 'Analyzing...' : 'Refresh Insights'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5">
          {loadingInsights && (!insights || insights.length === 0) ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-50 rounded-lg animate-pulse" />
            ))
          ) : !insights || insights.length === 0 ? (
            <div className="md:col-span-3 rounded-lg bg-slate-50 border border-slate-200/80 p-4 text-xs text-slate-600">
              No insights generated yet. Click <span className="font-semibold">Refresh Insights</span> to analyze your live pipeline.
            </div>
          ) : (
            insights.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg bg-slate-50 border border-slate-200/80 p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-medium text-sky-700">{item.category}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{item.insight}</p>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{item.why}</p>
                </div>
                <p className="text-xs font-medium text-slate-800 pt-2 border-t border-slate-200/70">
                  Next: {item.action}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
      )}

      {/* Primary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Conversion Funnel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Lead Conversion Funnel
              </h3>
              <p className="text-xs text-slate-500">Current distribution across pipeline stages</p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip />
                <Bar dataKey="count" name="Leads" fill="#0F172A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Sources */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Lead Sources
              </h3>
              <p className="text-xs text-slate-500">Acquisition channel volume & conversions</p>
            </div>
            <UserCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={leadSources}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis
                  dataKey="source"
                  type="category"
                  width={95}
                  tick={{ fontSize: 12, fill: '#475569' }}
                />
                <Tooltip />
                <Bar dataKey="count" name="Total Leads" fill="#0284C7" radius={[0, 4, 4, 0]} />
                <Bar dataKey="converted" name="Converted" fill="#0F172A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Leads & Conversions */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Weekly Leads & Conversions
              </h3>
              <p className="text-xs text-slate-500">Last 7 days inbound activity</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="leads"
                  name="New Leads"
                  stroke="#0284C7"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="conversions"
                  name="Conversions"
                  stroke="#0F172A"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Follow-up Completion */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Follow-up Completion
              </h3>
              <p className="text-xs text-slate-500">
                {summary.followUpCompletionRate}% completion rate across scheduled tasks
              </p>
            </div>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-64 flex flex-col sm:flex-row items-center">
            <div className="w-full sm:w-2/3 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={followUpBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {followUpBreakdown.map((entry, idx) => (
                      <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/3 space-y-2.5 text-sm">
              {followUpBreakdown.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    {item.name}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {item.value}
                  </span>
                </div>
              ))}
              <Link
                to="/follow-ups"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 pt-2"
              >
                <span>Open Follow-ups</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
