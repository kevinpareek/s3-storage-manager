import { HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

export default async function headObjectExists(s3, key, bucketName) {
	// If checking a folder/prefix, determine existence by listing one object under it
	if (key.endsWith('/')) {
		try {
			const res = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: key, MaxKeys: 1 }))
			const count = typeof res?.KeyCount === 'number' ? res.KeyCount : (res?.Contents?.length || 0)
			return count > 0
		} catch {
			// On permission or transient errors, assume exists to be safe
			return true
		}
	}

	// For exact object keys, prefer listing first to avoid 404 noise in DevTools when not found.
	try {
		const res = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: key, MaxKeys: 1 }))
		const first = Array.isArray(res?.Contents) && res.Contents[0]
		if (!first) return false
		return first.Key === key
	} catch (e1) {
		// If ListBucket is not permitted (e.g., 403), fall back to HEAD.
		try {
			await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }))
			return true
		} catch (err) {
			const status = err?.$metadata?.httpStatusCode
			if (status === 404) return false
			return true
		}
	}
}


