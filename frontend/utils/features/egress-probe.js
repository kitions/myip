// Pure layer of the egress tools (SplitTunnel, CdnLookup, MultiEgress):
// pull a client IP and a CDN edge code out of one echo response, then
// group rows that left through the same address. The fetch itself stays
// in the component.

import { parseTrace } from '../ip/parse-trace.js';
import { isValidIP } from '../../../common/valid-ip.js';

export const EGRESS_CONCURRENCY = 6;
export const EGRESS_TIMEOUT_MS = 5000;

const KINDS = new Set(['trace', 'json', 'plain', 'served-by']);

// First comma- or whitespace-separated token, if it is an IP.
const firstIp = (value) => {
    if (typeof value !== 'string') return '';
    const token = value.trim().split(/[\s,]+/)[0];
    return token && isValidIP(token) ? token : '';
};

const asObject = (body) => {
    if (body && typeof body === 'object') return body;
    if (typeof body !== 'string') return null;
    try {
        const parsed = JSON.parse(body);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

// Client address echoed by the endpoint. served-by rows carry a pop code,
// not an address, so they return ''.
export const extractClientIp = (kind, body) => {
    if (kind === 'trace') return firstIp(parseTrace(body).ip);
    if (kind === 'plain') return firstIp(typeof body === 'string' ? body : '');
    if (kind === 'json') {
        const data = asObject(body);
        if (!data) return '';
        return firstIp(data.ip)
            || firstIp(data.origin)
            || firstIp(data.clientIp)
            || firstIp(data.data && data.data.ip);
    }
    return '';
};

const headerValue = (headers, name) => {
    if (!headers) return '';
    if (typeof headers.get === 'function') {
        return headers.get(name) || '';
    }
    const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
    return key ? String(headers[key]) : '';
};

// Last Fastly/jsDelivr cache token ends with the IATA code: cache-…-NRT.
export const extractServedByPop = (value) => {
    if (typeof value !== 'string' || !value.trim()) return '';
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const match = last.match(/-([A-Z]{3})$/);
    return match ? match[1] : '';
};

// Edge code: Cloudflare colo, or the jsDelivr pop. Empty when the kind
// has neither.
export const extractEdge = (kind, body, headers) => {
    if (kind === 'trace') {
        const colo = parseTrace(body).colo;
        if (typeof colo !== 'string') return '';
        const code = colo.trim().toUpperCase();
        return /^[A-Z0-9]{2,5}$/.test(code) ? code : '';
    }
    if (kind === 'served-by') return extractServedByPop(headerValue(headers, 'x-served-by'));
    return '';
};

// ok: false covers HTTP errors and transport failures. An optional row
// (IPv6) that missed becomes 'skip' instead of 'error'.
export const interpretProbe = (kind, body, headers, { optional = false, ok = true } = {}) => {
    if (!ok || !KINDS.has(kind)) {
        return { status: optional ? 'skip' : 'error', ip: '', edge: '' };
    }
    const ip = extractClientIp(kind, body);
    const edge = extractEdge(kind, body, headers);
    if (!ip && !edge) {
        return { status: optional ? 'skip' : 'error', ip: '', edge: '' };
    }
    return { status: 'ok', ip, edge };
};

// Distinct client IPs, in first-seen order, plus how many edges answered.
// Rows without a valid IP still count as reachable when they have an edge.
export const summarizeEgress = (rows) => {
    const groups = new Map();
    const edges = new Set();
    let reachable = 0;
    for (const row of rows) {
        if (!row) continue;
        const ip = row.ip && isValidIP(row.ip) ? row.ip : '';
        if (ip) {
            reachable += 1;
            if (!groups.has(ip)) groups.set(ip, []);
            groups.get(ip).push(row.id);
        } else if (row.edge) {
            reachable += 1;
        }
        if (row.edge) edges.add(row.edge);
    }
    return {
        reachable,
        pathCount: groups.size,
        edgeCount: edges.size,
        groups: [...groups.entries()].map(([ip, ids]) => ({ ip, ids })),
    };
};

// group is 1-based in first-seen IP order. Rows with no client IP stay 0.
export const assignGroups = (rows) => {
    const order = [];
    return rows.map((row) => {
        if (!row.ip || !isValidIP(row.ip)) return { ...row, group: 0 };
        let index = order.indexOf(row.ip);
        if (index < 0) {
            order.push(row.ip);
            index = order.length - 1;
        }
        return { ...row, group: index + 1 };
    });
};

// Fixed-concurrency map. Results keep input order. The cursor moves
// before the await, so two lanes never take the same index.
export const mapPool = async (items, limit, worker) => {
    const results = new Array(items.length);
    if (items.length === 0) return results;
    let cursor = 0;
    const lanes = Math.max(1, Math.min(limit, items.length));
    const lane = async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: lanes }, () => lane()));
    return results;
};
