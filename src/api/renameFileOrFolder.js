import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export default async function renameFileOrFolder(s3, oldKey, newKey, bucketName) {
    // Copy the object to the new key
    await s3.send(new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${oldKey}`,
        Key: newKey
    }))
    // Delete the old object
    await s3.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: oldKey
    }))
    return true;
}
