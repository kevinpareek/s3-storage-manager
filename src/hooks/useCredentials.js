import { useContext } from "react";
import { credentialsContext } from "../context/CredentialsProvider";

export default function useCredentials() {
    return useContext(credentialsContext);
}
