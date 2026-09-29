# SpecBar

**Live demo: https://specbar.onrender.com**

Type a rough product idea and get a complete, leadership-ready product spec in about 30 seconds.
Download it as a Word doc.

Each spec includes:

- Problem statement and market context
- User personas
- Competitive landscape table
- Prioritized requirements matrix
- Metrics and OKRs
- Risks and mitigations
- Go-to-market plan
- Technical deep dive
- Effort and ROI estimate
- Launch comms: a LinkedIn post, a blog post and an internal team announcement

## Stack

- **Frontend:** a single HTML page with a retro terminal look (Tailwind, no framework)
- **Backend:** Node + Express. `POST /api/generate-spec` calls the model; `POST /api/download-spec` builds the .docx
- **AI:** Azure OpenAI (`gpt-4.1-mini`), configured by environment variables
- **Hosting:** Render (see `render.yaml`)

## Run locally

```bash
cp .env.example .env   # add your Azure OpenAI endpoint + key
npm install
npm start              # http://localhost:3000
```

Built with AI.
