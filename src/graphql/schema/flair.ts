export const flairTypeDefs = /* GraphQL */ `
  """Represents a flair/tag for posts"""
  type Flair {
    """Unique identifier for the flair"""
    id: ID!
    """Flair label text"""
    label: String!
    """Text color (hex)"""
    color: String
    """Background color (hex)"""
    backgroundColor: String
  }

  """Input for creating a new flair"""
  input CreateFlairInput {
    """Community ID to create flair for"""
    communityId: ID!
    """Flair label text"""
    label: String!
    """Text color (hex)"""
    color: String
    """Background color (hex)"""
    backgroundColor: String
  }

  """Input for updating a flair"""
  input UpdateFlairInput {
    """New flair label text"""
    label: String
    """New text color (hex)"""
    color: String
    """New background color (hex)"""
    backgroundColor: String
  }

  extend type Query {
    """Get flairs for a community"""
    flairsByCommunity(communityId: ID!): [Flair!]!
  }

  extend type Mutation {
    """Create a new flair for a community (auth required, must be moderator)"""
    createFlair(input: CreateFlairInput!): Flair!
    """Update a flair (auth required, must be moderator)"""
    updateFlair(flairId: ID!, input: UpdateFlairInput!): Flair!
    """Delete a flair (auth required, must be moderator)"""
    deleteFlair(flairId: ID!): Boolean!
  }
`;
