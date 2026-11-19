import { STORES } from "./catalog";
import { createRng } from "./random";
import { type LocalDate, addDays, diffDays } from "./time";
import type { Customer, CustomerTier } from "./types";

/** Size of the fictional loyalty programme. */
export const CUSTOMER_COUNT = 6_000;

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
/** Last day the fictional programme history is drawn up to (join and churn dates). */
const HISTORY_END = "2026-11-15";

/** Visit frequency by tier, relative to bronze: better tiers shop more often. */
const TIER_ACTIVITY: Record<CustomerTier, number> = { bronze: 1, silver: 1.6, gold: 2.8 };
/** Cap on relative activity, so even the keenest regulars shop a few times a week at most. */
const MAX_ACTIVITY = 3.5;
/** Share of members who stopped shopping at some point in recent months. */
const CHURN_RATE = 0.22;

/**
 * How a member behaves, kept out of `Customer` (and the API): it is the
 * simulation's hidden truth, which the dashboard must infer from visits.
 */
interface MemberBehaviour {
  /** Relative visit rate: long-tailed (a few regulars, many occasional shoppers) × tier. */
  activity: number;
  /** First day the member no longer shops, or null if still active. */
  churnedOn: LocalDate | null;
}

let cache: {
  all: Customer[];
  byId: Map<string, Customer>;
  byStore: Map<string, Customer[]>;
  behaviour: Map<string, MemberBehaviour>;
} | null = null;

function build() {
  const rng = createRng("customers|v1");
  const all: Customer[] = [];
  const behaviour = new Map<string, MemberBehaviour>();
  const span = diffDays(PROGRAMME_START, HISTORY_END);
  for (let i = 1; i <= CUSTOMER_COUNT; i++) {
    const first = rng.pick(FIRST_NAMES);
    const last = `${rng.pick(LAST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    const tier = rng.weightedPick(TIERS, TIER_WEIGHTS);
    const id = `C${String(i).padStart(5, "0")}`;
    // The programme grew over time: more members joined recently.
    const memberSince = addDays(PROGRAMME_START, Math.floor(span * Math.pow(rng.next(), 0.75)));
    all.push({
      id,
      name: `${first} ${last}`,
      tier,
      homeStoreId: rng.weightedPick(STORES, HOME_WEIGHTS).id,
      memberSince,
    });
    const activity = Math.min(MAX_ACTIVITY, Math.exp(rng.normal(0, 0.85)) * TIER_ACTIVITY[tier]);
    const churnedOn = rng.chance(CHURN_RATE) ? addDays(HISTORY_END, -rng.int(10, 200)) : null;
    behaviour.set(id, {
      activity,
      // Nobody churns within a month of joining.
      churnedOn: churnedOn && diffDays(memberSince, churnedOn) > 30 ? churnedOn : null,
    });
  }
  const byId = new Map(all.map((c) => [c.id, c]));
  const byStore = new Map<string, Customer[]>(STORES.map((s) => [s.id, []]));
  for (const c of all) byStore.get(c.homeStoreId)!.push(c);
  return { all, byId, byStore, behaviour };
}

/** Picks members in proportion to their activity among those shopping on a given day. */
export interface MemberPicker {
  /** `r` is a uniform draw in [0, 1); undefined when nobody in the pool shops that day. */
  pick(r: number): Customer | undefined;
}

/**
 * Members of `pool` who shop on `date` (joined, not churned), weighted by
 * activity. Cumulative weights + binary search keep each pick O(log n).
 */
export function memberPicker(pool: readonly Customer[], date: LocalDate): MemberPicker {
  const { behaviour } = data();
  const members: Customer[] = [];
  const cum: number[] = [];
  let total = 0;
  for (const c of pool) {
    const b = behaviour.get(c.id)!;
    if (c.memberSince > date || (b.churnedOn !== null && date >= b.churnedOn)) continue;
    total += b.activity;
    members.push(c);
    cum.push(total);
  }
  return {
    pick(r) {
      if (members.length === 0) return undefined;
      const target = r * total;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] > target) hi = mid;
        else lo = mid + 1;
      }
      return members[lo];
    },
  };
}

function data() {
  return (cache ??= build());
}

/** A member's hidden behaviour. For the simulation and its tests only; never expose it in the API. */
export function memberBehaviour(id: string): MemberBehaviour | undefined {
  return data().behaviour.get(id);
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
