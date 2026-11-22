import { and, eq, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { activities, customers, notifications } from '../../db/schema.ts';

interface ConvertInput {
  businessId: string;
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string;
    company: string;
    source: string;
  };
  actorUserId?: string | null;
}

export async function convertLeadToCustomerIfNeeded(input: ConvertInput) {
  const { businessId, lead, actorUserId } = input;

  const existingByLead = await db
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, businessId), eq(customers.leadId, lead.id)))
    .limit(1);

  if (existingByLead.length > 0) {
    return { customer: existingByLead[0], created: false };
  }

  const conditions = [eq(customers.phone, lead.phone)];
  if (lead.email) {
    conditions.push(eq(customers.email, lead.email));
  }

  const existingByContact = await db
    .select()
    .from(customers)
    .where(and(eq(customers.businessId, businessId), or(...conditions)))
    .limit(1);

  if (existingByContact.length > 0) {
    const [updated] = await db
      .update(customers)
      .set({
        leadId: lead.id,
        lastInteractionAt: new Date(),
        totalInteractions: existingByContact[0].totalInteractions + 1,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existingByContact[0].id))
      .returning();
    return { customer: updated, created: false };
  }

  const [createdCustomer] = await db
    .insert(customers)
    .values({
      businessId,
      leadId: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      source: lead.source,
      status: 'Active',
      lastInteractionAt: new Date(),
      totalInteractions: 1,
    })
    .returning();

  await db.insert(activities).values({
    businessId,
    leadId: lead.id,
    userId: actorUserId ?? null,
    type: 'CUSTOMER_CONVERTED',
    title: 'Customer Record Created',
    description: `${lead.name} was automatically added to Customers upon conversion.`,
    metadata: { customerId: createdCustomer.id },
  });

  await db.insert(notifications).values({
    businessId,
    userId: actorUserId ?? null,
    title: 'New customer conversion',
    message: `${lead.name}${lead.company ? ` (${lead.company})` : ''} converted from ${lead.source}.`,
    category: 'CONVERSION',
    isRead: false,
    linkUrl: '/customers',
  });

  return { customer: createdCustomer, created: true };
}
