// information_uuid_v5=8a991a8a-19d8-590e-bf27-287aec58040e
// event_uuid_v7=01a04bd0-b895-799d-8a32-aa756477aa7c state_transition=VITE_CLIENT_BUILD -> SITES_SERVER_PACKAGE occurred_at=2026-08-29T01:00:00Z
// machine-contract: serve only the generated static assets; no server database, file storage, OpenAI API key, or booking side effect exists here.
export default {
  async fetch(request, environment) {
    return environment.ASSETS.fetch(request);
  },
};
