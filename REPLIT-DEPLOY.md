Replit deployment instructions
=============================

This file explains how to run the `backend` on Replit after importing the repository.

Quick summary
-------------
- A `.replit` file is already added to run `cd backend && npm install && npm start`.
- You still need to set Secrets/Environment variables in Replit UI.

Required environment variables (Replit Secrets)
----------------------------------------------
- `PORT` = `5000`
- `SUPABASE_URL` = your Supabase project URL (e.g. https://xxx.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key
- `JWT_SECRET` = a long random string used to sign JWT tokens
- `ML_SERVICE_URL` = URL of your ML service (or `http://127.0.0.1:8000` for local testing)

How to run
----------
1. Import repository on Replit (Import from GitHub). Choose this repository and import.
2. Ensure `.replit` exists in repo root (it is already committed) so Replit will run the backend.
3. In Replit settings → Secrets, add the environment variables listed above.
4. Click Run. Replit will install dependencies and start the server.
5. Public URL will appear in the top-right (or in the Repl console). Use that URL as `VITE_API_URL` in your Vercel project.

Testing endpoints
-----------------
From your local machine or an online REST client, test:

Root:
```
curl https://your-repl.username.repl.co/
```

Login (replace values):
```
curl -X POST https://your-repl.username.repl.co/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

Notes
-----
- Replit free plans may sleep; use for testing/demos only.
- For persistent production, consider Render or Railway.
