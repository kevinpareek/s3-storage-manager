import copyObjectOrFolder from './copyObjectOrFolder';
import deleteFileOrFolder from './deleteFileOrFolder';

export default async function renameFolder(s3, oldPrefix, newPrefix, bucketName) {
    if (!oldPrefix || !newPrefix) return false;

    // Normalize prefixes to ensure they end with '/'
    const normOld = oldPrefix.endsWith('/') ? oldPrefix : oldPrefix + '/';
    const normNew = newPrefix.endsWith('/') ? newPrefix : newPrefix + '/';

    if (normOld === normNew) return true;

    // Copy all objects from old prefix to new prefix
    await copyObjectOrFolder(s3, normOld, normNew, bucketName);

    // Delete all objects in old prefix
    await deleteFileOrFolder(s3, normOld, bucketName);

    return true;
}
