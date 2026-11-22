import React, { useEffect, useState } from 'react';
import { MessageSquarePlus, Search } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Customer } from '../types';

export function CustomersPage() {
  const { showError, showSuccess } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const res = await apiRequest<{ customers: Customer[] }>(
        `/api/customers?${params.toString()}`
      );
      setCustomers(res.customers);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadCustomers, 150);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  const toggleStatus = async (c: Customer) => {
    const nextStatus = c.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiRequest(`/api/customers/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      showSuccess(`${c.name} marked as ${nextStatus}`);
      await loadCustomers();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update customer');
    }
  };

  const logInteraction = async (c: Customer) => {
    try {
      await apiRequest(`/api/customers/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ logInteraction: true }),
      });
      showSuccess(`Logged interaction with ${c.name}`);
      await loadCustomers();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to log interaction');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Customers</h1>
        <p className="text-sm text-slate-600 mt-1">
          Automatically created whenever a lead converts, with interaction tracking.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-600"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="All">Status: All</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Customer & Company</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Last Interaction</th>
                <th className="py-3 px-4 text-right">Interactions</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
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
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-slate-500">
                    No customers yet. Mark any lead as Converted to create a customer automatically.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.company || 'Direct Buyer'}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-mono text-xs text-slate-800 tabular-nums">{c.phone}</p>
                      <p className="text-xs text-slate-500">{c.email || '—'}</p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">{c.source}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600 tabular-nums">
                      {new Date(c.lastInteractionAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {c.totalInteractions}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => toggleStatus(c)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                          c.status === 'Active'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {c.status}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => logInteraction(c)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        <span>Log Touchpoint</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
