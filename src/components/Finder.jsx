import { Folder, LoaderCircle, Trash2, Pencil, Home, Info } from 'lucide-react'
import getFilePreview from '../api/getFilePreview'
import deleteFileOrFolder from '../api/deleteFileOrFolder'
import useCredentials from '../hooks/useCredentials'
import { useState } from 'react'
import DeleteConfirmModal from './modals/DeleteConfirmModal'

export default function Finder({ contents = [], setCurrentDirectory, onRename, onDelete, onOpenInfo, loading = false }) {

    const { s3, credentials } = useCredentials()
    const [isDeletingFileOrFolder, setIsDeletingFileOrFolder] = useState(false)
    const [deletingFileOrFolderKey, setDeletingFileOrFolderKey] = useState(null)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null) // { key, type, name }

    async function handleFilePreview(key) {
        console.log("Previweing", credentials)
        const previewUrl = await getFilePreview(s3, key, false, credentials.name)
        window.open(previewUrl, '_blank')
    }

    async function handleDeleteFileOrFolder({ key, type }) {
        setIsDeletingFileOrFolder(true)
        setDeletingFileOrFolderKey(key)
        await deleteFileOrFolder(s3, key, credentials.name)
        // Directory logic
        if (type === 'folder') {
            // Remove trailing slash if present
            let folderPath = key.endsWith('/') ? key.slice(0, -1) : key;
            const parts = folderPath.split('/').filter(Boolean);
            parts.pop(); // Remove deleted folder
            const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
            setCurrentDirectory(parentPath);
        } else {
            // For file, stay in same directory
            let filePath = key;
            const parts = filePath.split('/').filter(Boolean);
            parts.pop(); // Remove file name
            const currentDir = parts.length > 0 ? '/' + parts.join('/') : '/';
            setCurrentDirectory(currentDir);
        }
    setDeletingFileOrFolderKey(null)
    setIsDeletingFileOrFolder(false)
    setDeleteModalOpen(false)
    setDeleteTarget(null)
    // Trigger parent refresh if provided
    if (onDelete) onDelete();
    }

    async function handleFileDownload(key) {
        const previewUrl = await getFilePreview(s3, key, true, credentials.name)
        window.open(previewUrl, 'download')
    }

    console.log(contents)

    return (
        <>
            <div className='divide-y divide-[#252525]'>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <LoaderCircle size={22} className="animate-spin text-yellow-400" />
                    </div>
                ) : contents.length > 0 ? (
                    contents.map((content, index) => (
                        <div key={index} className='flex items-center justify-between px-4 py-3 hover:bg-[#0f0f0f] transition-colors'>
                            <span className='flex items-center gap-3'>
                                {
                                    // Render files like folders visually
                                    <Folder
                                        size={18}
                                        className='text-yellow-500'
                                    />
                                }

                                <div>
                                    <p
                                        className={`text-yellow-500 cursor-pointer text-xs font-mono`}
                                        onClick={() => {
                                            if (content.type == 'folder') {
                                                setCurrentDirectory('/' + content.key)
                                            }
                                        }}
                                    >
                                        {content.name}
                                    </p>
                                    {/* Show path if not in root */}
                                    {content.key && content.key.split('/').filter(Boolean).length > 1 && (() => {
                                        // Remove the trailing slash for folders
                                        let path = content.key;
                                        if (content.type === 'folder' && path.endsWith('/')) path = path.slice(0, -1);
                                        // Remove the file/folder name from the end
                                        const parts = path.split('/').filter(Boolean);
                                        parts.pop();
                                        // Breadcrumbs: each folder clickable
                                        let breadcrumb = [];
                                        // Home icon
                                        breadcrumb.push(
                                            <span key="home">
                                                <Home
                                                    size={12}
                                                    className="inline align-middle text-blue-400 cursor-pointer hover:underline mr-1"
                                                    onClick={() => setCurrentDirectory('/')}
                                                />
                                                {parts.length > 0 && <span className="text-gray-400"> / </span>}
                                            </span>
                                        );
                                        for (let idx = 0; idx < parts.length; idx++) {
                                            // Build absolute path for each segment
                                            const absPath = '/' + parts.slice(0, idx + 1).join('/');
                                            // breadcrumb for each folder segment
                                            breadcrumb.push(
                                                <span key={absPath}>
                                                    <span
                                                        className="text-blue-400 cursor-pointer hover:underline"
                                                        onClick={() => setCurrentDirectory(absPath)}
                                                    >
                                                        {parts[idx]}
                                                    </span>

                                                    {idx < parts.length - 1 && <span className="text-gray-400"> / </span>}
                                                </span>
                                            );
                                        }
                                        return (
                                            <span className="block text-[10px] font-mono ml-1">
                                                {breadcrumb}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </span>
                            <div className='flex items-center gap-4'>
                                <Info
                                    size={18}
                                    className='text-blue-300 cursor-pointer'
                                    onClick={() => onOpenInfo && onOpenInfo(content)}
                                />
                                <Pencil
                                    size={18}
                                    className='text-blue-300 cursor-pointer'
                                    onClick={() => onRename && onRename(content)}
                                />
                                {(deletingFileOrFolderKey == content.key && isDeletingFileOrFolder) ? (
                                    <LoaderCircle
                                        size={18}
                                        className='text-yellow-300 cursor-pointer animate-spin'
                                    />
                                ) : (
                                    <Trash2
                                        size={18}
                                        className='text-red-300 cursor-pointer'
                                        onClick={() => setDeleteModalOpen(true) || setDeleteTarget({ key: content.key, type: content.type, name: content.name })}
                                    />
                                )}
                                {/* view/download icons removed to display files like folders */}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center py-10 text-sm text-gray-500 font-mono ">
                        No files or folders in this directory.
                    </div>
                )}
            </div>
            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                handleClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
                onConfirm={() => deleteTarget && handleDeleteFileOrFolder(deleteTarget)}
                type={deleteTarget?.type}
                name={deleteTarget?.name}
            />
        </>
    )
}
