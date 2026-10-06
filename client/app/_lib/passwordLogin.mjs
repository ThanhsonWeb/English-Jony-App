import { submitCredential } from "./credentialSubmission.mjs";

export function loginWithPassword(credentials, t, attempt) {
	return submitCredential("login", credentials, t, attempt);
}
