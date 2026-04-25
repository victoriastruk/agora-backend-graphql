import { GraphQLError } from "graphql";
import { reportQueries } from "@/db/queries/reports";
import {
  requireAuth,
  canModerateReport,
  ensureCanViewReport,
  ensureCanResolveReport,
  enrichReport,
} from "./helpers";
import type { GraphQLContext } from "../types";
import type { Report } from "@/db/schema";

export const reportResolvers = {
  Query: {
    reports: async (
      _: unknown,
      { status, limit = 20, offset = 0 }: { status?: string; limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);
        const allReports = await reportQueries.getAll(status, limit, offset);

        const allowedReports: Report[] = [];
        for (const report of allReports) {
          const canView =
            report.reporterId === userId || (await canModerateReport(userId, report));
          if (canView) {
            allowedReports.push(report);
          }
        }

        return Promise.all(allowedReports.map(enrichReport));
      } catch (error) {
        console.error("Error fetching reports:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch reports", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    report: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      try {
        const userId = requireAuth(context);
        const report = await reportQueries.getById(parseInt(id));
        if (!report) return null;

        await ensureCanViewReport(userId, report);
        return enrichReport(report);
      } catch (error) {
        console.error("Error fetching report:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch report", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Mutation: {
    createReport: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          postId?: string;
          commentId?: string;
          reason: string;
          description?: string;
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        // Validate that either postId or commentId is provided, but not both
        if ((!input.postId && !input.commentId) || (input.postId && input.commentId)) {
          throw new GraphQLError("Must provide either postId or commentId, but not both", {
            extensions: { code: "INVALID_INPUT" },
          });
        }

        // Check if user can report this content
        const canReport = await reportQueries.canUserReport(
          userId,
          input.postId ? parseInt(input.postId) : undefined,
          input.commentId ? parseInt(input.commentId) : undefined
        );

        if (!canReport) {
          throw new GraphQLError("You have already reported this content", {
            extensions: { code: "ALREADY_REPORTED" },
          });
        }

        const report = await reportQueries.create({
          reporterId: userId,
          postId: input.postId ? parseInt(input.postId) : null,
          commentId: input.commentId ? parseInt(input.commentId) : null,
          reason: input.reason as
            | "spam"
            | "harassment"
            | "hate_speech"
            | "violence"
            | "inappropriate_content"
            | "copyright_violation"
            | "other",
          description: input.description,
        });

        return enrichReport(report);
      } catch (error) {
        console.error("Error creating report:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to create report", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    resolveReport: async (
      _: unknown,
      { reportId, status }: { reportId: string; status: string },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        const report = await reportQueries.getById(parseInt(reportId));
        if (!report) {
          throw new GraphQLError("Report not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        await ensureCanResolveReport(userId, report);

        const updatedReport = await reportQueries.updateStatus(parseInt(reportId), status, userId);

        if (!updatedReport) {
          throw new GraphQLError("Failed to update report", {
            extensions: { code: "INTERNAL_ERROR" },
          });
        }

        return enrichReport(updatedReport);
      } catch (error) {
        console.error("Error resolving report:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to resolve report", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },
};
