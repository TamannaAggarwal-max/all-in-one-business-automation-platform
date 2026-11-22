import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { user } = useAuth();
  const slug = user?.businessSlug || 'atelier-nord';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Settings & Architecture</h1>
        <p className="text-sm text-slate-600 mt-1">
          Workspace identity, role permissions, and integration transparency.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {user?.businessName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Storefront Slug: <span className="font-mono text-slate-800">/store/{slug}</span>
            </p>
          </div>
          <Link
            to={`/store/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 self-start"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Public Storefront</span>
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          <h2 className="font-display text-base font-semibold text-slate-900">
            Role-Based Access Matrix
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 pr-4">Role</th>
                <th className="py-2.5 px-4">Allowed Modules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              <tr>
                <td className="py-3 pr-4 font-semibold text-slate-900">ADMIN</td>
                <td className="py-3 px-4">
                  Full access: Dashboard, Leads, Customers, Follow-ups, Products, Automation, Brand Setup, Storefront, Analytics, AI Assistant, Team, Settings.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold text-slate-900">MANAGER</td>
                <td className="py-3 px-4">
                  Dashboard, Leads, Customers, Follow-ups, Products, Automation, Analytics, Storefront.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold text-slate-900">SALES_EMPLOYEE</td>
                <td className="py-3 px-4">Leads, Customers, Follow-ups, AI Assistant.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Real vs. Simulated Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-1.5">
            <p className="font-semibold text-emerald-800">Production / Real Implementations</p>
            <ul className="space-y-1 text-slate-700 list-disc pl-4">
              <li>PostgreSQL persistence via Drizzle ORM & Cloud SQL</li>
              <li>JWT + bcrypt & Google Sign-In authentication + backend RBAC</li>
              <li>Full CRM, Customers, Products, Follow-ups & Notifications CRUD</li>
              <li>Automation Engine executing actions in PostgreSQL</li>
              <li>Server-side Gemini AI replies, product copy, banners, insights & storefront chat</li>
              <li>Public Storefront reading live brand & catalog data</li>
            </ul>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-1.5">
            <p className="font-semibold text-sky-800">Demo / Simulated Channels</p>
            <ul className="space-y-1 text-slate-700 list-disc pl-4">
              <li>WhatsApp Business webhook lead capture (simulated trigger button)</li>
              <li>Inbound Telephony / Call lead capture (simulated trigger button)</li>
              <li>External Website embed capture (simulated trigger button; public Storefront form is real)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
