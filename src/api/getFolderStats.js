import { ListObjectsV2Command } from "@aws-sdk/client-s3";

// Returns { totalSize: number, earliestLastModified: Date|null, objectCount: number }
export default async function getFolderStats(s3, prefix = "", bucketName = "") {
  if (!s3) throw new Error('S3 client not initialized')
  let normalizedPrefix = prefix.startsWith('/') ? prefix.slice(1) : prefix
  if (normalizedPrefix && !normalizedPrefix.endsWith('/')) normalizedPrefix += '/'

  let continuationToken = undefined
  let totalSize = 0
  let earliest = null
  let latest = null
  let count = 0

  try {
    do {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
      })
      const res = await s3.send(command)
      const contents = res.Contents || []
      for (const obj of contents) {
        // Skip the placeholder "folder" object equal to the prefix itself
        if (obj.Key === normalizedPrefix) continue
        count += 1
        totalSize += obj.Size || 0
        const lm = obj.LastModified ? new Date(obj.LastModified) : null
        if (lm) {
          if (!earliest || lm < earliest) earliest = lm
          if (!latest || lm > latest) latest = lm
        }
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (continuationToken)
  return { totalSize, earliestLastModified: earliest, latestLastModified: latest, objectCount: count }
  } catch (err) {
    console.error('Error getting folder stats', err)
    throw err
  }
}
