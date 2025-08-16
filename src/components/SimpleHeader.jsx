export default function SimpleHeader() {
    return (
        <div className='bg-[#181818] w-full p-4 border-b border-[#202020] sticky top-0 z-20'>
            <div className='w-full max-w-6xl mx-auto flex items-center'>
                <div className='flex items-center gap-2 select-none'>
                    <img src='/logo.svg' alt='Logo' className='w-6 h-6 rounded-sm' />
                    <h3 className='text-xl font-semibold text-gray-200 flex items-center gap-2'>
                        <span>S3</span>
                        <span className='bg-gradient-to-r from-orange-300 to-red-400 bg-clip-text text-transparent'>Manager</span>
                    </h3>
                </div>
            </div>
        </div>
    )
}


