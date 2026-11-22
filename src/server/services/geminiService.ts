import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

function parseJsonSafe<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 18000,
    },
  });
}

async function generateWithTimeout(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  timeoutMs = 20000
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      ai.models.generateContent(params),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error('AI request timed out. Please try again.') as Error & { status?: number };
          err.status = 504;
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface ReplyGenerationInput {
  customerMessage: string;
  businessName: string;
  businessContext?: string;
  leadName?: string;
  tone: 'Professional' | 'Friendly' | 'Short' | 'Sales-focused';
}

export async function generateCustomerReply(input: ReplyGenerationInput): Promise<{
  reply: string;
  isDemoFallback: boolean;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    const greeting = input.leadName ? `Hi ${input.leadName},` : 'Hello,';
    const fallbackByTone: Record<string, string> = {
      Professional: `${greeting} thank you for contacting ${input.businessName}. We have received your message regarding "${input.customerMessage.slice(0, 80)}" and a dedicated specialist will share pricing and availability details shortly.`,
      Friendly: `${greeting} thanks so much for reaching out to ${input.businessName}! We'd love to help with your request—let me pull up the exact details and send them right over.`,
      Short: `${greeting} thanks for messaging ${input.businessName}. Checking availability now and will update you within 15 minutes.`,
      'Sales-focused': `${greeting} thank you for your interest in ${input.businessName}! We currently have stock ready for quick dispatch and volume pricing available—would you like me to reserve your items and share a quick quote?`,
    };
    return {
      reply: fallbackByTone[input.tone] ?? fallbackByTone.Professional,
      isDemoFallback: true,
    };
  }

  const response = await generateWithTimeout(ai, {
    model: 'gemini-4-hydrogen',
    contents: `Customer Name: ${input.leadName || 'Customer'}
Business Name: ${input.businessName}
Business Context: ${input.businessContext || 'Small business selling curated products'}
Requested Tone: ${input.tone}
Customer Message: "${input.customerMessage}"

Write a ready-to-send reply message.`,
    config: {
      systemInstruction:
        'You are a customer communications specialist for a small business. Write a natural, clear, accurate reply matching the requested tone. Keep it concise (2-4 sentences) with no markdown formatting or placeholders.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return {
    reply: (response.text ?? '').trim(),
    isDemoFallback: false,
  };
}

export interface ProductDescriptionInput {
  name: string;
  category: string;
  features: string;
  targetAudience: string;
}

export async function generateProductCopy(input: ProductDescriptionInput): Promise<{
  shortDescription: string;
  fullDescription: string;
  highlights: string[];
  isDemoFallback: boolean;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      shortDescription: `${input.name} — thoughtfully crafted ${input.category.toLowerCase()} designed for ${input.targetAudience || 'everyday use'}.`,
      fullDescription: `Meet ${input.name}, created for ${input.targetAudience || 'modern daily routines'}. Built with ${input.features || 'quality materials and reliable craftsmanship'}, it delivers dependable performance and clean design across every detail.`,
      highlights: [
        `Designed specifically for ${input.targetAudience || 'everyday utility'}`,
        input.features ? `Key feature: ${input.features.split(',')[0].trim()}` : 'Premium build quality',
        `Curated ${input.category} essential`,
      ],
      isDemoFallback: true,
    };
  }

  const response = await generateWithTimeout(ai, {
    model: 'gemini-4-hydrogen',
    contents: `Generate product marketing copy for:
Product Name: ${input.name}
Category: ${input.category}
Key Features: ${input.features}
Target Audience: ${input.targetAudience}`,
    config: {
      systemInstruction:
        'You are an e-commerce copywriter. Write crisp, persuasive, grounded product copy without hype or unverified claims.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shortDescription: {
            type: Type.STRING,
            description: 'One concise sentence (max 140 characters) summarizing the product.',
          },
          fullDescription: {
            type: Type.STRING,
            description: 'Two to three compelling sentences describing benefits, materials, and use case.',
          },
          highlights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Three short bullet highlights (4-8 words each).',
          },
        },
        required: ['shortDescription', 'fullDescription', 'highlights'],
      },
    },
  });

  const parsed = parseJsonSafe<{
    shortDescription?: string;
    fullDescription?: string;
    highlights?: string[];
  }>(response.text, {});

  return {
    shortDescription: parsed.shortDescription ?? '',
    fullDescription: parsed.fullDescription ?? '',
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    isDemoFallback: false,
  };
}

export interface BannerCopyInput {
  campaign: string;
  offer: string;
  targetAudience: string;
  businessName: string;
  category: string;
}

