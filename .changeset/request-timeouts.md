---
'@satoshai/playstacks': minor
---

Add configurable request timeouts for all Stacks API calls

All HTTP requests now use `AbortSignal.timeout()` with a configurable `requestTimeout` option (default 30s). This prevents tests from hanging indefinitely when the Stacks API is slow or unresponsive.
