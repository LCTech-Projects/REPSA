# Vercel Deployment Guide

This guide explains how to deploy your REPSA project to Vercel.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup)
2. Git repository (GitHub, GitLab, or Bitbucket)
3. Node.js and Python installed locally (for testing)

## Important Considerations

**Note:** Vercel's serverless functions have limitations for Flask applications:
- 10-second timeout for Hobby plan (60 seconds for Pro)
- 50MB function size limit
- Cold starts can be slow for large applications

For production with heavy ML models, consider:
- **Option 1:** Deploy frontend to Vercel, backend to Railway/Render/Heroku
- **Option 2:** Use Vercel Pro plan for longer timeouts
- **Option 3:** Split ML model inference to separate service

## Quick Start (Recommended Approach)

**For production, we recommend deploying the frontend and backend separately:**

1. **Frontend (Vercel):** Deploy React app to Vercel
2. **Backend (Railway/Render):** Deploy Flask API separately (better for ML models)

This avoids Vercel's serverless function limitations (timeouts, size limits).

---

## Deployment Steps

### Step 1: Prepare Your Repository

1. Ensure your code is pushed to a Git repository (GitHub, GitLab, or Bitbucket)

2. Update API base URL for production:
   - The frontend currently uses `http://127.0.0.1:5000` for local development
   - You'll need to update this to use environment variables

### Step 2: Update Frontend API Configuration

Update `src/appSlices/apiSlice.ts` to use environment variables:

```typescript
baseQuery: fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000",
  // ... rest of config
}),
```

### Step 3: Set Up Environment Variables

Create a `.env` file in the root directory (for local development):

```env
VITE_API_URL=http://127.0.0.1:5000
```

In Vercel dashboard, add environment variables:
- `VITE_API_URL`: Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
- Any Flask environment variables from `api/.env`

### Step 4: Deploy to Vercel

#### Option A: Using Vercel CLI (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? (Select your account)
   - Link to existing project? **No**
   - Project name? (Enter a name or press Enter)
   - Directory? **./** (root directory)
   - Override settings? **No**

5. For production deployment:
```bash
vercel --prod
```

#### Option B: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `./` (root)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. Add environment variables in the project settings

6. Click "Deploy"

### Step 5: Configure Build Settings

In `package.json`, ensure build script exists:
```json
{
  "scripts": {
    "build": "tsc -b && vite build"
  }
}
```

### Step 6: Update API Routes

The Flask backend will be available at:
- Development: `http://localhost:5000/api/*`
- Production: `https://your-app.vercel.app/api/*`

## Alternative: Separate Backend Deployment

If you encounter issues with Flask on Vercel, deploy the backend separately:

### Backend Options:

1. **Railway** (Recommended for Python apps):
   - Connect your repo
   - Set root directory to `api/`
   - Add environment variables
   - Deploy

2. **Render**:
   - Create a new Web Service
   - Set root directory to `api/`
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn run:app`

3. **Heroku**:
   - Create `Procfile` in `api/`:
     ```
     web: gunicorn run:app
     ```
   - Deploy using Heroku CLI

### Update Frontend API URL

After deploying backend separately, update `VITE_API_URL` in Vercel:
```
VITE_API_URL=https://your-backend.railway.app
```

## Troubleshooting

### Issue: API routes return 404
- Check that `vercel.json` routes are correctly configured
- Ensure Flask blueprints are registered with `/api` prefix

### Issue: Timeout errors
- Vercel Hobby plan has 10-second timeout
- Consider upgrading to Pro or moving ML inference to separate service
- Optimize model loading (cache models, use smaller models)

### Issue: Function size too large
- ML models might exceed 50MB limit
- Consider:
  - Using model hosting services (Hugging Face, etc.)
  - Loading models from external storage
  - Splitting into multiple functions

### Issue: CORS errors
- Ensure CORS is enabled in Flask app
- Check that `VITE_API_URL` is correctly set
- Verify backend URL in Vercel environment variables

## Post-Deployment

1. Test all API endpoints
2. Verify environment variables are set
3. Check function logs in Vercel dashboard
4. Monitor function execution time and errors

## Production Checklist

- [ ] Environment variables configured
- [ ] API base URL updated
- [ ] CORS configured correctly
- [ ] Build succeeds without errors
- [ ] All routes accessible
- [ ] ML models load within timeout limits
- [ ] Error handling in place
- [ ] Monitoring/logging set up

## Support

For issues specific to:
- **Vercel:** Check [Vercel documentation](https://vercel.com/docs)
- **Flask on Vercel:** See [Vercel Python guide](https://vercel.com/docs/functions/serverless-functions/runtimes/python)
- **Vite:** See [Vite deployment guide](https://vitejs.dev/guide/static-deploy.html)
