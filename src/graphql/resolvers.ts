// import { eq } from "drizzle-orm";
// import { db } from "@/db/client";
// import { users, communities, postFlairs, posts, comments } from "@/db/schema";
// import { communityQueries } from "@/db/queries/communities";
// import { postQueries } from "@/db/queries/posts";
// import { commentQueries } from "@/db/queries/comments";
// import { flairQueries } from "@/db/queries/flairs";
// import { reportQueries } from "@/db/queries/reports";
// import { PubSub } from "graphql-subscriptions";
// import { withFilter } from "graphql-subscriptions";
// import { GraphQLError } from "graphql";
// import { AuthQueries } from "@/db/queries/auth";
// import type { User, Post, Comment, Community, Report } from "@/db/schema";

// export const pubsub = new PubSub();

// export const POST_ADDED = "POST_ADDED";
// export const POST_UPDATED = "POST_UPDATED";
// export const POST_VOTED = "POST_VOTED";
// export const COMMENT_ADDED = "COMMENT_ADDED";
// export const COMMENT_VOTED = "COMMENT_VOTED";

// // Type definitions for GraphQL context
// type GraphQLContext = {
//   userId?: number;
//   pubsub: PubSub;
// };

// // Maximum depth for nested comment enrichment to prevent stack overflow
// const MAX_COMMENT_DEPTH = 10;

// const getUserId = (context: GraphQLContext): number | undefined => {
//   return context?.userId;
// };

// const requireAuth = (context: GraphQLContext): number => {
//   const userId = getUserId(context);
//   if (!userId) {
//     throw new GraphQLError("Not authenticated", {
//       extensions: { code: "UNAUTHENTICATED" },
//     });
//   }
//   return userId;
// };

// const requireCommunityMembership = async (userId: number, communityId: number): Promise<void> => {
//   const isMember = await communityQueries.isMember(userId, communityId);
//   if (!isMember) {
//     throw new GraphQLError("Join the community to perform this action", {
//       extensions: { code: "FORBIDDEN" },
//     });
//   }
// };

// const getReportCommunityId = async (report: Report): Promise<number | null> => {
//   if (report.postId) {
//     const post = await postQueries.getById(report.postId);
//     return post?.communityId ?? null;
//   }

//   if (report.commentId) {
//     const comment = await commentQueries.getById(report.commentId);
//     if (!comment) return null;
//     const post = await postQueries.getById(comment.postId);
//     return post?.communityId ?? null;
//   }

//   return null;
// };

// const canModerateReport = async (userId: number, report: Report): Promise<boolean> => {
//   const communityId = await getReportCommunityId(report);
//   if (!communityId) return false;
//   return communityQueries.isModerator(userId, communityId);
// };

// const ensureCanViewReport = async (userId: number, report: Report): Promise<void> => {
//   const isReporter = report.reporterId === userId;
//   const isModerator = await canModerateReport(userId, report);

//   if (!isReporter && !isModerator) {
//     throw new GraphQLError(
//       "Only moderators of the related community or the reporter can view this report",
//       { extensions: { code: "FORBIDDEN" } }
//     );
//   }
// };

// const ensureCanResolveReport = async (userId: number, report: Report): Promise<void> => {
//   const isModerator = await canModerateReport(userId, report);
//   if (!isModerator) {
//     throw new GraphQLError("Only moderators of the related community can resolve this report", {
//       extensions: { code: "FORBIDDEN" },
//     });
//   }
// };

// const enrichPost = async (post: Post, userId?: number) => {
//   const enrichedPost = await postQueries.getByIdWithRelations(post.id, userId);
//   if (!enrichedPost) return null;

//   const [community, author] = await Promise.all([
//     db.select().from(communities).where(eq(communities.id, post.communityId)).limit(1),
//     db.select().from(users).where(eq(users.id, post.authorId)).limit(1),
//   ]);

//   return {
//     ...enrichedPost,
//     community: community[0]
//       ? {
//           id: community[0].id,
//           name: community[0].name,
//           displayName: community[0].displayName,
//           iconUrl: community[0].iconUrl,
//           memberCount: community[0].memberCount,
//           createdAt: community[0].createdAt,
//           updatedAt: community[0].updatedAt,
//           isJoined: userId ? await communityQueries.isMember(userId, community[0].id) : false,
//         }
//       : null,
//     author: author[0]
//       ? {
//           id: author[0].id,
//           username: author[0].username,
//           name: author[0].name,
//           email: author[0].email,
//           createdAt: author[0].createdAt,
//         }
//       : null,
//   };
// };

// const enrichComment = async (
//   comment: Comment & { replies?: Comment[] },
//   userId?: number,
//   depth = 0
// ): Promise<any> => {
//   // Prevent stack overflow on deeply nested comments
//   if (depth > MAX_COMMENT_DEPTH) {
//     return {
//       ...comment,
//       author: null,
//       replies: [],
//     };
//   }

//   const author = await db.select().from(users).where(eq(users.id, comment.authorId)).limit(1);

//   const enrichedReplies =
//     comment.replies && comment.replies.length > 0
//       ? await Promise.all(
//           comment.replies.map((reply: Comment) =>
//             enrichComment(reply as Comment & { replies?: Comment[] }, userId, depth + 1)
//           )
//         )
//       : [];

