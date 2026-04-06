import type { ActionConfig, JobRecord } from "@/types/tracking";
import { getSmtpConfig } from "@/lib/settings/admin-settings";
import { sendSmtpMail } from "@/lib/email/smtp";

type ActionHandler = (ctx: {
  action: ActionConfig;
  job: JobRecord;
  currentValue: string;
  previousValue?: string;
  recipientEmail: string;
}) => Promise<void>;

const handlers: Record<string, ActionHandler> = {
  console: async ({ job, currentValue, previousValue }) => {
    console.log("[tracker:triggered]", {
      jobId: job.id,
      name: job.name,
      currentValue,
      previousValue,
      at: new Date().toISOString(),
    });
  },
  webhook: async ({ action, job, currentValue, previousValue }) => {
    const url = action.config?.url;
    if (!url) {
      throw new Error("Webhook action requires config.url");
    }

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "tracker.triggered",
        jobId: job.id,
        name: job.name,
        currentValue,
        previousValue,
        triggeredAt: new Date().toISOString(),
      }),
    });
  },
  email: async ({ action, job, currentValue, previousValue, recipientEmail }) => {
    const adminSmtp = await getSmtpConfig();
    const smtpHost = action.config?.smtpHost ?? adminSmtp?.host ?? process.env.SMTP_HOST;
    const smtpPort = Number(
      action.config?.smtpPort ?? adminSmtp?.port ?? process.env.SMTP_PORT ?? 587,
    );
    const smtpUser = action.config?.smtpUser ?? adminSmtp?.user ?? process.env.SMTP_USER;
    const smtpPass = action.config?.smtpPass ?? adminSmtp?.pass ?? process.env.SMTP_PASS;
    const from = action.config?.from ?? adminSmtp?.fromEmail ?? process.env.SMTP_FROM;
    const to = action.config?.to ?? recipientEmail;

    if (!smtpHost || !smtpPort || !from || !to) {
      throw new Error("Email action requires SMTP config from admin or env vars");
    }

    const subject = action.config?.subject ?? `[Tracker] ${job.name} matched condition`;
    const html = `
      <h2>Tracker Triggered</h2>
      <p><strong>Job:</strong> ${job.name}</p>
      <p><strong>URL:</strong> ${job.url}</p>
      <p><strong>Selector:</strong> ${job.tracker.selector}</p>
      <p><strong>Current value:</strong> ${currentValue}</p>
      <p><strong>Previous value:</strong> ${previousValue ?? "(none)"}</p>
      <p><strong>Triggered at:</strong> ${new Date().toISOString()}</p>
    `;

    await sendSmtpMail(
      {
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        secure:
          action.config?.secure === "true" ||
          adminSmtp?.secure === true ||
          smtpPort === 465,
      },
      {
      from,
      to,
      subject,
      html,
      text: `Tracker ${job.name} triggered. Current value: ${currentValue}. Previous value: ${previousValue ?? "(none)"}. URL: ${job.url}`,
      },
    );
  },
};

export async function runActions(input: {
  actions: ActionConfig[];
  job: JobRecord;
  currentValue: string;
  previousValue?: string;
  recipientEmail: string;
}): Promise<{ handledCount: number }> {
  let handledCount = 0;
  for (const action of input.actions) {
    const handler = handlers[action.type];
    if (!handler) {
      continue;
    }

    await handler({
      action,
      job: input.job,
      currentValue: input.currentValue,
      previousValue: input.previousValue,
      recipientEmail: input.recipientEmail,
    });
    handledCount += 1;
  }

  return { handledCount };
}
