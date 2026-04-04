import { describe, it, expect, beforeEach } from "vitest";
import {
  registerNavigationGuard,
  unregisterNavigationGuard,
  checkNavigationGuard,
} from "@/lib/navigation-guard";

describe("navigation-guard", () => {
  beforeEach(() => {
    // Clean up any guards between tests
    unregisterNavigationGuard();
  });

  describe("registerNavigationGuard", () => {
    it("should register a guard that blocks navigation", () => {
      registerNavigationGuard(() => false);
      expect(checkNavigationGuard("/settings")).toBe(false);
    });

    it("should register a guard that allows navigation", () => {
      registerNavigationGuard(() => true);
      expect(checkNavigationGuard("/dashboard")).toBe(true);
    });

    it("should allow guard to inspect the href", () => {
      registerNavigationGuard((href) => href !== "/settings");
      expect(checkNavigationGuard("/dashboard")).toBe(true);
      expect(checkNavigationGuard("/settings")).toBe(false);
    });

    it("should replace previous guard when registering a new one", () => {
      registerNavigationGuard(() => false);
      expect(checkNavigationGuard("/any")).toBe(false);

      registerNavigationGuard(() => true);
      expect(checkNavigationGuard("/any")).toBe(true);
    });
  });

  describe("unregisterNavigationGuard", () => {
    it("should clear the registered guard", () => {
      registerNavigationGuard(() => false);
      unregisterNavigationGuard();
      expect(checkNavigationGuard("/any")).toBe(true);
    });

    it("should be safe to call when no guard is registered", () => {
      expect(() => unregisterNavigationGuard()).not.toThrow();
      expect(checkNavigationGuard("/any")).toBe(true);
    });
  });

  describe("checkNavigationGuard", () => {
    it("should return true when no guard is registered", () => {
      expect(checkNavigationGuard("/dashboard")).toBe(true);
      expect(checkNavigationGuard("/settings")).toBe(true);
    });

    it("should call the registered guard with the href", () => {
      let capturedHref = "";
      registerNavigationGuard((href) => {
        capturedHref = href;
        return true;
      });

      checkNavigationGuard("/test-path");
      expect(capturedHref).toBe("/test-path");
    });

    it("should return false when guard blocks navigation", () => {
      registerNavigationGuard(() => false);
      expect(checkNavigationGuard("/blocked")).toBe(false);
    });

    it("should return true when guard allows navigation", () => {
      registerNavigationGuard(() => true);
      expect(checkNavigationGuard("/allowed")).toBe(true);
    });

    it("should support complex guard logic", () => {
      const allowedPaths = ["/dashboard", "/calendar-spread", "/funding-rate"];

      registerNavigationGuard((href) => {
        return allowedPaths.includes(href);
      });

      expect(checkNavigationGuard("/dashboard")).toBe(true);
      expect(checkNavigationGuard("/calendar-spread")).toBe(true);
      expect(checkNavigationGuard("/settings")).toBe(false);
      expect(checkNavigationGuard("/unknown")).toBe(false);
    });
  });
});
