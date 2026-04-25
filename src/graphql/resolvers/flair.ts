import { GraphQLError } from "graphql";
import { communityQueries } from "@/db/queries/communities";
import { flairQueries } from "@/db/queries/flairs";
import { requireAuth } from "./helpers";
import type { GraphQLContext } from "../types";

export const flairResolvers = {
  Query: {
    flairsByCommunity: async (_: unknown, { communityId }: { communityId: string }) => {
      try {
        return await flairQueries.getByCommunity(parseInt(communityId));
      } catch (error) {
        console.error("Error fetching flairs by community:", error);
        throw new GraphQLError("Failed to fetch flairs", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Mutation: {
    createFlair: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          communityId: string;
          label: string;
          color?: string;
          backgroundColor?: string;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        // Check if user is a moderator
        const isMod = await communityQueries.isModerator(userId, parseInt(input.communityId));
        if (!isMod) {
          throw new GraphQLError("Only moderators can create flairs", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const flair = await flairQueries.create({
          communityId: parseInt(input.communityId),
          label: input.label,
          color: input.color,
          backgroundColor: input.backgroundColor,
        });

        return flair;
      } catch (error) {
        console.error("Error creating flair:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to create flair", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updateFlair: async (
      _: unknown,
      {
        flairId,
        input,
      }: {
        flairId: string;
        input: { label?: string; color?: string; backgroundColor?: string };
      },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        // Get flair to check community
        const flair = await flairQueries.getById(parseInt(flairId));
        if (!flair) {
          throw new GraphQLError("Flair not found", {
            extensions: { code: "FLAIR_NOT_FOUND" },
          });
        }

        // Check if user is a moderator of the community
        const isMod = await communityQueries.isModerator(userId, flair.communityId);
        if (!isMod) {
          throw new GraphQLError("Only moderators can update flairs", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const updatedFlair = await flairQueries.update(parseInt(flairId), {
          label: input.label,
          color: input.color,
          backgroundColor: input.backgroundColor,
        });

        return updatedFlair;
      } catch (error) {
        console.error("Error updating flair:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to update flair", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    deleteFlair: async (
      _: unknown,
      { flairId }: { flairId: string },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        // Get flair to check community
        const flair = await flairQueries.getById(parseInt(flairId));
        if (!flair) {
          throw new GraphQLError("Flair not found", {
            extensions: { code: "FLAIR_NOT_FOUND" },
          });
        }

        // Check if user is a moderator of the community
        const isMod = await communityQueries.isModerator(userId, flair.communityId);
        if (!isMod) {
          throw new GraphQLError("Only moderators can delete flairs", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        return await flairQueries.delete(parseInt(flairId));
      } catch (error) {
        console.error("Error deleting flair:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to delete flair", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },
};
