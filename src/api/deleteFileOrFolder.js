import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export default async function deleteFileOrFolder(s3, key = "", bucketName = "") {

    if (!s3) {
        throw new Error("S3 client is not initialized");
    }

    const listedObjects = await s3.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: key
    }));

    const command = new  DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
            Objects: listedObjects.Contents.map(obj => ({Key: obj.Key})),
            Quiet: true
        }
    })
    await s3.send(command)
}