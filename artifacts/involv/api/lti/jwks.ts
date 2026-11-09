import { handleJwks } from '../_lib/lti.js';

// Involv's public keys, for Toddle's "Keyset URL" field.
export function GET() { return handleJwks(process.env); }
