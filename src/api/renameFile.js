import copyObjectOrFolder from './copyObjectOrFolder';
import deleteFileOrFolder from './deleteFileOrFolder';

export default async function renameFile(s3, oldKey, newKey, bucketName) {
    if (!s3) throw new Error('S3 client is not initialized');
    if (!oldKey || !newKey || oldKey === newKey) return true;
    
    // Copy to new location
    await copyObjectOrFolder(s3, oldKey, newKey, bucketName);
    
    // Delete old file
    await deleteFileOrFolder(s3, oldKey, bucketName);
    
    return true;
}
