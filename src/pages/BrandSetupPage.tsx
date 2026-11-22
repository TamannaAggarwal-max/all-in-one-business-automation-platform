import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, ExternalLink, RefreshCw, Save } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { BrandSettings } from '../types';

export function BrandSetupPage() {
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('atelier-nord');

  const [form, setForm] = useState({
    businessName: '',
    tagline: '',
    logoUrl: '',
    primaryColor: '#0F172A',
    secondaryColor: '#0284C7',
    description: '',
    category: 'Lifestyle & Home',
    bannerHeadline: '',
    bannerSubheadline: '',
    bannerCta: 'Shop Now',
  });

  const [campaignInput, setCampaignInput] = useState({
    campaign: 'Winter Craft Collection',
    offer: 'Free studio shipping on orders above ₹1,500',
    targetAudience: 'Design-conscious home & gift shoppers',
  });
  const [generatingBanner, setGeneratingBanner] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<{ brand: BrandSettings; businessSlug: string }>('/api/brand');
        setSlug(res.businessSlug);
        if (res.brand) {
          setForm({
            businessName: res.brand.businessName,
            tagline: res.brand.tagline,
            logoUrl: res.brand.logoUrl || '',
            primaryColor: res.brand.primaryColor,
            secondaryColor: res.brand.secondaryColor,
            description: res.brand.description,
            category: res.brand.category,
            bannerHeadline: res.brand.bannerHeadline,
            bannerSubheadline: res.brand.bannerSubheadline,
            bannerCta: res.brand.bannerCta,
          });
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to load brand settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleGenerateBanner = async () => {
    setGeneratingBanner(true);
    try {
      const res = await apiRequest<{
        headline: string;
        subheadline: string;
        cta: string;
        isDemoFallback: boolean;
      }>('/api/ai/banner-copy', {
        method: 'POST',
        body: JSON.stringify(campaignInput),
      });
      setForm((prev) => ({
        ...prev,
        bannerHeadline: res.headline,
        bannerSubheadline: res.subheadline,
        bannerCta: res.cta,
      }));
      showSuccess(
        res.isDemoFallback
          ? 'Generated banner copy (Demo Fallback)'
          : 'Generated banner copy with Gemini AI'
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate banner copy');
    } finally {
      setGeneratingBanner(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/brand', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      showSuccess('Brand settings saved and synced to your public storefront');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save brand settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Brand Setup</h1>
          <p className="text-sm text-slate-600 mt-1">
            Customize your brand identity, colors, and AI-crafted storefront banner in real time.
          </p>
        </div>
        <Link
          to={`/store/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 whitespace-nowrap self-start"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Open Live Storefront</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <h2 className="font-display text-base font-semibold text-slate-900">Brand Identity</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Business Name
              </label>
              <input
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <input
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tagline</label>
            <input
              required
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Primary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="flex-1 px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Secondary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                  className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  value={form.secondaryColor}
                  onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                  className="flex-1 px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Logo URL (optional)
              </label>
              <input
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Business Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {/* AI Banner Generator */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-semibold text-slate-900">AI Banner Copy Generator</h3>
              </div>
              <button
                type="button"
                onClick={handleGenerateBanner}
                disabled={generatingBanner}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generatingBanner ? 'animate-spin' : ''}`} />
                <span>{generatingBanner ? 'Generating...' : 'Generate Banner Copy'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={campaignInput.campaign}
                onChange={(e) =>
                  setCampaignInput({ ...campaignInput, campaign: e.target.value })
                }
                placeholder="Campaign name"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <input
                value={campaignInput.offer}
                onChange={(e) => setCampaignInput({ ...campaignInput, offer: e.target.value })}
                placeholder="Offer / promo"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <input
                value={campaignInput.targetAudience}
                onChange={(e) =>
                  setCampaignInput({ ...campaignInput, targetAudience: e.target.value })
                }
                placeholder="Target audience"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Banner Headline
                </label>
                <input
                  required
                  value={form.bannerHeadline}
                  onChange={(e) => setForm({ ...form, bannerHeadline: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  CTA Label
                </label>
                <input
                  required
                  value={form.bannerCta}
                  onChange={(e) => setForm({ ...form, bannerCta: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Banner Subheadline
              </label>
              <input
                required
                value={form.bannerSubheadline}
                onChange={(e) => setForm({ ...form, bannerSubheadline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Brand Settings'}</span>
            </button>
          </div>
        </form>

        {/* Real-Time Storefront Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500">LIVE STOREFRONT PREVIEW</p>

            {/* Header Bar Preview */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt={form.businessName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded object-cover"
                    />
                  ) : (
                    <div
                      className="w-7 h-7 rounded text-white text-xs font-bold flex items-center justify-center"
                      style={{ backgroundColor: form.primaryColor }}
                    >
                      {(form.businessName || 'B').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="font-display font-bold text-sm text-slate-900">
                    {form.businessName || 'Business Name'}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{form.category}</span>
              </div>

              {/* Hero Banner Preview */}
              <div
                className="p-6 text-white space-y-3"
                style={{
                  background: `linear-gradient(135deg, ${form.primaryColor} 0%, ${form.secondaryColor} 100%)`,
                }}
              >
                <p className="text-xs text-white/80">{form.tagline}</p>
                <h3 className="font-display text-xl font-bold leading-snug text-balance">
                  {form.bannerHeadline || 'Your Campaign Headline'}
                </h3>
                <p className="text-xs text-white/90 leading-relaxed">
                  {form.bannerSubheadline || 'Subheadline appears here.'}
                </p>
                <div className="pt-1">
                  <span className="inline-block px-4 py-2 rounded-lg bg-white text-slate-900 text-xs font-semibold">
                    {form.bannerCta || 'Shop Now'}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Every change here updates <span className="font-mono text-slate-700">/store/{slug}</span> immediately after saving.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
