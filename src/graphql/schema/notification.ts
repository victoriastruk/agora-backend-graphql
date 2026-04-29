export const notificationTypeDefs = /* GraphQL */ `
  """Type of notification event"""
  enum NotificationType {
    comment
    reply
    upvote
    mention
    follow
    award
  }

  """A notification for the authenticated user"""
  type Notification {
    id: ID!
    """What triggered this notification"""
    type: NotificationType!
    """User who triggered the notification"""
    actor: User
    """Related post (if applicable)"""
    post: Post
    """Related comment (if applicable)"""
    comment: Comment
    """Human-readable notification message"""
    message: String!
    """Whether the notification has been read"""
    isRead: Boolean!
    createdAt: DateTime!
  }

  extend type Query {
    """Get the authenticated user's notifications (auth required)"""
    notifications(limit: Int = 20, offset: Int = 0): [Notification!]!
    """Count of unread notifications for the authenticated user (auth required)"""
    unreadNotificationsCount: Int!
  }

  extend type Mutation {
    """Mark a notification as read (auth required)"""
    markNotificationAsRead(id: ID!): Notification!
    """Mark all notifications as read (auth required)"""
    markAllNotificationsAsRead: Boolean!
    """Delete a notification (auth required)"""
    clearNotification(id: ID!): Boolean!
    """Delete all notifications (auth required)"""
    clearAllNotifications: Boolean!
  }

  extend type Subscription {
    """Receive new notifications in real-time (auth required)"""
    notificationReceived: Notification!
  }
`;
