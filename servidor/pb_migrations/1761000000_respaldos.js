/// <reference path="../pb_data/types.d.ts" />
// Respaldo automático todos los días a las 3 de la mañana. Guarda los últimos 14.
migrate((app) => {
  const s = app.settings();
  s.backups.cron = "0 3 * * *";
  s.backups.cronMaxKeep = 14;
  app.save(s);
}, (app) => {
  const s = app.settings();
  s.backups.cron = "";
  app.save(s);
});
