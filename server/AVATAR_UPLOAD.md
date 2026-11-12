# Profile avatar storage

Set these variables on the **server** for production profile photo uploads:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

When no Cloudinary settings are present in development, uploads use an ignored local image directory and return a same-origin image URL. Production never falls back to local disk.

Production startup validates all three Cloudinary variables. Missing or partial configuration stops startup instead of allowing local avatar URLs to be created. Values should be configured in the production server environment, not copied into the client or committed to Git.

The authenticated `/api/v1/users/avatar` endpoint accepts a compressed JPG, PNG, or WebP image up to 2 MB. Each upload uses a unique tracked storage key; Cloudinary requests are signed and responses checked. The URL is stored in `User.avatar` with an internal intent reference. Replaced managed avatars are queued for the separately operated cleanup worker; see `services/AVATAR_UPLOAD_INTENTS.md`. Existing legacy avatars are not deleted. `User.photo` remains the Google photo fallback. Do not put the API secret in the client environment.

The client accepts relative `/api/v1/users/avatar-files/...` URLs only during development. Production displays only HTTPS avatar/photo URLs, so legacy local records fall back to the Google photo instead of requesting a broken local file.
