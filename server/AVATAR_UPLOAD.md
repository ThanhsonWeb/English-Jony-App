# Profile avatar storage

Set these variables on the **server** to enable profile photo uploads:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

The authenticated `/api/v1/users/avatar` endpoint accepts a compressed JPG, PNG, or WebP image up to 2 MB. It signs the Cloudinary upload on the server, checks the response, and stores only its HTTPS URL in `User.avatar`. `User.photo` remains the Google photo fallback. Do not put the API secret in the client environment.