//   return {
//     ...comment,
//     author: author[0]
//       ? {
//           id: author[0].id,
//           username: author[0].username,
//           name: author[0].name,
//           email: author[0].email,
//           createdAt: author[0].createdAt,
//         }
//       : null,
//     replies: enrichedReplies,
//   };
// };

// const enrichReport = async (report: Report) => {
//   const [reporter, post, comment, resolver] = await Promise.all([
//     db.select().from(users).where(eq(users.id, report.reporterId)).limit(1),
//     report.postId
//       ? db.select().from(posts).where(eq(posts.id, report.postId)).limit(1)
//       : Promise.resolve([]),
//     report.commentId
//       ? db.select().from(comments).where(eq(comments.id, report.commentId)).limit(1)
//       : Promise.resolve([]),
//     report.resolvedBy
//       ? db.select().from(users).where(eq(users.id, report.resolvedBy)).limit(1)
//       : Promise.resolve([]),
//   ]);

//   return {
//     ...report,
//     reporter: reporter[0]
//       ? {
//           id: reporter[0].id,
//           username: reporter[0].username,
//           name: reporter[0].name,
//           email: reporter[0].email,
//           createdAt: reporter[0].createdAt,
//         }
//       : null,
//     post: post[0] || null,
//     comment: comment[0] || null,
//     resolvedBy: resolver[0]
//       ? {
//           id: resolver[0].id,
//           username: resolver[0].username,
//           name: resolver[0].name,
//           email: resolver[0].email,
//           createdAt: resolver[0].createdAt,
//         }
//       : null,
//   };
// };

// export const resolvers = {
//   DateTime: {
//     parseValue: (value: string) => new Date(value),
//     serialize: (value: Date | string) => (value instanceof Date ? value.toISOString() : value),
//     parseLiteral: (ast: { kind: string; value: string }) => {
//       if (ast.kind === "StringValue") {
//         return new Date(ast.value);
//       }
//       return null;
//     },
//   },

