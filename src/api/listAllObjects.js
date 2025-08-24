import { ListObjectsV2Command } from "@aws-sdk/client-s3";

// List all objects under a given prefix (recursively). Returns array of { Key, Size, LastModified }
export default async function listAllObjects(s3, prefix = "", bucketName = "") {
    if (!s3) throw new Error('S3 client is not initialized');

    // Normalize prefix: ensure no leading slash and end with '/'
    let normalizedPrefix = (prefix || '').toString().trim();
    if (normalizedPrefix.startsWith('/')) normalizedPrefix = normalizedPrefix.slice(1);
    // If a non-empty folder without trailing slash, add it
    if (normalizedPrefix && !normalizedPrefix.endsWith('/')) normalizedPrefix += '/';

    let continuationToken = undefined;
    const results = [];

    while (true) {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: normalizedPrefix || undefined,
            ContinuationToken: continuationToken,
        });
        const response = await s3.send(command);
        const contents = response.Contents || [];
        for (const obj of contents) {
            // Skip synthetic folder marker if present
            if (normalizedPrefix && obj.Key === normalizedPrefix) continue;
            results.push({ Key: obj.Key, Size: obj.Size, LastModified: obj.LastModified });
        }
        if (!response.IsTruncated) break;
        continuationToken = response.NextContinuationToken;
    }

    return results;
}
