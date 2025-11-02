import { makeExecutableSchema } from '@graphql-tools/schema';
import { resolvers } from './resolvers';

const typeDefs = `
  type User {
    id: ID!
    username: String!
    email: String!
    createdAt: String!
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    createUser(username: String!, email: String!): User!
    updateUser(id: ID!, username: String, email: String): User
    deleteUser(id: ID!): Boolean!
  }
`;

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
