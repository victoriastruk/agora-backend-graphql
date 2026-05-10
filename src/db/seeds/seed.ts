import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { users, communities, communityMembers } from "@/db/schema";
import { AuthUtils } from "@/utils/auth";
import usersJson from "./data/users.json";
import communitiesJson from "./data/communities.json";

export async function seed() {
  try {
    console.log("Seeding from JSON...");

    await db.execute(sql`
      TRUNCATE TABLE 
        users,
        communities,
        community_members,
        community_moderators
      RESTART IDENTITY CASCADE
    `);

    const insertedUsers = await db
      .insert(users)
      .values(
        await Promise.all(
          usersJson.map(async (u) => ({
            username: u.username,
            email: u.email,
            passwordHash: await AuthUtils.hashPassword(u.password),
          }))
        )
      )
      .returning();

    const userMap = new Map(insertedUsers.map((u) => [u.username, u.id]));

    const insertedCommunities = await db
      .insert(communities)
      .values(
        communitiesJson.map((c) => ({
          name: c.name,
          displayName: c.displayName,
          description: c.description,
          iconUrl: c.iconUrl,
          bannerUrl: c.bannerUrl,
          creatorId: userMap.get(c.creator)!,
        }))
      )
      .returning();

    const communityMap = new Map(
      insertedCommunities.map((c) => [c.name, c.id])
    );

    await db.insert(communityMembers).values([
      ...insertedCommunities.map((c) => ({
        userId: c.creatorId!,
        communityId: c.id,
      })),
    ]);

    await db.execute(sql`
      UPDATE communities c
      SET member_count = sub.count
      FROM (
        SELECT community_id, COUNT(*) as count
        FROM community_members
        GROUP BY community_id
      ) sub
      WHERE c.id = sub.community_id
    `);

    console.log("Seed complete");
  } catch (e) {
    console.error("Seed failed:", e);
    process.exit(1);
  }
}
if (require.main === module) {
  seed().then(() => process.exit(0));
}
