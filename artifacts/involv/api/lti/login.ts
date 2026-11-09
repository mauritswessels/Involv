import { handleLogin } from '../_lib/lti.js';

// Toddle starts an LTI 1.3 launch here (OIDC third-party initiated login).
export function GET(request: Request) { return handleLogin(request, process.env); }
export function POST(request: Request) { return handleLogin(request, process.env); }
