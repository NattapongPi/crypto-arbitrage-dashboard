/**
 * Simple module-level navigation guard.
 * Settings page registers a guard; DashboardLayout checks it before navigating.
 */

type Guard = (href: string) => boolean; // return true = allow navigation, false = block

let guard: Guard | null = null;

export function registerNavigationGuard(fn: Guard) {
  guard = fn;
}

export function unregisterNavigationGuard() {
  guard = null;
}

/** Returns true if navigation should proceed. */
export function checkNavigationGuard(href: string): boolean {
  return guard ? guard(href) : true;
}