//   Query: {
//     posts: async (
//       _parent: unknown,
//       {
//         communityId,
//         region: _region,
//         sort,
//         limit,
//         offset,
//       }: {
//         communityId?: string;
//         region?: string;
//         sort?: string;
//         limit?: number;
//         offset?: number;
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = getUserId(context);
//         if (communityId) {
//           const posts = await postQueries.getByCommunity(parseInt(communityId), limit, offset);
//           return Promise.all(posts.map((post) => enrichPost(post, userId)));
//         } else {
//           const posts = await postQueries.getFeed(
//             (sort as "best" | "hot" | "new" | "rising" | "top") || "best",
//             limit,
//             offset,
//             userId
//           );
//           return Promise.all(posts.map((post) => enrichPost(post, userId)));
//         }
//       } catch (error) {
//         console.error("Query.posts error:", error);
//         throw new GraphQLError("Failed to fetch posts", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     users: async (
//       _: unknown,
//       { limit = 20, offset = 0 }: { limit?: number; offset?: number }
//     ): Promise<Omit<User, "passwordHash">[]> => {
//       try {
//         const allUsers = await db.select().from(users).limit(limit).offset(offset);
//         return allUsers.map(({ passwordHash: _passwordHash, ...user }) => user);
//       } catch (error) {
//         console.error("Error fetching users:", error);
//         throw new GraphQLError("Failed to fetch users", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     searchUsers: async (
//       _: unknown,
//       { query, limit = 20, offset = 0 }: { query: string; limit?: number; offset?: number }
//     ): Promise<Omit<User, "passwordHash">[]> => {
//       try {
//         if (query.length < 2) {
//           throw new GraphQLError("Search query must be at least 2 characters long", {
//             extensions: { code: "INVALID_QUERY" },
//           });
//         }
//         return await AuthQueries.searchUsers(query, limit, offset);
//       } catch (error) {
//         console.error("Error searching users:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to search users", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     user: async (
//       _: unknown,
//       { id }: { id: string }
//     ): Promise<Omit<User, "passwordHash"> | null> => {
//       try {
//         const result = await db
//           .select()
//           .from(users)
//           .where(eq(users.id, parseInt(id)))
//           .limit(1);
//         if (!result[0]) return null;
//         const { passwordHash: _passwordHash, ...safeUser } = result[0];
//         return safeUser;
//       } catch (error) {
//         console.error("Error fetching user:", error);
//         throw new GraphQLError("Failed to fetch user", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     communities: async (
//       _: unknown,
//       { limit = 20, offset = 0 }: { limit?: number; offset?: number }
//     ) => {
//       try {
//         return await communityQueries.getAll(limit, offset);
//       } catch (error) {
//         console.error("Error fetching communities:", error);
//         throw new GraphQLError("Failed to fetch communities", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     community: async (_: unknown, { id }: { id?: string }) => {
//       try {
//         if (!id) return null;
//         return await communityQueries.getById(parseInt(id));
//       } catch (error) {
//         console.error("Error fetching community:", error);
//         throw new GraphQLError("Failed to fetch community", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     communityByName: async (_: unknown, { name }: { name: string }) => {
//       try {
//         return await communityQueries.getByName(name);
//       } catch (error) {
//         console.error("Error fetching community by name:", error);
//         throw new GraphQLError("Failed to fetch community", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     popularCommunities: async (_: unknown, { limit = 10 }: { limit?: number }) => {
//       try {
//         return await communityQueries.getPopular(limit);
//       } catch (error) {
//         console.error("Error fetching popular communities:", error);
//         throw new GraphQLError("Failed to fetch popular communities", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     searchCommunities: async (
//       _: unknown,
//       { query, limit = 20, offset = 0 }: { query: string; limit?: number; offset?: number }
//     ) => {
//       try {
//         return await communityQueries.search(query, limit, offset);
//       } catch (error) {
//         console.error("Error searching communities:", error);
//         throw new GraphQLError("Failed to search communities", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     post: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
//       try {
//         const userId = getUserId(context);
//         const post = await postQueries.getById(parseInt(id));
//         if (!post) return null;
//         return enrichPost(post, userId);
//       } catch (error) {
//         console.error("Error fetching post:", error);
//         throw new GraphQLError("Failed to fetch post", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     feed: async (
//       _: unknown,
//       { sort = "best", limit = 20, offset = 0 }: { sort?: string; limit?: number; offset?: number },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = getUserId(context);
//         const posts = await postQueries.getFeed(
//           sort as "best" | "hot" | "new" | "rising" | "top",
//           limit,
//           offset,
//           userId
//         );
//         return Promise.all(posts.map((post) => enrichPost(post, userId)));
//       } catch (error) {
//         console.error("Error fetching feed:", error);
//         throw new GraphQLError("Failed to fetch feed", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     topStories: async (_: unknown, { limit = 6 }: { limit?: number }, context: GraphQLContext) => {
//       try {
//         const userId = getUserId(context);
//         const posts = await postQueries.getTopStories(limit);
//         return Promise.all(posts.map((post) => enrichPost(post, userId)));
//       } catch (error) {
//         console.error("Error fetching top stories:", error);
//         throw new GraphQLError("Failed to fetch top stories", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     postsByCommunity: async (
//       _: unknown,
//       {
//         communityId,
//         limit = 20,
//         offset = 0,
//       }: { communityId: string; limit?: number; offset?: number },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = getUserId(context);
//         const posts = await postQueries.getByCommunity(parseInt(communityId), limit, offset);
//         return Promise.all(posts.map((post) => enrichPost(post, userId)));
//       } catch (error) {
//         console.error("Error fetching posts by community:", error);
//         throw new GraphQLError("Failed to fetch posts by community", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     userPosts: async (
//       _: unknown,
//       { userId, limit = 20, offset = 0 }: { userId: string; limit?: number; offset?: number },
//       context: GraphQLContext
//     ) => {
//       try {
//         const currentUserId = getUserId(context);
//         const posts = await postQueries.getByAuthor(parseInt(userId), limit, offset);
//         return Promise.all(posts.map((post) => enrichPost(post, currentUserId)));
//       } catch (error) {
//         console.error("Error fetching user posts:", error);
//         throw new GraphQLError("Failed to fetch user posts", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     userComments: async (
//       _: unknown,
//       { userId, limit = 20, offset = 0 }: { userId: string; limit?: number; offset?: number },
//       context: GraphQLContext
//     ) => {
//       try {
//         const currentUserId = getUserId(context);
//         const userComments = await commentQueries.getByAuthor(parseInt(userId), limit, offset);
//         return Promise.all(
//           userComments.map((comment) =>
//             enrichComment(comment as Comment & { replies?: Comment[] }, currentUserId)
//           )
//         );
//       } catch (error) {
//         console.error("Error fetching user comments:", error);
//         throw new GraphQLError("Failed to fetch user comments", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     searchPosts: async (
//       _: unknown,
//       {
//         query,
//         communityId,
//         limit = 20,
//         offset = 0,
//       }: {
//         query: string;
//         communityId?: string;
//         limit?: number;
//         offset?: number;
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = getUserId(context);
//         const posts = await postQueries.search(
//           query,
//           communityId ? parseInt(communityId) : undefined,
//           limit,
//           offset
//         );
//         return Promise.all(posts.map((post) => enrichPost(post, userId)));
//       } catch (error) {
//         console.error("Error searching posts:", error);
//         throw new GraphQLError("Failed to search posts", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     comments: async (
//       _: unknown,
//       { postId, limit = 50, offset = 0 }: { postId: string; limit?: number; offset?: number },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = getUserId(context);
//         const postComments = await commentQueries.getByPostId(
//           parseInt(postId),
//           userId,
//           limit,
//           offset
//         );
//         return Promise.all(
//           postComments.map((comment) =>
//             enrichComment(comment as Comment & { replies?: Comment[] }, userId)
//           )
//         );
//       } catch (error) {
//         console.error("Error fetching comments:", error);
//         throw new GraphQLError("Failed to fetch comments", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     comment: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
//       try {
//         const userId = getUserId(context);
//         const comment = await commentQueries.getById(parseInt(id));
//         if (!comment) return null;
//         return enrichComment(comment as Comment & { replies?: Comment[] }, userId);
//       } catch (error) {
//         console.error("Error fetching comment:", error);
//         throw new GraphQLError("Failed to fetch comment", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     savedPosts: async (
//       _: unknown,
//       { limit = 20, offset = 0 }: { limit?: number; offset?: number },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);
//         const posts = await postQueries.getSavedByUser(userId, limit, offset);
//         return Promise.all(posts.map((post) => enrichPost(post, userId)));
//       } catch (error) {
//         console.error("Error fetching saved posts:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to fetch saved posts", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     flairsByCommunity: async (_: unknown, { communityId }: { communityId: string }) => {
//       try {
//         return await flairQueries.getByCommunity(parseInt(communityId));
//       } catch (error) {
//         console.error("Error fetching flairs by community:", error);
//         throw new GraphQLError("Failed to fetch flairs", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     reports: async (
//       _: unknown,
//       { status, limit = 20, offset = 0 }: { status?: string; limit?: number; offset?: number },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);
//         const allReports = await reportQueries.getAll(status, limit, offset);

