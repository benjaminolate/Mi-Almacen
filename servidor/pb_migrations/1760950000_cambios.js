/// <reference path="../pb_data/types.d.ts" />
// Crea la tabla "cambios": la lista de todos los cambios de todas las tiendas, en el
// orden en que llegaron al servidor (seq). Nadie la lee directamente; solo se usa a
// través de /api/sync (pb_hooks/sync.pb.js), por eso todas las reglas quedan cerradas.
migrate((app) => {
  const c = new Collection({
    type: "base",
    name: "cambios",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "tienda", type: "text", required: true, max: 64 },
      { name: "seq", type: "number", required: true, onlyInt: true, min: 1 },
      { name: "hlc", type: "text", required: true, max: 40 },
      { name: "device", type: "text", max: 40 },
      { name: "store", type: "text", required: true, max: 20 },
      { name: "value", type: "json", maxSize: 200000 },
      { name: "del", type: "text", max: 64 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_cambios_hlc ON cambios (hlc)",
      "CREATE UNIQUE INDEX idx_cambios_tienda_seq ON cambios (tienda, seq)",
    ],
  });
  app.save(c);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("cambios"));
});
