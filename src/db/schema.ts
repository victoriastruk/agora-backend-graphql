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
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
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

// Communities (Subreddits)
export const communities = pgTable('communities', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  iconUrl: text('icon_url'),
  bannerUrl: text('banner_url'),
  memberCount: integer('member_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Community members (join/leave)
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

// Flairs (tags for posts)
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

// Posts
const postTypeEnum = pgEnum('post_type', [
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

// Post media (images, videos, links)
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

// Post flairs (many-to-many)
export const postFlairs = pgTable('post_flairs', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id)
    .notNull(),
  flairId: integer('flair_id')
    .references(() => flairs.id)
    .notNull(),
});

// Comments (must be defined before votes)
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id)
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id)
    .notNull(),
  parentId: integer('parent_id'), // for nested comments - self-reference handled via relations
  content: text('content').notNull(),
  score: integer('score').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Votes (upvote/downvote)
const voteTypeEnum = pgEnum('vote_type', ['upvote', 'downvote']);

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

// Saved posts
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  votes: many(votes),
  communityMemberships: many(communityMembers),
  savedPosts: many(savedPosts),
}));

export const communitiesRelations = relations(communities, ({ many }) => ({
  posts: many(posts),
  members: many(communityMembers),
  flairs: many(flairs),
}));

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
}));

// Types
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