export async function generateBannerCopy(input: BannerCopyInput): Promise<{
  headline: string;
  subheadline: string;
  cta: string;
  isDemoFallback: boolean;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      headline: input.campaign || `Discover ${input.businessName}`,
      subheadline: input.offer
        ? `${input.offer} — curated for ${input.targetAudience || 'our valued customers'}.`
        : 'Explore thoughtfully designed essentials crafted for everyday living.',
      cta: 'Shop Now',
      isDemoFallback: true,
    };
  }

  const response = await generateWithTimeout(ai, {
    model: 'gemini-4-hydrogen',
    contents: `Business: ${input.businessName} (${input.category})
Campaign: ${input.campaign}
Offer: ${input.offer}
Target Audience: ${input.targetAudience}`,
    config: {
      systemInstruction:
        'You are a brand copywriter creating a clean retail storefront hero banner. Keep the headline 4-7 words, subheadline 8-16 words, and CTA 2-3 words.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          subheadline: { type: Type.STRING },
          cta: { type: Type.STRING },
        },
        required: ['headline', 'subheadline', 'cta'],
      },
    },
  });

  const parsed = parseJsonSafe<{
    headline?: string;
    subheadline?: string;
    cta?: string;
  }>(response.text, {});

  return {
    headline: parsed.headline ?? 'Discover Our Collection',
    subheadline: parsed.subheadline ?? 'Curated quality for everyday living.',
    cta: parsed.cta ?? 'Shop Now',
    isDemoFallback: false,
  };
}

export interface AggregatedMetricsInput {
  businessName: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  overdueFollowUps: number;
  pendingFollowUps: number;
  completedFollowUps: number;
  leadsBySource: Array<{ source: string; count: number; converted: number }>;
  lowStockProducts: Array<{ name: string; stock: number }>;
  activeAutomations: number;
}

export interface BusinessInsightItem {
  insight: string;
  why: string;
  action: string;
  category: string;
}

export async function generateBusinessInsights(metrics: AggregatedMetricsInput): Promise<{
  insights: BusinessInsightItem[];
  isDemoFallback: boolean;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    const topSource = [...metrics.leadsBySource].sort((a, b) => b.count - a.count)[0];
    const items: BusinessInsightItem[] = [
      {
        insight: topSource
          ? `${topSource.source} is your highest-volume lead channel.`
          : 'Lead pipeline is ready for inbound growth.',
        why: topSource
          ? `${topSource.count} of ${metrics.totalLeads} total leads arrived via ${topSource.source} (${topSource.converted} converted).`
          : 'No leads captured yet across active channels.',
        action: topSource
          ? `Keep your ${topSource.source} automation active and test faster follow-up templates.`
          : 'Use the lead capture simulator or storefront form to start capturing leads.',
        category: 'Lead Acquisition',
      },
      {
        insight:
          metrics.overdueFollowUps > 0
            ? `${metrics.overdueFollowUps} follow-up${metrics.overdueFollowUps > 1 ? 's are' : ' is'} currently overdue.`
            : 'All scheduled follow-ups are on track.',
        why:
          metrics.overdueFollowUps > 0
            ? 'Leads that wait longer than 24–48 hours show sharply lower conversion rates.'
            : `${metrics.completedFollowUps} follow-ups completed with zero overdue tasks.`,
        action:
          metrics.overdueFollowUps > 0
            ? 'Prioritize overdue follow-ups today and assign backup capacity if needed.'
            : 'Maintain your automated follow-up cadence for new inquiries.',
        category: 'Follow-up Velocity',
      },
      {
        insight:
          metrics.lowStockProducts.length > 0
            ? `${metrics.lowStockProducts[0].name} is running low on inventory (${metrics.lowStockProducts[0].stock} left).`
            : `Overall lead-to-customer conversion stands at ${metrics.conversionRate}%.`,
        why:
          metrics.lowStockProducts.length > 0
            ? 'Stockouts on published storefront items pause revenue and lead fulfillment.'
            : `${metrics.convertedLeads} leads have converted with ${metrics.activeAutomations} active automations running.`,
        action:
          metrics.lowStockProducts.length > 0
            ? `Restock ${metrics.lowStockProducts.map((p) => p.name).join(', ')} in Products.`
            : 'Promote top converting products on your public storefront banner.',
        category: metrics.lowStockProducts.length > 0 ? 'Inventory' : 'Conversion',
      },
    ];
    return { insights: items, isDemoFallback: true };
  }

  const response = await generateWithTimeout(ai, {
    model: 'gemini-4-hydrogen',
    contents: `Analyze these aggregated business metrics (no PII) for ${metrics.businessName} and produce 3 concrete, data-backed recommendations:
${JSON.stringify(metrics, null, 2)}`,
    config: {
      systemInstruction:
        'You are a pragmatic small-business operations advisor. Return exactly 3 insights strictly grounded in the provided numbers. Never invent metrics.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            insight: { type: Type.STRING, description: 'Clear 1-sentence finding grounded in the numbers.' },
            why: { type: Type.STRING, description: 'Why it matters based on the actual metrics.' },
            action: { type: Type.STRING, description: 'Concrete next step inside BizPilot.' },
            category: { type: Type.STRING, description: 'Short label like Acquisition, Follow-ups, Inventory, or Conversion.' },
          },
          required: ['insight', 'why', 'action', 'category'],
        },
      },
    },
  });

  const parsed = parseJsonSafe<BusinessInsightItem[] | { insights?: BusinessInsightItem[] }>(
    response.text,
    []
  );
  const normalized = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.insights)
      ? parsed.insights
      : [];
  return {
    insights: normalized.slice(0, 3),
    isDemoFallback: false,
  };
}

