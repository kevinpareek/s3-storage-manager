import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export default async function listFiles(s3, prefix = "", bucketName = "", opts = {}) {
    const { continuationToken } = opts || {}
    if (!s3) {
        const err = new Error('S3 client is not initialized');
        console.error(err);
        throw err;
    }

    // Normalize incoming UI path to S3 prefix
    let normalizedPrefix = (prefix || '').toString().trim();
    if (normalizedPrefix === '/') normalizedPrefix = '';
    if (normalizedPrefix.startsWith('/')) normalizedPrefix = normalizedPrefix.slice(1);
    if (normalizedPrefix && !normalizedPrefix.endsWith('/')) normalizedPrefix += '/';

    const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: normalizedPrefix,
        Delimiter: "/",
        ContinuationToken: continuationToken
    });

    try {
        const response = await s3.send(command);

        const folders =
            response.CommonPrefixes?.map((p) => ({
                name: p.Prefix.replace(normalizedPrefix, "").replace(/\/$/, ""),
                type: "folder",
                key: p.Prefix,
            })) || [];

        const files =
            response.Contents?.filter((obj) => obj.Key !== normalizedPrefix).map((obj) => ({
                name: obj.Key.replace(normalizedPrefix, ""),
                type: "file",
                key: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified,
            })) || [];

        return {
            items: [...folders, ...files],
            isTruncated: Boolean(response.IsTruncated),
            nextContinuationToken: response.NextContinuationToken || null
        };
    } catch (error) {
        console.error("Error listing files:", error);
        throw error;
    }
}