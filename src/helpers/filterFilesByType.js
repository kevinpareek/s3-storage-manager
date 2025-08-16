const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];
const AUDIO_EXTS = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'];
const DOCUMENT_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp'];
const CODE_EXTS = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'rb', 'php', 'go', 'rs', 'swift', 'kt', 'html', 'css', 'json', 'xml', 'sh', 'bat', 'pl', 'm', 'scala', 'dart', 'sql', 'ipynb'];
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'jar'];

function getExtension(name) {
    // Handles names like "video.final.MP4" and returns "mp4"
    const parts = name.toLowerCase().split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1];
}

export default function filterFilesByType(files, type) {
    if (!type || type === 'all') return files;
    return files.filter(file => {
        if (file.type === 'folder') return false;
        const ext = getExtension(file.name);
        if (type === 'image') return IMAGE_EXTS.includes(ext);
        if (type === 'video') return VIDEO_EXTS.includes(ext);
        if (type === 'audio') return AUDIO_EXTS.includes(ext);
        if (type === 'document') return DOCUMENT_EXTS.includes(ext);
        if (type === 'code') return CODE_EXTS.includes(ext);
        if (type === 'archive') return ARCHIVE_EXTS.includes(ext);
        if (type === 'other') {
            // Not matching any known type
            return !IMAGE_EXTS.includes(ext) && !VIDEO_EXTS.includes(ext) && !AUDIO_EXTS.includes(ext) && !DOCUMENT_EXTS.includes(ext) && !CODE_EXTS.includes(ext) && !ARCHIVE_EXTS.includes(ext);
        }
        return ext === type.toLowerCase();
    });
}
