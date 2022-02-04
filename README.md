# submarine

Submarine is a utility application for monitoring substrate-based blockchains
and sending notifications when certain events happen.

## Event matching

In order to match events the application supports a simple pattern-matching interface.

``` javascript
// minimal form, matches all events of this type
module-name.EventName

// matches events of this type whose arguments match the given values
module-name.EventName(1, asdf, 0x7899)

// matches events of this type where the second argument matches the given value.
// underscore (_) is used as a wildcard operator.
module-name.EventName(_, asdf, _)
```

A list of events supported by polkadot.js can be found [here](https://polkadot.js.org/docs/substrate/events).

## Notifications

Currently the application supports sending notifications over HTTP, Email and SMS.

The payload of the notification is a JSON-encoded representation of the matched event and its parameters.

``` json
{
  "name": "balances.Transfer",
  "params": [
    "111111111111111111111111111111111HC",
    "163KH1bkorFNdyVktuFAoVdCHWz7HChPB7BrzfJFQvsFLgn",
    "42"
  ]
}
```

## Sample config

``` toml
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

## Running

``` shell
# expects a config file at ./config.toml
yarn start

# you can pass the config file location as a parameter
yarn start ~/.config/submarine/config.toml
```

This project includes a derivation for packaging with nix.

``` shell
nix-build
./result/bin/submarine
```
