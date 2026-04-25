import { eq, like, desc } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { postQueries } from "@/db/queries/posts";
import { commentQueries } from "@/db/queries/comments";
import { requireAuth, getUserId } from "./helpers";
import type { GraphQLContext } from "../types";
import type { User, Comment } from "@/db/schema";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const stripPassword = ({ passwordHash: _ph, ...user }: User) => user;

const formatUser = (user: User) => ({
  ...stripPassword(user),
  createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
});

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export const userResolvers = {
  Query: {
    users: async (
      _: unknown,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number }
    ): Promise<Omit<User, "passwordHash">[]> => {
      try {
        const allUsers = await db.select().from(users).limit(limit).offset(offset);
        return allUsers.map(stripPassword);
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new GraphQLError("Failed to fetch users", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    searchUsers: async (
      _: unknown,
      { query, limit = 20, offset = 0 }: { query: string; limit?: number; offset?: number }
    ): Promise<Omit<User, "passwordHash">[]> => {
      try {
        if (query.length < 2) {
          throw new GraphQLError("Search query must be at least 2 characters", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        const result = await db
          .select()
          .from(users)
          .where(like(users.username, `%${query}%`))
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset);

        return result.map(stripPassword);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        console.error("Error searching users:", error);
        throw new GraphQLError("Failed to search users", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    user: async (
      _: unknown,
      { id }: { id: string }
    ): Promise<Omit<User, "passwordHash"> | null> => {
      try {
        const [found] = await db
          .select()
          .from(users)
          .where(eq(users.id, parseInt(id)))
          .limit(1);

        return found ? stripPassword(found) : null;
      } catch (error) {
        console.error("Error fetching user:", error);
        throw new GraphQLError("Failed to fetch user", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    me: async (
      _: unknown,
      __: unknown,
      context: GraphQLContext
    ): Promise<Omit<User, "passwordHash"> | null> => {
      try {
        const userId = getUserId(context);
        if (!userId) return null;

        const [found] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        return found ? stripPassword(found) : null;
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
      { userId, input }: { userId: string; input: { username?: string; email?: string } },
      context: GraphQLContext
    ) => {
      try {
        const currentUserId = requireAuth(context);

        if (currentUserId !== parseInt(userId)) {
          throw new GraphQLError("Unauthorized", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        if (input.username) {
          const [existing] = await db
            .select()
            .from(users)
            .where(eq(users.username, input.username))
            .limit(1);

          if (existing && existing.id !== currentUserId) {
            throw new GraphQLError("Username already exists", {
              extensions: { code: "USERNAME_EXISTS" },
            });
          }
        }

        if (input.email) {
          const [existing] = await db
            .select()
            .from(users)
            .where(eq(users.email, input.email))
            .limit(1);

          if (existing && existing.id !== currentUserId) {
            throw new GraphQLError("Email already exists", {
              extensions: { code: "EMAIL_EXISTS" },
            });
          }
        }

        const [updated] = await db
          .update(users)
          .set(input)
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
  },

  // ---------------------------------------------------------------------------
  // Field resolvers on User type
  // ---------------------------------------------------------------------------

  User: {
    posts: async (
      parent: { id: number },
      { limit = 20, offset = 0 }: { limit?: number; offset?: number }
    ) => {
      try {
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
        return await commentQueries.getByAuthor(parent.id, limit, offset);
      } catch (error) {
        console.error("Error fetching user comments:", error);
        return [];
      }
    },
  },
};