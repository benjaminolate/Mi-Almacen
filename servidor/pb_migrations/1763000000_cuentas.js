/// <reference path="../pb_data/types.d.ts" />
// Cuentas (Fase 4): "usuarios" son las personas que entran con usuario y contraseña, y
// "miembros" dice a qué tienda pertenece cada una, con qué rol y qué permisos.
// Todo se usa a través de pb_hooks/cuentas.pb.js; las reglas de acceso directo quedan cerradas.
migrate((app) => {
  const u = new Collection({
    type: "auth",
    name: "usuarios",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "usuario", type: "text", required: true, min: 3, max: 30, pattern: "^[a-z0-9._-]+$" },
      { name: "nombre", type: "text", required: true, max: 60 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_usuarios_usuario ON usuarios (usuario)"],
    passwordAuth: { enabled: true, identityFields: ["usuario"] },
    authToken: { duration: 30 * 24 * 3600 },
  });
  app.save(u);
  // Quienes atienden no siempre tienen correo: el correo queda opcional
  const col = app.findCollectionByNameOrId("usuarios");
  col.fields.getByName("email").required = false;
  // Contraseñas de al menos 6 caracteres, fáciles de recordar para quien atiende
  col.fields.getByName("password").min = 6;
  app.save(col);

  const m = new Collection({
    type: "base",
    name: "miembros",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "usuario", type: "relation", required: true, collectionId: col.id, cascadeDelete: true, maxSelect: 1 },
      { name: "tienda", type: "text", required: true, max: 64 },
      { name: "rol", type: "select", required: true, values: ["dueno", "encargado", "vendedor"], maxSelect: 1 },
      { name: "permisos", type: "json", maxSize: 2000 },
      { name: "activo", type: "bool" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_miembros_usuario_tienda ON miembros (usuario, tienda)",
      "CREATE INDEX idx_miembros_tienda ON miembros (tienda)",
    ],
  });
  app.save(m);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("miembros"));
  app.delete(app.findCollectionByNameOrId("usuarios"));
});
