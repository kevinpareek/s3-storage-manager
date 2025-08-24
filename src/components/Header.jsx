
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import useCredentials from '../hooks/useCredentials';

export default function Header() {
    const navigate = useNavigate();
    const { credentials, credentialsList, selectedCredentialIndex, setSelectedCredentialIndex } = useCredentials();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    function handleDisconnect() {
        localStorage.removeItem("credentials");
        return navigate("/config");
    }

    function handleSelectCredential(idx) {
        setSelectedCredentialIndex(idx);
        setDropdownOpen(false);
    }

    function handleAddCredential() {
    console.log('Add Credential clicked');
    setDropdownOpen(false);
    navigate('/config');
    }


    // Close dropdown on outside click
    useEffect(() => {
        function onDocClick(e) {
            if (!dropdownOpen) return;
            const el = dropdownRef.current;
            if (el && !el.contains(e.target)) setDropdownOpen(false);
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [dropdownOpen]);

    return (
        <div className='bg-[#181818] w-full p-4 border-b border-[#202020] sticky top-0 z-20'>
            <div className='w-full max-w-6xl mx-auto flex items-center justify-between'>
                <div className='flex items-center gap-2 select-none'>
                    <img src='/logo.svg' alt='Logo' className='w-6 h-6 rounded-sm' />
                    <h3 className='text-xl font-semibold text-gray-200 flex items-center gap-2'>
                        <span>S3</span>
                        <span className='bg-gradient-to-r from-orange-300 to-red-400 bg-clip-text text-transparent'>Manager</span>
                    </h3>
                </div>

                <div className='flex items-center gap-2'>
                    <div className='relative'>
                        <div
                            className='surface px-4 py-2 flex items-center gap-2 rounded-md select-none cursor-pointer min-w-[140px]'
                            onClick={() => setDropdownOpen((v) => !v)}
                        >
                            <div className='w-2 h-2 aspect-square rounded-full bg-green-400 animate-pulse' />
                            <p className='text-xs text-gray-300 truncate max-w-[100px]'>
                                {credentials?.name || 'No Credential'}
                            </p>
                            <svg className='w-3 h-3 text-gray-400 ml-1' fill='none' stroke='currentColor' strokeWidth='2' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
                            </svg>
                        </div>
                        {dropdownOpen && (
                            <div ref={dropdownRef} className='absolute left-0 mt-1 w-full bg-[#181818] border border-[#202020] rounded-md shadow-lg z-30'>
                                {credentialsList.length > 1 ? credentialsList.map((cred, idx) => (
                                    <div
                                        key={cred.name + idx}
                                        role="button"
                                        tabIndex={0}
                                        className={`px-4 py-2 text-xs cursor-pointer hover:bg-[#232323] ${idx === selectedCredentialIndex ? 'bg-[#232323] text-orange-300' : 'text-gray-300'}`}
                                        onClick={() => handleSelectCredential(idx)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCredential(idx) }}
                                    >
                                        {cred.name}
                                    </div>
                                )) : (
                                    ""
                                )}
                                <div className='border-t border-[#232323]' />
                                <div
                                    role="button"
                                    tabIndex={0}
                                    className='px-4 py-2 text-xs cursor-pointer hover:bg-[#232323] text-blue-400'
                                    onClick={handleAddCredential}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAddCredential() }}
                                >
                                    + Add Credential
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => navigate('/edit-credential')}
                        className='btn btn-blue'
                    >
                        Edit Credential
                    </button>
                    <button onClick={handleDisconnect} className='btn btn-danger'>
                        Disconnect
                    </button>
                </div>
            </div>
        </div>
    );
}
