import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function getFilePreview(s3, key, download = false, bucketName = "") {

    if (!s3) {
        throw new Error("S3 client is not initialized");
    }
    console.log(bucketName)

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ...(download && {
            ResponseContentDisposition: `attachment; filename="${key}"`,
        }),
    });

    
    console.log(command)
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return url;
}