export const communityTypeDefs = /* GraphQL */ `
  """Represents a community (subreddit)"""
  type Community {
    """Unique identifier for the community"""
    id: ID!
    """URL-friendly name (e.g., 'programming')"""
    name: String!
    """Display name (e.g., 'Programming')"""
    displayName: String!
    """Community description"""
    description: String
    """Community icon URL"""
    iconUrl: String
    """Community banner URL"""
    bannerUrl: String
    """Community topic / category"""
    topic: String!
    """Community visibility type"""
    communityType: CommunityType!
    """Community creator"""
    creator: User
    """Number of members"""
    memberCount: Int!
    """List of community members"""
    members(limit: Int = 50, offset: Int = 0): [User!]!
    """List of community moderators"""
    moderators: [Moderator!]!
    """Community creation timestamp"""
    createdAt: DateTime!
    """Last update timestamp"""
    updatedAt: DateTime!
    """Whether the authenticated user has joined this community"""
    isJoined: Boolean
    """Whether the authenticated user is a moderator of this community"""
    isModerator: Boolean
  }

  """Represents a moderator of a community"""
  type Moderator {
    """User information"""
    user: User!
    """Role: owner or moderator"""
    role: ModeratorRole!
  }

  """Community visibility type"""
  enum CommunityType {
    public
    restricted
    private
  }

  """Moderator role within a community"""
  enum ModeratorRole {
    owner
    moderator
  }

  """Input for creating a new community"""
  input CreateCommunityInput {
    """URL-friendly name (e.g., 'programming')"""
    name: String!
    """Display name (e.g., 'Programming')"""
    displayName: String!
    """Community description"""
    description: String
    """Community icon URL"""
    iconUrl: String
    """Community banner URL"""
    bannerUrl: String
    """Community topic / category"""
    topic: String!
    """Community visibility (default: public)"""
    communityType: CommunityType
  }

  """Input for updating a community"""
  input UpdateCommunityInput {
    """New display name"""
    displayName: String
    """New description"""
    description: String
    """New icon URL"""
    iconUrl: String
    """New banner URL"""
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
