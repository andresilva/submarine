import { Logger } from "tslog";
import { ApiPromise, WsProvider } from "@polkadot/api";
import "@polkadot/api-augment/polkadot";

const log = new Logger();

async function main(): Promise<void> {
  const wsProvider = new WsProvider("wss://rpc.polkadot.io");
  const api = await ApiPromise.create({ provider: wsProvider });

  log.info(api.genesisHash.toHex());
}

main().catch(log.error);