export interface StorefrontChatInput {
  businessName: string;
  tagline: string;
  description: string;
  products: Array<{
    name: string;
    category: string;
    price: number;
    stock: number;
    shortDescription: string;
    description: string;
    status: string;
  }>;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}

export async function answerStorefrontCustomerQuery(input: StorefrontChatInput): Promise<{
  reply: string;
  isDemoFallback: boolean;
}> {
  const availableProducts = input.products.filter((p) => p.status !== 'Draft');
  const catalogContext = availableProducts
    .map(
      (p) =>
        `- ${p.name} | Category: ${p.category} | Price: ₹${p.price} | Stock: ${p.stock} (${p.status}) | Summary: ${p.shortDescription || p.description}`
    )
    .join('\n');

  const ai = getGeminiClient();
  if (!ai) {
    const q = input.message.toLowerCase();
    const underMatch = q.match(/under\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    if (underMatch) {
      const cap = Number(underMatch[1]);
      const matching = availableProducts.filter((p) => p.price <= cap);
      if (matching.length === 0) {
        return {
          reply: `We currently don't have any products priced under ₹${cap} in our ${input.businessName} catalog.`,
          isDemoFallback: true,
        };
      }
      const list = matching.map((p) => `${p.name} (₹${p.price}, ${p.stock} in stock)`).join(', ');
      return {
        reply: `Here are our products under ₹${cap}: ${list}.`,
        isDemoFallback: true,
      };
    }

    const foundByName = availableProducts.find((p) => q.includes(p.name.toLowerCase()));
    if (foundByName) {
      return {
        reply: `${foundByName.name} is priced at ₹${foundByName.price} (${foundByName.category}) with ${foundByName.stock} units available. ${foundByName.shortDescription || foundByName.description}`,
        isDemoFallback: true,
      };
    }

    const foundByCategory = availableProducts.filter((p) =>
      q.includes(p.category.toLowerCase())
    );
    if (foundByCategory.length > 0) {
      return {
        reply: `In ${foundByCategory[0].category}, we offer: ${foundByCategory.map((p) => `${p.name} (₹${p.price})`).join(', ')}.`,
        isDemoFallback: true,
      };
    }

    if (q.includes('gift')) {
      const giftIdeas = availableProducts.slice(0, 3).map((p) => `${p.name} (₹${p.price})`);
      return {
        reply: `Popular gifting picks from ${input.businessName} include ${giftIdeas.join(', ')}. Would you like details on any of these?`,
        isDemoFallback: true,
      };
    }

    return {
      reply: `Welcome to ${input.businessName}! We currently carry: ${availableProducts.map((p) => `${p.name} (₹${p.price})`).join(', ')}. Ask me about pricing, categories, stock availability, or product details!`,
      isDemoFallback: true,
    };
  }

  const historyText = (input.history ?? [])
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.text}`)
    .join('\n');

  const response = await generateWithTimeout(ai, {
    model: 'gemini-4-hydrogen',
    contents: `${historyText ? `Recent Conversation:\n${historyText}\n\n` : ''}Customer Question: "${input.message}"`,
    config: {
      systemInstruction: `You are the helpful storefront customer assistant for "${input.businessName}" (${input.tagline}).
About the business: ${input.description}

STRICT GROUNDING RULES:
1. You must ONLY reference products, prices (in ₹), categories, and stock counts listed in the catalog below.
2. NEVER invent products, discounts, prices, delivery promises, or features not present below.
3. If the customer asks for something unavailable or not in the catalog, state that clearly and suggest the closest available catalog items if relevant.
4. Keep answers concise, warm, and factual.

LIVE PRODUCT CATALOG:
${catalogContext || 'No published products currently in catalog.'}`,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return {
    reply: (response.text ?? '').trim(),
    isDemoFallback: false,
  };
}
