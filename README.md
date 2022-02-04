# submarine

Submarine is a utility application for monitoring substrate-based blockchains
and sending notifications when certain events happen.

## Event matching

## Notifications

Currently the application supports sending notifications over HTTP, Email and SMS.

## Sample config

```toml
[services.smtp]
host = "smtp.example.com"
user = "user"
password = "password"
from_email = "submarine@example.com"

[services.twilio]
account_sid = "sid"
auth_token = "token"
from_number = "+1111111111"

[notifications]
http = [{ url = "http://example.com/notification" }]
sms = [{ number = "+351123456789" }]
email = [{ email = "submarine@example.com" }]

[[events]]
matcher = "balances.Transfer"

[[events]]
matcher = "crowdloan.Contributed(_, 1337, _)"
```
