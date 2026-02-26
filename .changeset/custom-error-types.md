---
'@satoshai/playstacks': minor
---

Add custom error types for programmatic error handling

Introduces a typed error hierarchy (`PlaystacksError`, `NetworkError`, `BroadcastError`, `ConfirmationError`, `UserRejectionError`, `ConfigurationError`, `FeeEstimationError`) so consumers can catch specific errors with `instanceof` checks instead of parsing error message strings.
