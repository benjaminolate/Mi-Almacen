/// <reference path="../pb_data/types.d.ts" />
// Crea la tabla "vitrinas": lo que muestra la página pública de cada tienda (tienda.html).
// La app de la tienda la publica con /api/publico/publicar; los clientes la leen con
// /api/publico/<pid>. "pid" es un código distinto al de la tienda, para que el link
// público nunca dé acceso a los datos. Como "cambios", nadie la lee directamente.
migrate((app) => {
  const c = new Collection({
    type: "base",
    name: "vitrinas",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "pid", type: "text", required: true, max: 24 },
      { name: "tienda", type: "text", required: true, max: 64 },
      { name: "activo", type: "bool" },
      { name: "data", type: "json", maxSize: 500000 },
      { name: "privado", type: "json", maxSize: 50000 },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_vitrinas_pid ON vitrinas (pid)",
      "CREATE INDEX idx_vitrinas_tienda ON vitrinas (tienda)",
    ],
  });
  app.save(c);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("vitrinas"));
});
