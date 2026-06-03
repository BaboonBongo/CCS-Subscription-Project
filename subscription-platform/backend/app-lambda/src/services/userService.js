const { PutCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const docClient = require("./dynamodb");

const TABLE_NAME = process.env.USERS_TABLE || "Users";

/**
 * Look up a user by email using the GSI "email-index".
 * Uses QueryCommand (NOT ScanCommand) for efficient lookup.
 */
async function getUserByEmail(email) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    })
  );
  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Create a new user in the Users table.
 */
async function createUser(user) {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: user,
    })
  );
  return user;
}

/**
 * Get a user by their partition key (userId).
 */
async function getUserById(userId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId },
    })
  );
  return result.Item || null;
}

module.exports = { getUserByEmail, createUser, getUserById };
