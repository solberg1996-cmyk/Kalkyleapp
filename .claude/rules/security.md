---
paths:
  - "auth.js"
  - "app.js"
  - "settings.js"
---

# Security

- Never expose Supabase service role keys in client-side code — only use the anon/public key.
- Sanitize output to prevent XSS. Use `textContent` over `innerHTML` when displaying user data.
- Never log secrets, tokens, passwords, or PII to the console.
- Validate user input before sending to Supabase.
- Use Supabase Row Level Security (RLS) — don't rely on client-side checks alone.
