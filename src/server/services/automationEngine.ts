import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  activities,
  automationActions,
  automations,
  brandSettings,
  followUps,
  leads,
  notifications,
  users,
} from '../../db/schema.ts';
import { generateCustomerReply } from './geminiService.ts';
import { convertLeadToCustomerIfNeeded } from './conversionService.ts';

export interface AutomationExecutionTrace {
  automationId: string;
  automationName: string;
  triggerType: string;
  executedActions: Array<{
    actionType: string;
    summary: string;
  }>;
}

export async function executeAutomations(params: {
  businessId: string;
  triggerTypes: string[];
  leadId?: string | null;
  actorUserId?: string | null;
}): Promise<AutomationExecutionTrace[]> {
  const { businessId, triggerTypes, leadId, actorUserId } = params;
  if (triggerTypes.length === 0) return [];

  const matchingAutomations = await db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.businessId, businessId),
        eq(automations.status, 'ACTIVE'),
        inArray(automations.triggerType, triggerTypes)
      )
    );

  if (matchingAutomations.length === 0) return [];

  const [brand] = await db
    .select()
    .from(brandSettings)
    .where(eq(brandSettings.businessId, businessId))
    .limit(1);

  const businessName = brand?.businessName ?? 'BizPilot Business';

  let currentLead = leadId
    ? (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0]
    : undefined;

  const traces: AutomationExecutionTrace[] = [];

  for (const auto of matchingAutomations) {
    const actions = await db
      .select()
      .from(automationActions)
      .where(eq(automationActions.automationId, auto.id))
      .orderBy(asc(automationActions.orderIndex));

    const executedActions: Array<{ actionType: string; summary: string }> = [];

    for (const action of actions) {
      const cfg = (action.config ?? {}) as Record<string, unknown>;

      if (action.actionType === 'ASSIGN_EMPLOYEE' && currentLead) {
        const activeTeam = await db
          .select()
          .from(users)
          .where(and(eq(users.businessId, businessId), eq(users.isActive, true)));

        const candidates = activeTeam.filter((u) => u.role === 'SALES_EMPLOYEE');
        const pool = candidates.length > 0 ? candidates : activeTeam;

        if (pool.length > 0) {
          const picked = pool[auto.runCount % pool.length];
          const [updated] = await db
            .update(leads)
            .set({ assignedUserId: picked.id, updatedAt: new Date() })
            .where(eq(leads.id, currentLead.id))
            .returning();
          currentLead = updated;

          await db.insert(activities).values({
            businessId,
            leadId: currentLead.id,
            userId: picked.id,
            type: 'EMPLOYEE_ASSIGNED',
            title: 'Employee Assigned',
            description: `Automation "${auto.name}" assigned lead to ${picked.fullName}.`,
            metadata: { automationId: auto.id, assignedUserId: picked.id },
          });

          executedActions.push({
            actionType: 'ASSIGN_EMPLOYEE',
            summary: `Assigned to ${picked.fullName}`,
          });
        }
      } else if (action.actionType === 'SEND_AUTOREPLY' && currentLead) {
        const tone = (cfg.tone as 'Professional' | 'Friendly' | 'Short' | 'Sales-focused') || 'Friendly';
        let replyText = '';
        try {
          const generated = await generateCustomerReply({
            customerMessage:
              currentLead.notes || `New ${currentLead.source} inquiry from ${currentLead.name}`,
            businessName,
            businessContext: brand?.description || brand?.tagline || '',
            leadName: currentLead.name,
            tone,
          });
          replyText = generated.reply;
        } catch {
          replyText = `Hi ${currentLead.name}, thanks for contacting ${businessName}! Our team has received your inquiry and will get back to you shortly.`;
        }

        await db.insert(activities).values({
          businessId,
          leadId: currentLead.id,
          userId: currentLead.assignedUserId ?? actorUserId ?? null,
          type: 'AUTO_REPLY_SENT',
          title: 'Auto Reply Sent',
          description: replyText,
          metadata: { automationId: auto.id, tone, channel: currentLead.source },
        });

        executedActions.push({
          actionType: 'SEND_AUTOREPLY',
          summary: `Auto-reply generated (${tone})`,
        });
      } else if (action.actionType === 'CREATE_FOLLOWUP' && currentLead) {
        const offsetDays = typeof cfg.offsetDays === 'number' ? cfg.offsetDays : 1;
        const due = new Date();
        due.setDate(due.getDate() + offsetDays);
        const dueDate = due.toISOString().slice(0, 10);
        const dueTime = typeof cfg.time === 'string' ? cfg.time : '11:00';
        const followType =
          typeof cfg.type === 'string'
            ? cfg.type
            : currentLead.source === 'Call'
              ? 'Call'
              : currentLead.source === 'Website Form'
                ? 'Email'
                : 'WhatsApp';

        await db.insert(followUps).values({
          businessId,
          leadId: currentLead.id,
          assignedUserId: currentLead.assignedUserId ?? actorUserId ?? null,
          dueDate,
          dueTime,
          type: followType,
          notes: `Automated follow-up from "${auto.name}" for ${currentLead.name}.`,
          status: 'Pending',
        });

        await db
          .update(leads)
          .set({ nextFollowUpAt: due, updatedAt: new Date() })
          .where(eq(leads.id, currentLead.id));

        await db.insert(activities).values({
          businessId,
          leadId: currentLead.id,
          userId: currentLead.assignedUserId ?? actorUserId ?? null,
          type: 'FOLLOWUP_SCHEDULED',
          title: 'Follow-up Scheduled',
          description: `${followType} follow-up scheduled for ${dueDate} at ${dueTime}.`,
          metadata: { automationId: auto.id, dueDate, dueTime, type: followType },
        });

        executedActions.push({
          actionType: 'CREATE_FOLLOWUP',
          summary: `${followType} follow-up scheduled (${dueDate})`,
        });
      } else if (action.actionType === 'CHANGE_STATUS' && currentLead) {
        const targetStatus = typeof cfg.status === 'string' ? cfg.status : 'Contacted';
        const [updated] = await db
          .update(leads)
          .set({ status: targetStatus, updatedAt: new Date() })
          .where(eq(leads.id, currentLead.id))
          .returning();
        currentLead = updated;

        await db.insert(activities).values({
          businessId,
          leadId: currentLead.id,
          userId: actorUserId ?? null,
          type: 'STATUS_CHANGED',
          title: `Status Changed to ${targetStatus}`,
          description: `Updated automatically by "${auto.name}".`,
          metadata: { automationId: auto.id, status: targetStatus },
        });

        if (targetStatus === 'Converted') {
          await convertLeadToCustomerIfNeeded({
            businessId,
            lead: currentLead,
            actorUserId,
          });
        }

        executedActions.push({
          actionType: 'CHANGE_STATUS',
          summary: `Status updated to ${targetStatus}`,
        });
      } else if (action.actionType === 'CREATE_NOTIFICATION') {
        const title =
          typeof cfg.title === 'string'
            ? cfg.title
            : `Automation: ${auto.name}`;
        const message = currentLead
          ? `${currentLead.name} (${currentLead.source}) triggered "${auto.name}".`
          : `Workflow "${auto.name}" executed.`;

        await db.insert(notifications).values({
          businessId,
          userId: currentLead?.assignedUserId ?? actorUserId ?? null,
          title,
          message,
          category: 'AUTOMATION',
          isRead: false,
          linkUrl: currentLead ? `/leads` : '/automation',
        });

        executedActions.push({
          actionType: 'CREATE_NOTIFICATION',
          summary: title,
        });
      }
    }

    await db
      .update(automations)
      .set({
        lastRunAt: new Date(),
        runCount: auto.runCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(automations.id, auto.id));

    traces.push({
      automationId: auto.id,
      automationName: auto.name,
      triggerType: auto.triggerType,
      executedActions,
    });
  }

  return traces;
}
