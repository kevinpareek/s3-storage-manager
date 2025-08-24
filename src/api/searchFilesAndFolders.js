import { ListObjectsV2Command } from '@aws-sdk/client-s3';
// Returns folders and files matching searchTerm
// Recursively list all files and folders under prefix and filter by searchTerm

// Recursively get all folders and files under prefix
async function getAllFoldersAndFiles(s3, prefix, bucketName) {
    let normalizedPrefix = prefix.startsWith("/") ? prefix.slice(1) : prefix;
    if (normalizedPrefix && !normalizedPrefix.endsWith("/")) {
        normalizedPrefix += "/";
    }
    let results = [];
    let ContinuationToken = undefined;
    do {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: normalizedPrefix,
            Delimiter: '/',
            ContinuationToken
        });
        const response = await s3.send(command);
        // Folders (prefixes)
        if (response.CommonPrefixes) {
            for (const p of response.CommonPrefixes) {
                results.push({
                    name: p.Prefix.replace(normalizedPrefix, "").replace(/\/$/, ""),
                    type: "folder",
                    key: p.Prefix,
                    fullName: p.Prefix
                });
                // Recursively get subfolders
                const subfolders = await getAllFoldersAndFiles(s3, p.Prefix, bucketName);
                results.push(...subfolders);
            }
        }
        // Files
        if (response.Contents) {
            results.push(...response.Contents.filter(obj => obj.Key !== normalizedPrefix).map(obj => ({
                name: obj.Key.replace(normalizedPrefix, ""),
                type: "file",
                key: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified,
            })));
        }
        ContinuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return results;
}

export default async function searchFilesAndFolders(s3, prefix, searchTerm, bucketName) {
    const allItems = await getAllFoldersAndFiles(s3, prefix, bucketName);
        if (!s3) {
            const err = new Error('S3 client is not initialized');
            console.error(err);
            throw err;
        }
    return allItems.filter(item => {
        if (item.type === 'folder') {
            return (item.fullName || item.key || '').toLowerCase().includes(searchTerm.toLowerCase());
        }
        return item.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
}
