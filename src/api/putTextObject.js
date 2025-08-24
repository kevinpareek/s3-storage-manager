import { PutObjectCommand } from "@aws-sdk/client-s3";

// Save small text content to an object key. Accepts string body and optional contentType.
export default async function putTextObject(s3, key, bucketName = "", body = "", contentType = "text/plain; charset=utf-8") {
  if (!s3) throw new Error("S3 client is not initialized");
  const command = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: body, ContentType: contentType });
  await s3.send(command);
  return true;
}
