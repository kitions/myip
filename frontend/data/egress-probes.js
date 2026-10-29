// Curated public echo endpoints for the three egress tools
// (SplitTunnel, CdnLookup, MultiEgress).
//
// Every URL here was checked from a browser origin: the response carries
// Access-Control-Allow-Origin and, for the jsDelivr rows, exposes
// x-served-by. Hostnames that answer but hide the body from script
// (no ACAO) are not on this list. This is not a speedtest-server scan.

// kind:
//   trace      — Cloudflare /cdn-cgi/trace (ip + colo)
//   json       — JSON body; ip / origin / data.ip
//   plain      — body is the address itself
//   served-by  — CDN pop from the last x-served-by token (no client IP)
// optional    — a miss is "no IPv6", not a failure

export const EGRESS_SETS = {
    splittunnel: [
        { id: 'cloudflare', name: 'Cloudflare', host: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'one', name: '1.1.1.1', host: '1.1.1.1', url: 'https://1.1.1.1/cdn-cgi/trace', kind: 'trace' },
        { id: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com', url: 'https://chatgpt.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'openai', name: 'OpenAI', host: 'openai.com', url: 'https://openai.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'claude', name: 'Claude', host: 'claude.ai', url: 'https://claude.ai/cdn-cgi/trace', kind: 'trace' },
        { id: 'grok', name: 'Grok', host: 'grok.com', url: 'https://grok.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'x', name: 'X', host: 'x.com', url: 'https://x.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'medium', name: 'Medium', host: 'medium.com', url: 'https://medium.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'visa', name: 'Visa', host: 'visa.com', url: 'https://visa.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'gitlab', name: 'GitLab', host: 'gitlab.com', url: 'https://gitlab.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'npm', name: 'npm', host: 'registry.npmjs.org', url: 'https://registry.npmjs.org/cdn-cgi/trace', kind: 'trace' },
        { id: 'cdnjs', name: 'cdnjs', host: 'cdnjs.cloudflare.com', url: 'https://cdnjs.cloudflare.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'qualcomm', name: 'Qualcomm CN', host: 'www.qualcomm.cn', url: 'https://www.qualcomm.cn/cdn-cgi/trace', kind: 'trace' },
        { id: 'ipip', name: 'IPIP', host: 'myip.ipip.net', url: 'https://myip.ipip.net/json', kind: 'json' },
    ],
    cdnlookup: [
        { id: 'cf-www', name: 'Cloudflare', host: 'www.cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace', kind: 'trace' },
        { id: 'cf-one', name: '1.1.1.1', host: '1.1.1.1', url: 'https://1.1.1.1/cdn-cgi/trace', kind: 'trace' },
        { id: 'cf-qualcomm', name: 'Qualcomm CN', host: 'www.qualcomm.cn', url: 'https://www.qualcomm.cn/cdn-cgi/trace', kind: 'trace' },
        { id: 'jsdelivr', name: 'jsDelivr', host: 'cdn.jsdelivr.net', url: 'https://cdn.jsdelivr.net/gh/jason5ng32/MyIP@main/package.json', kind: 'served-by' },
        { id: 'jsdelivr-fastly', name: 'jsDelivr Fastly', host: 'fastly.jsdelivr.net', url: 'https://fastly.jsdelivr.net/gh/jason5ng32/MyIP@main/package.json', kind: 'served-by' },
        { id: 'jsdelivr-cf', name: 'jsDelivr Cloudflare', host: 'testingcf.jsdelivr.net', url: 'https://testingcf.jsdelivr.net/gh/jason5ng32/MyIP@main/package.json', kind: 'served-by' },
    ],
    multiegress: [
        { id: 'one', name: '1.1.1.1', host: '1.1.1.1', url: 'https://1.1.1.1/cdn-cgi/trace', kind: 'trace' },
        { id: 'onezero', name: '1.0.0.1', host: '1.0.0.1', url: 'https://1.0.0.1/cdn-cgi/trace', kind: 'trace' },
        { id: 'ipip', name: 'IPIP', host: 'myip.ipip.net', url: 'https://myip.ipip.net/json', kind: 'json' },
        { id: 'ipinfo', name: 'IPinfo', host: 'ipinfo.io', url: 'https://ipinfo.io/json', kind: 'json' },
        { id: 'ipsb', name: 'IP.SB', host: 'api.ip.sb', url: 'https://api.ip.sb/geoip', kind: 'json' },
        { id: 'ident', name: 'ident.me', host: 'ident.me', url: 'https://ident.me/json', kind: 'json' },
        { id: 'icanhazip', name: 'icanhazip', host: 'ipv4.icanhazip.com', url: 'https://ipv4.icanhazip.com/', kind: 'plain' },
        { id: 'ifconfig', name: 'ifconfig.me', host: 'ifconfig.me', url: 'https://ifconfig.me/ip', kind: 'plain' },
        { id: 'httpbin', name: 'httpbin', host: 'httpbin.org', url: 'https://httpbin.org/ip', kind: 'json' },
        { id: 'ipify', name: 'ipify', host: 'api.ipify.org', url: 'https://api.ipify.org?format=json', kind: 'json' },
        { id: 'ipify6', name: 'ipify IPv6', host: 'api6.ipify.org', url: 'https://api6.ipify.org?format=json', kind: 'json', optional: true },
        { id: 'ident6', name: 'ident.me IPv6', host: 'v6.ident.me', url: 'https://v6.ident.me/json', kind: 'json', optional: true },
    ],
};
