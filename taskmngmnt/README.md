# Task Hub

A lightweight task management portal that reads from and writes to a Notion database. The boss enters tasks via the web UI; her team updates them in Notion; the UI polls for changes every 12 seconds.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Vanilla HTML / CSS / JS |
| Serverless API | Netlify Functions (Node 18) |
| Database | Notion (existing Inbox Database) |
| Hosting | Netlify |
| Domain | GoDaddy subdomain → Netlify |

---

## One-Time Setup

### 1 — Create a Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click **New integration**
3. Give it a name (e.g. "Task Hub"), select your workspace
4. Under **Capabilities**, enable: Read content, Update content, Insert content, Read user information
5. Click **Submit** — copy the **Internal Integration Secret** (starts with `secret_…`)

### 2 — Share the Database with the Integration

1. Open your **Inbox Database** in Notion
2. Click **⋯** (top-right) → **Connections** → find your integration → click **Connect**

Your Notion database ID is:
```
348f36d28034804e993fedf4062babd7
```

### 3 — Create the GitHub Repo

1. Go to https://github.com/new
2. Create a **private** repo named `taskmngmnt`
3. Push this folder up:
```bash
cd task-hub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/taskmngmnt.git
git push -u origin main
```

### 4 — Deploy to Netlify

1. Go to https://app.netlify.com → **Add new site** → **Import an existing project**
2. Connect GitHub → select your `taskmngmnt` repo
3. Build settings are auto-detected from `netlify.toml`:
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
4. Click **Deploy site**

### 5 — Add Environment Variables in Netlify

In Netlify: **Site configuration → Environment variables → Add variable**

| Key | Value |
|---|---|
| `NOTION_API_KEY` | `secret_…` (your integration token) |
| `NOTION_DATABASE_ID` | `348f36d28034804e993fedf4062babd7` |

Then **trigger a new deploy** so the variables take effect.

### 6 — Connect your GoDaddy Subdomain

1. In Netlify: **Domain management → Add custom domain**
2. Enter your subdomain (e.g. `tasks.yourdomain.com`) → **Verify** → **Add domain**
3. Netlify will show you a **CNAME value** (looks like `your-site-name.netlify.app`)
4. In GoDaddy: **DNS → Add record**
   - Type: `CNAME`
   - Name: `tasks` (or whatever your subdomain prefix is)
   - Value: the Netlify CNAME value
   - TTL: 600
5. Wait up to 10 minutes for DNS to propagate

Netlify handles SSL (HTTPS) automatically.

---

## Adding More Entities

The **Entity** field is a Notion Select. To add a new business/entity:

1. Open any task in Notion → click the Entity field → type a new name → select **Create option**

It will appear automatically in the webapp dropdown on next load.

---

## Project Structure

```
task-hub/
├── netlify/
│   └── functions/
│       ├── get-tasks.js       # GET all tasks from Notion
│       ├── create-task.js     # POST a new task to Notion
│       ├── get-users.js       # GET workspace members (for Assign To)
│       └── get-entities.js    # GET Entity select options from DB schema
├── public/
│   ├── index.html             # Main UI
│   ├── style.css              # Styles
│   └── app.js                 # Frontend logic + polling
├── netlify.toml               # Build + function config
├── package.json               # @notionhq/client dependency
└── .gitignore
```

---

## How It Works

- **Creating a task:** The form POSTs to `/netlify/functions/create-task`, which writes directly to Notion via the API.
- **Live updates:** `app.js` polls `/netlify/functions/get-tasks` every 12 seconds. Any status/notes changes made in Notion show up automatically.
- **Filtering:** Person and Entity filters run client-side on the fetched task list — no extra API calls.
- **Security:** The Notion API key never touches the browser. All Notion calls happen inside the serverless functions.
