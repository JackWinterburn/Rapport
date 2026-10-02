import { config } from "zod";

// Our CSP forbids eval. Without this, zod probes `new Function("")` and the
// browser reports a CSP violation even though zod catches the error.
config({ jitless: true });
