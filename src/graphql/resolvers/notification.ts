import { GraphQLError } from "graphql";
import { withFilter } from "graphql-subscriptions";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, posts, comments } from "@/db/schema";
import { notificationQueries } from "@/db/queries/notifications";
import { pubsub, Events } from "../pubsub";
import { requireAuth } from "./helpers";
import type { GraphQLContext } from "../types";
import type { Notification } from "@/db/schema";

const enrichNotification = async (notification: Notification) => {
  const [actor, post, comment] = await Promise.all([
    notification.actorId
      ? db.select().from(users).where(eq(users.id, notification.actorId)).limit(1)
      : Promise.resolve([]),
    notification.postId
      ? db.select().from(posts).where(eq(posts.id, notification.postId)).limit(1)
      : Promise.resolve([]),
    notification.commentId
      ? db.select().from(comments).where(eq(comments.id, notification.commentId)).limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ...notification,
    actor: (actor as any[])[0] || null,
    post: (post as any[])[0] || null,
    comment: (comment as any[])[0] || null,
  };
};

export const notificationResolvers = {
  Query: {
    notifications: async (
      _: unknown,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);
        const items = await notificationQueries.getByUserId(userId, limit, offset);
        return Promise.all(items.map(enrichNotification));
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch notifications", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    unreadNotificationsCount: async (_: unknown, __: unknown, context: GraphQLContext) => {
      try {
        const userId = requireAuth(context);
        return notificationQueries.getUnreadCount(userId);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch unread count", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Mutation: {
    markNotificationAsRead: async (
      _: unknown,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);
        const notification = await notificationQueries.markAsRead(parseInt(id), userId);
        if (!notification) {
          throw new GraphQLError("Notification not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }
        return enrichNotification(notification);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to mark notification as read", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    markAllNotificationsAsRead: async (_: unknown, __: unknown, context: GraphQLContext) => {
      try {
        const userId = requireAuth(context);
        await notificationQueries.markAllAsRead(userId);
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to mark all notifications as read", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    clearNotification: async (
      _: unknown,
      { id }: { id: string },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);
        const deleted = await notificationQueries.deleteOne(parseInt(id), userId);
        if (!deleted) {
          throw new GraphQLError("Notification not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to delete notification", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    clearAllNotifications: async (_: unknown, __: unknown, context: GraphQLContext) => {
      try {
        const userId = requireAuth(context);
        return notificationQueries.deleteAll(userId);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to clear notifications", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Subscription: {
    notificationReceived: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(Events.NOTIFICATION_RECEIVED),
        (
          payload: { notificationReceived: { userId: number } } | undefined,
          _variables: unknown,
          context: GraphQLContext
        ) => {
          if (!payload || !context.userId) return false;
          return payload.notificationReceived.userId === context.userId;
        }
      ),
    },
  },
};

export { enrichNotification };
