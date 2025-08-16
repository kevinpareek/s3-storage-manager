import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export default async function listFiles(s3, prefix = "", bucketName = "") {
    console.log(prefix)
    let normalizedPrefix = prefix.startsWith("/") ? prefix.slice(1) : prefix;
    if (normalizedPrefix && !normalizedPrefix.endsWith("/")) {
        normalizedPrefix += "/";
    }

    const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: normalizedPrefix,
        Delimiter: "/",
    });

    try {
        const response = await s3.send(command);

        console.log("All", response.CommonPrefixes)

        const folders =
            response.CommonPrefixes?.map((p) => ({
                name: p.Prefix.replace(normalizedPrefix, "").replace("/", ""),
                type: "folder",
                key: p.Prefix,
            })) || [];

        const files =
            response.Contents?.filter((obj) => obj.Key !== normalizedPrefix).map((obj) => ({
                name: obj.Key.replace(normalizedPrefix, ""),
                type: "file",
                key: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified,
            })) || [];

        return [...folders, ...files];
    } catch (error) {
        console.error("Error listing files:", error);
        throw error;
    }
}