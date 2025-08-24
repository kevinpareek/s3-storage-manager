import { HeadObjectCommand } from '@aws-sdk/client-s3'

export default async function headObjectExists(s3, key, bucketName) {
	try {
		await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }))
		return true
	} catch (err) {
		const status = err?.$metadata?.httpStatusCode
		if (status === 404) return false
		// unknown: assume exists to be safe
		return true
	}
}


