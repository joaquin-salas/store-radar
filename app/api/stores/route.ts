import { connection } from "next/server";
import { json } from "@/lib/api";
import { listStores } from "@/lib/domain/service";

export async function GET() {
  await connection(); // store status depends on the current time
  return json({ stores: listStores() });
}
