# Environment Variables Reference

This document lists all environment variables used by XFlex Trading Academy.

---

## Required Variables

These variables are **automatically configured** by the Manus platform and Railway:

| Variable | Description | Auto-Configured |
|----------|-------------|-----------------|
| `DATABASE_URL` | MySQL connection string | ✅ Railway |
| `JWT_SECRET` | Secret for JWT tokens | ✅ Manus |
| `OAUTH_SERVER_URL` | Manus OAuth server | ✅ Manus |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuth portal | ✅ Manus |
| `VITE_APP_ID` | Manus application ID | ✅ Manus |
| `OWNER_OPEN_ID` | Owner's OpenID | ✅ Manus |
| `OWNER_NAME` | Owner's name | ✅ Manus |
| `VITE_APP_TITLE` | App title | ✅ Manus |
| `VITE_APP_LOGO` | App logo path | ✅ Manus |
| `BUILT_IN_FORGE_API_URL` | Forge API URL (server) | ✅ Manus |
| `BUILT_IN_FORGE_API_KEY` | Forge API key (server) | ✅ Manus |
| `VITE_FRONTEND_FORGE_API_URL` | Forge API URL (frontend) | ✅ Manus |
| `VITE_FRONTEND_FORGE_API_KEY` | Forge API key (frontend) | ✅ Manus |

---

## Optional Variables

These variables can be configured for additional features:

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG_LOGGING` | `false` | Set to `true` to enable detailed logging for debugging |

**When to enable**:
- During initial deployment
- When troubleshooting issues
- When testing new features

**When to disable**:
- In production (reduces log volume by ~90%)
- After issues are resolved

### Analytics

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ANALYTICS_ENDPOINT` | No | Analytics service endpoint |
| `VITE_ANALYTICS_WEBSITE_ID` | No | Website ID for analytics |

---

## Railway-Specific Configuration

When deploying to Railway, you only need to configure:

### 1. Database (Automatic)

Railway automatically sets `DATABASE_URL` when you add a MySQL service.

### 2. Debug Logging (Manual)

Add this variable in Railway dashboard:

```
DEBUG_LOGGING=true
```

**Remember to set it to `false` after testing!**

### 3. Node Environment (Manual)

```
NODE_ENV=production
```

---

## Updating Environment Variables

### On Railway

1. Go to your Railway project
2. Click on your web service
3. Navigate to **Variables** tab
4. Click **+ New Variable**
5. Add the variable name and value
6. Railway will automatically redeploy with the new variables

### On Manus Platform

1. Go to your project settings
2. Navigate to **Settings** → **Secrets**
3. Update the variable value
4. Changes take effect immediately (no redeploy needed)

---

## Security Best Practices

1. **Never commit** `.env` files to version control
2. **Use strong secrets** for `JWT_SECRET` (min 32 characters)
3. **Don't expose** server-side API keys in `VITE_` variables
4. **Rotate secrets** regularly (every 90 days recommended)
5. **Use different secrets** for development and production

---

## Troubleshooting

### Variable Not Taking Effect

**Solution**:
1. Verify the variable is set correctly (check for typos)
2. Restart the application
3. Clear browser cache (for `VITE_` variables)
4. Check Railway logs for any errors

### Database Connection Fails

**Solution**:
1. Verify `DATABASE_URL` is set
2. Check that MySQL service is running on Railway
3. Ensure the format is correct: `mysql://user:pass@host:port/db`

### Authentication Issues

**Solution**:
1. Verify all OAuth variables are set
2. Check that `JWT_SECRET` is configured
3. Ensure `OWNER_OPEN_ID` matches your account

---

## Adding New Variables

If you need to add new environment variables:

1. **For server-side use**: Add directly to Railway
2. **For frontend use**: Prefix with `VITE_` and add to Railway
3. **Update this document** with the new variable
4. **Document in code** where the variable is used

---

**Last Updated:** November 9, 2025
