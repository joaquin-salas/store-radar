import { type NextRequest, NextResponse } from "next/server";
import { getCustomer } from "@/lib/domain/customers";
import { isKnownPage } from "@/lib/nav";

/**
 * Unknown pages (a store, view or member that doesn't exist) get a real 404.
 * Pages stream their shell before they can check their params, which fixes
 * the status at 200, so the check runs here, before rendering. Redirects in
 * next.config.ts run first, so `/`, `/<scope>` and old URLs never reach it.
 */
export function proxy(request: NextRequest) {
  if (isKnownPage(request.nextUrl.pathname, (id) => getCustomer(id) !== undefined))
    return NextResponse.next();
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = {
  // Pages only: not the API, Next.js internals or files such as icon.svg.
  matcher: ["/((?!api/|_next/|_vercel/|.*\\..*).*)"],
};
