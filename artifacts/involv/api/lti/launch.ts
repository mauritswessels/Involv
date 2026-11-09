import { handleLaunch } from '../_lib/lti.js';

// Toddle posts the signed LTI id_token here after the student is identified.
export function GET(request: Request) { return handleLaunch(request, process.env); }
export function POST(request: Request) { return handleLaunch(request, process.env); }
