// Integration boundary for the APPROVED Moon Temple math from game design.
// Intentionally no invented production paytable or strips. Until supplied, the
// real tab is a labelled, non-playing 5×3 wireframe. See docs/moon-temple-contract.md.
export const TEMPLE_CONFIG = null;
export const TEMPLE_TEST_MODE = false;
export const TEMPLE_FIXTURES = Object.freeze({});

// Next local-only demo slice. Inject the candidate item mapping from GD here.
// Do not replace this with an invented production mapping or an account wallet.
export { TEMPLE_DEMO_ITEM_MAPPING as TEMPLE_TEST_ITEM_MAPPING } from './temple-demo-mapping.js';

// Production defaults closed. The isolated preview builder enables demo explicitly.
export const TEMPLE_DEFAULT_DEMO = false;
