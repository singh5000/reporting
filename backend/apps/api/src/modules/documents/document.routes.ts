import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";
import { createHash } from "crypto";
import { uploadFile, getPresignedDownloadUrl, deleteFile, buildStorageKey } from "../../shared/storage/s3.service";
import { NotFoundError } from "../../shared/errors/http.errors";

export default async function documentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("document:read")] }, async (req, reply) => {
    const { category, status, page = 1, limit = 20 } = req.query as any;
    const where: any = { deletedAt: null, ...(category && { category }), ...(status && { status }) };
    const [total, data] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });

  fastify.get("/:id", { preHandler: [authorize("document:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        versions: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!doc) throw new NotFoundError("Document");
    return reply.send({ success: true, data: doc });
  });

  fastify.get("/:id/download", { preHandler: [authorize("document:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundError("Document");

    const signedUrl = await getPresignedDownloadUrl(doc.storageKey ?? doc.fileUrl, 3600);
    return reply.send({ success: true, data: { url: signedUrl, expiresIn: 3600 } });
  });

  fastify.post("/upload", { preHandler: [authorize("document:create")] }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ success: false, error: { code: "NO_FILE", message: "No file uploaded" } });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const checksum = createHash("sha256").update(buffer).digest("hex");

    const tenantId = (req as any).tenantId;
    const storageKey = buildStorageKey(tenantId, "documents", data.filename);

    const { url: fileUrl } = await uploadFile(storageKey, buffer, data.mimetype, {
      tenantId,
      uploadedBy: (req as any).userId,
      originalName: data.filename,
    });

    const doc = await prisma.document.create({
      data: {
        tenantId,
        uploadedById: (req as any).userId,
        title: data.filename,
        filename: data.filename,
        fileUrl,
        storageKey,
        fileSize: buffer.length,
        mimeType: data.mimetype,
        checksum,
        status: "DRAFT",
        version: "1.0",
      },
    });

    return reply.status(201).send({ success: true, data: doc });
  });

  fastify.delete("/:id", { preHandler: [authorize("document:delete")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundError("Document");

    if (doc.storageKey) {
      await deleteFile(doc.storageKey).catch(() => {});
    }

    await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ success: true });
  });
}
