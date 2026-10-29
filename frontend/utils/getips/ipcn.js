// IP.cn — https://my.ip.cn/ returns "ip：<address> 归属地：…" and allows
// the browser to read it. Homepage card for the domestic exit.

import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseIpCn } from './parse-echo.js';

export const ipCn = {
    id: 'ipcn',
    name: 'IP.cn',
    run: async () => {
        const response = await fetchWithTimeout('https://my.ip.cn/', { cache: 'no-store' });
        if (!response.ok) return '';
        return parseIpCn(await response.text());
    },
};
