const { ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const docClient = require("./dynamodb");

const TABLE_NAME = process.env.CONTENT_TABLE || "Content";

/**
 * Get all content items from the Content table.
 * ScanCommand is acceptable here because the Content table is small and fixed.
 */
async function getAllContent() {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
    })
  );
  return result.Items || [];
}

/**
 * Get a single content item by contentId (partition key).
 */
async function getContentById(contentId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { contentId },
    })
  );
  return result.Item || null;
}

module.exports = { getAllContent, getContentById };
