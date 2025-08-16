import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";

export default async function MultiPartUpload(s3, file, currentDirectory = "/", bucketName = "") {

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    const chunkSize = 5 * 1024 * 1024
    const totalParts = Math.ceil(buffer.length / chunkSize)
    // Ensure currentDirectory has no leading slash and ends with exactly one slash if not root
    let dir = currentDirectory.trim()
    if (dir === "/") {
        dir = "";
    } else {
        dir = dir.replace(/^\/+/, "").replace(/\/+$/, "") + "/";
    }
    const filePath = dir + file.name;
    let uploadId = ''
    let key = ''

    try {
        // Creating multipart on S3
        const createRes = await s3.send(new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: filePath,
            ContentType: file.type || "application/octet-stream"
        }))

        uploadId = createRes.UploadId
        key = createRes.Key
        const parts = []

        // Uploading part by part on S3
        for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            const start = (partNumber - 1) * chunkSize;
            const end = Math.min(partNumber * chunkSize, buffer.length);
            const partBuffer = buffer.slice(start, end);

            const uploadRes = await s3.send(new UploadPartCommand({
                Bucket: bucketName,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
                Body: partBuffer,
            }));

            parts.push({
                ETag: uploadRes.ETag,
                PartNumber: partNumber,
            });
        }

        await s3.send(new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts
            }
        }))
        return true

    } catch (error) {
        console.log("Failed to Upload", error)
        if (uploadId) {
            await s3.send(new AbortMultipartUploadCommand({
                Bucket: bucketName,
                Key: key,
                UploadId: uploadId
            }))
        }
        return false
    }
}