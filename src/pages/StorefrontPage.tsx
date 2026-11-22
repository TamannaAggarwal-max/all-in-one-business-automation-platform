import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bot,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { ProductImage } from './ProductsPage';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { BrandSettings, Product } from '../types';

interface StorefrontResponse {
  business: {
    name: string;
    slug: string;
    category: string;
  };
  brand: BrandSettings;
  products: Product[];
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export function StorefrontPage() {
  const { businessSlug = 'atelier-nord' } = useParams();
  const { showError, showSuccess } = useToast();

  const [store, setStore] = useState<StorefrontResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderRef, setOrderRef] = useState<string | null>(null);

  // Floating AI Customer Assistant
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hello! Ask me about our products, prices, categories, or current stock availability.',
    },
  ]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await apiRequest<StorefrontResponse>(`/api/store/${businessSlug}`, {
          skipAuth: true,
        });
        setStore(res);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [businessSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8 space-y-8 max-w-6xl mx-auto">
        <div className="h-14 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-80 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Storefront not found</h1>
        <p className="text-sm text-slate-600 mt-2">
          We couldn't find a business storefront at "{businessSlug}".
        </p>
        <Link
          to="/login"
          className="mt-5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium"
        >
          Back to BizPilot
        </Link>
      </div>
    );
  }

  const { brand, products } = store;
  const primaryColor = brand?.primaryColor || '#0F172A';
  const secondaryColor = brand?.secondaryColor || '#0284C7';

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];
  const filteredProducts = products.filter((p) => {
    const matchCat = category === 'All' || p.category === category;
    const matchSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.shortDescription.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addToCart = (product: Product) => {
    if (product.stock <= 0 || product.status === 'Out of Stock') return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(product.stock, i.quantity + 1) }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    showSuccess(`Added ${product.name} to bag`);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, Math.min(item.product.stock, item.quantity + delta)) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const handleSubmitOrderInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOrder(true);
    try {
      const itemsSummary = cart
        .map((i) => `${i.quantity}x ${i.product.name} (₹${i.product.price})`)
        .join(', ');
      const fullNotes = `Storefront Bag Request [Total ₹${cartTotal.toLocaleString('en-IN')}]: ${itemsSummary}${
        inquiryForm.notes ? ` | Note: ${inquiryForm.notes}` : ''
      }`;
      const res = await apiRequest<{ message: string; referenceId: string }>(
        `/api/store/${businessSlug}/inquire`,
        {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify({
            name: inquiryForm.name,
            phone: inquiryForm.phone,
            email: inquiryForm.email,
            notes: fullNotes,
          }),
        }
      );
      setOrderRef(res.referenceId);
      setCart([]);
      setInquiryForm({ name: '', phone: '', email: '', notes: '' });
      showSuccess('Order inquiry submitted');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to submit inquiry');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const sendChat = async (questionOverride?: string) => {
    const q = (questionOverride ?? chatInput).trim();
    if (!q || chatLoading) return;
    const nextHistory: ChatMessage[] = [...messages, { role: 'user', text: q }];
    setMessages(nextHistory);
    if (!questionOverride) setChatInput('');
    setChatLoading(true);
    try {
      const res = await apiRequest<{ reply: string; isDemoFallback: boolean }>('/api/ai/chat', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          businessSlug,
          message: q,
          history: nextHistory.slice(-6),
        }),
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            err instanceof Error
              ? `Sorry, I couldn't reach the store assistant: ${err.message}`
              : 'Sorry, something went wrong.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Bar Contract: Brand wordmark — Category links — 1 primary Bag action */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#catalog"
            className="flex items-center gap-2.5 font-display font-bold text-lg tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            {brand?.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.businessName}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded object-cover"
              />
            ) : (
              <span
                className="w-7 h-7 rounded text-white text-xs font-bold flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                {(brand?.businessName || store.business.name).slice(0, 2).toUpperCase()}
              </span>
            )}
            <span>{brand?.businessName || store.business.name}</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                  category === cat ? 'text-slate-900 underline underline-offset-4' : ''
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setOrderRef(null);
                setCartOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-medium whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Bag</span>
              <span className="font-mono tabular-nums">({cartCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Split Hero Section */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-8 pb-12">
        <div
          className="rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch border border-slate-200"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
          }}
        >
          <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center text-white space-y-5">
            <p className="text-xs font-medium text-white/80">
              {brand?.tagline || store.business.category}
            </p>
            <h1 className="font-editorial text-3xl sm:text-5xl font-semibold leading-tight text-balance">
              {brand?.bannerHeadline || 'Discover Our Curated Collection'}
            </h1>
            <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-lg">
              {brand?.bannerSubheadline ||
                'Thoughtfully designed everyday essentials crafted for lasting utility.'}
            </p>
            <div className="pt-2">
              <a
                href="#catalog"
                className="inline-flex items-center px-5 py-3 rounded-lg bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-colors"
              >
                {brand?.bannerCta || 'Explore Collection'}
              </a>
            </div>
          </div>

          <div className="lg:col-span-6 min-h-[260px] lg:min-h-[420px]">
            <img
              src="/src/assets/images/storefront_hero_lifestyle_1795285137897.jpg"
              alt={brand?.businessName || store.business.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Featured Catalog */}
      <section id="catalog" className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Product Catalog</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Live inventory and pricing from {brand?.businessName || store.business.name}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    category === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No products match your search or selected category.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 pt-8">
            {filteredProducts.map((product) => {
              const outOfStock = product.stock <= 0 || product.status === 'Out of Stock';
              return (
                <article
                  key={product.id}
                  className="group border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="w-full text-left block overflow-hidden bg-slate-50"
                    >
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full aspect-[4/3] object-cover"
                      />
                    </button>
                    <div className="p-5 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{product.category}</span>
                        <span className="font-mono tabular-nums">
                          {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="font-display text-lg font-semibold text-slate-900 hover:underline text-left block"
                      >
                        {product.name}
                      </button>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {product.shortDescription || product.description}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                      ₹{product.price.toLocaleString('en-IN')}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => addToCart(product)}
                        className="px-3.5 py-2 text-xs font-medium rounded-lg text-white disabled:opacity-40 whitespace-nowrap"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {outOfStock ? 'Sold Out' : 'Add to Bag'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* About & Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <p className="font-display font-bold text-slate-900">
              {brand?.businessName || store.business.name}
            </p>
            <p className="text-sm text-slate-600 mt-1">{brand?.description}</p>
          </div>
          <Link
            to="/login"
            className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
          >
            Business Owner Login →
          </Link>
        </div>
      </footer>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
            <ProductImage
              src={selectedProduct.imageUrl}
              alt={selectedProduct.name}
              className="w-full h-72 md:h-full object-cover"
            />
            <div className="p-6 flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      {selectedProduct.category} · {selectedProduct.sku}
                    </p>
                    <h3 className="font-display text-2xl font-bold text-slate-900 mt-1">
                      {selectedProduct.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="font-mono text-2xl font-bold text-slate-900 mt-3 tabular-nums">
                  ₹{selectedProduct.price.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-slate-600 mt-1 tabular-nums">
                  {selectedProduct.stock > 0
                    ? `${selectedProduct.stock} units available`
                    : 'Currently out of stock'}
                </p>

                <p className="text-sm text-slate-700 mt-4 leading-relaxed">
                  {selectedProduct.description || selectedProduct.shortDescription}
                </p>

                {selectedProduct.highlights && selectedProduct.highlights.length > 0 && (
                  <ul className="mt-4 space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                    {selectedProduct.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                disabled={selectedProduct.stock <= 0}
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: primaryColor }}
              >
                {selectedProduct.stock <= 0 ? 'Out of Stock' : 'Add to Bag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart & Inquiry Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
          <div className="w-full max-w-md bg-white h-full overflow-y-auto p-6 flex flex-col justify-between border-l border-slate-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h2 className="font-display text-lg font-bold text-slate-900">Your Bag</h2>
                <button
                  onClick={() => setCartOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {orderRef ? (
                <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-5 space-y-2">
                  <p className="text-sm font-bold text-emerald-900">
                    Inquiry #{orderRef} Confirmed
                  </p>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Your order inquiry has been captured directly in {brand?.businessName}'s CRM. A team member will reach out shortly.
                  </p>
                </div>
              ) : cart.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">Your bag is empty.</p>
              ) : (
                <div className="mt-4 divide-y divide-slate-100">
                  {cart.map((item) => (
                    <div key={item.product.id} className="py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {item.product.name}
                        </p>
                        <p className="text-xs font-mono text-slate-600 tabular-nums">
                          ₹{item.product.price.toLocaleString('en-IN')} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQty(item.product.id, -1)}
                          className="p-1 border border-slate-200 rounded"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono tabular-nums w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.product.id, 1)}
                          className="p-1 border border-slate-200 rounded"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updateQty(item.product.id, -item.quantity)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && !orderRef && (
              <form onSubmit={handleSubmitOrderInquiry} className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">
                    ₹{cartTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  required
                  value={inquiryForm.name}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                  placeholder="Your Full Name"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  required
                  value={inquiryForm.phone}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                  placeholder="Phone / WhatsApp Number"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="email"
                  value={inquiryForm.email}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                  placeholder="Email (optional)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  value={inquiryForm.notes}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, notes: e.target.value })}
                  placeholder="Delivery city or notes (optional)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submittingOrder ? 'Submitting...' : 'Submit Order Inquiry'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Floating AI Customer Assistant Chatbot */}
      <div className="fixed bottom-5 right-5 z-40">
        {chatOpen ? (
          <div className="w-[340px] sm:w-[380px] h-[480px] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div
              className="px-4 py-3.5 text-white flex items-center justify-between"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <div>
                  <p className="text-sm font-semibold leading-tight">
                    {brand?.businessName || store.business.name} Assistant
                  </p>
                  <p className="text-[11px] text-white/80">Live catalog answers</p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 text-white/80 hover:text-white"
                aria-label="Close assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                    style={m.role === 'user' ? { backgroundColor: primaryColor } : undefined}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-slate-500">Checking live catalog...</div>
              )}
            </div>

            {/* Quick Suggestion Prompts */}
            <div className="px-3 py-2 border-t border-slate-100 bg-white flex gap-1.5 overflow-x-auto">
              {['Which products are under ₹1500?', 'Do you have accessories?'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendChat(q)}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap shrink-0"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
              className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about prices, stock, gifting..."
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-2 rounded-lg text-white disabled:opacity-40"
                style={{ backgroundColor: primaryColor }}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg hover:opacity-95 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Ask Store Assistant</span>
          </button>
        )}
      </div>
    </div>
  );
}
