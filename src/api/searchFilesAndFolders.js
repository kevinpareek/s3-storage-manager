import listAllObjects from './listAllObjects';

export default async function searchFilesAndFolders(s3, prefix, searchTerm, bucketName) {
    const hasTerm = typeof searchTerm === 'string' && searchTerm.trim() !== '';
    const lowerTerm = hasTerm ? searchTerm.toLowerCase() : '';

    // Efficiently list all objects recursively (no delimiter)
    const allObjects = await listAllObjects(s3, prefix, bucketName);
    const results = [];
    const seenFolderKeys = new Set();

    // Normalize prefix
    let normPrefix = prefix || '';
    if (normPrefix && !normPrefix.endsWith('/')) normPrefix += '/';
    if (normPrefix === '/') normPrefix = '';

    for (const obj of allObjects) {
        const key = obj.Key;

        // Remove prefix from key to get relative path
        if (normPrefix && !key.startsWith(normPrefix)) continue;
        const relativeKey = normPrefix ? key.slice(normPrefix.length) : key;

        const parts = relativeKey.split('/');

        // 1. Check if it's a file and matches (or include all when no term for filters)
        if (!key.endsWith('/')) {
            const fileName = parts[parts.length - 1];
            if (!hasTerm || fileName.toLowerCase().includes(lowerTerm)) {
                results.push({
                    name: fileName,
                    type: 'file',
                    key: key,
                    size: obj.Size,
                    lastModified: obj.LastModified
                });
            }
        }

        // 2. Check implicit folders in the path only when searching by name
        if (!hasTerm) continue;

        const segmentsToCheck = parts.slice(0, -1);

        let currentRelPath = '';
        for (const segment of segmentsToCheck) {
            if (!segment) continue;
            currentRelPath += segment + '/';
            const fullKey = normPrefix + currentRelPath;

            if (seenFolderKeys.has(fullKey)) continue;
            seenFolderKeys.add(fullKey);

            if (segment.toLowerCase().includes(lowerTerm)) {
                results.push({
                    name: segment,
                    type: 'folder',
                    key: fullKey,
                    fullName: fullKey
                });
            }
        }
    }

    return results;
}
