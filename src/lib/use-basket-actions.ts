import { useLocation, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import { useAuth } from "./auth";
import { useCart } from "./cart";

type BasketActions = {
  /** True once the stored session has been read, so the buttons know when to unlock. */
  ready: boolean;
  signedIn: boolean;
  /**
   * Adds to the basket when there is a session; otherwise sends the shopper to
   * sign in and returns false, so callers can skip whatever came next.
   */
  addToBasket: (slug: string, quantity?: number, description?: string) => boolean;
  /** Sends the shopper to sign in, coming back here afterwards. */
  goToSignIn: () => void;
};

/**
 * Buying is account-only: everything that puts an item in the basket goes
 * through here so the sign-in gate is enforced in exactly one place.
 */
export function useBasketActions(): BasketActions {
  const { user, ready } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const goToSignIn = React.useCallback(() => {
    void navigate({ to: "/login", search: { redirect: location.pathname } });
  }, [navigate, location.pathname]);

  const addToBasket = React.useCallback(
    (slug: string, quantity = 1, description?: string) => {
      if (user === null) {
        toast.error("Sign in to start a basket", {
          description: "Your basket and orders are kept with your account.",
        });
        goToSignIn();
        return false;
      }

      add(slug, quantity);
      if (description !== undefined) {
        toast.success("Added to basket", { description });
      }
      return true;
    },
    [user, add, goToSignIn],
  );

  return { ready, signedIn: user !== null, addToBasket, goToSignIn };
}
