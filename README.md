# KYC – Know Your Champions

A website that tells the story of every Indian medallist at the Aichi-Nagoya 2026 Asian Games, one journey at a time.

- **Website:** Astro, running on Cloudflare Workers
- **Database, logins, photos:** Supabase
- **Bot protection:** Cloudflare Turnstile

---

## Part 1: Run it on your computer

You need Node.js (version 22.12 or newer) and Git, which you've already installed.

### 1. Put the project in place

Unzip this folder to `C:\Projects\kyc`. It replaces the earlier practice files. Open the folder in VS Code, open a terminal (**Terminal → New Terminal**) and run:

```
npm install
```

This downloads the libraries the site needs into `node_modules`. It takes a minute or two.

### 2. Create the Supabase project

1. Go to supabase.com, sign in, and click **New project**.
2. Name it `kyc`, choose a strong database password (save it somewhere safe), and pick the region **Mumbai (ap-south-1)** so it's close to your visitors.
3. Wait until the project is ready.

### 3. Create the database tables

1. In Supabase, open **SQL Editor** in the left menu, then **New query**.
2. Open `supabase/schema.sql` from this project in VS Code, copy all of it, paste it into the editor and click **Run**. It should say *Success*.
3. Make another new query with all of `supabase/seed.sql`, and run it. The last result should show **gold 16, silver 25, bronze 35**.

### 4. Switch off public sign-ups

Only you should be able to create writer accounts.

In Supabase, go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Keep the **Email** provider itself switched on, because writers log in with email and password.

### 5. Create your own admin account

1. Go to **Authentication → Users → Add user → Create new user**. Enter your email and a password, and tick **Auto Confirm User**.
2. Go back to **SQL Editor** and run this, with your own name and email:

```sql
insert into public.profiles (id, display_name, email, role, must_change_password)
select id, 'Your Name', email, 'admin', false
from auth.users
where email = 'you@example.com';
```

`Your Name` appears as the byline on the stories you write.

### 6. Connect the site to Supabase

1. In VS Code, copy `.dev.vars.example` and name the copy `.dev.vars`.
2. In Supabase, go to **Project Settings → API Keys**. Copy the **publishable** key into `SUPABASE_PUBLISHABLE_KEY` and the **secret** key into `SUPABASE_SECRET_KEY`. (Older projects call these the *anon* and *service_role* keys; those work too.)
3. Your project URL is under **Project Settings → Data API**. Put it in `SUPABASE_URL`.
4. Leave the two Turnstile test keys as they are for now.

**The secret key can do anything in your database.** Never share it, post it, or put it in a file that goes to GitHub. `.dev.vars` is already excluded from Git.

### 7. Start the site

```
npm run dev
```

