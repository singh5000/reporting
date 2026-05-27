import { basePrisma } from "@360crd/database";
import type { SubmitAuditDtoType } from "./audit.dto";
import { eventBus, Events } from "@360crd/event-bus";
import { notificationQueue } from "@360crd/queue";

export class AuditService {
  // ── Calculate score from responses ───────────────────────────────────────
  async calculateScore(auditId: string, responses: SubmitAuditDtoType["responses"]) {
    const audit = await basePrisma.audit.findUnique({
      where: { id: auditId },
      include: {
        template: {
          include: {
            sections: { include: { questions: true } },
          },
        },
      },
    });

    if (!audit?.template) {
      // No template — no scoring
      return { score: null, maxScore: null, percentage: null, passed: null };
    }

    let totalScore = 0;
    let totalMaxScore = 0;

    for (const section of audit.template.sections) {
      const sectionWeight = section.weight / 100;

      for (const question of section.questions) {
        const response = responses.find(r => r.questionId === question.id);
        if (!question.isRequired && !response) continue;

        const maxScore = question.weight;
        totalMaxScore += maxScore * sectionWeight;

        if (!response) continue;

        let questionScore = 0;
        switch (question.type) {
          case "YES_NO":
            if (question.expectedAnswer) {
              questionScore = response.booleanAnswer?.toString() === question.expectedAnswer ? maxScore : 0;
            } else {
              questionScore = response.booleanAnswer ? maxScore : 0;
            }
            break;

          case "RATING":
            const max = question.maxValue ?? 5;
            const min = question.minValue ?? 1;
            const val = response.numericAnswer ?? min;
            questionScore = ((val - min) / (max - min)) * maxScore;
            break;

          case "NUMBER":
            if (question.expectedAnswer) {
              const expected = parseFloat(question.expectedAnswer);
              questionScore = response.numericAnswer === expected ? maxScore : 0;
            } else {
              questionScore = response.numericAnswer !== undefined ? maxScore : 0;
            }
            break;

          case "SINGLE_CHOICE":
          case "MULTIPLE_CHOICE":
            if (question.expectedAnswer && response.selectedOptions?.includes(question.expectedAnswer)) {
              questionScore = maxScore;
            } else if (!question.expectedAnswer && response.selectedOptions?.length > 0) {
              questionScore = maxScore;
            }
            break;

          case "TEXT":
          case "DATE":
          case "PHOTO":
          case "SIGNATURE":
            questionScore = response.answer || response.evidenceUrls?.length ? maxScore : 0;
            break;
        }

        totalScore += questionScore * sectionWeight;
      }
    }

    const percentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    const passingScore = audit.template.passingScore ?? 70;
    const passed = percentage >= passingScore;

    return {
      score: Math.round(totalScore * 100) / 100,
      maxScore: Math.round(totalMaxScore * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
      passed,
    };
  }

  // ── Generate ref number ───────────────────────────────────────────────────
  async generateRefNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await basePrisma.audit.count({
      where: { tenantId, refNumber: { startsWith: `AUD-${year}-` } },
    });
    return `AUD-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  // ── Notify assigned user ──────────────────────────────────────────────────
  async notifyAssignment(auditId: string, assignedToId: string, tenantId: string) {
    const audit = await basePrisma.audit.findUnique({ where: { id: auditId }, select: { refNumber: true, title: true } });

    eventBus.publish({
      type: "audit.assigned",
      tenantId,
      userId: assignedToId,
      payload: { auditId, assignedToId },
    });

    await notificationQueue.add("audit-assigned", {
      tenantId,
      userId: assignedToId,
      type: "audit_assigned",
      title: "Audit Assigned",
      message: `You have been assigned audit ${audit?.refNumber ?? ""}: ${audit?.title ?? ""}`,
      channel: "in-app",
      data: { auditId, refNumber: audit?.refNumber },
    });
  }

  // ── Create findings-based CAPA items ─────────────────────────────────────
  async autoCreateFindings(auditId: string, responses: SubmitAuditDtoType["responses"], tenantId: string) {
    const audit = await basePrisma.audit.findUnique({
      where: { id: auditId },
      include: { template: { include: { sections: { include: { questions: true } } } } },
    });

    if (!audit?.template) return;

    const nonCompliantResponses = [];

    for (const section of audit.template.sections) {
      for (const question of section.questions) {
        const response = responses.find(r => r.questionId === question.id);
        if (!response || !question.expectedAnswer) continue;

        let isCompliant = true;
        if (question.type === "YES_NO") {
          isCompliant = response.booleanAnswer?.toString() === question.expectedAnswer;
        } else if (question.type === "SINGLE_CHOICE") {
          isCompliant = response.selectedOptions?.includes(question.expectedAnswer);
        }

        if (!isCompliant) {
          nonCompliantResponses.push({ question: question.text, sectionTitle: section.title });
        }
      }
    }

    // Auto-create OBSERVATION findings for non-compliant responses
    for (const nc of nonCompliantResponses) {
      await basePrisma.auditFinding.create({
        data: {
          tenantId,
          auditId,
          type: "NON_CONFORMANCE",
          title: `Non-conformance: ${nc.question}`,
          description: `Question "${nc.question}" in section "${nc.sectionTitle}" did not meet the expected answer.`,
          severity: "MINOR",
          status: "OPEN",
          evidenceUrls: [],
        },
      });
    }

    // Update findings count on audit
    await basePrisma.audit.update({
      where: { id: auditId },
      data: { nonConformances: nonCompliantResponses.length },
    });
  }
}
