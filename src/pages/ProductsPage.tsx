import React, { useEffect, useState } from 'react';
import { Bot, Edit2, Package, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Product } from '../types';

const CATEGORIES = [
  'Apparel',
  'Accessories',
  'Home & Living',
  'Beauty',
  'Stationery',
  'Other',
] as const;

const STATUSES = ['Published', 'Draft', 'Out of Stock'] as const;

export function ProductImage({
  src,
  alt,
  className = 'w-full h-44 object-cover',
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`bg-slate-100 flex flex-col items-center justify-center text-slate-400 ${className}`}
      >
        <Package className="w-7 h-7 mb-1.5" />
        <span className="text-xs font-medium text-slate-500 px-3 text-center truncate max-w-full">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function ProductsPage() {
  const { showError, showSuccess } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [aiFeatures, setAiFeatures] = useState('');
  const [aiAudience, setAiAudience] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: 'Accessories' as Product['category'],
    price: 999,
    stock: 20,
    sku: '',
    status: 'Published' as Product['status'],
    imageUrl: '',
    shortDescription: '',
    description: '',
    highlightsText: '',
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const res = await apiRequest<{ products: Product[] }>(`/api/products?${params.toString()}`);
      setProducts(res.products);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadProducts, 150);
    return () => clearTimeout(t);
  }, [search, categoryFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setAiFeatures('');
    setAiAudience('');
    setForm({
      name: '',
      category: 'Accessories',
      price: 1299,
      stock: 25,
      sku: `BP-${Math.floor(100 + Math.random() * 900)}`,
      status: 'Published',
      imageUrl: '',
      shortDescription: '',
      description: '',
      highlightsText: '',
    });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setAiFeatures('');
    setAiAudience('');
    setForm({
      name: p.name,
      category: p.category,
      price: p.price,
      stock: p.stock,
      sku: p.sku,
      status: p.status,
      imageUrl: p.imageUrl,
      shortDescription: p.shortDescription,
      description: p.description,
      highlightsText: (p.highlights || []).join('\n'),
    });
    setShowModal(true);
  };

  const handleGenerateWithAi = async () => {
    if (!form.name.trim()) {
      showError('Enter a Product Name first so Gemini can write copy.');
      return;
    }
    setGeneratingAi(true);
    try {
      const res = await apiRequest<{
        shortDescription: string;
        fullDescription: string;
        highlights: string[];
        isDemoFallback: boolean;
      }>('/api/ai/product-description', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          features: aiFeatures,
          targetAudience: aiAudience,
        }),
      });
      setForm((prev) => ({
        ...prev,
        shortDescription: res.shortDescription,
        description: res.fullDescription,
        highlightsText: res.highlights.join('\n'),
      }));
      showSuccess(
        res.isDemoFallback
          ? 'Generated product copy (Demo Fallback)'
          : 'Generated product copy with Gemini AI'
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      sku: form.sku,
      status: form.status,
      imageUrl: form.imageUrl,
      shortDescription: form.shortDescription,
      description: form.description,
      highlights: form.highlightsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (editing) {
        await apiRequest(`/api/products/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showSuccess(`Updated "${form.name}"`);
      } else {
        await apiRequest('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showSuccess(`Added "${form.name}" to catalog`);
      }
      setShowModal(false);
      await loadProducts();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save product');
    }
  };

  const togglePublish = async (p: Product) => {
    const nextStatus = p.status === 'Published' ? 'Draft' : 'Published';
    try {
      await apiRequest(`/api/products/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      showSuccess(`${p.name} is now ${nextStatus}`);
      await loadProducts();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async (p: Product) => {
    try {
      await apiRequest(`/api/products/${p.id}`, { method: 'DELETE' });
      showSuccess(`Deleted "${p.name}"`);
      await loadProducts();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage inventory, pricing, storefront visibility, and AI-generated descriptions.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-600"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="All">Category: All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="All">Status: All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
          No products found. Add your first product to publish it to your Storefront.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                <ProductImage src={p.imageUrl} alt={p.name} className="w-full h-44 object-cover" />
                <div className="p-4 space-y-2">
                  <p className="text-xs text-slate-500">
                    {p.category} · <span className="font-mono">{p.sku}</span>
                  </p>
                  <h3 className="font-display text-base font-semibold text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {p.shortDescription || p.description || 'No description added yet.'}
                  </p>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                      ₹{p.price.toLocaleString('en-IN')}
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        p.stock <= 8 ? 'text-amber-700 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      {p.stock} in stock
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => togglePublish(p)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                    p.status === 'Published'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : p.status === 'Out of Stock'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {p.status}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    aria-label={`Delete ${p.name}`}
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
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? `Edit ${editing.name}` : 'Add New Product'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Product Name
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Linen Travel Organizer"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as Product['category'] })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Stock</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">SKU</label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as Product['status'] })
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
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Image Path / URL (optional)
                </label>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="/src/assets/images/... or https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* AI Product Description Assistant */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-semibold text-slate-900">
                      Gemini Product Copywriter
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateWithAi}
                    disabled={generatingAi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 disabled:opacity-50 self-start sm:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generatingAi ? 'animate-spin' : ''}`} />
                    <span>{generatingAi ? 'Generating...' : 'Generate with AI'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={aiFeatures}
                    onChange={(e) => setAiFeatures(e.target.value)}
                    placeholder="Key features (e.g. waterproof canvas, brass zip)"
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    value={aiAudience}
                    onChange={(e) => setAiAudience(e.target.value)}
                    placeholder="Target audience (e.g. remote creatives, travelers)"
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Short Description
                </label>
                <input
                  value={form.shortDescription}
                  onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Marketing Highlights (one per line)
                </label>
                <textarea
                  rows={3}
                  value={form.highlightsText}
                  onChange={(e) => setForm({ ...form, highlightsText: e.target.value })}
                  placeholder="100% organic cotton&#10;Handcrafted brass hardware"
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
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
