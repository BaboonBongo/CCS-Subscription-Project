const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

/**
 * Generate a pre-signed URL for an S3 object.
 * The URL expires in 30 seconds — matches the demo subscription window.
 *
 * @param {string} key - The S3 object key (e.g., "premium/aws-security.mp4")
 * @returns {Promise<string>} A pre-signed URL for temporary access
 */
async function generateSignedUrl(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.MEDIA_BUCKET,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 30,
  });

  return signedUrl;
}

module.exports = { generateSignedUrl };
