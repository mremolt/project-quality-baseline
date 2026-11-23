# Agent checklists: node

The agent checklists of the node docs, one section per doc, titled like the doc. **Read only the sections of the docs you used, once, before you finish a task** (TOOL-SKL-13). Each checklist belongs to its doc: a change to the doc's rules updates its section here in the same change.

## Node.js Backend: Hexagonal Architecture

[05-building-block-view/node.md](../05-building-block-view/node.md)

- [ ] New file in the right ring and folder (NODE-ARCH-01/02)?
- [ ] No framework, `node:*`, database or logging import in `domain`, `ports`, `application`, also no `import type` (NODE-ARCH-04)?
- [ ] Command created through its factory; invalid input becomes `DomainValidationError` (NODE-ARCH-06/07)?
- [ ] New business error extends one category base class (NODE-ARCH-07)?
- [ ] No blocking call on the request path; no floating promise (NODE-ARCH-10/11)?
- [ ] dependency-cruiser green and its rules not loosened?
- [ ] Authorization refusals throw `AccessDeniedError` (403), objects the caller may not know `NotFoundError` (NODE-ARCH-07)?
- [ ] Mail in `adapter/out/mail`, file writers in one `adapter/out/file` with a folder per format (NODE-ARCH-01)?

## Node.js Tooling

[08-crosscutting-concepts/development/node-tooling.md](../08-crosscutting-concepts/development/node-tooling.md)

- [ ] Node from `.nvmrc`, npm 11.10 or newer (NODE-TOOL-01)?
- [ ] ESM imports with `.js` extension; no DOM lib (NODE-TOOL-02)?
- [ ] No `process.env` outside `src/platform/config`, no `console`, no `child_process` (NODE-TOOL-05)?
- [ ] `npm run verify` green before finishing; no rule or compiler check loosened?

## Node.js Backend-for-Frontend

[08-crosscutting-concepts/security/node-bff.md](../08-crosscutting-concepts/security/node-bff.md)

- [ ] BFF holds no business logic; API calls relayed with the user's token and explicit timeouts (NODE-BFF-01)?
- [ ] Login with PKCE, state and nonce; `redirect_uri` from configuration; post-login target allow-listed (NODE-BFF-02)?
- [ ] Session store with an atomic `compareAndSet`, no memory store, tokens encrypted at rest, no tokens in cookies (NODE-BFF-03, NODE-BFF-05)?
- [ ] `__Host-session` cookie with all attributes, cleared with the same ones (NODE-BFF-04)?
- [ ] `XSRF-TOKEN`/`X-XSRF-TOKEN` on every unsafe method incl. logout, header only (NODE-BFF-06)?
- [ ] Login start never ends a live session; idle and absolute lifetimes, new session id at login, one refresh per session through `compareAndSet` with merge on a lost write (NODE-BFF-02, NODE-BFF-07)?
- [ ] Logout at the IdP (`200 {redirectUri}` for a JSON request, `303` otherwise), back-channel logout with full token validation and `sid` index (NODE-BFF-08)?
- [ ] Nonce CSP per response, HTML `no-store`, deep-link 404s, report endpoint limited (NODE-BFF-09)?
- [ ] Threat model and the tests of NODE-BFF-04..09 in CI (NODE-BFF-10)?
- [ ] Pre-login state expires within 10 minutes, purged, public routes rate-limited and the limit recorded in chapter 7 (NODE-BFF-11)?
- [ ] Long-open page keeps its work state on the server instead of a longer idle timeout (NODE-BFF-07)?
