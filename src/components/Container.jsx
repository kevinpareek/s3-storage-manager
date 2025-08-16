
import { useEffect, useState, useCallback } from 'react'

import FileDropper from './FileDropper'
import Finder from './Finder'
import listFiles from '../api/listFiles'
import getFilePreview from '../api/getFilePreview'
import getFolderStats from '../api/getFolderStats'
import CreateFolderModal from './modals/CreateFolderModal'
import InfoModal from './modals/InfoModal'
import RenameModal from './modals/RenameModal'
import useCredentials from '../hooks/useCredentials'
import renameFileOrFolder from '../api/renameFileOrFolder'
import renameFolder from '../api/renameFolder'
import searchFilesAndFolders from '../api/searchFilesAndFolders'
import filterFilesByType from '../helpers/filterFilesByType'
import { Home } from 'lucide-react'


export default function Container() {
    const [refreshFlag, setRefreshFlag] = useState(0);
    const [files, setFiles] = useState([])
    const [folderName, setFolderName] = useState('')
    const [currentDirectory, setCurrentDirectory] = useState("/")
    const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false)
    const { s3, credentials } = useCredentials()
    const [uploading, setUploading] = useState(false)
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
    const [renameTarget, setRenameTarget] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [infoModalOpen, setInfoModalOpen] = useState(false)
    const [infoItem, setInfoItem] = useState(null)
    const [shareUrl, setShareUrl] = useState(null)
    const [downloadUrl, setDownloadUrl] = useState(null)
    const [isGeneratingUrls, setIsGeneratingUrls] = useState(false)

    const handleSetCurrentDirectory = useCallback(
        (location) => {
            localStorage.setItem('currentDirectory', location)
            setCurrentDirectory(location)
        }, [])

    function handleBack() {
        const parts = currentDirectory.split("/").filter(Boolean);
        parts.pop();
        handleSetCurrentDirectory("/" + parts.join("/"));
    }

    useEffect(() => {
        const onPopState = () => {
            handleBack();
        };
        window.addEventListener("popstate", onPopState);

        return () => {
            window.removeEventListener("popstate", onPopState);
        };
    }, [currentDirectory])

    // Helper to load files for current directory
    const loadFiles = useCallback(async () => {
        if (!credentials) return;
        const location = localStorage.getItem('currentDirectory') || '/';
        let contents = [];
        if (searchTerm) {
            contents = await searchFilesAndFolders(s3, location, searchTerm, credentials.name);
        } else if (filterType && filterType !== 'all') {
            contents = await searchFilesAndFolders(s3, location, '', credentials.name);
        } else {
            contents = await listFiles(s3, location, credentials.name);
        }
        if (filterType && filterType !== 'all') {
            contents = filterFilesByType(contents, filterType);
        }
        setFiles(contents);
    }, [credentials, s3, searchTerm, filterType]);

    useEffect(() => {
        setCurrentDirectory(localStorage.getItem('currentDirectory') || '/');
    }, [credentials]);

    useEffect(() => {
        if (!isCreateFolderModalOpen) {
            loadFiles();
        }
        // eslint-disable-next-line
    }, [currentDirectory, uploading, isCreateFolderModalOpen, searchTerm, filterType, refreshFlag, loadFiles]);

    // Generate signed URLs when info modal opens for a file
    useEffect(() => {
        let mounted = true
        async function genUrls() {
            setShareUrl(null)
            setDownloadUrl(null)
            if (!infoItem) return
            setIsGeneratingUrls(true)
            try {
                if (infoItem.type === 'file') {
                    const share = await getFilePreview(s3, infoItem.key, false, credentials.name)
                    const dl = await getFilePreview(s3, infoItem.key, true, credentials.name)
                    if (!mounted) return
                    setShareUrl(share)
                    setDownloadUrl(dl)
                    } else if (infoItem.type === 'folder') {
                    // compute total size and earliest date for the folder
                    try {
                        const stats = await getFolderStats(s3, infoItem.key, credentials.name)
                        if (!mounted) return
                        // set synthetic fields on infoItem for modal display
                        setInfoItem(i => ({ ...i, size: stats.totalSize, created: stats.earliestLastModified, lastModified: stats.latestLastModified }))
                        setShareUrl(null)
                        setDownloadUrl(null)
                    } catch (e) {
                        console.error('Error getting folder stats', e)
                    }
                }
            } catch (err) {
                console.error('Error generating URLs', err)
            } finally {
                if (mounted) setIsGeneratingUrls(false)
            }
        }
        if (infoModalOpen) genUrls()
        return () => { mounted = false }
    }, [infoModalOpen, infoItem])

    return (
        <div className='w-full px-4 py-4 pb-20'>
            <div className='w-full max-w-6xl mx-auto card divide-y divide-[#252525]'>
                <div className='w-full p-4 flex items-center justify-between'>
                    <h4 className='font-mono text-sm text-gray-400 select-none flex items-center gap-1'>
                        {/* Breadcrumbs: Home + folders, clickable, like Finder */}
                        {(() => {
                            // Remove trailing slash for folders (if any)
                            let path = currentDirectory;
                            if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
                            const parts = path.split('/').filter(Boolean);
                            let breadcrumb = [];
                            // Home icon
                            breadcrumb.push(
                                <span key="home">
                                    <Home
                                        size={16}
                                        className="inline align-middle text-blue-400 cursor-pointer hover:underline mr-1"
                                        onClick={() => handleSetCurrentDirectory('/')}
                                    />
                                    {parts.length > 0 && <span className="text-gray-400">/</span>}
                                </span>
                            );
                            for (let idx = 0; idx < parts.length; idx++) {
                                const absPath = '/' + parts.slice(0, idx + 1).join('/');
                                breadcrumb.push(
                                    <span key={absPath}>
                                        <span
                                            className="text-blue-400 cursor-pointer hover:underline"
                                            onClick={() => handleSetCurrentDirectory(absPath)}
                                        >
                                            {parts[idx]}
                                        </span>
                                        {idx < parts.length - 1 && <span className="text-gray-400">/</span>}
                                    </span>
                                );
                            }
                            return <span className="flex items-center flex-wrap">{breadcrumb}</span>;
                        })()}
                    </h4>
                    <div className='flex items-center gap-2'>
                        <input
                            type="text"
                            placeholder="Search files/folders"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="input text-xs mr-2"
                        />
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            className="file-type-select input text-xs mr-2"
                        >
                            <option value="all">All Files</option>
                            <option value="image">Images</option>
                            <option value="video">Videos</option>
                            <option value="audio">Audio</option>
                            <option value="document">Documents</option>
                            <option value="code">Code</option>
                            <option value="archive">Archives</option>
                            <option value="other">Other</option>
                        </select>
                        {currentDirectory != "/" &&
                            <button onClick={handleBack} className='btn btn-ghost'>Back</button>
                        }
                        <button onClick={() => setIsCreateFolderModalOpen(true)} className='btn btn-primary'>Add Folder</button>
                    </div>
                </div>
                <div className='p-4 bg-[#101010]'>
                    <FileDropper
                        currentDirectory={currentDirectory}
                        uploading={uploading}
                        setUploading={setUploading}
                    />
                </div>
                <div className='bg-[#101010] rounded-b-xl'>
                    <div>
                        <Finder
                            contents={files}
                            currentDirectory={currentDirectory}
                            setCurrentDirectory={handleSetCurrentDirectory}
                            onRename={(item) => {
                                setRenameTarget(item)
                                setIsRenameModalOpen(true)
                            }}
                            onDelete={() => setRefreshFlag(f => f + 1)}
                            onOpenInfo={(item) => {
                                setInfoItem(item)
                                setInfoModalOpen(true)
                            }}
                        />
                    </div>
                </div>
            </div>
            {/* Modals */}
            <CreateFolderModal
                folderName={folderName}
                setFolderName={setFolderName}
                isOpen={isCreateFolderModalOpen}
                handleClose={() => {
                    setIsCreateFolderModalOpen(false)
                    setFolderName('')
                }}
                currentDirectory={currentDirectory}
                setCurrentDirectory={handleSetCurrentDirectory}
            />
            <RenameModal
                isOpen={isRenameModalOpen}
                handleClose={() => setIsRenameModalOpen(false)}
                oldName={renameTarget?.name}
                onRename={async (newName) => {
                    if (!renameTarget) return;
                    if (renameTarget.type === 'folder') {
                        await renameFolder(s3, renameTarget.key, newName, credentials.name)
                    } else {
                        // Keep the file in the same directory, only change the file name
                        const oldKey = renameTarget.key;
                        const lastSlash = oldKey.lastIndexOf('/');
                        let newKey = newName;
                        if (lastSlash !== -1) {
                            newKey = oldKey.substring(0, lastSlash + 1) + newName;
                        }
                        await renameFileOrFolder(s3, oldKey, newKey, credentials.name)
                    }
                    setIsRenameModalOpen(false);
                    setRenameTarget(null);
                    setRefreshFlag(f => f + 1); // trigger file list reload
                }}
            />
            <InfoModal
                isOpen={infoModalOpen}
                onClose={() => setInfoModalOpen(false)}
                item={infoItem}
                shareUrl={shareUrl}
                downloadUrl={downloadUrl}
                isGenerating={isGeneratingUrls}
            />
        </div>
    )
}
