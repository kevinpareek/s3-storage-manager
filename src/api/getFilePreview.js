import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Generate a URL for viewing/downloading a key.
// Rules:
// - If publicBaseUrl is provided AND download === false -> return `${publicBaseUrl}/${encodedKey}`
// - For download === true -> always return a signed URL (more reliable across CDNs)
export default async function getFilePreview(s3, key, download = false, bucketName = "", publicBaseUrl = "") {
    // Prefer public base URL only for non-download views
    if (publicBaseUrl && !download) {
        const base = String(publicBaseUrl).replace(/\/+$/, '');
        const k = String(key || '');
        const encodedKey = k.split('/').map(encodeURIComponent).join('/');
        let url = `${base}/${encodedKey}`;
        return url;
    }

    if (!s3) {
        throw new Error("S3 client is not initialized");
    }

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ...(download && {
            ResponseContentDisposition: `attachment; filename="${key}"`,
        }),
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return url;
}