import { CopyObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

export default async function copyObjectOrFolder(s3, sourceKeyOrPrefix, destKeyOrPrefix, bucketName) {
	if (!s3) throw new Error('S3 client not initialized')
	if (!sourceKeyOrPrefix || !destKeyOrPrefix) return false

	// Prevent accidental self-copy loops
	if (sourceKeyOrPrefix === destKeyOrPrefix) return true

	const encodeCopySource = (key) => encodeURI(`${bucketName}/${key}`)

	const isFolder = sourceKeyOrPrefix.endsWith('/')
	if (!isFolder) {
		await s3.send(new CopyObjectCommand({
			Bucket: bucketName,
			CopySource: encodeCopySource(sourceKeyOrPrefix),
			Key: destKeyOrPrefix
		}))
		return true
	}

	const srcPrefix = sourceKeyOrPrefix.endsWith('/') ? sourceKeyOrPrefix : sourceKeyOrPrefix + '/'
	const dstPrefix = destKeyOrPrefix.endsWith('/') ? destKeyOrPrefix : destKeyOrPrefix + '/'

	// Don't allow copying a folder into itself or a nested child of itself
	if (dstPrefix.startsWith(srcPrefix)) {
		throw new Error('Destination cannot be inside the source folder')
	}

	let continuationToken = undefined
	while (true) {
		const listRes = await s3.send(new ListObjectsV2Command({
			Bucket: bucketName,
			Prefix: srcPrefix,
			ContinuationToken: continuationToken
		}))
		const contents = listRes.Contents || []
		for (const obj of contents) {
			const oldKey = obj.Key
			const newKey = oldKey.replace(srcPrefix, dstPrefix)
			await s3.send(new CopyObjectCommand({
				Bucket: bucketName,
				CopySource: encodeCopySource(oldKey),
				Key: newKey
			}))
		}
		if (!listRes.IsTruncated) break
		continuationToken = listRes.NextContinuationToken
	}
	return true
}


