---
"upload-app": major
---

Rewrite for Tour de Cloud API v2 as a Node 24 TypeScript action.

- Uploads go through the v2 preflight → build & push → complete flow; the payment check and local schema validation are gone (the API reports problems).
- Inputs: `api_domain` and `registry_domain` removed; added `api_url`, `config_path` and `debug`. The registry is taken from the preflight response.
- New outputs: `upload_id`, `images`, `deployable`.
- The action no longer checks out the repository — add `actions/checkout` before it.
- Images are built with Docker Buildx and cached in the GitHub Actions cache per build name.
- `build[].dockerfile` and `build[].context` are optional.
- A `{{VAR}}` placeholder without a matching environment variable now fails the upload.
