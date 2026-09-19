# Oshxona admin panel

`/oshxona` will be the private editorial workspace for Bolagaism.uz. The public site remains the generated static catalogue; the panel writes editorial changes to D1 and publishes only approved records.

## Rollout order

1. Create a Cloudflare D1 database and apply `schema.sql`.
2. Import the current generated name catalogue into `names`.
3. Add a Worker API with Cloudflare Access authentication.
4. Add the dashboard and name editor under `/oshxona`.
5. Publish changed pages and update sitemap only after an explicit publish action.

## Editorial states

`draft` → `review` → `published` → `archived`

Every write creates a revision and an audit-log entry. A publish action keeps the previous snapshot so an editor can restore it.

## Security boundary

The panel must be protected at the Cloudflare Access layer before it is exposed publicly. A `noindex` meta tag alone is not authentication. The public assets worker will continue serving the current site while the panel is being built.
