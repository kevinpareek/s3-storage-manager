import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export default async function renameFolder(s3, oldPrefix, newPrefix, bucketName) {
    if (!oldPrefix || !newPrefix) return false;

    // Normalize prefixes to ensure they end with '/'
    const normOld = oldPrefix.endsWith('/') ? oldPrefix : oldPrefix + '/';
    const normNew = newPrefix.endsWith('/') ? newPrefix : newPrefix + '/';

    if (normOld === normNew) return true; // nothing to do

    // List all objects under the old prefix
    const listedObjects = await s3.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: normOld
    }))
    if (!listedObjects.Contents) return false;
    // Copy each object to the new prefix and delete the old one
    for (const obj of listedObjects.Contents) {
        const oldKey = obj.Key;
        // Replace only the first occurrence of the old prefix
        let newKey;
        if (oldKey.startsWith(normOld)) {
            newKey = normNew + oldKey.substring(normOld.length);
        } else {
            // Fallback to a simple replace
            newKey = oldKey.replace(oldPrefix, newPrefix);
        }
        await s3.send(new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: encodeURI(`${bucketName}/${oldKey}`),
            Key: newKey
        }))
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldKey
        }))
    }
    return true;
}
