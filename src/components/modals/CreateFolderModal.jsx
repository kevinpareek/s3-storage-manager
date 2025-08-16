import React, { useEffect, useState } from 'react'
import addFolder from '../../api/addFolder'
import useCredentials from '../../hooks/useCredentials'

export default function CreateFolderModal({ isOpen, handleClose, currentDirectory = "", setCurrentDirectory, folderName, setFolderName }) {

    const { s3, credentials } = useCredentials()

    async function handleCreateFolder(event) {
        event.preventDefault();
        // Ensure currentDirectory is correct
        let folderPath = currentDirectory === '/' ? '' : currentDirectory.slice(1);
        // Ensure trailing slash for parent folder
        if (folderPath && !folderPath.endsWith('/')) {
            folderPath += '/';
        }
        // Always add trailing slash for new folder
        const newFolderKey = folderPath + folderName + '/';
        await addFolder(s3, newFolderKey, credentials.name);
        // Optionally, update current directory to the new folder
        // setCurrentDirectory('/' + newFolderKey);
        handleClose();
    }

    function handleCancel() {
        handleClose()
    }

    if (!isOpen) {
        return null
    }

    return (
        <div className='w-full h-full fixed top-0 left-0 bg-[#000]/50 backdrop-blur-sm flex items-center justify-center px-2'>
            <div className='w-full max-w-lg card p-5'>
                <h1 className='font-semibold text-xl mb-6 bg-gradient-to-r from-orange-300 to-red-400 bg-clip-text text-transparent'>
                    Add Folder
                </h1>

                <form onSubmit={handleCreateFolder} className='space-y-3'>
                    <div className='flex flex-col items-start gap-1'>
                        <label htmlFor="name" className='text-sm text-gray-400'>
                            Name
                        </label>
                        <input
                            type="text"
                            name='name'
                            value={folderName}
                            onChange={(e) => {
                                setFolderName(e.target.value)
                                console.log((currentDirectory + e.target.value + '/'))
                            }}
                            className='input w-full text-sm'
                            placeholder='eg. my folder'
                            autoFocus
                            required
                        />
                    </div>

                    <div className='flex items-center flex-row-reverse gap-2'>
                        <button onClick={handleCancel} type='button' className='btn btn-ghost mt-4'>
                            Cancel
                        </button>

                        <button type='submit' className='btn btn-primary mt-4'>
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
