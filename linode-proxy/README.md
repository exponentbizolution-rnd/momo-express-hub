# MTN Transfer Proxy (Linode)

Tiny Express service that forwards MTN MoMo `POST /disbursement/v1_0/transfer` calls
from the Lovable Cloud edge function, so MTN sees the **whitelisted Linode IP**
(`172.239.107.35`) instead of dynamic edge-function IPs.

## Endpoints
- `GET /health` — public, returns `{ ok: true }`
- `POST /mtn/transfer` — auth via `x-proxy-secret`, forwards to MTN

## Deploy on your Linode (alongside the existing frontend container)

SSH to the box, then:

```bash
mkdir -p /opt/mtn-proxy && cd /opt/mtn-proxy
# Copy server.js, package.json, Dockerfile from this repo's linode-proxy/ folder
# (e.g. scp them up, or git pull this repo)

docker build -t mtn-transfer-proxy:latest .

docker stop mtn-transfer-proxy 2>/dev/null || true
docker rm   mtn-transfer-proxy 2>/dev/null || true

docker run -d \
  --name mtn-transfer-proxy \
  --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  -e LINODE_PROXY_SECRET='PASTE_THE_SAME_SECRET_YOU_SAVED_IN_LOVABLE' \
  mtn-transfer-proxy:latest

# Verify
curl http://127.0.0.1:8787/health
```

## Expose via nginx (HTTPS recommended — MTN credentials pass through)

Add this `location` block to your existing nginx server block (the one already
serving the frontend on port 80/443):

```nginx
location /mtn-proxy/ {
    proxy_pass         http://127.0.0.1:8787/;
    proxy_http_version 1.1;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_read_timeout 60s;
}
```

Reload nginx: `nginx -t && systemctl reload nginx`

Then in Lovable, set `LINODE_PROXY_URL` to:
- `https://your-domain.com/mtn-proxy` (preferred — get a Let's Encrypt cert)
- or `http://172.239.107.35/mtn-proxy` (works but credentials travel in cleartext)

The edge function will POST to `${LINODE_PROXY_URL}/mtn/transfer`.

## Security notes
- Only `/mtn/transfer` requires the shared secret; `/health` is public.
- The proxy never stores credentials — it just forwards headers + body.
- Bind Docker to `127.0.0.1` so the proxy is only reachable through nginx.