//         const allowedReports: Report[] = [];
//         for (const report of allReports) {
//           const canView = report.reporterId === userId || (await canModerateReport(userId, report));
//           if (canView) {
//             allowedReports.push(report);
//           }
//         }

//         return Promise.all(allowedReports.map(enrichReport));
//       } catch (error) {
//         console.error("Error fetching reports:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to fetch reports", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     report: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
//       try {
//         const userId = requireAuth(context);
//         const report = await reportQueries.getById(parseInt(id));
//         if (!report) return null;

//         await ensureCanViewReport(userId, report);
//         return enrichReport(report);
//       } catch (error) {
//         console.error("Error fetching report:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to fetch report", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },
//   },

//   User: {
//     posts: async (
//       parent: { id: number },
//       { limit = 20, offset = 0 }: { limit?: number; offset?: number }
//     ) => {
//       try {
//         return await postQueries.getByAuthor(parent.id, limit, offset);
//       } catch (error) {
//         console.error("Error fetching user posts:", error);
//         return [];
//       }
//     },
//     comments: async (
//       parent: { id: number },
//       { limit = 20, offset = 0 }: { limit?: number; offset?: number }
//     ) => {
//       try {
//         return await commentQueries.getByAuthor(parent.id, limit, offset);
//       } catch (error) {
//         console.error("Error fetching user comments:", error);
//         return [];
//       }
//     },
//   },

//   Community: {
//     members: async (
//       parent: { id: number },
//       { limit = 50, offset = 0 }: { limit?: number; offset?: number }
//     ) => {
//       try {
//         return await communityQueries.getMembers(parent.id, limit, offset);
//       } catch (error) {
//         console.error("Error fetching community members:", error);
//         return [];
//       }
//     },
//     moderators: async (parent: { id: number }) => {
//       try {
//         const mods = await communityQueries.getModerators(parent.id);
//         return mods.map((mod) => ({
//           user: {
//             id: mod.id,
//             username: mod.username,
//             email: mod.email,
//           },
//           role: mod.role,
//         }));
//       } catch (error) {
//         console.error("Error fetching community moderators:", error);
//         return [];
//       }
//     },
//     creator: async (parent: Community) => {
//       try {
//         if (!parent.creatorId) return null;
//         const result = await db.select().from(users).where(eq(users.id, parent.creatorId)).limit(1);
//         if (!result[0]) return null;
//         const { passwordHash: _passwordHash, ...user } = result[0];
//         return user;
//       } catch (error) {
//         console.error("Error fetching community creator:", error);
//         return null;
//       }
//     },
//     isJoined: async (parent: { id: number }, _: unknown, context: GraphQLContext) => {
//       try {
//         const userId = getUserId(context);
//         if (!userId) return false;
//         return await communityQueries.isMember(userId, parent.id);
//       } catch (error) {
//         console.error("Error checking if user joined community:", error);
//         return false;
//       }
//     },
//     isModerator: async (parent: { id: number }, _: unknown, context: GraphQLContext) => {
//       try {
//         const userId = getUserId(context);
//         if (!userId) return false;
//         return await communityQueries.isModerator(userId, parent.id);
//       } catch (error) {
//         console.error("Error checking if user is moderator:", error);
//         return false;
//       }
//     },
//   },

//   Post: {
//     comments: async (
//       parent: { id: number },
//       { limit = 50, offset = 0 }: { limit?: number; offset?: number },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = getUserId(context);
//         return await commentQueries.getByPostId(parent.id, userId, limit, offset);
//       } catch (error) {
//         console.error("Error fetching post comments:", error);
//         return [];
//       }
//     },
//   },

//   PostMedia: {
//     thumb: (parent: { thumbnailUrl?: string }) => {
//       return parent.thumbnailUrl;
//     },
//   },

//   Comment: {
//     post: async (parent: { postId: number }) => {
//       try {
//         return await postQueries.getById(parent.postId);
//       } catch (error) {
//         console.error("Error fetching comment post:", error);
//         return null;
//       }
//     },
//   },

//   Mutation: {
//     updateUser: async (
//       _: unknown,
//       { userId, input }: { userId: string; input: { username?: string; email?: string } },
//       context: GraphQLContext
//     ) => {
//       try {
//         const currentUserId = requireAuth(context);

