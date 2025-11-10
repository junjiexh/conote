# Development Setup Guide

## Efficient Development with Hot Reload

This project now supports efficient development with hot module replacement (HMR), eliminating the need to rebuild Docker images for every code change.

### Quick Start

**For Development (with hot reload):**
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**For Production:**
```bash
docker-compose up
```

### What's Different in Development Mode?

#### Before (Production mode):
- ❌ Required full image rebuild for every code change
- ❌ Slow iteration cycle (build → restart → test)
- ✅ Optimized production bundle with nginx

#### After (Development mode):
- ✅ **Instant hot reload** - changes reflect immediately in browser
- ✅ **Fast iteration** - edit code → see changes in seconds
- ✅ **Source maps** - easier debugging
- ✅ **Volume mounting** - no rebuilds needed

### How It Works

1. **Volume Mounting**: Your source code is mounted into the container, so changes are immediately visible
2. **Vite Dev Server**: Runs the Vite development server instead of building and serving with nginx
3. **Hot Module Replacement**: Vite automatically detects changes and updates the browser

### Development Workflow

1. Start the development environment:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
   ```

2. Edit files in `frontend/src/` - changes will automatically reload in your browser

3. Access the app at `http://localhost:3000`

### Troubleshooting

**If hot reload isn't working:**
- Restart the containers: `docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart frontend`
- Check container logs: `docker-compose logs -f frontend`

**If you need to install new npm packages:**
```bash
# Stop containers
docker-compose down

# Rebuild the dev image
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build frontend

# Start again
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Files Modified

- `vite.config.js` - Added Docker-compatible settings (host, polling)
- `frontend/Dockerfile.dev` - Development Dockerfile without build step
- `docker-compose.dev.yml` - Development overrides with volume mounts

### Production Deployment

For production, continue using the original command:
```bash
docker-compose up --build
```

This uses the production Dockerfile with optimized builds and nginx.