Open the address it shows (usually http://localhost:4321). To write your first story, add `/admin` to the address and log in with the account from step 5.

To stop the site, click in the terminal and press **Ctrl + C**.

---

## Part 2: Put it on the internet

### 1. Turnstile (the invisible bot check)

1. Create a free Cloudflare account at dash.cloudflare.com.
2. Open **Turnstile → Add widget**. Name it `KYC`, add your website's domain, and choose the **Managed** mode.
3. Keep the **Site key** and **Secret key** for the next step. Use these real keys only on the live site; keep the test keys in `.dev.vars`.

### 2. Deploy from your computer

In the VS Code terminal:

```
npx wrangler login
```

A browser window opens. Log in to Cloudflare and allow access. Then publish the site once:

```
npm run deploy
```

At the end it prints your web address, ending in `.workers.dev`. Now save the five settings on Cloudflare, one at a time. Each command asks you to paste the value:

```
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put TURNSTILE_SITE_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Open your `.workers.dev` address. Your site is live. Add that address to your Turnstile widget's list of domains too.

Every time you change the code, run `npm run deploy` again. Stories, champions and photos don't need a deploy: they're in the database, so they appear the moment a writer saves them.

### 3. Your own domain (optional)

If you buy a domain like `knowyourchampions.in`, connect it in the Cloudflare dashboard under your `kyc` Worker's **Settings → Domains & Routes**. Then add the domain to your Turnstile widget as well.

### 4. Check the free plan's limits

Cloudflare Workers has a free plan with a daily request limit. Photos and design files are served separately and don't count against it, but every page visit does. Look up the current limit in your Cloudflare dashboard. If a story goes viral and you get close to it, the paid Workers plan raises it a lot for a small monthly fee.

---

## Daily use: the writer panel

Open `/admin` on your site.

- **Stories:** write a story, pick the champion or team, choose the day it becomes Story of the Day, and build the journey stop by stop. Mark the hard chapter as a **Setback** (it appears as a dashed stretch of road) and end with **The podium**. Use **Preview** to see a draft exactly as visitors will. A story set to *Published* with a future date stays hidden until that day, and only one published story can have each date.
- **Champions:** add the remaining medals as the Games finish, add team players (hockey, cricket, both kabaddi teams and the badminton team have no players yet), and add photos and hometowns.
- **Cheers:** messages caught by the abuse filter, or reported by three visitors, wait under *Needs review*. Approve, hide or delete them.
- **Feedback:** corrections and tips from visitors. Only writers see them.
- **Settings:** the "As of" date and note under the medal tally.
- **Writers** (only you): create an account for a new writer. The page shows a temporary password once. Send it to them yourself; they must choose their own password when they first log in. You can switch an account off at any time; their stories stay published.

**Photos:** use only photos you have permission to use, and always fill in the credit. Photos are shrunk automatically before upload.

---

## Before launch: check the names

The medal list was compiled from news coverage, and news sources spell some names differently. Check every name in **Champions** against an official source, especially:

- Rudrankksh Patil (also spelled Rudranksh)
- Joshna Chinappa (also spelled Joshana)
- Haritha Bhadra (also spelled Harita)
- Prachi Choudhary and Parul Chaudhary
- Sawan Berwal (also spelled Barwal)
- Nitesh Kumar (also reported as Nitesh Siwach)
- Manu TS: the mixed 4x400m relay was reported with just "Manu"; confirm it is the same athlete
- Eight medals have no date yet: women's trap, women's trap team, women's 4x400m relay, men's +90 kg boxing, men's 5000m, mixed 4x100m relay, women's high jump and men's 4x400m relay

---

## Project map

```
supabase/
  schema.sql          Database tables, security rules, photo storage. Run once.
  seed.sql            The 76 medals, 96 athletes and 33 teams. Run once.

src/
  pages/              Each file is a page. [slug] means "one page per champion/story".
    index.astro           Home page
    stories/              All stories, and one story page
    champions/            The directory, and one page per champion
    teams/                One page per team
    medals.astro          Every medal
    feedback.astro        Private corrections and tips form
    api/                  Reactions, cheers and reports sent from the browser
    admin/                The writer panel
  components/         Reusable pieces: journey road, story card, cheer wall...
  layouts/            The page frame: header, footer, fonts, dark mode
  lib/                Server code: database queries, abuse filter, uploads
  styles/global.css   Colours (light and dark) and shared styles
  middleware.ts       Guards the writer panel: only logged-in writers get in

public/               Files served as they are (the favicon)
astro.config.mjs      Site settings and the list of secret values it needs
wrangler.jsonc        Cloudflare Workers settings
.dev.vars             Your private keys for local development (not in Git)
```

### Adjusting the abuse filter

The word lists are in `src/lib/moderation.ts`. Add words to `ALWAYS_BLOCK` (caught anywhere, even with spaces) or `WHOLE_WORDS` (caught only as complete words). Flagged messages are never deleted automatically; they wait for review.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the site on your computer |
| `npm run check` | Checks the code for mistakes |
| `npm run deploy` | Publishes the site to Cloudflare |