//         if (currentUserId !== parseInt(userId)) {
//           throw new GraphQLError("Unauthorized", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         if (input.username) {
//           const existingUser = await db
//             .select()
//             .from(users)
//             .where(eq(users.username, input.username))
//             .limit(1);
//           if (existingUser[0] && existingUser[0].id !== currentUserId) {
//             throw new GraphQLError("Username already exists", {
//               extensions: { code: "USERNAME_EXISTS" },
//             });
//           }
//         }

//         if (input.email) {
//           const existingUser = await db
//             .select()
//             .from(users)
//             .where(eq(users.email, input.email))
//             .limit(1);
//           if (existingUser[0] && existingUser[0].id !== currentUserId) {
//             throw new GraphQLError("Email already exists", {
//               extensions: { code: "EMAIL_EXISTS" },
//             });
//           }
//         }

//         const result = await db
//           .update(users)
//           .set(input)
//           .where(eq(users.id, currentUserId))
//           .returning();

//         if (!result[0]) {
//           throw new GraphQLError("User not found", {
//             extensions: { code: "USER_NOT_FOUND" },
//           });
//         }

//         const { passwordHash: _, ...safeUser } = result[0];
//         return {
//           ...safeUser,
//           createdAt: safeUser.createdAt ? new Date(safeUser.createdAt).toISOString() : undefined,
//         };
//       } catch (error) {
//         console.error("Update user error:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Internal server error", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     deleteUser: async (_: unknown, { userId }: { userId: string }, context: GraphQLContext) => {
//       try {
//         const currentUserId = requireAuth(context);

//         if (currentUserId !== parseInt(userId)) {
//           throw new GraphQLError("Unauthorized", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         const existingUser = await db
//           .select()
//           .from(users)
//           .where(eq(users.id, currentUserId))
//           .limit(1);

//         if (!existingUser[0]) {
//           throw new GraphQLError("User not found", {
//             extensions: { code: "USER_NOT_FOUND" },
//           });
//         }

//         await db.delete(users).where(eq(users.id, currentUserId));
//         return true;
//       } catch (error) {
//         console.error("Delete user error:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Internal server error", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     joinCommunity: async (
//       _: unknown,
//       { communityId }: { communityId: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);
//         await communityQueries.join(userId, parseInt(communityId));
//         return await communityQueries.getById(parseInt(communityId));
//       } catch (error) {
//         console.error("Error joining community:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to join community", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     leaveCommunity: async (
//       _: unknown,
//       { communityId }: { communityId: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);
//         return await communityQueries.leave(userId, parseInt(communityId));
//       } catch (error) {
//         console.error("Error leaving community:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to leave community", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     createCommunity: async (
//       _: unknown,
//       {
//         input,
//       }: {
//         input: {
//           name: string;
//           displayName: string;
//           description?: string;
//           iconUrl?: string;
//           bannerUrl?: string;
//         };
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Create community with creator
//         const community = await communityQueries.create({
//           ...input,
//           creatorId: userId,
//         });

//         // Add creator as owner/moderator
//         await communityQueries.addModerator(community.id, userId, "owner");

//         // Auto-join the creator to the community
//         await communityQueries.join(userId, community.id);

//         return await communityQueries.getById(community.id);
//       } catch (error) {
//         console.error("Error creating community:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to create community", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     updateCommunity: async (
//       _: unknown,
//       {
//         communityId,
//         input,
//       }: {
//         communityId: string;
//         input: {
//           displayName?: string;
//           description?: string;
//           iconUrl?: string;
//           bannerUrl?: string;
//         };
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Check if user is a moderator or owner
//         const isMod = await communityQueries.isModerator(userId, parseInt(communityId));
//         if (!isMod) {
//           throw new GraphQLError("Only moderators can update community", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         const updatedCommunity = await communityQueries.update(parseInt(communityId), input);
//         if (!updatedCommunity) {
//           throw new GraphQLError("Community not found", {
//             extensions: { code: "COMMUNITY_NOT_FOUND" },
//           });
//         }

//         return updatedCommunity;
//       } catch (error) {
//         console.error("Error updating community:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to update community", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     deleteCommunity: async (
//       _: unknown,
//       { communityId }: { communityId: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Only owner can delete community
//         const isOwner = await communityQueries.isOwner(userId, parseInt(communityId));
//         if (!isOwner) {
//           throw new GraphQLError("Only the owner can delete the community", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         const community = await communityQueries.getById(parseInt(communityId));
//         if (!community) {
//           throw new GraphQLError("Community not found", {
//             extensions: { code: "COMMUNITY_NOT_FOUND" },
//           });
//         }

