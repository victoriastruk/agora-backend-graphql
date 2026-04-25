export const reportTypeDefs = /* GraphQL */ `
  """Report reason enumeration"""
  enum ReportReason {
    spam
    harassment
    hate_speech
    violence
    inappropriate_content
    copyright_violation
    other
  }

  """Represents a report on a post or comment"""
  type Report {
    """Unique identifier for the report"""
    id: ID!
    """User who submitted the report"""
    reporter: User!
    """Post being reported (null if reporting a comment)"""
    post: Post
    """Comment being reported (null if reporting a post)"""
    comment: Comment
    """Reason for the report"""
    reason: ReportReason!
    """Additional description"""
    description: String
    """Report status: 'pending', 'resolved', or 'dismissed'"""
    status: String!
    """Report creation timestamp"""
    createdAt: DateTime!
    """Report resolution timestamp"""
    resolvedAt: DateTime
    """User who resolved the report"""
    resolvedBy: User
  }

  """Input for creating a report"""
  input CreateReportInput {
    """Post ID to report (optional if reporting a comment)"""
    postId: ID
    """Comment ID to report (optional if reporting a post)"""
    commentId: ID
    """Reason for the report"""
    reason: ReportReason!
    """Additional description"""
    description: String
  }

  extend type Query {
    """Get reports — auth required, must be a moderator"""
    reports(status: String, limit: Int = 20, offset: Int = 0): [Report!]!
    """Get a specific report by ID — auth required, must be a moderator"""
    report(id: ID!): Report
  }

  extend type Mutation {
    """Report a post or comment (auth required)"""
    createReport(input: CreateReportInput!): Report!
    """Resolve or dismiss a report (auth required, must be a moderator)"""
    resolveReport(reportId: ID!, status: String!): Report!
  }
`;
