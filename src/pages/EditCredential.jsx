
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useCredentials from '../hooks/useCredentials';
import { toast } from 'react-toastify';

export default function EditCredential() {
	const { credentials, credentialsList, selectedCredentialIndex, setCredentialsList, setSelectedCredentialIndex } = useCredentials();
	const navigate = useNavigate();
	const [formData, setFormData] = useState({
		name: '',
		access_key: '',
		secret_key: '',
		region: '',
		endpoint: ''
	});

	useEffect(() => {
		if (credentials) {
			setFormData({
				name: credentials.name || '',
				access_key: credentials.access_key || '',
				secret_key: credentials.secret_key || '',
				region: credentials.region || '',
				endpoint: credentials.endpoint || ''
			});
		}
	}, [credentials]);

	function handleChange(e) {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	}

	function handleSubmit(e) {
		e.preventDefault();
		if (!formData.name || !formData.access_key || !formData.secret_key || !formData.region || !formData.endpoint) {
			toast.error('All fields are required');
			return;
		}
		// Preserve existing credentials and replace only the selected one
		try {
			let stored = localStorage.getItem('credentials');
			let newList = [];
			if (Array.isArray(credentialsList) && credentialsList.length) {
				// Use list from context as the source of truth
				newList = [...credentialsList];
				newList[selectedCredentialIndex] = { ...formData };
			} else if (stored) {
				// Fallback to localStorage parsing
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) {
					newList = [...parsed];
					newList[selectedCredentialIndex] = { ...formData };
				} else if (parsed && typeof parsed === 'object') {
					newList = [{ ...formData }];
				}
			} else {
				newList = [{ ...formData }];
			}

			localStorage.setItem('credentials', JSON.stringify(newList));
			if (setCredentialsList) setCredentialsList(newList);
			toast.success('Credentials updated!');
			setTimeout(() => navigate('/'), 800);
		} catch (err) {
			console.error('Failed to update credentials', err);
			toast.error('Failed to update credentials');
		}
	}

	function handleDelete() {
		if (!confirm('Delete this credential? This cannot be undone.')) return;

		// if credentialsList has multiple entries, remove selected index
		if (Array.isArray(credentialsList) && credentialsList.length > 1) {
			const newList = credentialsList.filter((_, i) => i !== selectedCredentialIndex);
			localStorage.setItem('credentials', JSON.stringify(newList));
			if (setCredentialsList) setCredentialsList(newList);
			// reset selected index if needed
			if (selectedCredentialIndex >= newList.length) setSelectedCredentialIndex(0);
			toast.success('Credential removed');
			setTimeout(() => navigate('/'), 500);
			return;
		}

		// otherwise remove the single stored credential
		localStorage.removeItem('credentials');
		if (setCredentialsList) setCredentialsList([]);
		setSelectedCredentialIndex(0);
		toast.success('Credential removed');
		navigate('/config');
	}

	return (
		<div className="w-full min-h-dvh flex items-center justify-center bg-[#101010] text-gray-300">
			<form onSubmit={handleSubmit} className="card p-8 shadow-lg w-full max-w-md flex flex-col gap-4">
				<h2 className="text-2xl font-bold mb-2 text-center">Edit Credentials</h2>
				<input className="input" name="access_key" placeholder="Access Key" value={formData.access_key} onChange={handleChange} />
				<input className="input" name="secret_key" placeholder="Secret Key" value={formData.secret_key} onChange={handleChange} type="password" />
				<input className="input" name="region" placeholder="Region" value={formData.region} onChange={handleChange} />
                <input className="input" name="name" placeholder="Bucket Name" value={formData.name} onChange={handleChange} />
				<input className="input" name="endpoint" placeholder="Endpoint" value={formData.endpoint} onChange={handleChange} />
				<button type="submit" className="btn btn-primary mt-2">Save</button>
					<div className="flex items-center gap-2">
						<button type="button" className="text-xs text-gray-400 hover:underline mt-2" onClick={() => navigate('/')}>Cancel</button>
						<button type="button" onClick={handleDelete} className="ml-auto btn btn-danger mt-2">Delete</button>
					</div>
			</form>
		</div>
	);
}