//         return await communityQueries.delete(parseInt(communityId));
//       } catch (error) {
//         console.error("Error deleting community:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to delete community", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     addModerator: async (
//       _: unknown,
//       { communityId, userId: targetUserId }: { communityId: string; userId: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Only owner can add moderators
//         const isOwner = await communityQueries.isOwner(userId, parseInt(communityId));
//         if (!isOwner) {
//           throw new GraphQLError("Only the owner can add moderators", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         await communityQueries.addModerator(
//           parseInt(communityId),
//           parseInt(targetUserId),
//           "moderator"
//         );
//         return await communityQueries.getById(parseInt(communityId));
//       } catch (error) {
//         console.error("Error adding moderator:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to add moderator", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     removeModerator: async (
//       _: unknown,
//       { communityId, userId: targetUserId }: { communityId: string; userId: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Only owner can remove moderators
//         const isOwner = await communityQueries.isOwner(userId, parseInt(communityId));
//         if (!isOwner) {
//           throw new GraphQLError("Only the owner can remove moderators", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         // Prevent owner from removing themselves
//         if (userId === parseInt(targetUserId)) {
//           throw new GraphQLError("Owner cannot remove themselves", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         return await communityQueries.removeModerator(
//           parseInt(communityId),
//           parseInt(targetUserId)
//         );
//       } catch (error) {
//         console.error("Error removing moderator:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to remove moderator", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     createFlair: async (
//       _: unknown,
//       {
//         input,
//       }: {
//         input: {
//           communityId: string;
//           label: string;
//           color?: string;
//           backgroundColor?: string;
//         };
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Check if user is a moderator
//         const isMod = await communityQueries.isModerator(userId, parseInt(input.communityId));
//         if (!isMod) {
//           throw new GraphQLError("Only moderators can create flairs", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         const flair = await flairQueries.create({
//           communityId: parseInt(input.communityId),
//           label: input.label,
//           color: input.color,
//           backgroundColor: input.backgroundColor,
//         });

//         return flair;
//       } catch (error) {
//         console.error("Error creating flair:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to create flair", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     updateFlair: async (
//       _: unknown,
//       {
//         flairId,
//         input,
//       }: {
//         flairId: string;
//         input: { label?: string; color?: string; backgroundColor?: string };
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Get flair to check community
//         const flair = await flairQueries.getById(parseInt(flairId));
//         if (!flair) {
//           throw new GraphQLError("Flair not found", {
//             extensions: { code: "FLAIR_NOT_FOUND" },
//           });
//         }

//         // Check if user is a moderator of the community
//         const isMod = await communityQueries.isModerator(userId, flair.communityId);
//         if (!isMod) {
//           throw new GraphQLError("Only moderators can update flairs", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         const updatedFlair = await flairQueries.update(parseInt(flairId), {
//           label: input.label,
//           color: input.color,
//           backgroundColor: input.backgroundColor,
//         });

//         return updatedFlair;
//       } catch (error) {
//         console.error("Error updating flair:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to update flair", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     deleteFlair: async (_: unknown, { flairId }: { flairId: string }, context: GraphQLContext) => {
//       try {
//         const userId = requireAuth(context);

//         // Get flair to check community
//         const flair = await flairQueries.getById(parseInt(flairId));
//         if (!flair) {
//           throw new GraphQLError("Flair not found", {
//             extensions: { code: "FLAIR_NOT_FOUND" },
//           });
//         }

//         // Check if user is a moderator of the community
//         const isMod = await communityQueries.isModerator(userId, flair.communityId);
//         if (!isMod) {
//           throw new GraphQLError("Only moderators can delete flairs", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         return await flairQueries.delete(parseInt(flairId));
//       } catch (error) {
//         console.error("Error deleting flair:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to delete flair", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     createReport: async (
//       _: unknown,
//       {
//         input,
//       }: {
//         input: {
//           postId?: string;
//           commentId?: string;
//           reason: string;
//           description?: string;
//         };
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Validate that either postId or commentId is provided, but not both
//         if ((!input.postId && !input.commentId) || (input.postId && input.commentId)) {
//           throw new GraphQLError("Must provide either postId or commentId, but not both", {
//             extensions: { code: "INVALID_INPUT" },
//           });
//         }

//         // Check if user can report this content
//         const canReport = await reportQueries.canUserReport(
//           userId,
//           input.postId ? parseInt(input.postId) : undefined,
//           input.commentId ? parseInt(input.commentId) : undefined
//         );

//         if (!canReport) {
//           throw new GraphQLError("You have already reported this content", {
//             extensions: { code: "ALREADY_REPORTED" },
//           });
//         }

//         const report = await reportQueries.create({
//           reporterId: userId,
//           postId: input.postId ? parseInt(input.postId) : null,
//           commentId: input.commentId ? parseInt(input.commentId) : null,
//           reason: input.reason as
//             | "spam"
//             | "harassment"
//             | "hate_speech"
//             | "violence"
//             | "inappropriate_content"
//             | "copyright_violation"
//             | "other",
//           description: input.description,
//         });

//         return enrichReport(report);
//       } catch (error) {
//         console.error("Error creating report:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to create report", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     resolveReport: async (
//       _: unknown,
//       { reportId, status }: { reportId: string; status: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         const report = await reportQueries.getById(parseInt(reportId));
//         if (!report) {
//           throw new GraphQLError("Report not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         await ensureCanResolveReport(userId, report);

//         const updatedReport = await reportQueries.updateStatus(parseInt(reportId), status, userId);

//         if (!updatedReport) {
//           throw new GraphQLError("Failed to update report", {
//             extensions: { code: "INTERNAL_ERROR" },
//           });
//         }

//         return enrichReport(updatedReport);
//       } catch (error) {
//         console.error("Error resolving report:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to resolve report", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     createPost: async (
//       _: unknown,
//       {
//         input,
//       }: {
//         input: {
//           communityId: string;
//           title: string;
//           content?: string;
//           type?: string;
//           media?: Array<{
//             type: string;
//             url: string;
//             thumbnailUrl?: string;
//             width?: number;
//             height?: number;
//           }>;
//           flairIds?: string[];
//         };
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         const { communityId, title, content, type, media, flairIds } = input;
//         const communityIdNum = parseInt(communityId);

