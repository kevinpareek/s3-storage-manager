import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useCredentials from '../hooks/useCredentials'
import { S3Client } from '@aws-sdk/client-s3'
import listFiles from '../api/listFiles'
import { toast } from 'react-toastify'
import SimpleHeader from '../components/SimpleHeader'

export default function ConfigurationForm() {

    const [formData, setFormData] = useState({
        name: '',
        secret_key: '',
        access_key: '',
        region: '',
        endpoint: ''
    })
    const { credentials, credentialsList, setCredentialsList } = useCredentials()
    const navigate = useNavigate()
    const [copiedCors, setCopiedCors] = useState(false)
    const [copiedPolicy, setCopiedPolicy] = useState(false)
    const [copiedR2Endpoint, setCopiedR2Endpoint] = useState(false)
    const [copiedR2Region, setCopiedR2Region] = useState(false)
    const [copiedR2Cors, setCopiedR2Cors] = useState(false)
    const [openSection, setOpenSection] = useState('aws')
    const [copiedKey, setCopiedKey] = useState(null)
    const [selectedProvider, setSelectedProvider] = useState('aws')
    const [providerSearch, setProviderSearch] = useState('')

    const corsJson = `[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]`

    async function handleCopyCors() {
        try {
            await navigator.clipboard.writeText(corsJson)
            setCopiedCors(true)
            setTimeout(() => setCopiedCors(false), 1500)
        } catch (err) {
            console.error('Failed to copy CORS JSON', err)
        }
    }

    const bucketName = formData.name || '<your-bucket-name>'
    const policyJson = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${bucketName}"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::${bucketName}/*"
      ]
    }
  ]
}`

    async function handleCopyPolicy() {
        try {
            await navigator.clipboard.writeText(policyJson)
            setCopiedPolicy(true)
            setTimeout(() => setCopiedPolicy(false), 1500)
        } catch (err) {
            console.error('Failed to copy Policy JSON', err)
        }
    }

    const r2EndpointTemplate = 'https://<accountid>.r2.cloudflarestorage.com'
    const r2Region = 'auto'
    const r2CorsJson = `[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]`

    async function handleCopyR2Endpoint() {
        try {
            await navigator.clipboard.writeText(r2EndpointTemplate)
            setCopiedR2Endpoint(true)
            setTimeout(() => setCopiedR2Endpoint(false), 1500)
        } catch (err) {
            console.error('Failed to copy R2 endpoint', err)
        }
    }

    async function handleCopyR2Region() {
        try {
            await navigator.clipboard.writeText(r2Region)
            setCopiedR2Region(true)
            setTimeout(() => setCopiedR2Region(false), 1500)
        } catch (err) {
            console.error('Failed to copy R2 region', err)
        }
    }

    async function handleCopyR2Cors() {
        try {
            await navigator.clipboard.writeText(r2CorsJson)
            setCopiedR2Cors(true)
            setTimeout(() => setCopiedR2Cors(false), 1500)
        } catch (err) {
            console.error('Failed to copy R2 CORS JSON', err)
        }
    }

    function toggleSection(key) {
        setOpenSection((prev) => (prev === key ? null : key))
    }

    async function copyText(id, text) {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedKey(id)
            setTimeout(() => setCopiedKey(null), 1500)
        } catch (err) {
            console.error('Failed to copy', err)
        }
    }

    function applyProviderToForm(providerMeta) {
        setFormData((prev) => ({
            ...prev,
            region: providerMeta.region || prev.region,
            endpoint: providerMeta.endpoint || prev.endpoint
        }))
        try { toast.success('Applied provider values to form') } catch {}
    }

    const providers = [
        {
            key: 'aws',
            label: 'AWS S3',
            description: 'Standard S3 buckets with IAM access.',
            endpoint: 'https://s3.amazonaws.com',
            region: 'us-east-1',
            steps: ['Open S3 Console', 'Permissions → CORS', 'Paste the JSON below', 'Ensure required IAM permissions']
        },
        {
            key: 'r2',
            label: 'Cloudflare R2',
            description: 'S3-compatible storage with zero egress to CF.',
            endpoint: r2EndpointTemplate,
            region: r2Region,
            steps: ['Create R2 bucket', 'Generate S3 API credentials', 'Use these values in the form']
        },
        {
            key: 'do',
            label: 'DigitalOcean Spaces',
            description: 'S3-compatible object storage.',
            endpoint: 'https://nyc3.digitaloceanspaces.com',
            region: 'nyc3',
            steps: ['Create Space', 'Use Access/Secret keys', 'Use these values in the form']
        },
        {
            key: 'gcs',
            label: 'Google Cloud Storage',
            description: 'Use Interoperability (HMAC) for S3 API.',
            endpoint: 'https://storage.googleapis.com',
            region: 'us-central1',
            steps: ['Enable HMAC keys (interoperability)', 'Use these values in the form']
        },
        {
            key: 'ibm',
            label: 'IBM Cloud Object Storage',
            description: 'S3-compatible storage.',
            endpoint: 'https://s3.us-south.cloud-object-storage.appdomain.cloud',
            region: 'us-south',
            steps: ['Create bucket', 'Use these values in the form']
        },
        {
            key: 'oracle',
            label: 'Oracle Cloud Object Storage',
            description: 'S3-compatible storage.',
            endpoint: 'https://objectstorage.ap-mumbai-1.oraclecloud.com',
            region: 'ap-mumbai-1',
            steps: ['Create bucket', 'Use these values in the form']
        },
        {
            key: 'scw',
            label: 'Scaleway Elements',
            description: 'S3-compatible storage.',
            endpoint: 'https://s3.fr-par.scw.cloud',
            region: 'fr-par',
            steps: ['Create bucket', 'Use these values in the form']
        },
        {
            key: 'wasabi',
            label: 'Wasabi',
            description: 'Hot cloud storage (S3-compatible).',
            endpoint: 'https://s3.us-east-1.wasabisys.com',
            region: 'us-east-1',
            steps: ['Create bucket', 'Use these values in the form']
        },
        {
            key: 'other',
            label: 'Other',
            description: 'Any S3-compatible provider.',
            endpoint: 'https://s3.provider.com',
            region: 'auto',
            steps: ['Find provider S3 endpoint & region', 'Use these values in the form']
        }
    ]

    async function handleSubmit(event) {
        event.preventDefault()

        if (
            !formData.name ||
            !formData.access_key ||
            !formData.secret_key ||
            !formData.region ||
            !formData.endpoint
        ) {
            alert("All fields are required")
            return
        }
        try {
            const tempClient = new S3Client({
                region: formData.region,
                endpoint: formData.endpoint,
                forcePathStyle: true,
                credentials: {
                    accessKeyId: formData.access_key,
                    secretAccessKey: formData.secret_key
                }
            })
            
            await listFiles(tempClient, '', formData.name)

            // Merge with existing credentials in localStorage
            const stored = localStorage.getItem('credentials')
            let newStored
            if (!stored) {
                newStored = formData
            } else {
                try {
                    const parsed = JSON.parse(stored)
                    if (Array.isArray(parsed)) {
                        newStored = [...parsed, formData]
                    } else if (parsed && typeof parsed === 'object') {
                        newStored = [parsed, formData]
                    } else {
                        newStored = formData
                    }
                } catch (err) {
                    newStored = formData
                }
            }

            localStorage.setItem("credentials", JSON.stringify(newStored))
            // update context state if available
            if (setCredentialsList) {
                if (Array.isArray(newStored)) setCredentialsList(newStored)
                else setCredentialsList([newStored])
            }

            toast.success("Authorization successfull")
            setFormData({
                name: '',
                secret_key: '',
                access_key: '',
                region: '',
                endpoint: ''
            })
            return navigate('/')

        } catch (error) {
            console.log(error)
            toast.error("Please enter valid credentials")
            setFormData({
                name: '',
                secret_key: '',
                access_key: '',
                region: '',
                endpoint: ''
            })
            return
        }
    }

    // Allow opening /config even when credentials exist (used for adding new credentials)

    return (
        <div className='w-full min-h-dvh bg-[#101010] text-gray-300'>
            <SimpleHeader />
            <div className='w-full flex flex-col items-center justify-start py-8 px-4'>
                <div className='w-full max-w-xl card px-5 pb-5 pt-7 shadow-sm'>
                    <h1 className='font-semibold text-xl mb-6 bg-gradient-to-r from-orange-300 to-red-400 bg-clip-text text-transparent'>
                        Enter your S3 Configurations
                    </h1>

                    <form onSubmit={handleSubmit} className='space-y-3'>
                        
                        <div className='flex flex-col items-start gap-1'>
                            <label htmlFor="name" className='text-sm text-gray-400'>
                                Access Key
                            </label>
                            <input
                                type="password"
                                name='access_key'
                                value={formData.access_key}
                                onChange={(e) => setFormData({ ...formData, access_key: e.target.value })}
                                className='input w-full text-sm'
                                placeholder='••••••••••••'
                            />
                        </div>
                        <div className='flex flex-col items-start gap-1'>
                            <label htmlFor="name" className='text-sm text-gray-400'>
                                Secret Key
                            </label>
                            <input
                                type="password"
                                name='secret_key'
                                value={formData.secret_key}
                                onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                                className='input w-full text-sm'
                                placeholder='••••••••••••'
                            />
                        </div>
                        <div className='flex flex-col items-start gap-1'>
                            <label htmlFor="region" className='text-sm text-gray-400'>
                                Region
                            </label>
                            <input
                                type="text"
                                name='region'
                                value={formData.region}
                                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                                className='input w-full text-sm'
                                placeholder='eg. eu-north-1'
                            />
                        </div>

                        <div className='flex flex-col items-start gap-1'>
                            <label htmlFor="name" className='text-sm text-gray-400'>
                                Bucket Name
                            </label>
                            <input
                                type="text"
                                name='name'
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className='input w-full text-sm'
                                placeholder='eg. bucketname'
                                autoFocus
                            />
                        </div>

                        <div className='flex flex-col items-start gap-1'>
                            <label htmlFor="endpoint" className='text-sm text-gray-400'>
                                Endpoint
                            </label>
                            <input
                                type="text"
                                name='endpoint'
                                value={formData.endpoint}
                                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                                className='input w-full text-sm'
                                placeholder='eg. https://s3.amazonaws.com or https://nyc3.digitaloceanspaces.com'
                            />
                        </div>
                        <button type='submit' className='btn btn-primary w-full text-sm mt-4'>
                            Connect
                        </button>
                    </form>
                </div>
                
                <div className='w-full max-w-4xl card p-6 mt-6 shadow-sm'>
                    <div className='mb-4'>
                        <div className='inline-flex items-center gap-2 px-2 py-1 rounded-md bg-[#101010] border border-[#232323] text-[10px] uppercase tracking-wide text-gray-300'>
                            <span>storage setup</span>
                        </div>
                        <h3 className='text-xl font-semibold text-gray-200 mt-2'>Choose a Provider</h3>
                        <p className='text-sm text-gray-400 mt-1'>Pick a provider to see exact values and steps. Apply to form in one click.</p>
                        <div className='mt-4 flex flex-col md:flex-row md:items-center gap-3'>
                            <input
                                type='text'
                                placeholder='Search provider...'
                                value={providerSearch}
                                onChange={(e) => setProviderSearch(e.target.value)}
                                className='input text-sm w-full md:max-w-xs'
                            />
                            <div className='flex gap-2 overflow-x-auto pb-1'>
                                {providers
                                    .filter(p => p.label.toLowerCase().includes(providerSearch.toLowerCase()))
                                    .map(p => (
                                        <button
                                            key={p.key}
                                            onClick={() => setSelectedProvider(p.key)}
                                            className={`px-3 py-1 rounded-md text-xs border ${selectedProvider === p.key ? 'bg-[#ffffff10] border-[#3a3a3a]' : 'bg-[#0f0f0f] border-[#232323]'} text-gray-200 whitespace-nowrap`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>

                    <div className='grid grid-cols-1 gap-6'>
                        <div className='card-2 p-4'>
                            {(() => {
                                const p = providers.find(x => x.key === selectedProvider) || providers[0]
                                return (
                                    <div>
                                        <div className='flex items-start justify-between gap-4'>
                                            <div>
                                                <h4 className='font-semibold text-gray-200'>{p.label}</h4>
                                                <p className='text-xs text-gray-400 mt-1'>{p.description}</p>
                                            </div>
                                            <button onClick={() => applyProviderToForm(p)} className='btn btn-ghost text-xs'>Apply to form</button>
                                        </div>
                                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4'>
                                            <div className='card overflow-hidden'>
                                                <div className='flex items-center justify-between px-3 py-2 border-b border-[#232323]'>
                                                    <span className='text-xs text-gray-400'>Endpoint</span>
                                                    <button onClick={() => copyText(`${p.key}-endpoint`, p.endpoint)} className='btn btn-ghost text-[11px] py-1'>
                                                        {copiedKey === `${p.key}-endpoint` ? '✅ Copied' : '📋 Copy'}
                                                    </button>
                                                </div>
                                                <pre className='text-xs overflow-x-auto p-3 text-gray-200'>
{p.endpoint}
                                                </pre>
                                            </div>
                                            <div className='card overflow-hidden'>
                                                <div className='flex items-center justify-between px-3 py-2 border-b border-[#232323]'>
                                                    <span className='text-xs text-gray-400'>Region</span>
                                                    <button onClick={() => copyText(`${p.key}-region`, p.region)} className='btn btn-ghost text-[11px] py-1'>
                                                        {copiedKey === `${p.key}-region` ? '✅ Copied' : '📋 Copy'}
                                                    </button>
                                                </div>
                                                <pre className='text-xs overflow-x-auto p-3 text-gray-200'>
{p.region}
                                                </pre>
                                            </div>
                                        </div>
                                        <div className='mt-4'>
                                            <h5 className='text-xs text-gray-400 mb-2'>Steps</h5>
                                            <ol className='list-decimal list-inside space-y-1 text-xs text-gray-300'>
                                                {p.steps.map((s, i) => (<li key={i}>{s}</li>))}
                                            </ol>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                        <div className='card-2 p-4'>
                            <div className='flex items-center justify-between px-1'>
                                <span className='text-xs text-gray-400'>CORS Configuration</span>
                                <button onClick={() => copyText(`${selectedProvider}-cors`, selectedProvider === 'r2' ? r2CorsJson : corsJson)} className='btn btn-ghost text-[11px] py-1'>
                                    {copiedKey === `${selectedProvider}-cors` ? '✅ Copied' : '📋 Copy'}
                                </button>
                            </div>
                            <pre className='text-xs overflow-x-auto p-3 mt-2 text-gray-200'>
{selectedProvider === 'r2' ? r2CorsJson : corsJson}
                            </pre>
                            <p className='text-[11px] text-gray-400 px-1 pt-1'>Note: For restricted domains, you can set AllowedOrigins: ["https://yourdomain.com"].</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
