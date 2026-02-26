---
'@satoshai/playstacks': minor
---

Add automatic nonce management for sequential transactions

Introduces a `NonceTracker` that fetches the initial nonce from the chain and increments it locally after each broadcast, allowing multiple transactions to be sent in a single test without waiting for each to confirm. Nonce tracking resets automatically between tests.