//         await requireCommunityMembership(userId, communityIdNum);

//         const post = await postQueries.create({
//           communityId: communityIdNum,
//           authorId: userId,
//           title,
//           content,
//           type: (type as "text" | "image" | "video" | "link" | "poll") || "text",
//         });

//         if (media && media.length > 0) {
//           await postQueries.addMedia(post.id, media);
//         }

//         if (flairIds && flairIds.length > 0) {
//           await postQueries.addFlairs(
//             post.id,
//             flairIds.map((id: string) => parseInt(id))
//           );
//         }

//         const enrichedPost = await enrichPost(post, userId);

//         // Publish subscription event
//         pubsub.publish(POST_ADDED, { postAdded: enrichedPost });

//         return enrichedPost;
//       } catch (error) {
//         console.error("Error creating post:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to create post", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     votePost: async (
//       _: unknown,
//       { postId, voteType }: { postId: string; voteType: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         const post = await postQueries.getById(parseInt(postId));
//         if (!post) {
//           throw new GraphQLError("Post not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         await requireCommunityMembership(userId, post.communityId);

//         await postQueries.vote(parseInt(postId), userId, voteType as "upvote" | "downvote");

//         const enrichedPost = await enrichPost(post, userId);

//         // Publish subscription event
//         pubsub.publish(POST_VOTED, { postVoted: enrichedPost });

//         return enrichedPost;
//       } catch (error) {
//         console.error("Error voting on post:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to vote on post", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     savePost: async (_: unknown, { postId }: { postId: string }, context: GraphQLContext) => {
//       try {
//         const userId = requireAuth(context);

//         const post = await postQueries.getById(parseInt(postId));
//         if (!post) {
//           throw new GraphQLError("Post not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         await requireCommunityMembership(userId, post.communityId);

//         await postQueries.save(userId, parseInt(postId));
//         return true;
//       } catch (error) {
//         console.error("Error saving post:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to save post", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     unsavePost: async (_: unknown, { postId }: { postId: string }, context: GraphQLContext) => {
//       try {
//         const userId = requireAuth(context);

//         const post = await postQueries.getById(parseInt(postId));
//         if (!post) {
//           throw new GraphQLError("Post not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         await requireCommunityMembership(userId, post.communityId);

//         await postQueries.unsave(userId, parseInt(postId));
//         return true;
//       } catch (error) {
//         console.error("Error unsaving post:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to unsave post", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     updatePost: async (
//       _: unknown,
//       {
//         postId,
//         input,
//       }: {
//         postId: string;
//         input: { title?: string; content?: string; flairIds?: string[] };
//       },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Check if user is the author of the post
//         const post = await postQueries.getById(parseInt(postId));
//         if (!post) {
//           throw new GraphQLError("Post not found", {
//             extensions: { code: "POST_NOT_FOUND" },
//           });
//         }

//         if (post.authorId !== userId) {
//           throw new GraphQLError("Only the author can update this post", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         // Update the post
//         const updatedPost = await postQueries.update(parseInt(postId), {
//           title: input.title,
//           content: input.content,
//         });

//         if (!updatedPost) {
//           throw new GraphQLError("Post not found", {
//             extensions: { code: "POST_NOT_FOUND" },
//           });
//         }

//         // Update flairs if provided
//         if (input.flairIds) {
//           await db.delete(postFlairs).where(eq(postFlairs.postId, parseInt(postId)));
//           if (input.flairIds.length > 0) {
//             await postQueries.addFlairs(
//               parseInt(postId),
//               input.flairIds.map((id: string) => parseInt(id))
//             );
//           }
//         }

//         const enrichedPost = await enrichPost(updatedPost, userId);

//         // Publish POST_UPDATED subscription event
//         pubsub.publish(POST_UPDATED, { postUpdated: enrichedPost });

//         return enrichedPost;
//       } catch (error) {
//         console.error("Error updating post:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to update post", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     deletePost: async (_: unknown, { postId }: { postId: string }, context: GraphQLContext) => {
//       try {
//         const userId = requireAuth(context);

//         const post = await postQueries.getById(parseInt(postId));
//         if (!post) {
//           throw new GraphQLError("Post not found", {
//             extensions: { code: "POST_NOT_FOUND" },
//           });
//         }

//         // Check if user is the author or a moderator of the community
//         const isMod = await communityQueries.isModerator(userId, post.communityId);
//         if (post.authorId !== userId && !isMod) {
//           throw new GraphQLError("Not authorized to delete this post", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         return await postQueries.delete(parseInt(postId));
//       } catch (error) {
//         console.error("Error deleting post:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to delete post", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     createComment: async (
//       _: unknown,
//       { input }: { input: { postId: string; content: string; parentId?: string } },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         const { postId, content, parentId } = input;
//         const post = await postQueries.getById(parseInt(postId));
//         if (!post) {
//           throw new GraphQLError("Post not found", {
//             extensions: { code: "POST_NOT_FOUND" },
//           });
//         }

//         await requireCommunityMembership(userId, post.communityId);

