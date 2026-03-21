import { Client, Pool } from "pg";

type GlobalPgState = {
  pool?: Pool;
  realtimeListener?: Promise<Client>;
};

const globalForPg = globalThis as unknown as GlobalPgState;

export function getPgPool() {
  globalForPg.pool ??= new Pool({
    connectionString: process.env.DATABASE_URL
  });

  return globalForPg.pool;
}

export async function getSingletonPgListener(channel: string) {
  globalForPg.realtimeListener ??= (async () => {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    await client.connect();
    await client.query(`LISTEN ${channel}`);

    client.on("error", (error) => {
      console.error("Shared PG listener failed", error);
      globalForPg.realtimeListener = undefined;
      void client.end().catch(() => undefined);
    });

    client.on("end", () => {
      globalForPg.realtimeListener = undefined;
    });

    return client;
  })();

  return globalForPg.realtimeListener;
}
