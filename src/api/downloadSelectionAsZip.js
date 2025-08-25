import JSZip from 'jszip'
import listAllObjects from './listAllObjects'
import getFilePreview from './getFilePreview'

// Helper to fetch a URL as ArrayBuffer safely
async function fetchAsArrayBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return await res.arrayBuffer();
}

// Download a mix of files and folders as a single ZIP.
// items: array of { type: 'file'|'folder', key: string, name: string }
export default async function downloadSelectionAsZip(s3, items, bucketName, rootPrefixForZip = '', publicBaseUrl = '') {
    const zip = new JSZip();

    // Normalize the zip root folder inside archive (optional)
    const root = rootPrefixForZip ? (rootPrefixForZip.replace(/^\/+|\/+$/g, '') + '/') : '';

    // Collect all file objects to include: { zipPath, key }
    const fileEntries = [];

    for (const item of items) {
        if (item.type === 'file') {
            const parts = item.key.split('/');
            const fileName = parts.pop();
            const folderPath = parts.join('/');
            const relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
            fileEntries.push({ key: item.key, zipPath: root + relativePath });
        } else if (item.type === 'folder') {
            const objects = await listAllObjects(s3, item.key, bucketName);
            for (const obj of objects) {
                // Derive relative path under the selected folder
                const rel = obj.Key.replace(item.key, '').replace(/^\/+/, '');
                const base = item.key.replace(/\/+$/, ''); // without trailing slash for zip folder name
                const zipPath = root + `${base}/${rel}`;
                fileEntries.push({ key: obj.Key, zipPath });
            }
        }
    }

    // Fetch all files and add to zip
    for (const entry of fileEntries) {
    const url = await getFilePreview(s3, entry.key, false, bucketName, publicBaseUrl);
        const buf = await fetchAsArrayBuffer(url);
        zip.file(entry.zipPath, buf);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = items.length === 1
        ? (items[0].type === 'folder' ? `${items[0].name}.zip` : `${items[0].name}.zip`)
        : 'selection.zip';

    const a = document.createElement('a');
    const href = URL.createObjectURL(blob);
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(href);
    }, 0);
}
