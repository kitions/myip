// iP138 — the year's host (https://2026.ip138.com/) echoes the visitor IP
// in the page title and allows a normal browser to read it. The host name
// follows the calendar year; a year that is not published yet falls back
// to the previous one. A user agent containing "HeadlessChrome" is
// redirected to http://127.0.0.1/ with no CORS header, so that client
// cannot read the page. Homepage card, not a geo database.

import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseIp138 } from './parse-echo.js';

const readYear = async (year) => {
    const response = await fetchWithTimeout(`https://${year}.ip138.com/`, { cache: 'no-store' });
    if (!response.ok) return '';
    return parseIp138(await response.text());
};

export const ip138 = {
    id: 'ip138',
    name: 'iP138',
    run: async () => {
        const year = new Date().getUTCFullYear();
        for (const candidate of [year, year - 1]) {
            try {
                const ip = await readYear(candidate);
                if (ip) return ip;
            } catch {
                // Try the previous year's host.
            }
        }
        return '';
    },
};
