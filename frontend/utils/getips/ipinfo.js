// IPinfo.io — https://ipinfo.io/json echoes the visitor IP with
// Access-Control-Allow-Origin: *. Homepage card for an international exit.
// The token-gated /api/ipinfo geo lookup is a different path.

import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseIpInfo } from './parse-echo.js';

export const ipInfoEcho = {
    id: 'ipinfo',
    name: 'IPinfo.io',
    run: async () => {
        const response = await fetchWithTimeout('https://ipinfo.io/json', { cache: 'no-store' });
        if (!response.ok) return '';
        return parseIpInfo(await response.text());
    },
};
