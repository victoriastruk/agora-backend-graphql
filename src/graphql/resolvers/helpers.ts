import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { db } from "@/db/client";
import { users, communities, posts, comments } from "@/db/schema";
import { communityQueries } from "@/db/queries/communities";
import { postQueries } from "@/db/queries/posts";
import { commentQueries } from "@/db/queries/comments";
import type { GraphQLContext } from "../types";
import type { Post, Comment, Report } from "@/db/schema";

export const MAX_COMMENT_DEPTH = 10;

export const getUserId = (context: GraphQLContext): number | undefined => {
  return context?.userId;
};

export const requireAuth = (context: GraphQLContext): number => {
  const userId = getUserId(context);
  if (!userId) {
    throw new GraphQLError("Not authenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return userId;
};

export const requireCommunityMembership = async (
  userId: number,
  communityId: number
): Promise<void> => {
  const isMember = await communityQueries.isMember(userId, communityId);
  if (!isMember) {
    throw new GraphQLError("Join the community to perform this action", {
      extensions: { code: "FORBIDDEN" },
    });
  }
};

const getReportCommunityId = async (report: Report): Promise<number | null> => {
  if (report.postId) {
    const post = await postQueries.getById(report.postId);
    return post?.communityId ?? null;
  }

  if (report.commentId) {
    const comment = await commentQueries.getById(report.commentId);
    if (!comment) return null;
    const post = await postQueries.getById(comment.postId);
    return post?.communityId ?? null;
  }

  return null;
};

export const canModerateReport = async (
  userId: number,
  report: Report
): Promise<boolean> => {
  const communityId = await getReportCommunityId(report);
  if (!communityId) return false;
  return communityQueries.isModerator(userId, communityId);
};

export const ensureCanViewReport = async (
  userId: number,
  report: Report
): Promise<void> => {
  const isReporter = report.reporterId === userId;
  const isModerator = await canModerateReport(userId, report);

  if (!isReporter && !isModerator) {
    throw new GraphQLError(
      "Only moderators of the related community or the reporter can view this report",
      { extensions: { code: "FORBIDDEN" } }
    );
  }
};

export const ensureCanResolveReport = async (
  userId: number,
  report: Report
): Promise<void> => {
  const isModerator = await canModerateReport(userId, report);
  if (!isModerator) {
    throw new GraphQLError(
      "Only moderators of the related community can resolve this report",
      { extensions: { code: "FORBIDDEN" } }
    );
  }
};

export const enrichPost = async (post: Post, userId?: number) => {
  const enrichedPost = await postQueries.getByIdWithRelations(post.id, userId);
  if (!enrichedPost) return null;

  const [community, author] = await Promise.all([
    db.select().from(communities).where(eq(communities.id, post.communityId)).limit(1),
    db.select().from(users).where(eq(users.id, post.authorId)).limit(1),
  ]);

  return {
    ...enrichedPost,
    community: community[0]
      ? {
          id: community[0].id,
          name: community[0].name,
          displayName: community[0].displayName,
          iconUrl: community[0].iconUrl,
          memberCount: community[0].memberCount,
          createdAt: community[0].createdAt,
          updatedAt: community[0].updatedAt,
          isJoined: userId ? await communityQueries.isMember(userId, community[0].id) : false,
        }
      : null,
    author: author[0]
      ? {
          id: author[0].id,
          username: author[0].username,
          name: author[0].name,
          email: author[0].email,
          createdAt: author[0].createdAt,
        }
      : null,
  };
};

export const enrichComment = async (
  comment: Comment & { replies?: Comment[] },
  userId?: number,
  depth = 0
): Promise<any> => {
  // Prevent stack overflow on deeply nested comments
  if (depth > MAX_COMMENT_DEPTH) {
    return {
      ...comment,
      author: null,
      replies: [],
    };
  }

  const author = await db.select().from(users).where(eq(users.id, comment.authorId)).limit(1);

  const enrichedReplies =
    comment.replies && comment.replies.length > 0
      ? await Promise.all(
          comment.replies.map((reply: Comment) =>
            enrichComment(reply as Comment & { replies?: Comment[] }, userId, depth + 1)
          )
        )
      : [];

  return {
    ...comment,
    author: author[0]
      ? {
          id: author[0].id,
          username: author[0].username,
          name: author[0].name,
          email: author[0].email,
          createdAt: author[0].createdAt,
        }
      : null,
    replies: enrichedReplies,
  };
};

export const enrichReport = async (report: Report) => {
  const [reporter, post, comment, resolver] = await Promise.all([
    db.select().from(users).where(eq(users.id, report.reporterId)).limit(1),
    report.postId
      ? db.select().from(posts).where(eq(posts.id, report.postId)).limit(1)
      : Promise.resolve([]),
    report.commentId
      ? db.select().from(comments).where(eq(comments.id, report.commentId)).limit(1)
      : Promise.resolve([]),
    report.resolvedBy
      ? db.select().from(users).where(eq(users.id, report.resolvedBy)).limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ...report,
    reporter: reporter[0]
      ? {
          id: reporter[0].id,
          username: reporter[0].username,
          name: reporter[0].name,
          email: reporter[0].email,
          createdAt: reporter[0].createdAt,
        }
      : null,
    post: (post as any[])[0] || null,
    comment: (comment as any[])[0] || null,
    resolvedBy: (resolver as any[])[0]
      ? {
          id: (resolver as any[])[0].id,
          username: (resolver as any[])[0].username,
          name: (resolver as any[])[0].name,
          email: (resolver as any[])[0].email,
          createdAt: (resolver as any[])[0].createdAt,
        }
      : null,
  };
};
