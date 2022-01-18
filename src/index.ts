import { ok, err, Result } from "neverthrow";
import { Logger } from "tslog";

import { ApiPromise, WsProvider } from "@polkadot/api";
import "@polkadot/api-augment/polkadot";

import { EventMatcher, newEventMatcher } from "./event-matcher";
import loadConfig from "./config";

const log = new Logger();

async function main(): Promise<Result<void, Error>> {
  const configResult = loadConfig("config.toml");
  if (configResult.isErr()) {
    return err(configResult.error);
  }
  const config = configResult.value;

  const wsProvider = new WsProvider("wss://rpc.polkadot.io");
  const api = await ApiPromise.create({ provider: wsProvider });

  const eventMatchers: EventMatcher[] = [];
  for (const event of config.events) {
    /* eslint-disable */
    const eventMatcherResult = newEventMatcher(api, event.matcher);
    /* eslint-enable */
    if (eventMatcherResult.isErr()) {
      return err(eventMatcherResult.error);
    }

    eventMatchers.push(eventMatcherResult.value);
  }

  log.debug("event matchers: ", eventMatchers);

  const unsubscribe = await api.query.system.events((events) => {
    events.forEach((record) => {
      const { event } = record;

      for (const eventMatcher of eventMatchers) {
        if (eventMatcher.match(event)) {
          const eventData = event.data.map((i) => i.toString()).join(", ");
          log.info(`event: ${event.section}.${event.method}(${eventData})`);
        }
      }
    });
  });

  process.on("SIGINT", () => {
    unsubscribe();
    process.exit();
  });

  return ok(undefined);
}

main()
  .then((result) => {
    if (result.isErr()) {
      log.error(result.error);
      process.exit(-1);
    }
  })
  .catch((error) => {
    log.error(error);
    process.exit(-1);
  });
