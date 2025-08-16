import { useEffect, useState } from 'react'

export default function ShareUrlView({ keyProp, keyName }) {
    const [url, setUrl] = useState('Generating...')
    useEffect(() => {
        let mounted = true
        async function gen() {
            try {
                const { default: getFilePreview } = await import('../api/getFilePreview')
                // We cannot import s3 or credentials here, so expect the parent to call getFilePreview if needed.
                // As a fallback, show a placeholder
                if (mounted) setUrl('Use "Copy URL" to generate a signed URL')
            } catch (e) {
                if (mounted) setUrl('Error')
            }
        }
        gen()
        return () => { mounted = false }
    }, [keyProp, keyName])

    return (
        <div className="text-[12px] break-words text-gray-300">{url}</div>
    )
}