//         const comment = await commentQueries.create({
//           postId: parseInt(postId),
//           authorId: userId,
//           content,
//           parentId: parentId ? parseInt(parentId) : null,
//         });

//         const enrichedComment = await enrichComment(
//           comment as Comment & { replies?: Comment[] },
//           userId
//         );

//         // Publish subscription event
//         pubsub.publish(COMMENT_ADDED, { commentAdded: enrichedComment });

//         return enrichedComment;
//       } catch (error) {
//         console.error("Error creating comment:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to create comment", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     voteComment: async (
//       _: unknown,
//       { commentId, voteType }: { commentId: string; voteType: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         const comment = await commentQueries.getById(parseInt(commentId));
//         if (!comment) {
//           throw new GraphQLError("Comment not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         const post = await postQueries.getById(comment.postId);
//         if (!post) {
//           throw new GraphQLError("Post not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         await requireCommunityMembership(userId, post.communityId);

//         await commentQueries.vote(parseInt(commentId), userId, voteType as "upvote" | "downvote");

//         const enrichedComment = await enrichComment(
//           comment as Comment & { replies?: Comment[] },
//           userId
//         );

//         pubsub.publish(COMMENT_VOTED, { commentVoted: enrichedComment });

//         return enrichedComment;
//       } catch (error) {
//         console.error("Error voting on comment:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to vote on comment", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     updateComment: async (
//       _: unknown,
//       { commentId, content }: { commentId: string; content: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Check if user is the author
//         const existingComment = await commentQueries.getById(parseInt(commentId));
//         if (!existingComment) {
//           throw new GraphQLError("Comment not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         if (existingComment.authorId !== userId) {
//           throw new GraphQLError("Only the author can update this comment", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         const comment = await commentQueries.update(parseInt(commentId), content);
//         if (!comment) {
//           throw new GraphQLError("Comment not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         return await enrichComment(comment as Comment & { replies?: Comment[] }, userId);
//       } catch (error) {
//         console.error("Error updating comment:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to update comment", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },

//     deleteComment: async (
//       _: unknown,
//       { commentId }: { commentId: string },
//       context: GraphQLContext
//     ) => {
//       try {
//         const userId = requireAuth(context);

//         // Check if user is the author
//         const comment = await commentQueries.getById(parseInt(commentId));
//         if (!comment) {
//           throw new GraphQLError("Comment not found", {
//             extensions: { code: "NOT_FOUND" },
//           });
//         }

//         // Get the post to check if user is a moderator
//         const post = await postQueries.getById(comment.postId);
//         const isMod = post ? await communityQueries.isModerator(userId, post.communityId) : false;

//         if (comment.authorId !== userId && !isMod) {
//           throw new GraphQLError("Not authorized to delete this comment", {
//             extensions: { code: "FORBIDDEN" },
//           });
//         }

//         return await commentQueries.delete(parseInt(commentId));
//       } catch (error) {
//         console.error("Error deleting comment:", error);
//         if (error instanceof GraphQLError) throw error;
//         throw new GraphQLError("Failed to delete comment", {
//           extensions: { code: "INTERNAL_ERROR" },
//         });
//       }
//     },
//   },

//   Subscription: {
//     postAdded: {
//       subscribe: withFilter(
//         () => pubsub.asyncIterableIterator(POST_ADDED),
//         (
//           payload: { postAdded: { community: { id: number } } } | undefined,
//           variables: { communityId?: string } | undefined
//         ) => {
//           if (!payload) return false;
//           if (!variables?.communityId) return true;
//           return payload.postAdded.community.id === parseInt(variables.communityId);
//         }
//       ),
//     },
//     postUpdated: {
//       subscribe: withFilter(
//         () => pubsub.asyncIterableIterator(POST_UPDATED),
//         (
//           payload: { postUpdated: { id: number } } | undefined,
//           variables: { postId: string } | undefined
//         ) => {
//           if (!payload || !variables) return false;
//           return payload.postUpdated.id === parseInt(variables.postId);
//         }
//       ),
//     },
//     postVoted: {
//       subscribe: withFilter(
//         () => pubsub.asyncIterableIterator(POST_VOTED),
//         (
//           payload: { postVoted: { id: number } } | undefined,
//           variables: { postId: string } | undefined
//         ) => {
//           if (!payload || !variables) return false;
//           return payload.postVoted.id === parseInt(variables.postId);
//         }
//       ),
//     },
//     commentAdded: {
//       subscribe: withFilter(
//         () => pubsub.asyncIterableIterator(COMMENT_ADDED),
//         (
//           payload: { commentAdded: { postId: number } } | undefined,
//           variables: { postId: string } | undefined
//         ) => {
//           if (!payload || !variables) return false;
//           return payload.commentAdded.postId === parseInt(variables.postId);
//         }
//       ),
//     },
//     commentVoted: {
//       subscribe: withFilter(
//         () => pubsub.asyncIterableIterator(COMMENT_VOTED),
//         (
//           payload: { commentVoted: { id: number } } | undefined,
//           variables: { commentId: string } | undefined
//         ) => {
//           if (!payload || !variables) return false;
//           return payload.commentVoted.id === parseInt(variables.commentId);
//         }
//       ),
//     },
//   },
// };
