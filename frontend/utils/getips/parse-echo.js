// Pull a client IP out of the plain echoes the homepage cards read
// directly in the browser. iP138 and IP.cn answer with a short HTML or
// text page; IPinfo answers with JSON. Invalid text yields ''.

import { isValidIP } from '../ip/valid-ip.js';

const accept = (value) => (typeof value === 'string' && isValidIP(value.trim()) ? value.trim() : '');

// 2026.ip138.com puts the address in the <title>, then again in the body.
export const parseIp138 = (text) => {
    if (typeof text !== 'string') return '';
    const titled = text.match(/您的ip地址是：\s*(\d{1,3}(?:\.\d{1,3}){3})/i);
    if (titled) return accept(titled[1]);
    const bracketed = text.match(/\[(\d{1,3}(?:\.\d{1,3}){3})\]/);
    return bracketed ? accept(bracketed[1]) : '';
};

// my.ip.cn: "ip：61.169.45.46 归属地：…"
export const parseIpCn = (text) => {
    if (typeof text !== 'string') return '';
    const match = text.match(/ip\s*[：:]\s*([0-9a-fA-F:.]+)/i);
    return match ? accept(match[1]) : '';
};

export const parseIpInfo = (body) => {
    let data = body;
    if (typeof body === 'string') {
        try {
            data = JSON.parse(body);
        } catch {
            return '';
        }
    }
    if (!data || typeof data !== 'object') return '';
    return accept(data.ip);
};
