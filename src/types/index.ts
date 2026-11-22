export type UserRole = 'ADMIN' | 'MANAGER' | 'SALES_EMPLOYEE';

export interface User {
  id: string;
  businessId: string;
  email: string;
  fullName: string;
  role: UserRole;
  businessName: string;
  businessSlug: string;
}

export interface Lead {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  source: 'WhatsApp' | 'Call' | 'Website Form' | 'Instagram' | 'Referral';
  status: 'New' | 'Contacted' | 'Interested' | 'Follow-up' | 'Converted' | 'Lost';
  assignedUserId: string | null;
  assignedUserName?: string | null;
  notes: string;
  nextFollowUpAt: string | null;
  isSimulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  userName?: string | null;
}

export interface Customer {
  id: string;
  businessId: string;
  leadId: string | null;
  name: string;
  phone: string;
  email: string;
  company: string;
  source: string;
  status: 'Active' | 'Inactive';
  lastInteractionAt: string;
  totalInteractions: number;
  createdAt: string;
}

export interface Product {
  id: string;
  businessId?: string;
  name: string;
  category: 'Apparel' | 'Accessories' | 'Home & Living' | 'Beauty' | 'Stationery' | 'Other';
  price: number;
  stock: number;
  shortDescription: string;
  description: string;
  highlights: string[];
  imageUrl: string;
  sku: string;
  status: 'Published' | 'Draft' | 'Out of Stock';
  createdAt?: string;
}

export interface FollowUp {
  id: string;
  leadId: string | null;
  leadName?: string | null;
  leadCompany?: string | null;
  customerId: string | null;
  customerName?: string | null;
  assignedUserId: string | null;
  assignedUserName?: string | null;
  dueDate: string;
  dueTime: string;
  type: 'Call' | 'WhatsApp' | 'Email' | 'Meeting';
  notes: string;
  status: 'Pending' | 'Completed' | 'Overdue';
}

export interface AutomationAction {
  id?: string;
  actionType:
    | 'CREATE_FOLLOWUP'
    | 'SEND_AUTOREPLY'
    | 'ASSIGN_EMPLOYEE'
    | 'CHANGE_STATUS'
    | 'CREATE_NOTIFICATION';
  config: Record<string, unknown>;
  orderIndex?: number;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  triggerType:
    | 'NEW_LEAD'
    | 'WHATSAPP_LEAD'
    | 'WEBSITE_LEAD'
    | 'CALL_LEAD'
    | 'STATUS_CHANGED'
    | 'FOLLOWUP_DUE'
    | 'INACTIVE_LEAD';
  status: 'ACTIVE' | 'PAUSED';
  lastRunAt: string | null;
  runCount: number;
  actions: AutomationAction[];
}

export interface BrandSettings {
  id: string;
  businessId: string;
  businessName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  description: string;
  category: string;
  bannerHeadline: string;
  bannerSubheadline: string;
  bannerCta: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  linkUrl: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  stats: {
    leadsAssigned: number;
    leadsContacted: number;
    conversions: number;
    pendingFollowUps: number;
  };
}

export interface AnalyticsData {
  businessName: string;
  summary: {
    totalLeads: number;
    newLeads: number;
    followUpsDue: number;
    overdueFollowUps: number;
    pendingFollowUps: number;
    completedFollowUps: number;
    convertedLeads: number;
    totalCustomers: number;
    totalProducts: number;
    conversionRate: number;
    activeAutomations: number;
    followUpCompletionRate: number;
  };
  funnel: Array<{ stage: string; count: number }>;
  leadSources: Array<{ source: string; count: number; converted: number }>;
  weeklyTrend: Array<{ day: string; leads: number; conversions: number }>;
  monthlyTrend: Array<{ period: string; leads: number; conversions: number }>;
  followUpBreakdown: Array<{ name: string; value: number }>;
  productPerformance: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    inventoryValue: number;
    status: string;
  }>;
  employeePerformance: Array<{
    id: string;
    fullName: string;
    role: UserRole;
    leadsAssigned: number;
    leadsContacted: number;
    conversions: number;
    pendingFollowUps: number;
  }>;
  lowStockProducts: Array<{ name: string; stock: number }>;
}

export interface BusinessInsight {
  insight: string;
  why: string;
  action: string;
  category: string;
}
