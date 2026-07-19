/*
 * Alin cart checkout boundary
 * Owns submission state and duplicate-submit protection.
 * The legacy order writer remains behind this boundary until its database
 * dependencies are migrated separately.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartCheckout?.installed) return;

  const state = features.cartState;
  const form = features.cartForm;
  const writer = features.cartWriter;
  const legacySubmit = writer?.submit || (typeof window.confirmCartCheckout === 'function'
    ? window.confirmCartCheckout.bind(window)
    : null);
  let pending = null;

  function announce(status, extra) {
    document.dispatchEvent(new CustomEvent('alin:cart-checkout', {
      detail: { status, ...(extra || {}) }
    }));
  }

  async function submit(...args) {
    if (pending) return pending;
    try {
      form?.validate();
    } catch (error) {
      window.alert?.(error?.message || String(error));
      return false;
    }
    if (!legacySubmit) {
      console.error('[Alin cart] Checkout implementation is unavailable');
      return false;
    }

    announce('started');
    pending = Promise.resolve()
      .then(() => legacySubmit(...args))
      .then(result => {
        announce('completed');
        return result;
      })
      .catch(error => {
        announce('failed', { message: error?.message || String(error) });
        throw error;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  features.cartCheckout = Object.freeze({
    installed: true,
    submit,
    isPending: () => Boolean(pending)
  });
})();
