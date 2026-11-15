/// <reference path="../pb_data/types.d.ts" />
// Invitaciones: el dueño crea un link para una persona; esa persona elige su propio usuario y
// contraseña. Cada link sirve una sola vez y vence. Solo se guarda el resumen (sha256) del código,
// así que quien vea la tabla no puede usar los links. Se usa a través de pb_hooks/cuentas.pb.js.
migrate((app) => {
  const c = new Collection({
    type: "base",
    name: "invitaciones",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "tienda", type: "text", required: true, max: 64 },
      { name: "hash", type: "text", required: true, max: 64 },
      { name: "nombre", type: "text", required: true, max: 60 },
      { name: "rol", type: "select", required: true, values: ["encargado", "vendedor"], maxSelect: 1 },
      { name: "permisos", type: "json", maxSize: 2000 },
      { name: "vence", type: "number", required: true },
      { name: "usada", type: "bool" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_invitaciones_hash ON invitaciones (hash)"],
  });
  app.save(c);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("invitaciones"));
});
