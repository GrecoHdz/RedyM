// Importa todos los modelos existentes
const Usuario = require('./usuariosModel');
const Rol = require('./rolesModel');
const Ciudad = require('./ciudadesModel');
const RefreshToken = require('./refreshtokenModel');
const Cuenta = require('./cuentasModel');
const Notificacion = require('./notificacionesModel');
const NotificacionDestinatario = require('./notificacionesDestinatariosModel');
const Config = require('./configModel');
const SuscripcionNotificacion = require('./suscripcionesNotificacionesModel');

const Publicacion = require('./publicacionesModel');
const Interaccion = require('./InteraccionModel');
const CreditoUsuario = require("./creditoUsuariosModel");
const RedNiveles = require("./redNivelesModel");
const Membresia = require("./membresiaModel");
const Retiro = require("./retiroModel");
const SolicitudUpgrade = require("./solicitudesUpgradeModel");

// Función para configurar las asociaciones
const setupAssociations = () => {
  // Relación Usuario - Publicación
  Usuario.hasMany(Publicacion, {
    foreignKey: 'id_usuario',
    as: 'publicaciones',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  Publicacion.belongsTo(Usuario, {
    foreignKey: 'id_usuario',
    as: 'usuario',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Usuario - Rol
  Usuario.belongsTo(Rol, {
    foreignKey: 'id_rol',
    as: 'rol'
  });
  Rol.hasMany(Usuario, {
    foreignKey: 'id_rol',
    as: 'usuarios'
  });

  // Relación Usuario - Ciudad
  Usuario.belongsTo(Ciudad, {
    foreignKey: 'id_ciudad',
    as: 'ciudad'
  });
  Ciudad.hasMany(Usuario, {
    foreignKey: 'id_ciudad',
    as: 'usuarios'
  });

  // Relación Usuario - RefreshToken
  Usuario.hasMany(RefreshToken, {
    foreignKey: 'usuario_id',
    as: 'refreshTokens',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  RefreshToken.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    as: 'usuario',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Notificación - NotificaciónDestinatario
  Notificacion.hasMany(NotificacionDestinatario, {
    foreignKey: "id_notificacion",
    as: "destinatarios",
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  NotificacionDestinatario.belongsTo(Notificacion, {
    foreignKey: "id_notificacion",
    as: "notificacion",
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Usuario - NotificaciónDestinatario
  Usuario.hasMany(NotificacionDestinatario, {
    foreignKey: "id_usuario",
    as: "notificacionesRecibidas",
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  NotificacionDestinatario.belongsTo(Usuario, {
    foreignKey: "id_usuario",
    as: "usuario",
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Config - Usuario (para referidor predeterminado)
  Config.belongsTo(Usuario, {
    foreignKey: 'valor',
    as: 'referidorPredeterminado',
    constraints: false
  });

  // Relación SuscripcionNotificacion - Usuario
  SuscripcionNotificacion.belongsTo(Usuario, {
    foreignKey: 'id_usuario',
    as: 'usuario',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  Usuario.hasMany(SuscripcionNotificacion, {
    foreignKey: 'id_usuario',
    as: 'suscripciones',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });

  // Relación Publicación - Interacción
  Publicacion.hasMany(Interaccion, {
    foreignKey: 'id_publicacion',
    as: 'interacciones',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  Interaccion.belongsTo(Publicacion, {
    foreignKey: 'id_publicacion',
    as: 'publicacion'
  });

  // Relación Usuario - Interacción
  Usuario.hasMany(Interaccion, {
    foreignKey: 'id_usuario',
    as: 'interacciones',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  });
  Interaccion.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

  // Relaciones de CreditoUsuario
  Usuario.hasOne(CreditoUsuario, { foreignKey: 'id_usuario', as: 'credito' });
  CreditoUsuario.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

  // Relaciones de RedNiveles
  Usuario.hasOne(RedNiveles, { foreignKey: 'id_usuario', as: 'nodoRed' });
  RedNiveles.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });

  RedNiveles.belongsTo(Usuario, { foreignKey: 'id_padre', as: 'padre' });
  RedNiveles.belongsTo(Usuario, { foreignKey: 'id_patrocinador', as: 'patrocinador' });

  Usuario.hasMany(RedNiveles, { foreignKey: 'id_padre', as: 'hijosRed' });
  Usuario.hasMany(RedNiveles, { foreignKey: 'id_patrocinador', as: 'referidosRed' });
  
  // Relaciones de Membresia
  Membresia.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
  Usuario.hasMany(Membresia, { foreignKey: 'id_usuario', as: 'membresias' });

  Membresia.belongsTo(Usuario, { foreignKey: 'id_pagador', as: 'pagador' });

  Membresia.belongsTo(Cuenta, { foreignKey: 'id_cuenta', as: 'cuenta' });
  Cuenta.hasMany(Membresia, { foreignKey: 'id_cuenta', as: 'membresias' });

  // Relaciones de Retiro
  Retiro.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
  Usuario.hasMany(Retiro, { foreignKey: 'id_usuario', as: 'retiros' });

  // Relaciones de SolicitudUpgrade
  SolicitudUpgrade.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
  Usuario.hasMany(SolicitudUpgrade, { foreignKey: 'id_usuario', as: 'solicitudesUpgrade' });
  SolicitudUpgrade.belongsTo(Cuenta, { foreignKey: 'id_cuenta', as: 'cuenta' });
  Cuenta.hasMany(SolicitudUpgrade, { foreignKey: 'id_cuenta', as: 'solicitudesUpgrade' });

  console.log('Asociaciones de RedYMercadeo configuradas correctamente');
};

// Exporta la función de configuración
module.exports = setupAssociations;