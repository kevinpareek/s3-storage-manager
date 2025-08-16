import { PutObjectCommand } from "@aws-sdk/client-s3";

export default async function addFolder(s3, folderPath = "", bucketName = "") {

    if (!s3) {
        throw new Error("S3 client is not initialized");
    }

    if (!folderPath.endsWith("/")) {
        folderPath += "/";
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: folderPath,
        Body: "",
    });

    await s3.send(command)
}