import nodemailer from "nodemailer";
import type { Job } from "bullmq";
import { createWorker } from "@360crd/queue";
import { basePrisma } from "@360crd/database";
import type { EmailJob } from "@360crd/shared-types";
import { config } from "../config";
import { logger } from "@360crd/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Email Worker — processes email queue jobs
// Supports: tenant-specific SMTP config (white-label), fallback to platform SMTP
// ─────────────────────────────────────────────────────────────────────────────

async function getTransporter(tenantId?: string): Promise<nodemailer.Transporter> {
  if (tenantId) {
    const tenantSmtp = await basePrisma.tenantSmtp.findUnique({
      where: { tenantId },
    });

    if (tenantSmtp?.isVerified) {
      return nodemailer.createTransport({
        host: tenantSmtp.host,
        port: tenantSmtp.port,
        secure: tenantSmtp.secure,
        auth: { user: tenantSmtp.username, pass: tenantSmtp.password },
      });
    }
  }

  // Platform fallback SMTP
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

async function getFromAddress(tenantId?: string): Promise<{ name: string; address: string }> {
  if (tenantId) {
    const data = await Promise.all([
      basePrisma.tenantSmtp.findUnique({ where: { tenantId }, select: { fromName: true, fromEmail: true } }),
      basePrisma.tenantBranding.findUnique({ where: { tenantId }, select: { appName: true } }),
    ]);

    const [smtp, branding] = data;
    if (smtp) {
      return { name: smtp.fromName || branding?.appName || config.smtp.fromName, address: smtp.fromEmail };
    }
  }

  return { name: config.smtp.fromName, address: config.smtp.fromEmail };
}

export function createEmailWorker() {
  return createWorker<EmailJob>("email", async (job: Job<EmailJob>) => {
    const { to, cc, bcc, subject, htmlBody, textBody, from, tenantId } = job.data;

    logger.info("Processing email job", {
      jobId: job.id,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      tenantId,
    });

    const transporter = await getTransporter(tenantId);
    const fromAddress = from ? { name: from.name, address: from.email } : await getFromAddress(tenantId);

    await transporter.sendMail({
      from: `"${fromAddress.name}" <${fromAddress.address}>`,
      to: Array.isArray(to) ? to.join(", ") : to,
      cc: cc?.join(", "),
      bcc: bcc?.join(", "),
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]*>/g, ""),
    });

    logger.info("Email sent successfully", { jobId: job.id, subject });
  }, { concurrency: 10 });
}
