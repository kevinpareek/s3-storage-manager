import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export default async function deleteFileOrFolder(s3, key = "", bucketName = "") {
    if (!s3) throw new Error("S3 client is not initialized");
    if (!key) return true;

    const isFolder = key.endsWith('/');

    // If it's a single file (no trailing '/'), do a direct DeleteObject
    if (!isFolder) {
        await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
        return true;
    }

    // Folder: list and batch delete (handle pagination and >1000 objects)
    let continuationToken = undefined;
    const keysToDelete = [];
    do {
        const res = await s3.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: key,
            ContinuationToken: continuationToken
        }));
        const batch = (res.Contents || []).map(obj => ({ Key: obj.Key }));
        keysToDelete.push(...batch);
        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    if (keysToDelete.length === 0) return true;

    // Delete in chunks of 1000
    const chunkSize = 1000;
    for (let i = 0; i < keysToDelete.length; i += chunkSize) {
        const chunk = keysToDelete.slice(i, i + chunkSize);
        await s3.send(new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: { Objects: chunk, Quiet: true }
        }));
    }
    return true;
}