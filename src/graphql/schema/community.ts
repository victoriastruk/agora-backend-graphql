export const communityTypeDefs = /* GraphQL */ `
  type Community {
    id: ID!
    name: String!
    displayName: String!
    description: String
    iconUrl: String
    bannerUrl: String
    creator: User
    memberCount: Int!
    members(limit: Int = 50, offset: Int = 0): [User!]!
    moderators: [Moderator!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    isJoined: Boolean!
    isModerator: Boolean
  }

  """Represents a moderator of a community"""
  type Moderator {
    """User information"""
    user: User!
    """Role: owner or moderator"""
    role: ModeratorRole!
  }

  """Moderator role within a community"""
  enum ModeratorRole {
    owner
    moderator
  }

  input CreateCommunityInput {
    name: String!
    displayName: String!
    description: String
    iconUrl: String
    bannerUrl: String
  }

  input UpdateCommunityInput {
    displayName: String
    description: String
    iconUrl: String
    bannerUrl: String
  }

  extend type Query {
    """Get paginated list of all communities"""
    communities(limit: Int = 20, offset: Int = 0): [Community!]!
    """Get a specific community by ID"""
    community(id: ID): Community
    """Get a community by its URL-friendly name"""
    communityByName(name: String!): Community
    """Get popular communities sorted by member count"""
    popularCommunities(limit: Int = 10): [Community!]!
    """Search communities by name or display name"""
    searchCommunities(query: String!, limit: Int = 20, offset: Int = 0): [Community!]!
  }

  extend type Mutation {
    """Join a community (auth required)"""
    joinCommunity(communityId: ID!): Community!
    """Leave a community (auth required)"""
    leaveCommunity(communityId: ID!): Boolean!
    """Create a new community (auth required)"""
    createCommunity(input: CreateCommunityInput!): Community!
    """Update community information (auth required, must be owner or moderator)"""
    updateCommunity(communityId: ID!, input: UpdateCommunityInput!): Community!
    """Delete a community (auth required, must be owner)"""
    deleteCommunity(communityId: ID!): Boolean!
    """Add a moderator to a community (auth required, must be owner)"""
    addModerator(communityId: ID!, userId: ID!): Community!
    """Remove a moderator from a community (auth required, must be owner)"""
    removeModerator(communityId: ID!, userId: ID!): Boolean!
  }
`;
