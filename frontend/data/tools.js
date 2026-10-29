// Single source of truth for the Advanced Tools: their /tools/:slug pages
// (ToolPage.vue), the card groups, the Nav, the keyboard shortcuts and the
// legacy `/?tool=<slug>` redirect (utils/legacy-tool-link.js).
//
// Entry shape:
//   slug                 — stable URL/identifier (/tools/:slug)
//   emoji                — card glyph + page / menu glyph
//   titleKey / noteKey   — i18n keys for the tool title and one-line description
//   category             — TOOL_CATEGORIES id: the card group it renders in
//   component            — lazy import of the tool's .vue (rendered by ToolPage)
//   requiresOriginalSite — gate: only shown on the original site (private API +
//                          sign-in required); omitted == public tool
//   requiresConfig       — gate: only shown when this `/api/configs` flag is
//                          true (e.g. 'cloudFlare' for the Radar-backed tools)
//
// Gates decide listing only (utils/tool-availability.js); a /tools/:slug link
// opens the tool regardless.

export const ADVANCED_TOOLS = [
  { slug: 'pingtest', emoji: '⏱️', titleKey: 'pingtest.Title', noteKey: 'advancedtools.PingTestNote', category: 'network', component: () => import('@/components/advanced-tools/GlobalLatencyTest.vue') },
  { slug: 'mtrtest', emoji: '🚉', titleKey: 'mtrtest.Title', noteKey: 'advancedtools.MTRTestNote', category: 'network', component: () => import('@/components/advanced-tools/MtrTest.vue') },
  { slug: 'splittunnel', emoji: '🔀', titleKey: 'splittunnel.Title', noteKey: 'advancedtools.SplitTunnelNote', category: 'network', component: () => import('@/components/advanced-tools/SplitTunnel.vue') },
  { slug: 'cdnlookup', emoji: '🛰️', titleKey: 'cdnlookup.Title', noteKey: 'advancedtools.CdnLookupNote', category: 'network', component: () => import('@/components/advanced-tools/CdnLookup.vue') },
  { slug: 'multiegress', emoji: '🧭', titleKey: 'multiegress.Title', noteKey: 'advancedtools.MultiEgressNote', category: 'network', component: () => import('@/components/advanced-tools/MultiEgress.vue') },
  { slug: 'dnsresolver', emoji: '📟', titleKey: 'dnsresolver.Title', noteKey: 'advancedtools.DNSResolverNote', category: 'network', component: () => import('@/components/advanced-tools/DnsResolver.vue') },
  { slug: 'whois', emoji: '📓', titleKey: 'whois.Title', noteKey: 'advancedtools.Whois', category: 'lookup', component: () => import('@/components/advanced-tools/Whois.vue') },
  { slug: 'asn', emoji: '🛂', titleKey: 'asnprofile.Title', noteKey: 'advancedtools.AsnProfile', category: 'lookup', component: () => import('@/components/advanced-tools/AsnProfile.vue'), requiresConfig: 'cloudFlare' },
  { slug: 'ipcalculator', emoji: '🔢', titleKey: 'ipcalculator.Title', noteKey: 'advancedtools.IpCalculator', category: 'lookup', component: () => import('@/components/advanced-tools/IpCalculator.vue') },
  { slug: 'invisibilitytest', emoji: '🫣', titleKey: 'invisibilitytest.Title', noteKey: 'advancedtools.InvisibilityTest', category: 'deep', component: () => import('@/components/advanced-tools/InvisibilityTest.vue'), requiresOriginalSite: true },
  { slug: 'enhanceddnsleaktest', emoji: '🌀', titleKey: 'enhanceddnsleaktest.Title', noteKey: 'advancedtools.EnhancedDnsLeakTest', category: 'deep', component: () => import('@/components/advanced-tools/EnhancedDnsLeakTest.vue'), requiresOriginalSite: true },
  { slug: 'blocklist', emoji: '🚫', titleKey: 'ipblocklist.Title', noteKey: 'advancedtools.IpBlocklist', category: 'deep', component: () => import('@/components/advanced-tools/IpBlocklist.vue'), requiresOriginalSite: true },
  { slug: 'personacheck', emoji: '🎭', titleKey: 'personacheck.Title', noteKey: 'advancedtools.PersonaCheck', category: 'deep', component: () => import('@/components/advanced-tools/PersonaCheck.vue'), requiresOriginalSite: true },
];

// slug → entry.
export const TOOL_BY_SLUG = new Map(ADVANCED_TOOLS.map((tool) => [tool.slug, tool]));

// Card groups, in render order. On a self-hosted deployment the 'deep' tools
// (IPCheck.ing's private API) all fail their gates, and the group disappears.
// 'reference' is empty on this fork: the security checklist is not listed.
// An empty group is dropped by groupToolsByCategory.
export const TOOL_CATEGORIES = [
  { id: 'network', titleKey: 'advancedtools.category.network' },
  { id: 'lookup', titleKey: 'advancedtools.category.lookup' },
  { id: 'deep', titleKey: 'advancedtools.category.deep' },
  { id: 'reference', titleKey: 'advancedtools.category.reference' },
];

// Tools grouped by category in TOOL_CATEGORIES order (each keeping registry
// order); groups left empty — every tool filtered out — are dropped.
export const groupToolsByCategory = (tools) => TOOL_CATEGORIES
  .map((c) => ({ ...c, tools: tools.filter((tool) => tool.category === c.id) }))
  .filter((group) => group.tools.length > 0);
