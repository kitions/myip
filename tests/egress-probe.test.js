// Guards the pure egress-probe helpers: IP extraction from the echo
// shapes the three tools fetch, Fastly pop codes, grouping, and the
// curated probe list staying on https.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EGRESS_SETS } from '../frontend/data/egress-probes.js';
import {
    assignGroups,
    extractClientIp,
    extractEdge,
    extractServedByPop,
    interpretProbe,
    mapPool,
    summarizeEgress,
} from '../frontend/utils/features/egress-probe.js';

const headers = (value) => ({ get: (name) => (name.toLowerCase() === 'x-served-by' ? value : '') });

describe('extractClientIp', () => {
    it('reads a Cloudflare trace, including CRLF', () => {
        const body = 'fl=1\r\nip=203.0.113.7\r\ncolo=SIN\r\n';
        assert.equal(extractClientIp('trace', body), '203.0.113.7');
    });

    it('reads json ip, origin, and data.ip', () => {
        assert.equal(extractClientIp('json', '{"ip":"198.51.100.8"}'), '198.51.100.8');
        assert.equal(extractClientIp('json', '{"origin":"198.51.100.9, 203.0.113.1"}'), '198.51.100.9');
        assert.equal(extractClientIp('json', '{"data":{"ip":"192.0.2.10"}}'), '192.0.2.10');
    });

    it('rejects a non-address', () => {
        assert.equal(extractClientIp('json', '{"ip":"not-an-ip"}'), '');
        assert.equal(extractClientIp('plain', 'hello'), '');
        assert.equal(extractClientIp('served-by', '{"name":"myip"}'), '');
    });

    it('reads a plain address with a trailing newline', () => {
        assert.equal(extractClientIp('plain', '203.0.113.4\n'), '203.0.113.4');
    });
});

describe('extractEdge', () => {
    it('reads a Cloudflare colo', () => {
        assert.equal(extractEdge('trace', 'ip=203.0.113.7\ncolo=sin\n', null), 'SIN');
    });

    it('reads the last x-served-by pop', () => {
        assert.equal(extractServedByPop('cache-sin123-SIN, cache-nrt4567-NRT'), 'NRT');
        assert.equal(extractServedByPop('cache-hkg12345-HKG'), 'HKG');
        assert.equal(extractServedByPop(''), '');
        assert.equal(extractEdge('served-by', '{}', headers('cache-sin-abc-SIN')), 'SIN');
        assert.equal(extractEdge('served-by', '{}', { 'X-Served-By': 'cache-nrt1-NRT' }), 'NRT');
    });
});

describe('interpretProbe', () => {
    it('marks a readable trace as ok', () => {
        assert.deepEqual(
            interpretProbe('trace', 'ip=203.0.113.7\ncolo=SIN\n', null),
            { status: 'ok', ip: '203.0.113.7', edge: 'SIN' },
        );
    });

    it('turns an optional miss into skip, and a required miss into error', () => {
        assert.equal(interpretProbe('json', '', null, { optional: true }).status, 'skip');
        assert.equal(interpretProbe('json', '', null).status, 'error');
        assert.equal(interpretProbe('json', '{"ip":"203.0.113.7"}', null, { ok: false }).status, 'error');
    });

    it('accepts an edge with no client IP', () => {
        const result = interpretProbe('served-by', '{"name":"myip"}', headers('cache-sin-SIN'));
        assert.deepEqual(result, { status: 'ok', ip: '', edge: 'SIN' });
    });
});

describe('summarizeEgress and assignGroups', () => {
    const rows = [
        { id: 'a', ip: '203.0.113.7', edge: 'SIN' },
        { id: 'b', ip: '203.0.113.7', edge: 'SIN' },
        { id: 'c', ip: '198.51.100.8', edge: 'LHW' },
        { id: 'd', ip: '', edge: 'NRT' },
        { id: 'e', ip: 'nope', edge: '' },
    ];

    it('counts distinct exits and edges', () => {
        const summary = summarizeEgress(rows);
        assert.equal(summary.pathCount, 2);
        assert.equal(summary.edgeCount, 3);
        assert.equal(summary.reachable, 4);
        assert.deepEqual(summary.groups[0], { ip: '203.0.113.7', ids: ['a', 'b'] });
    });

    it('numbers groups in first-seen order', () => {
        const grouped = assignGroups(rows);
        assert.deepEqual(grouped.map((row) => row.group), [1, 1, 2, 0, 0]);
    });
});

describe('mapPool', () => {
    it('keeps input order under concurrency', async () => {
        const result = await mapPool([1, 2, 3, 4], 2, async (value) => value * 10);
        assert.deepEqual(result, [10, 20, 30, 40]);
    });
});

describe('EGRESS_SETS', () => {
    const kinds = new Set(['trace', 'json', 'plain', 'served-by']);

    it('only lists https echoes with a known kind', () => {
        for (const [setId, probes] of Object.entries(EGRESS_SETS)) {
            const ids = new Set();
            for (const probe of probes) {
                assert.equal(ids.has(probe.id), false, `${setId} repeats ${probe.id}`);
                ids.add(probe.id);
                assert.ok(kinds.has(probe.kind), probe.id);
                assert.ok(probe.url.startsWith('https://'), probe.url);
                assert.ok(probe.host && probe.name, probe.id);
            }
        }
    });
});
