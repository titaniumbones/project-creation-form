# ADR-001: Migration from Personal Access Token to OAuth for Asana Integration

**Status:** Approved
**Date:** 2025-12-18
**Deciders:** Matt Price
**Technical Story:** Replace PAT-based Asana authentication with OAuth 2.0 to improve security and user experience

---

## Context and Problem Statement

The Airtable extension currently uses a Personal Access Token (PAT) for Asana API authentication. This approach has security and UX concerns:
- PATs have full account access (implicit permissions)
- PATs never expire unless manually revoked
- Users must understand how to create and manage PATs

---

## Decision

**Chosen Option: Netlify Functions**

Rationale:
- Existing Netlify account available
- CLI-first workflow aligns with developer preferences
- Generous free tier (125k function invocations/month)
- `netlify dev` for local development

---

## Functionality Comparison: PAT vs OAuth

| Feature | PAT | OAuth |
|---------|-----|-------|
| Project creation from template | ✅ | ✅ |
| Add members to project | ✅ | ✅ (requires `default` scope) |
| Assign users to template roles | ✅ | ✅ |
| Read user info | ✅ | ✅ |
| Write to any workspace | ✅ | ⚠️ Depends on scopes requested |
| Token expiration | Never | 1 hour (refresh token available) |
| Multi-user support | Poor | ✅ Native |

**Potential Functionality Loss:** None expected with `default` scope.

---

## Implementation

### Project Structure
```
asana-oauth-relay/
├── netlify/
│   └── functions/
│       ├── asana-auth.js       # Initiates OAuth flow
│       ├── asana-callback.js   # Handles OAuth callback
│       └── asana-refresh.js    # Token refresh endpoint
├── netlify.toml
├── package.json
└── .env                        # Local dev (not committed)
```

### CLI Commands

```bash
# Setup
mkdir asana-oauth-relay && cd asana-oauth-relay
npm init -y
mkdir -p netlify/functions

# After creating files
netlify init
netlify env:set ASANA_CLIENT_ID "xxx"
netlify env:set ASANA_CLIENT_SECRET "xxx"
netlify env:set REDIRECT_URI "https://xxx.netlify.app/.netlify/functions/asana-callback"

# Development
netlify dev

# Deploy
netlify deploy --prod
```

### Asana App Registration

1. Go to https://app.asana.com/0/developer-console
2. Create new app
3. Configure OAuth:
   - Redirect URL: `https://your-site.netlify.app/.netlify/functions/asana-callback`
   - Scopes: `default`
4. Copy Client ID and Client Secret

---

## Security Considerations

1. **Client Secret Protection:** Never expose client secret in frontend code
2. **Token Storage:** Tokens stored in Airtable globalConfig (base-level access control)
3. **CORS:** Restricted to known origins in production
4. **State Parameter:** Used to prevent CSRF attacks
5. **HTTPS:** All endpoints use HTTPS (automatic on Netlify)

---

## References

- [Asana OAuth Documentation](https://developers.asana.com/docs/oauth)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/)
