# Quizz — Setup Guide (phone-only, no PC needed)

Everything here is free. You only need two accounts: **GitHub** and **Netlify**.
No database to set up — the site stores its data using Netlify's built-in storage automatically.

## 1. Put the code on GitHub
1. Go to github.com on your phone browser (or the GitHub app) and sign up (free).
2. Tap **+ → New repository**. Name it `quizz-platform`. Keep it Public or Private, either is fine. Create it.
3. Open the repo, tap **Add file → Upload files**, and upload every file/folder from this project
   (keep the folder structure exactly as given: `netlify/functions/...`, `public/...`, `netlify.toml`, `package.json`).
4. Commit the upload.

## 2. Deploy on Netlify
1. Go to netlify.com and sign up using **"Sign up with GitHub"** (free, one tap, no password to remember).
2. Tap **Add new site → Import an existing project → GitHub**, then pick `quizz-platform`.
3. Leave the build settings as-is (this project has no build step) and click **Deploy**.
4. Wait a minute — Netlify gives you a link like `https://random-name-123.netlify.app`. That's your site.
   You can rename it under **Site settings → Change site name**.

## 3. Set your secret Admin login (2 minutes)
Go to **Site settings → Environment variables → Add a variable**, and add three:

| Key | Value |
|---|---|
| `ADMIN_ID` | any ID you'll remember, e.g. `shubham_admin` |
| `ADMIN_PASSWORD` | any password — only you should know this |
| `JWT_SECRET` | any long random text, e.g. `xk29Pq7mLwZt93RbHj` |

Then go to **Deploys → Trigger deploy → Deploy site** once, so the new variables take effect.

## 4. You're live
- **Students** use: `https://your-site.netlify.app`
- **Admin (you)** use: `https://your-site.netlify.app/admin.html` — log in with the `ADMIN_ID` / `ADMIN_PASSWORD` you set above.
  This page isn't linked from the student site, so students won't stumble onto it.

## How it works
- **Sign up:** students register once with name + 10-digit phone + password. Same login works forever.
- **Sets:** as admin, go to **+ New Set**, name it (e.g. "Set 1"), add as many questions as you like (each with 4 options and the correct one marked), then **Save set**. Add Set 2, Set 3, etc. any day you want, with any number of questions.
- **Scoring:** every correct answer = +1 mark, every wrong answer = −0.25 mark, unattempted = 0. Calculated automatically the moment a student submits.
- **One attempt per set:** a student can take each set only once, so scores can't be inflated by retries.
- **Ranking:** updates automatically every day at **9:00 PM IST**. Students see the top 10 (by name) and their own current rank — never anyone else's phone number or details. As admin, you can also tap **"Recompute ranking now"** any time to refresh it immediately.
- **Privacy:** students only ever see their own phone number and score history. You (admin) are the only one who can see everyone's name + phone number + full scores, under the **Students** tab.

## If something needs changing later
Since you don't have a PC: edit any file directly on github.com (open the file → pencil/edit icon → save). Netlify automatically redeploys the site within a minute of any change to GitHub.
