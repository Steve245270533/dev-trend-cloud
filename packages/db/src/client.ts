import { Pool, type PoolClient, type QueryResult } from "pg";

export interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
}

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
  });
}

export async function withTransaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
