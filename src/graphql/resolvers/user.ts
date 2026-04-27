import { GraphQLError } from "graphql";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, userSocialLinks } from "@/db/schema";
import { requireAuth, getUserId } from "@/graphql/resolvers/helpers";
import type { GraphQLContext } from "@/graphql/types";
import type { User } from "@/db/schema";

function stripPassword(user: User) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

function formatUser(user: User) {
  const safe = stripPassword(user);
  return {
    ...safe,
    socialLinks: [], 
  };
}

export const userResolvers = {
  Query: {
    users: async (
      _: unknown,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number }
    ) => {
      try {
        const result = await db.select().from(users).limit(limit).offset(offset);
        return result.map(formatUser);
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new GraphQLError("Failed to fetch users", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    user: async (_: unknown, { id }: { id: string }) => {
      try {
        const [found] = await db
          .select()
          .from(users)
          .where(eq(users.id, parseInt(id)))
          .limit(1);
        return found ? formatUser(found) : null;
      } catch (error) {
        console.error("Error fetching user:", error);
        throw new GraphQLError("Failed to fetch user", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    userByUsername: async (_: unknown, { username }: { username: string }) => {
      try {
        const [found] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);
        return found ? formatUser(found) : null;
      } catch (error) {
        console.error("Error fetching user by username:", error);
        throw new GraphQLError("Failed to fetch user", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    searchUsers: async (
      _: unknown,
      { query, limit = 20, offset = 0 }: { query: string; limit?: number; offset?: number }
    ) => {
      try {
        const { ilike } = await import("drizzle-orm");
        const result = await db
          .select()
          .from(users)
          .where(ilike(users.username, `%${query}%`))
          .limit(limit)
          .offset(offset);
        return result.map(formatUser);
      } catch (error) {
        console.error("Error searching users:", error);
        throw new GraphQLError("Failed to search users", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    me: async (
      _: unknown,
      __: unknown,
      context: GraphQLContext
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) return null;

        const [found] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        return found ? formatUser(found) : null;
      } catch (error) {
        console.error("Error fetching current user:", error);
        throw new GraphQLError("Failed to fetch current user", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Mutation: {
    updateUser: async (
      _: unknown,
      {
        userId,
        input,
      }: {
        userId: string;
        input: {
          name?: string;
          bio?: string;
          avatarUrl?: string;
          bannerUrl?: string;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const currentUserId = requireAuth(context);

        if (currentUserId !== parseInt(userId)) {
          throw new GraphQLError("Unauthorized", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        // Filter out undefined fields
        const updateData: Record<string, unknown> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.bio !== undefined) updateData.bio = input.bio;
        if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
        if (input.bannerUrl !== undefined) updateData.bannerUrl = input.bannerUrl;

        if (Object.keys(updateData).length === 0) {
          throw new GraphQLError("No fields to update", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        const [updated] = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, currentUserId))
          .returning();

        if (!updated) {
          throw new GraphQLError("User not found", {
            extensions: { code: "USER_NOT_FOUND" },
          });
        }

        return formatUser(updated);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error("Update user error:", error);
        throw new GraphQLError("Internal server error", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    deleteUser: async (
      _: unknown,
      { userId }: { userId: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      try {
        const currentUserId = requireAuth(context);

        if (currentUserId !== parseInt(userId)) {
          throw new GraphQLError("Unauthorized", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.id, currentUserId))
          .limit(1);

        if (!existing) {
          throw new GraphQLError("User not found", {
            extensions: { code: "USER_NOT_FOUND" },
          });
        }

        await db.delete(users).where(eq(users.id, currentUserId));
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error("Delete user error:", error);
        throw new GraphQLError("Internal server error", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    addSocialLink: async (
      _: unknown,
      { input }: { input: { label: string; url: string } },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        // Get next position
        const existing = await db
          .select()
          .from(userSocialLinks)
          .where(eq(userSocialLinks.userId, userId));

        const position = existing.length;

        const [created] = await db
          .insert(userSocialLinks)
          .values({ userId, label: input.label, url: input.url, position })
          .returning();

        return created;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error("Add social link error:", error);
        throw new GraphQLError("Internal server error", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updateSocialLink: async (
      _: unknown,
      { linkId, input }: { linkId: string; input: { label?: string; url?: string } },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        const [link] = await db
          .select()
          .from(userSocialLinks)
          .where(eq(userSocialLinks.id, parseInt(linkId)))
          .limit(1);

        if (!link) {
          throw new GraphQLError("Social link not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        if (link.userId !== userId) {
          throw new GraphQLError("Unauthorized", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const updateData: Record<string, unknown> = {};
        if (input.label !== undefined) updateData.label = input.label;
        if (input.url !== undefined) updateData.url = input.url;

        const [updated] = await db
          .update(userSocialLinks)
          .set(updateData)
          .where(eq(userSocialLinks.id, parseInt(linkId)))
          .returning();

        return updated;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error("Update social link error:", error);
        throw new GraphQLError("Internal server error", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    removeSocialLink: async (
      _: unknown,
      { linkId }: { linkId: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      try {
        const userId = requireAuth(context);

        const [link] = await db
          .select()
          .from(userSocialLinks)
          .where(eq(userSocialLinks.id, parseInt(linkId)))
          .limit(1);

        if (!link) {
          throw new GraphQLError("Social link not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        if (link.userId !== userId) {
          throw new GraphQLError("Unauthorized", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        await db
          .delete(userSocialLinks)
          .where(eq(userSocialLinks.id, parseInt(linkId)));

        return true;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error("Remove social link error:", error);
        throw new GraphQLError("Internal server error", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  User: {
    posts: async (
      parent: { id: number },
      { limit = 20, offset = 0 }: { limit?: number; offset?: number }
    ) => {
      try {
        const { postQueries } = await import("@/db/queries/posts");
        return await postQueries.getByAuthor(parent.id, limit, offset);
      } catch (error) {
        console.error("Error fetching user posts:", error);
        return [];
      }
    },

    comments: async (
      parent: { id: number },
      { limit = 20, offset = 0 }: { limit?: number; offset?: number }
    ) => {
      try {
        const { commentQueries } = await import("@/db/queries/comments");
        return await commentQueries.getByAuthor(parent.id, limit, offset);
      } catch (error) {
        console.error("Error fetching user comments:", error);
        return [];
      }
    },

    socialLinks: async (parent: { id: number }) => {
      try {
        const links = await db
          .select()
          .from(userSocialLinks)
          .where(eq(userSocialLinks.userId, parent.id))
          .orderBy(userSocialLinks.position);
        return links;
      } catch (error) {
        console.error("Error fetching user social links:", error);
        return [];
      }
    },
  },
};