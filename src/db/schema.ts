import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const businesses = pgTable('businesses', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  category: text('category').notNull().default('Retail & Lifestyle'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').unique(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('SALES_EMPLOYEE'), // ADMIN | MANAGER | SALES_EMPLOYEE
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const brandSettings = pgTable('brand_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  businessName: text('business_name').notNull(),
  tagline: text('tagline').notNull().default('Crafted for everyday life'),
  logoUrl: text('logo_url').default(''),
  primaryColor: text('primary_color').notNull().default('#0F172A'),
  secondaryColor: text('secondary_color').notNull().default('#0284C7'),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default('Retail & Lifestyle'),
  bannerHeadline: text('banner_headline').notNull().default('Discover Our Curated Collection'),
  bannerSubheadline: text('banner_subheadline').notNull().default('Thoughtfully designed essentials at everyday prices.'),
  bannerCta: text('banner_cta').notNull().default('Shop Collection'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').default('').notNull(),
  company: text('company').default('').notNull(),
  source: text('source').notNull().default('WhatsApp'), // WhatsApp | Call | Website Form | Instagram | Referral
  status: text('status').notNull().default('New'), // New | Contacted | Interested | Follow-up | Converted | Lost
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes').default('').notNull(),
  nextFollowUpAt: timestamp('next_follow_up_at'),
  isSimulated: boolean('is_simulated').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').default('').notNull(),
  company: text('company').default('').notNull(),
  source: text('source').notNull().default('WhatsApp'),
  status: text('status').notNull().default('Active'), // Active | Inactive
  lastInteractionAt: timestamp('last_interaction_at').defaultNow().notNull(),
  totalInteractions: integer('total_interactions').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default('Other'), // Apparel | Accessories | Home & Living | Beauty | Stationery | Other
  price: integer('price').notNull().default(0),
  stock: integer('stock').notNull().default(0),
  shortDescription: text('short_description').default('').notNull(),
  description: text('description').default('').notNull(),
  highlights: jsonb('highlights').$type<string[]>().default([]).notNull(),
  imageUrl: text('image_url').default('').notNull(),
  sku: text('sku').notNull(),
  status: text('status').notNull().default('Published'), // Published | Draft | Out of Stock
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const followUps = pgTable('follow_ups', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  dueDate: text('due_date').notNull(), // YYYY-MM-DD
  dueTime: text('due_time').notNull().default('11:00'),
  type: text('type').notNull().default('WhatsApp'), // Call | WhatsApp | Email | Meeting
  notes: text('notes').default('').notNull(),
  status: text('status').notNull().default('Pending'), // Pending | Completed | Overdue
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // LEAD_CREATED | AUTO_REPLY_SENT | EMPLOYEE_ASSIGNED | CUSTOMER_CONTACTED | FOLLOWUP_SCHEDULED | STATUS_CHANGED
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const automations = pgTable('automations', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description').default('').notNull(),
  triggerType: text('trigger_type').notNull(), // NEW_LEAD | WHATSAPP_LEAD | WEBSITE_LEAD | CALL_LEAD | STATUS_CHANGED | FOLLOWUP_DUE | INACTIVE_LEAD
  status: text('status').notNull().default('ACTIVE'), // ACTIVE | PAUSED
  lastRunAt: timestamp('last_run_at'),
  runCount: integer('run_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const automationActions = pgTable('automation_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  automationId: uuid('automation_id')
    .references(() => automations.id, { onDelete: 'cascade' })
    .notNull(),
  actionType: text('action_type').notNull(), // CREATE_FOLLOWUP | SEND_AUTOREPLY | ASSIGN_EMPLOYEE | CHANGE_STATUS | CREATE_NOTIFICATION
  config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .references(() => businesses.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').notNull().default('LEAD'), // LEAD | FOLLOWUP | STOCK | CONVERSION | AUTOMATION
  isRead: boolean('is_read').default(false).notNull(),
  linkUrl: text('link_url').default('/leads').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const businessesRelations = relations(businesses, ({ many, one }) => ({
  users: many(users),
  brandSettings: one(brandSettings, {
    fields: [businesses.id],
    references: [brandSettings.businessId],
  }),
  leads: many(leads),
  customers: many(customers),
  products: many(products),
  followUps: many(followUps),
  automations: many(automations),
  notifications: many(notifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  business: one(businesses, {
    fields: [users.businessId],
    references: [businesses.id],
  }),
  assignedLeads: many(leads),
  assignedFollowUps: many(followUps),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  business: one(businesses, {
    fields: [leads.businessId],
    references: [businesses.id],
  }),
  assignedUser: one(users, {
    fields: [leads.assignedUserId],
    references: [users.id],
  }),
  activities: many(activities),
  followUps: many(followUps),
}));

export const automationsRelations = relations(automations, ({ one, many }) => ({
  business: one(businesses, {
    fields: [automations.businessId],
    references: [businesses.id],
  }),
  actions: many(automationActions),
}));

export const automationActionsRelations = relations(automationActions, ({ one }) => ({
  automation: one(automations, {
    fields: [automationActions.automationId],
    references: [automations.id],
  }),
}));
