import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export default async function renameFolder(s3, oldPrefix, newPrefix, bucketName) {
    // List all objects under the old prefix
    const listedObjects = await s3.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: oldPrefix
    }))
    if (!listedObjects.Contents) return false;
    // Copy each object to the new prefix and delete the old one
    for (const obj of listedObjects.Contents) {
        const oldKey = obj.Key;
        const newKey = oldKey.replace(oldPrefix, newPrefix);
        await s3.send(new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `${bucketName}/${oldKey}`,
            Key: newKey
        }))
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldKey
        }))
    }
    return true;
}
