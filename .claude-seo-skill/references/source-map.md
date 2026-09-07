# Claude SEO source map

The attached Claude SEO project contains an SEO orchestrator with modules for:

- technical SEO, page/on-page review, content and E-E-A-T, content briefs;
- schema and sitemap work, image SEO, performance and Core Web Vitals;
- GEO/AI Overviews, search experience optimization, topical clustering;
- local SEO and maps, hreflang, ecommerce, programmatic and competitor pages;
- Google APIs, backlinks, baseline/drift monitoring, and the FLOW framework.

This Codex skill keeps the decision logic and reporting discipline while leaving Claude-specific slash commands, subagents, launchers, credentials, and third-party installers out of the runtime. Invoke the relevant module by describing the task naturally, for example: “audit the technical SEO and ad placement on this page” or “generate a schema and sitemap plan.”

The source project's useful reporting principles are:

1. observe before recommending;
2. connect recommendations by dependency;
3. validate with independent evidence;
4. state how a recommendation could fail;
5. give a leading indicator the owner can monitor without rerunning the whole audit.

