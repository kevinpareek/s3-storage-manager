import { S3Client } from "@aws-sdk/client-s3";
import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export const credentialsContext = createContext({
    s3: null,
    credentials: null,
    credentialsList: [],
    selectedCredentialIndex: 0,
    setSelectedCredentialIndex: () => {},
    setCredentialsList: () => {},
});

export default function CredentialsProvider({ children }) {
    const [s3, setS3] = useState(null);
    const [credentialsList, setCredentialsList] = useState([]);
    const [selectedCredentialIndex, setSelectedCredentialIndex] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        const stored = localStorage.getItem("credentials");
        if (!stored) {
            console.error("No credentials found in localStorage");
            navigate('/config');
            return;
        }

        try {
            let parsed = JSON.parse(stored);
            let credsArray = [];
            if (Array.isArray(parsed)) {
                credsArray = parsed;
            } else if (parsed && typeof parsed === 'object') {
                credsArray = [parsed];
            }
            // Validate all credentials
            const valid = credsArray.every(c => c.region && c.access_key && c.secret_key && c.name && c.endpoint);
            if (!valid || credsArray.length === 0) {
                console.error("Incomplete credentials found in localStorage");
                navigate('/config');
                return;
            }
            setCredentialsList(credsArray);
        } catch (err) {
            console.error("Invalid credentials in localStorage", err);
            navigate('/config');
        }
    }, [navigate]);

    // Update S3 client when credentialsList or selectedCredentialIndex changes
    useEffect(() => {
        if (!credentialsList.length) return;
        const cred = credentialsList[selectedCredentialIndex] || credentialsList[0];
        if (!cred) return;
        const { region, access_key, secret_key, endpoint } = cred;
        const client = new S3Client({
            region,
            endpoint,
            forcePathStyle: true,
            credentials: {
                accessKeyId: access_key,
                secretAccessKey: secret_key
            }
        });
        setS3(client);
    }, [credentialsList, selectedCredentialIndex]);

    const credentials = credentialsList[selectedCredentialIndex] || null;
    const values = {
        s3,
        credentials,
        credentialsList,
        selectedCredentialIndex,
        setSelectedCredentialIndex,
        setCredentialsList,
    };

    return (
        <credentialsContext.Provider value={values}>
            {children}
        </credentialsContext.Provider>
    );
}
