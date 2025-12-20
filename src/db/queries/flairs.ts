import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { flairs } from "@/db/schema";
import type { Flair, NewFlair } from "@/db/schema";

export const flairQueries = {
  async getByCommunity(communityId: number): Promise<Flair[]> {
    return await db
      .select()
      .from(flairs)
      .where(eq(flairs.communityId, communityId))
      .orderBy(flairs.id);
  },

  async getById(id: number): Promise<Flair | null> {
    const result = await db.select().from(flairs).where(eq(flairs.id, id)).limit(1);
    return result[0] || null;
  },

  async create(data: NewFlair): Promise<Flair> {
    const result = await db.insert(flairs).values(data).returning();
    return result[0];
  },

  async update(id: number, data: Partial<Flair>): Promise<Flair | null> {
    const result = await db.update(flairs).set(data).where(eq(flairs.id, id)).returning();
    return result[0] || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(flairs).where(eq(flairs.id, id)).returning();
    return result.length > 0;
  },
};
