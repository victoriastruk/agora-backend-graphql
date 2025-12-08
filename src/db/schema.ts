import {
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  integer,
  pgEnum,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name'),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: serial('user_id')
    .references(() => users.id)
    .notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const communities = pgTable('communities', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  iconUrl: text('icon_url'),
  bannerUrl: text('banner_url'),
  creatorId: integer('creator_id').references(() => users.id),
  memberCount: integer('member_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const communityMembers = pgTable('community_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  communityId: integer('community_id')
    .references(() => communities.id)
    .notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const moderatorRoleEnum = pgEnum('moderator_role', [
  'owner',
  'moderator',
]);

export const communityModerators = pgTable('community_moderators', {
  id: serial('id').primaryKey(),
  communityId: integer('community_id')
    .references(() => communities.id)
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  role: moderatorRoleEnum('role').notNull().default('moderator'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const flairs = pgTable('flairs', {
  id: serial('id').primaryKey(),
  communityId: integer('community_id')
    .references(() => communities.id)
    .notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }), // hex color
  backgroundColor: varchar('background_color', { length: 7 }), // hex color
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const postTypeEnum = pgEnum('post_type', [
  'text',
  'image',
  'video',
  'link',
  'poll',
]);

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  communityId: integer('community_id')
    .references(() => communities.id)
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id)
    .notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  content: text('content'), // for text posts
  type: postTypeEnum('type').notNull().default('text'),
  score: integer('score').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const postMedia = pgTable('post_media', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id)
    .notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'image', 'video', 'link'
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const postFlairs = pgTable('post_flairs', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id)
    .notNull(),
  flairId: integer('flair_id')
    .references(() => flairs.id)
    .notNull(),
});

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id)
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id)
    .notNull(),
  parentId: integer('parent_id'),
  content: text('content').notNull(),
  score: integer('score').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const voteTypeEnum = pgEnum('vote_type', ['upvote', 'downvote']);

export const votes = pgTable('votes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  postId: integer('post_id').references(() => posts.id),
  commentId: integer('comment_id').references(() => comments.id),
  type: voteTypeEnum('type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedPosts = pgTable('saved_posts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  postId: integer('post_id')
    .references(() => posts.id)
    .notNull(),
  savedAt: timestamp('saved_at').defaultNow().notNull(),
});

export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'inappropriate_content',
  'copyright_violation',
  'other',
]);

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id')
    .references(() => users.id)
    .notNull(),
  postId: integer('post_id').references(() => posts.id),
  commentId: integer('comment_id').references(() => comments.id),
  reason: reportReasonEnum('reason').notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: integer('resolved_by').references(() => users.id),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  votes: many(votes),
  communityMemberships: many(communityMembers),
  savedPosts: many(savedPosts),
  reports: many(reports),
}));

export const communitiesRelations = relations(communities, ({ one, many }) => ({
  posts: many(posts),
  members: many(communityMembers),
  moderators: many(communityModerators),
  flairs: many(flairs),
  creator: one(users, {
    fields: [communities.creatorId],
    references: [users.id],
  }),
}));

export const communityModeratorsRelations = relations(
  communityModerators,
  ({ one }) => ({
    community: one(communities, {
      fields: [communityModerators.communityId],
      references: [communities.id],
    }),
    user: one(users, {
      fields: [communityModerators.userId],
      references: [users.id],
    }),
  })
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  community: one(communities, {
    fields: [posts.communityId],
    references: [communities.id],
  }),
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  media: many(postMedia),
  comments: many(comments),
  votes: many(votes),
  flairs: many(postFlairs),
  reports: many(reports),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'commentReplies',
  }),
  replies: many(comments, {
    relationName: 'commentReplies',
  }),
  votes: many(votes),
  reports: many(reports),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [reports.postId],
    references: [posts.id],
  }),
  comment: one(comments, {
    fields: [reports.commentId],
    references: [comments.id],
  }),
  resolver: one(users, {
    fields: [reports.resolvedBy],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type Flair = typeof flairs.$inferSelect;
export type NewFlair = typeof flairs.$inferInsert;
export type PostMedia = typeof postMedia.$inferSelect;
export type NewPostMedia = typeof postMedia.$inferInsert;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type NewCommunityMember = typeof communityMembers.$inferInsert;
export type SavedPost = typeof savedPosts.$inferSelect;
export type NewSavedPost = typeof savedPosts.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type CommunityModerator = typeof communityModerators.$inferSelect;
export type NewCommunityModerator = typeof communityModerators.$inferInsert;
