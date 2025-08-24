import { Folder, LoaderCircle, Home, MoreVertical, Info } from 'lucide-react'
import getFilePreview from '../api/getFilePreview'
import deleteFileOrFolder from '../api/deleteFileOrFolder'
import useCredentials from '../hooks/useCredentials'
import { useState } from 'react'
import DeleteConfirmModal from './modals/DeleteConfirmModal'

export default function Finder({ contents = [], setCurrentDirectory, onRename, onDelete, onOpenInfo, onCopy, onMove, loading = false }) {

    const { s3, credentials } = useCredentials()
    const [isDeletingFileOrFolder, setIsDeletingFileOrFolder] = useState(false)
    const [deletingFileOrFolderKey, setDeletingFileOrFolderKey] = useState(null)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null) // { key, type, name }
    const [openMenuKey, setOpenMenuKey] = useState(null)

    async function handleFilePreview(key) {
        try {
            if (!s3 || !credentials) {
                console.error('S3 client or credentials not ready for preview');
                return;
            }
            console.log("Previweing", credentials)
            const previewUrl = await getFilePreview(s3, key, false, credentials.name)
            window.open(previewUrl, '_blank')
        } catch (err) {
            console.error('Error previewing file', err)
        }
    }

    async function handleDeleteFileOrFolder({ key, type }) {
        try {
            if (!s3 || !credentials) {
                console.error('S3 client or credentials not ready for delete');
                return;
            }
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
        } catch (err) {
            console.error('Error deleting file/folder', err)
        } finally {
            setDeletingFileOrFolderKey(null)
            setIsDeletingFileOrFolder(false)
            setDeleteModalOpen(false)
            setDeleteTarget(null)
        }
    // Trigger parent refresh if provided
    if (onDelete) onDelete();
    }

    async function handleFileDownload(key) {
        try {
            if (!s3 || !credentials) {
                console.error('S3 client or credentials not ready for download');
                return;
            }
            const previewUrl = await getFilePreview(s3, key, true, credentials.name)
            window.open(previewUrl, 'download')
        } catch (err) {
            console.error('Error downloading file', err)
        }
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
                        <div key={index} className='relative flex items-center justify-between px-4 py-3 hover:bg-[#0f0f0f] transition-colors'>
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
                                <MoreVertical
                                    size={18}
                                    className='text-gray-300 cursor-pointer'
                                    onClick={(e) => { e.stopPropagation(); setOpenMenuKey((k) => k === content.key ? null : content.key) }}
                                />
                                {deletingFileOrFolderKey == content.key && isDeletingFileOrFolder && (
                                    <LoaderCircle size={18} className='text-yellow-300 animate-spin' />
                                )}
                            </div>
                            {openMenuKey === content.key && (
                                <div className='absolute right-4 top-full mt-1 w-44 bg-[#181818] border border-[#232323] rounded-md shadow-lg z-40'
                                     onClick={(e) => e.stopPropagation()}>
                                    {content.type === 'folder' ? (
                                        <div>
                                            <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => setCurrentDirectory('/' + content.key)}>Open</div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => handleFilePreview(content.key)}>Preview</div>
                                            <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => handleFileDownload(content.key)}>Download</div>
                                        </div>
                                    )}
                                    <div className='border-t border-[#232323]' />
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); onCopy && onCopy(content) }}>Copy to…</div>
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); onMove && onMove(content) }}>Move to…</div>
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); onRename && onRename(content) }}>Rename</div>
                                    <div className='border-t border-[#232323]' />
                                    <div role='button' tabIndex={0} className='px-3 py-2 text-xs text-red-300 hover:bg-[#232323]' onClick={() => { setOpenMenuKey(null); setDeleteModalOpen(true); setDeleteTarget({ key: content.key, type: content.type, name: content.name }) }}>Delete</div>
                                </div>
                            )}
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
