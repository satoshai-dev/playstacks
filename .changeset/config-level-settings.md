---
'@satoshai/playstacks': minor
---

Support Playwright config-level Stacks settings

Adds `PlaystacksOptions` that can be set in `playwright.config.ts`'s `use` block (`stacksPrivateKey`, `stacksNetwork`, `stacksFeeMultiplier`, etc.), eliminating the need to repeat config in every test file. File-level `testWithStacks()` overrides still take precedence.
