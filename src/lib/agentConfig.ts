// Single source of truth for the news-agent runtime config.
// Replace AGENT_ACCESS_TOKEN here when it expires.

export const AGENT_API_BASE = "https://devde.muns.io";

export const AGENT_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWE5ZGMyYi0xZDBmLTQ2MzctOGE2Ny0wM2VhNzFmMGYyY2YiLCJlbWFpbCI6Im5hZGFtc2FsdWphQGdtYWlsLmNvbSIsIm9yZ0lkIjoiMSIsImF1dGhvcml0eSI6ImFkbWluIiwiaWF0IjoxNzc3MTE3NzgwLCJleHAiOjE3Nzc1NDk3ODB9.u--PdKiPaaA5BCFizdkwo2TKaHt3oLdMs2hnQcVvTu4";

// Map from dashboard sector id → backend agent UUID. Adding a new sector?
// Add the id+agent pair here and it lights up automatically — Refresh on the
// sector page and the bulk Sync-all flow both pick it up.
export const SECTOR_AGENTS: Record<string, string> = {
  banking: "c94633f6-94a4-42ef-96f3-e3c0f4d49a05",
  it: "96df15db-ab01-45df-ae5b-78519accc749",
  pharma: "a9960430-c7b4-4ea7-add7-88997655a599",
  auto: "081d9904-4b68-41b1-9133-dd9f02bb80f0",
  energy: "c3ef8187-b149-44c7-afb1-03ffc87200c3",
  metals: "41377de2-882b-48f0-af3e-ea618cee3141",
  fmcg: "6ede6a22-6967-44a7-b49b-17a0bee42cdc",
  realestate: "bcd1135d-b1ee-40d9-8d00-9153be5595fe",
  telecom: "bafce213-6ff4-458b-8771-e4ce2d0d15e5",
  capgoods: "af4cd893-e9c3-415c-8c3e-1eec517b8dcc",
  power: "7c700143-3d98-45e0-a895-9814b8d59cbd",
  cement: "6a110e9b-9525-4bc8-98a9-deb296e583a8",
  chemicals: "e56d9694-81fb-4915-a4a5-b1ffe2042115",
  healthcare: "05e5cebe-f067-4f54-911a-2352b562dce8",
  media: "ffc935e7-e87f-40b8-89e5-c66c891d81d5",
  retail: "2aa3e28b-81c4-49cd-8a7e-1b198f6ef6a3",
  aviation: "9d111d26-ca9b-410e-9a65-195efbb85e68",
  logistics: "2d50af65-cd51-45a6-a32f-d284ebe131be",
  agri: "fbeea6bf-4066-4014-aaa6-c7fa52977690",
  defence: "3b52dc5d-9427-44c0-b7f1-34193fa365dd",
  renewables: "d7befedf-8bff-43a2-8b7a-e25ef26d0bc2",
  semis: "eba9a222-1178-4793-b09a-3cd19bb6206c",
  ev: "cd4a79c4-7220-422f-b198-e816c69440f5",
  insurance: "0c4cb522-a1ea-43f3-b03e-09bc113d4fe1",
  textiles: "77e2eb1c-d738-417d-a5c5-5b0622bcd3d0",
  hospitality: "84de61bd-b176-4832-bf4e-7784c812ca57",
  infra: "c3ac8b97-2a67-4ed3-96c4-f29cd8ad7dae",
  specchem: "63ff7fc3-b398-420f-b135-6c28678215b4",
  nbfc: "a9445c9d-3841-4fd1-a76a-d243b3c6ef6a",
};
