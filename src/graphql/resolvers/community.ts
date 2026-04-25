import { eq } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { communityQueries } from '@/db/queries/communities';
import { requireAuth, getUserId } from './helpers';
import type { GraphQLContext } from '../types';
import type { Community } from '@/db/schema';

export const communityResolvers = {
  Query: {
    communities: async (
      _: unknown,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number },
    ) => {
      try {
        return await communityQueries.getAll(limit, offset);
      } catch (error) {
        console.error('Error fetching communities:', error);
        throw new GraphQLError('Failed to fetch communities', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    community: async (_: unknown, { id }: { id?: string }) => {
      try {
        if (!id) return null;
        return await communityQueries.getById(parseInt(id));
      } catch (error) {
        console.error('Error fetching community:', error);
        throw new GraphQLError('Failed to fetch community', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    communityByName: async (_: unknown, { name }: { name: string }) => {
      try {
        return await communityQueries.getByName(name);
      } catch (error) {
        console.error('Error fetching community by name:', error);
        throw new GraphQLError('Failed to fetch community', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    popularCommunities: async (
      _: unknown,
      { limit = 10 }: { limit?: number },
    ) => {
      try {
        return await communityQueries.getPopular(limit);
      } catch (error) {
        console.error('Error fetching popular communities:', error);
        throw new GraphQLError('Failed to fetch popular communities', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    searchCommunities: async (
      _: unknown,
      {
        query,
        limit = 20,
        offset = 0,
      }: { query: string; limit?: number; offset?: number },
    ) => {
      try {
        return await communityQueries.search(query, limit, offset);
      } catch (error) {
        console.error('Error searching communities:', error);
        throw new GraphQLError('Failed to search communities', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },
  },

  Mutation: {
    joinCommunity: async (
      _: unknown,
      { communityId }: { communityId: string },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuth(context);
        await communityQueries.join(userId, parseInt(communityId));
        return await communityQueries.getById(parseInt(communityId));
      } catch (error) {
        console.error('Error joining community:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to join community', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    leaveCommunity: async (
      _: unknown,
      { communityId }: { communityId: string },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuth(context);
        return await communityQueries.leave(userId, parseInt(communityId));
      } catch (error) {
        console.error('Error leaving community:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to leave community', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    createCommunity: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          name: string;
          displayName: string;
          description?: string;
          iconUrl?: string;
          bannerUrl?: string;
          topic: string;
          communityType?: 'public' | 'private';
        };
      },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuth(context);

        // Create community with creator
        // const community = await communityQueries.create({
        //   ...input,
        //   creatorId: userId,
        // });
        const community = await communityQueries.create(input, userId);
        // Add creator as owner/moderator
        await communityQueries.addModerator(community.id, userId, 'owner');

        // Auto-join the creator to the community
        await communityQueries.join(userId, community.id);

        return await communityQueries.getById(community.id);
      } catch (error) {
        console.error('Error creating community:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to create community', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    updateCommunity: async (
      _: unknown,
      {
        communityId,
        input,
      }: {
        communityId: string;
        input: {
          displayName?: string;
          description?: string;
          iconUrl?: string;
          bannerUrl?: string;
        };
      },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuth(context);

        // Check if user is a moderator or owner
        const isMod = await communityQueries.isModerator(
          userId,
          parseInt(communityId),
        );
        if (!isMod) {
          throw new GraphQLError('Only moderators can update community', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        const updatedCommunity = await communityQueries.update(
          parseInt(communityId),
          input,
        );
        if (!updatedCommunity) {
          throw new GraphQLError('Community not found', {
            extensions: { code: 'COMMUNITY_NOT_FOUND' },
          });
        }

        return updatedCommunity;
      } catch (error) {
        console.error('Error updating community:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to update community', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    deleteCommunity: async (
      _: unknown,
      { communityId }: { communityId: string },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuth(context);

        // Only owner can delete community
        const isOwner = await communityQueries.isOwner(
          userId,
          parseInt(communityId),
        );
        if (!isOwner) {
          throw new GraphQLError('Only the owner can delete the community', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        const community = await communityQueries.getById(parseInt(communityId));
        if (!community) {
          throw new GraphQLError('Community not found', {
            extensions: { code: 'COMMUNITY_NOT_FOUND' },
          });
        }

        return await communityQueries.delete(parseInt(communityId));
      } catch (error) {
        console.error('Error deleting community:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to delete community', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    addModerator: async (
      _: unknown,
      {
        communityId,
        userId: targetUserId,
      }: { communityId: string; userId: string },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuth(context);

        // Only owner can add moderators
        const isOwner = await communityQueries.isOwner(
          userId,
          parseInt(communityId),
        );
        if (!isOwner) {
          throw new GraphQLError('Only the owner can add moderators', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        await communityQueries.addModerator(
          parseInt(communityId),
          parseInt(targetUserId),
          'moderator',
        );
        return await communityQueries.getById(parseInt(communityId));
      } catch (error) {
        console.error('Error adding moderator:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to add moderator', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    removeModerator: async (
      _: unknown,
      {
        communityId,
        userId: targetUserId,
      }: { communityId: string; userId: string },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuth(context);

        // Only owner can remove moderators
        const isOwner = await communityQueries.isOwner(
          userId,
          parseInt(communityId),
        );
        if (!isOwner) {
          throw new GraphQLError('Only the owner can remove moderators', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        // Prevent owner from removing themselves
        if (userId === parseInt(targetUserId)) {
          throw new GraphQLError('Owner cannot remove themselves', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        return await communityQueries.removeModerator(
          parseInt(communityId),
          parseInt(targetUserId),
        );
      } catch (error) {
        console.error('Error removing moderator:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError('Failed to remove moderator', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },
  },

  Community: {
    members: async (
      parent: { id: number },
      { limit = 50, offset = 0 }: { limit?: number; offset?: number },
    ) => {
      try {
        return await communityQueries.getMembers(parent.id, limit, offset);
      } catch (error) {
        console.error('Error fetching community members:', error);
        return [];
      }
    },
    moderators: async (parent: { id: number }) => {
      try {
        const mods = await communityQueries.getModerators(parent.id);
        return mods.map(mod => ({
          user: {
            id: mod.id,
            username: mod.username,
            email: mod.email,
          },
          role: mod.role,
        }));
      } catch (error) {
        console.error('Error fetching community moderators:', error);
        return [];
      }
    },
    creator: async (parent: Community) => {
      try {
        if (!parent.creatorId) return null;
        const result = await db
          .select()
          .from(users)
          .where(eq(users.id, parent.creatorId))
          .limit(1);
        if (!result[0]) return null;
        const { passwordHash: _passwordHash, ...user } = result[0];
        return user;
      } catch (error) {
        console.error('Error fetching community creator:', error);
        return null;
      }
    },
    isJoined: async (
      parent: { id: number },
      _: unknown,
      context: GraphQLContext,
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) return false;
        return await communityQueries.isMember(userId, parent.id);
      } catch (error) {
        console.error('Error checking if user joined community:', error);
        return false;
      }
    },
    isModerator: async (
      parent: { id: number },
      _: unknown,
      context: GraphQLContext,
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) return false;
        return await communityQueries.isModerator(userId, parent.id);
      } catch (error) {
        console.error('Error checking if user is moderator:', error);
        return false;
      }
    },
  },

  DateTime: {
    parseValue: (value: string) => new Date(value),
    serialize: (value: Date | string) =>
      value instanceof Date ? value.toISOString() : value,
    parseLiteral: (ast: { kind: string; value: string }) => {
      if (ast.kind === 'StringValue') {
        return new Date(ast.value);
      }
      return null;
    },
  },
};
