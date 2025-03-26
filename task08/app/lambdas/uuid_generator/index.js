import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as generateUUID } from 'uuid';

// Retrieve AWS region from environment variables or default to 'eu-west-1'
const AWS_REGION = 'eu-west-1';
const STORAGE_BUCKET = process.env.S3_BUCKET_NAME || 'uuid-storage';

// Initialize the S3 client
const s3 = new S3Client({ region: AWS_REGION });

export const handler = async (event) => {
    try {
        // Generate an array of 10 unique identifiers
        const uuidList = Array.from({ length: 10 }, () => generateUUID());

        // Prepare data payload to be stored
        const dataPayload = {
            ids: uuidList
        };

        // Create a filename based on the current timestamp
        const fileKey = new Date().toISOString();

        // Set up S3 upload parameters
        const uploadParams = new PutObjectCommand({
            Bucket: STORAGE_BUCKET,
            Key: fileKey,
            Body: JSON.stringify(dataPayload, null, 4),
            ContentType: 'application/json'
        });

        // Upload data to S3 bucket
        await s3.send(uploadParams);

        console.log(`UUID data successfully uploaded to: s3://${STORAGE_BUCKET}/${fileKey}`);

        // No return value needed for CloudWatch-triggered functions
    } catch (err) {
        console.error('Upload error:', err);
        throw err;
    }
};
