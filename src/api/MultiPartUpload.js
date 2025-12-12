import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";

export default async function MultiPartUpload(s3, file, currentDirectory = "/", bucketName = "", opts = {}) {
    if (!s3) throw new Error('S3 client is not initialized');
    // opts: { onProgress: (uploadedBytes, totalBytes)=>{}, signal: AbortSignal, partSize: number, concurrency: number, targetKey?: string }
    const { onProgress, signal, partSize, concurrency, targetKey } = opts || {}

    const fileSize = file.size
    const chunkSize = partSize || (5 * 1024 * 1024)
    const totalParts = Math.ceil(fileSize / chunkSize)
    // Ensure currentDirectory has no leading slash and ends with exactly one slash if not root
    let dir = currentDirectory.trim()
    if (dir === "/") {
        dir = "";
    } else {
        dir = dir.replace(/^\/+/, "").replace(/\/+$/, "") + "/";
    }
    // Use the webkitRelativePath or our synthetic relativePath to preserve folder structure
    const relativeKey = (file.webkitRelativePath || file.relativePath || file.name).replace(/^\/+/, "")
    // If a full target key is provided, use it; otherwise compose from directory + relative path
    const filePath = (typeof targetKey === 'string' && targetKey.length > 0) ? targetKey : (dir + relativeKey);
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

        // Upload parts with limited concurrency and stream slices to avoid loading whole file
        const maxConcurrency = Math.max(1, Math.min(concurrency || 4, 8))
        let uploadedBytes = 0
        let nextPart = 1

        async function uploadOne(partNumber) {
            if (signal && signal.aborted) throw new Error('aborted')
            const start = (partNumber - 1) * chunkSize
            const end = Math.min(partNumber * chunkSize, fileSize)
            const blob = file.slice(start, end)
            const arrayBuffer = await blob.arrayBuffer()
            const body = new Uint8Array(arrayBuffer)
            const uploadRes = await s3.send(new UploadPartCommand({
                Bucket: bucketName,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
                Body: body,
            }))
            parts.push({ ETag: uploadRes.ETag, PartNumber: partNumber })
            uploadedBytes += body.length
            if (typeof onProgress === 'function') {
                try { onProgress(uploadedBytes, fileSize) } catch { }
            }
        }

        const workers = Array.from({ length: Math.min(maxConcurrency, totalParts) }, async () => {
            while (true) {
                const current = nextPart
                nextPart += 1
                if (current > totalParts) break
                await uploadOne(current)
            }
        })
        await Promise.all(workers)

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
        console.error("Failed to Upload", error)
        if (uploadId) {
            await s3.send(new AbortMultipartUploadCommand({
                Bucket: bucketName,
                Key: key,
                UploadId: uploadId
            }))
        }
    // If aborted, surface that via a special flag by returning false
    return false
    }
}