import { Logger } from "tslog";
import { ok, err, Result } from "neverthrow";
import { ApiPromise, WsProvider } from "@polkadot/api";
import "@polkadot/api-augment/polkadot";

import { newEventMatcher } from "./event-matcher";

const log = new Logger();

async function main(): Promise<Result<void, Error>> {
  const wsProvider = new WsProvider("wss://rpc.polkadot.io");
  const api = await ApiPromise.create({ provider: wsProvider });

  const matcher = "api.events.balances.Transfer(_,_,50000000000)";

  const eventMatcherResult = newEventMatcher(api, matcher);
  if (eventMatcherResult.isErr()) {
    return err(eventMatcherResult.error);
  }

  const eventMatcher = eventMatcherResult.value;

  const unsubscribe = await api.query.system.events((events) => {
    events.forEach((record) => {
      const { event } = record;

      if (eventMatcher.match(event)) {
        const eventData = event.data.map((i) => i.toString()).join(", ");
        log.info(`matched: ${event.section}.${event.method}(${eventData})`);
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
