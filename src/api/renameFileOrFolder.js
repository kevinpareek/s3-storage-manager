import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export default async function renameFileOrFolder(s3, oldKey, newKey, bucketName) {
    // If keys are identical, nothing to do
    if (!oldKey || !newKey || oldKey === newKey) {
        return true;
    }

    // Copy the object to the new key
    await s3.send(new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: encodeURI(`${bucketName}/${oldKey}`),
        Key: newKey
    }))
    // Delete the old object
    await s3.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: oldKey
    }))
    return true;
}
