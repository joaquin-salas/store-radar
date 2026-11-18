import { STORES } from "./catalog";
import { createRng } from "./random";
import { addDays } from "./time";
import type { Customer, CustomerTier } from "./types";

/** Size of the fictional loyalty programme. */
export const CUSTOMER_COUNT = 12_000;

const FIRST_NAMES = [
  "Lucía",
  "Martina",
  "Sofía",
  "María",
  "Julia",
  "Paula",
  "Valeria",
  "Emma",
  "Daniela",
  "Carla",
  "Alba",
  "Noa",
  "Sara",
  "Irene",
  "Claudia",
  "Elena",
  "Laura",
  "Marta",
  "Ana",
  "Nerea",
  "Hugo",
  "Martín",
  "Lucas",
  "Mateo",
  "Leo",
  "Daniel",
  "Alejandro",
  "Pablo",
  "Manuel",
  "Álvaro",
  "Adrián",
  "David",
  "Mario",
  "Diego",
  "Javier",
  "Iker",
  "Marcos",
  "Sergio",
  "Jorge",
  "Unai",
];

const LAST_NAMES = [
  "García",
  "Rodríguez",
  "González",
  "Fernández",
  "López",
  "Martínez",
  "Sánchez",
  "Pérez",
  "Gómez",
  "Martín",
  "Jiménez",
  "Ruiz",
  "Hernández",
  "Díaz",
  "Moreno",
  "Muñoz",
  "Álvarez",
  "Romero",
  "Alonso",
  "Navarro",
  "Torres",
  "Domínguez",
  "Vázquez",
  "Ramos",
  "Gil",
  "Serrano",
  "Blanco",
  "Molina",
  "Castro",
  "Ortega",
  "Rubio",
  "Marín",
  "Sanz",
  "Iglesias",
  "Núñez",
  "Garrido",
];

const TIERS: CustomerTier[] = ["bronze", "silver", "gold"];
const TIER_WEIGHTS = [0.62, 0.28, 0.1];

/** Larger stores get proportionally more members. */
const HOME_WEIGHTS = STORES.map((s) => s.streetBase * s.captureBase * s.registeredRate);

const PROGRAMME_START = "2021-03-01";

let cache: { all: Customer[]; byId: Map<string, Customer>; byStore: Map<string, Customer[]> } | null = null;

function build() {
  const rng = createRng("customers|v1");
  const all: Customer[] = [];
  for (let i = 1; i <= CUSTOMER_COUNT; i++) {
    const first = rng.pick(FIRST_NAMES);
    const last = `${rng.pick(LAST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    all.push({
      id: `C${String(i).padStart(5, "0")}`,
      name: `${first} ${last}`,
      tier: rng.weightedPick(TIERS, TIER_WEIGHTS),
      homeStoreId: rng.weightedPick(STORES, HOME_WEIGHTS).id,
      memberSince: addDays(PROGRAMME_START, rng.int(0, 2000)),
    });
  }
  const byId = new Map(all.map((c) => [c.id, c]));
  const byStore = new Map<string, Customer[]>(STORES.map((s) => [s.id, []]));
  for (const c of all) byStore.get(c.homeStoreId)!.push(c);
  return { all, byId, byStore };
}

function data() {
  return (cache ??= build());
}

export function allCustomers(): readonly Customer[] {
  return data().all;
}

export function getCustomer(id: string): Customer | undefined {
  return data().byId.get(id);
}

export function customersOfStore(storeId: string): readonly Customer[] {
  return data().byStore.get(storeId) ?? [];
}
