import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  activities,
  automationActions,
  automations,
  brandSettings,
  businesses,
  customers,
  followUps,
  leads,
  notifications,
  products,
  users,
} from '../db/schema.ts';

let seedPromise: Promise<void> | null = null;

function formatDateOffset(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'demo@bizpilot.app'))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  const demoPasswordHash = await bcrypt.hash('Demo@12345', 10);

  const [business] = await db
    .insert(businesses)
    .values({
      name: 'Atelier Nord',
      slug: 'atelier-nord',
      category: 'Lifestyle & Home',
    })
    .onConflictDoNothing({ target: businesses.slug })
    .returning();

  const targetBusiness =
    business ??
    (
      await db
        .select()
        .from(businesses)
        .where(eq(businesses.slug, 'atelier-nord'))
        .limit(1)
    )[0];

  if (!targetBusiness) return;

  const businessId = targetBusiness.id;

  const [adminUser, managerUser, salesOne, salesTwo] = await db
    .insert(users)
    .values([
      {
        businessId,
        fullName: 'Aarav Mehta',
        email: 'demo@bizpilot.app',
        passwordHash: demoPasswordHash,
        role: 'ADMIN',
        isActive: true,
      },
      {
        businessId,
        fullName: 'Rohan Verma',
        email: 'rohan@bizpilot.app',
        passwordHash: demoPasswordHash,
        role: 'MANAGER',
        isActive: true,
      },
      {
        businessId,
        fullName: 'Ananya Iyer',
        email: 'ananya@bizpilot.app',
        passwordHash: demoPasswordHash,
        role: 'SALES_EMPLOYEE',
        isActive: true,
      },
      {
        businessId,
        fullName: 'Arjun Nair',
        email: 'arjun@bizpilot.app',
        passwordHash: demoPasswordHash,
        role: 'SALES_EMPLOYEE',
        isActive: true,
      },
    ])
    .returning();

  await db
    .insert(brandSettings)
    .values({
      businessId,
      businessName: 'Atelier Nord',
      tagline: 'Thoughtful everyday essentials crafted for calm living',
      logoUrl: '',
      primaryColor: '#0F172A',
      secondaryColor: '#0284C7',
      description:
        'Atelier Nord designs small-batch homeware, organic cotton carry goods, and studio stationery built for daily rituals.',
      category: 'Lifestyle & Home',
      bannerHeadline: 'Discover Our Winter Craft Collection',
      bannerSubheadline:
        'Small-batch ceramics, heavyweight canvas totes, and merino-cotton knitwear at seasonal studio pricing.',
      bannerCta: 'Explore Collection',
    })
    .onConflictDoNothing({ target: brandSettings.businessId });

  await db.insert(products).values([
    {
      businessId,
      name: 'Everyday Tote',
      category: 'Accessories',
      price: 1299,
      stock: 42,
      shortDescription: 'Heavyweight 16oz organic cotton canvas tote with reinforced navy webbing.',
      description:
        'Structured for daily commutes and studio errands, the Everyday Tote pairs 16oz organic cotton canvas with full-grain trim, an interior key leash, and a padded 14-inch sleeve.',
      highlights: [
        '16oz organic cotton canvas',
        'Reinforced deep navy shoulder straps',
        'Fits 14-inch laptop & daily essentials',
      ],
      imageUrl: '/src/assets/images/product_everyday_tote_1795285137313.jpg',
      sku: 'AN-ACC-001',
      status: 'Published',
    },
    {
      businessId,
      name: 'Ceramic Pour-over',
      category: 'Home & Living',
      price: 899,
      stock: 18,
      shortDescription: 'Hand-glazed speckled stoneware dripper and matching 500ml carafe.',
      description:
        'Wheel-thrown in small batches with heat-retaining stoneware clay, the Ceramic Pour-over delivers clean extraction and warm tactile character on any morning counter.',
      highlights: [
        'Matte speckled stoneware glaze',
        '500ml heat-retaining carafe',
        'Dishwasher safe & lead-free',
      ],
      imageUrl: '/src/assets/images/product_ceramic_pourover_1795285137514.jpg',
      sku: 'AN-HOM-002',
      status: 'Published',
    },
    {
      businessId,
      name: 'Cloud Knit Set',
      category: 'Apparel',
      price: 2499,
      stock: 14,
      shortDescription: 'Breathable brushed cotton-wool loungewear sweater and relaxed trouser set.',
      description:
        'Knitted from ultra-soft combed cotton and fine wool yarn in oat heather, the Cloud Knit Set balances breathable warmth with an effortless tailored drape.',
      highlights: [
        'Combed cotton & fine wool blend',
        'Two-piece sweater and relaxed pant',
        'Pre-washed for zero shrinkage',
      ],
      imageUrl: '/src/assets/images/product_cloud_knit_set_1795285137920.jpg',
      sku: 'AN-APP-003',
      status: 'Published',
    },
    {
      businessId,
      name: 'Daily Journal',
      category: 'Stationery',
      price: 549,
      stock: 6,
      shortDescription: 'Linen-bound 192-page lay-flat planner with fountain-pen-friendly 120gsm paper.',
      description:
        'Bound in deep navy bookcloth with a woven ribbon marker, the Daily Journal features lightly dotted 120gsm ivory pages that lay completely flat for focused planning.',
      highlights: [
        '120gsm bleed-resistant ivory paper',
        'Lay-flat Smyth-sewn binding',
        '192 numbered pages with index',
      ],
      imageUrl: '/src/assets/images/product_daily_journal_1795285137460.jpg',
      sku: 'AN-STN-004',
      status: 'Published',
    },
  ]);

  const insertedLeads = await db
    .insert(leads)
    .values([
      {
        businessId,
        name: 'Ishita Rao',
        phone: '+91 98201 44120',
        email: 'ishita@mentaliving.in',
        company: 'Menta Living',
        source: 'WhatsApp',
        status: 'New',
        assignedUserId: salesOne.id,
        notes: 'Asked for bulk corporate gifting pricing on 25 Everyday Totes and Daily Journals.',
        nextFollowUpAt: daysAgo(-1),
        createdAt: daysAgo(0),
      },
      {
        businessId,
        name: 'Kabir Shah',
        phone: '+91 98112 77304',
        email: 'kabir@shahandco.in',
        company: 'Shah & Co.',
        source: 'Website Form',
        status: 'Follow-up',
        assignedUserId: salesTwo.id,
        notes: 'Requested lookbook and wholesale margin sheet for Ceramic Pour-over sets.',
        nextFollowUpAt: daysAgo(0),
        createdAt: daysAgo(1),
      },
      {
        businessId,
        name: 'Mira Kapoor',
        phone: '+91 99304 51920',
        email: 'mira@mkboutique.in',
        company: 'MK Boutique',
        source: 'Call',
        status: 'Interested',
        assignedUserId: salesOne.id,
        notes: 'Interested in stocking Cloud Knit Set across 2 Mumbai retail outlets.',
        nextFollowUpAt: daysAgo(1),
        createdAt: daysAgo(2),
      },
      {
        businessId,
        name: 'Dev Malhotra',
        phone: '+91 97654 22019',
        email: 'dev@dmessentials.com',
        company: 'DM Essentials',
        source: 'WhatsApp',
        status: 'Converted',
        assignedUserId: salesTwo.id,
        notes: 'Confirmed opening order of 40 Everyday Totes and 20 Ceramic Pour-overs.',
        createdAt: daysAgo(3),
      },
      {
        businessId,
        name: 'Neha Kulkarni',
        phone: '+91 98450 88102',
        email: 'neha@studiok.design',
        company: 'Studio K',
        source: 'Instagram',
        status: 'Contacted',
        assignedUserId: salesOne.id,
        notes: 'DM inquiry about custom embossing on Daily Journal.',
        createdAt: daysAgo(4),
      },
      {
        businessId,
        name: 'Vikram Joshi',
        phone: '+91 98220 31450',
        email: 'vikram@ververetail.in',
        company: 'Verve Retail',
        source: 'Referral',
        status: 'Converted',
        assignedUserId: managerUser.id,
        notes: 'Referred by DM Essentials; converted after studio walkthrough.',
        createdAt: daysAgo(5),
      },
    ])
    .returning();

  const [ishita, kabir, mira, dev, , vikram] = insertedLeads;

  await db.insert(customers).values([
    {
      businessId,
      leadId: dev.id,
      name: dev.name,
      phone: dev.phone,
      email: dev.email,
      company: dev.company,
      source: dev.source,
      status: 'Active',
      lastInteractionAt: daysAgo(1),
      totalInteractions: 5,
    },
    {
      businessId,
      leadId: vikram.id,
      name: vikram.name,
      phone: vikram.phone,
      email: vikram.email,
      company: vikram.company,
      source: vikram.source,
      status: 'Active',
      lastInteractionAt: daysAgo(2),
      totalInteractions: 7,
    },
  ]);

  await db.insert(followUps).values([
    {
      businessId,
      leadId: kabir.id,
      assignedUserId: salesTwo.id,
      dueDate: formatDateOffset(0),
      dueTime: '15:00',
      type: 'WhatsApp',
      notes: 'Share wholesale tier pricing PDF for Ceramic Pour-over.',
      status: 'Pending',
    },
    {
      businessId,
      leadId: mira.id,
      assignedUserId: salesOne.id,
      dueDate: formatDateOffset(-1),
      dueTime: '11:30',
      type: 'Call',
      notes: 'Confirm sample sizing dispatch for Cloud Knit Set.',
      status: 'Overdue',
    },
    {
      businessId,
      leadId: ishita.id,
      assignedUserId: salesOne.id,
      dueDate: formatDateOffset(2),
      dueTime: '10:30',
      type: 'WhatsApp',
      notes: 'Follow up on 25-unit corporate gifting quote.',
      status: 'Pending',
    },
    {
      businessId,
      leadId: dev.id,
      assignedUserId: salesTwo.id,
      dueDate: formatDateOffset(-2),
      dueTime: '16:00',
      type: 'Email',
      notes: 'Send signed invoice and dispatch schedule.',
      status: 'Completed',
    },
  ]);

  await db.insert(activities).values([
    {
      businessId,
      leadId: ishita.id,
      userId: adminUser.id,
      type: 'LEAD_CREATED',
      title: 'Lead Created',
      description: 'Captured via WhatsApp Business inquiry.',
      createdAt: daysAgo(0),
    },
    {
      businessId,
      leadId: ishita.id,
      userId: salesOne.id,
      type: 'EMPLOYEE_ASSIGNED',
      title: 'Employee Assigned',
      description: 'Assigned automatically to Ananya Iyer.',
      createdAt: daysAgo(0),
    },
    {
      businessId,
      leadId: kabir.id,
      userId: salesTwo.id,
      type: 'AUTO_REPLY_SENT',
      title: 'Auto Reply Sent',
      description: 'Sent welcome catalog link and scheduled follow-up.',
      createdAt: daysAgo(1),
    },
    {
      businessId,
      leadId: kabir.id,
      userId: salesTwo.id,
      type: 'FOLLOWUP_SCHEDULED',
      title: 'Follow-up Scheduled',
      description: 'WhatsApp check-in scheduled for today at 15:00.',
      createdAt: daysAgo(1),
    },
    {
      businessId,
      leadId: dev.id,
      userId: salesTwo.id,
      type: 'STATUS_CHANGED',
      title: 'Status Changed to Converted',
      description: 'Lead converted and added to Customer directory.',
      createdAt: daysAgo(2),
    },
  ]);

  const [waAuto, webAuto, callAuto, convAuto] = await db
    .insert(automations)
    .values([
      {
        businessId,
        name: 'Instant WhatsApp Lead Pilot',
        description:
          'Assigns a sales rep, sends an instant AI welcome reply, schedules a 24h follow-up, and alerts the team.',
        triggerType: 'WHATSAPP_LEAD',
        status: 'ACTIVE',
        lastRunAt: daysAgo(0),
        runCount: 14,
      },
      {
        businessId,
        name: 'Website Form Concierge',
        description:
          'Routes website inquiries to a rep, drafts an instant response, and schedules a follow-up.',
        triggerType: 'WEBSITE_LEAD',
        status: 'ACTIVE',
        lastRunAt: daysAgo(1),
        runCount: 9,
      },
      {
        businessId,
        name: 'Inbound Call Follow-up Flow',
        description:
          'Assigns missed or logged call leads, schedules a callback, and sends an internal notification.',
        triggerType: 'CALL_LEAD',
        status: 'ACTIVE',
        lastRunAt: daysAgo(2),
        runCount: 6,
      },
      {
        businessId,
        name: 'Conversion Alert Workflow',
        description: 'Notifies leadership whenever a lead moves to Converted.',
        triggerType: 'STATUS_CHANGED',
        status: 'PAUSED',
        lastRunAt: daysAgo(3),
        runCount: 2,
      },
    ])
    .returning();

  await db.insert(automationActions).values([
    { automationId: waAuto.id, actionType: 'ASSIGN_EMPLOYEE', config: { strategy: 'round_robin' }, orderIndex: 0 },
    { automationId: waAuto.id, actionType: 'SEND_AUTOREPLY', config: { tone: 'Friendly' }, orderIndex: 1 },
    { automationId: waAuto.id, actionType: 'CREATE_FOLLOWUP', config: { offsetDays: 1, type: 'WhatsApp', time: '11:00' }, orderIndex: 2 },
    { automationId: waAuto.id, actionType: 'CREATE_NOTIFICATION', config: { title: 'New WhatsApp Lead Captured' }, orderIndex: 3 },

    { automationId: webAuto.id, actionType: 'ASSIGN_EMPLOYEE', config: { strategy: 'round_robin' }, orderIndex: 0 },
    { automationId: webAuto.id, actionType: 'SEND_AUTOREPLY', config: { tone: 'Professional' }, orderIndex: 1 },
    { automationId: webAuto.id, actionType: 'CREATE_FOLLOWUP', config: { offsetDays: 0, type: 'Email', time: '16:00' }, orderIndex: 2 },
    { automationId: webAuto.id, actionType: 'CREATE_NOTIFICATION', config: { title: 'New Website Lead Received' }, orderIndex: 3 },

    { automationId: callAuto.id, actionType: 'ASSIGN_EMPLOYEE', config: { strategy: 'round_robin' }, orderIndex: 0 },
    { automationId: callAuto.id, actionType: 'CREATE_FOLLOWUP', config: { offsetDays: 0, type: 'Call', time: '17:00' }, orderIndex: 1 },
    { automationId: callAuto.id, actionType: 'CREATE_NOTIFICATION', config: { title: 'Inbound Call Lead Logged' }, orderIndex: 2 },

    { automationId: convAuto.id, actionType: 'CREATE_NOTIFICATION', config: { title: 'Lead Converted to Customer' }, orderIndex: 0 },
  ]);

  await db.insert(notifications).values([
    {
      businessId,
      userId: adminUser.id,
      title: 'New WhatsApp lead received',
      message: 'Ishita Rao from Menta Living inquired about Everyday Totes.',
      category: 'LEAD',
      isRead: false,
      linkUrl: '/leads',
    },
    {
      businessId,
      userId: adminUser.id,
      title: 'Follow-up overdue',
      message: 'Call follow-up with Mira Kapoor (MK Boutique) was due yesterday.',
      category: 'FOLLOWUP',
      isRead: false,
      linkUrl: '/follow-ups',
    },
    {
      businessId,
      userId: adminUser.id,
      title: 'Low product stock alert',
      message: 'Daily Journal (AN-STN-004) only has 6 units remaining in stock.',
      category: 'STOCK',
      isRead: false,
      linkUrl: '/products',
    },
    {
      businessId,
      userId: adminUser.id,
      title: 'New customer conversion',
      message: 'Dev Malhotra (DM Essentials) converted from WhatsApp.',
      category: 'CONVERSION',
      isRead: true,
      linkUrl: '/customers',
    },
  ]);
}
