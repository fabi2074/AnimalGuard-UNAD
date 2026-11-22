// src/components/AdopcionEducacionComponent.js
// Módulo de Adopción, Seguimiento Posadopción y Ruta de Aprendizaje Legal
// Autor: Iván Antonio Parada Meneses
// Requerimientos implementados aquí:
// 1. Galería de animales en adopción y postulación con filtro Ley 2455 de 2025 - RF04
// 2. Seguimiento posadopción con calendario (hitos 15, 30 y 90 días), reportes en cualquier
//    momento (rutina, médico, comportamiento, urgencia) y bandeja del albergue - RF04 / RNF05
// 3. Ruta de aprendizaje legal (Leyes 84/1989, 1774/2016, 2054/2020 y 2455/2025) - RF05
//
// Notas de diseño:
// - Datos de demostración en memoria (sin Supabase). Campos y enumeraciones siguen
//   database/schema.sql (animales_adopcion, albergues, solicitudes_adopcion,
//   seguimiento_posadopcion, contenidos_educativos).
// - El "store" vive a nivel de módulo: sobrevive cuando App.js desmonta este componente
//   ("Cerrar sesión" y volver a entrar, incluso con otro rol). El componente lo vuelve a leer al montarse.
// - Brechas frente a schema.sql (se documentan, no se cambia el esquema):
//   * solicitudes_adopcion no tiene correo, experiencia previa, mayor de edad, recursos,
//     compromiso de seguimiento ni fecha de aprobación: se guardan como campos extra.
//   * seguimiento_posadopcion.hito_control es NOT NULL y solo admite 'Día 15', 'Día 30' y
//     'Día 90'. Los reportes libres (sin hito) usan hito_control = null y el campo extra
//     tipo_reporte; en Supabase requerirían ampliar el esquema.
//   * "Seguimiento vencido" no existe en estado_cumplimiento: es un estado derivado
//     (sin registro y plazo vencido) más una alerta interna para el albergue.
// - Mapeo de estados del hito (UI -> schema.sql):
//   "Pendiente" -> sin registro y plazo vigente; "Al día" -> registro 'Al día';
//   "Seguimiento vencido" -> derivado; "Incumplimiento de seguimiento" -> registro del
//   albergue con estado_cumplimiento = 'Alerta de Incumplimiento'.
// - El plazo de cada hito vence al final del día (23:59) de la fecha límite.
// - Fotos de la galería: Unsplash (licencia Unsplash: uso gratuito, sin atribución obligatoria).

import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Modal,
  Alert,
  Switch,
  Keyboard,
  Linking,
  Platform,
  StatusBar,
  ActivityIndicator,
  AccessibilityInfo,
  KeyboardAvoidingView,
  useWindowDimensions,
  StyleSheet
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ============================================================================
// 0. SISTEMA DE DISEÑO (tokens)
// ============================================================================
const T = {
  color: {
    primario: '#1B4332',
    primarioMedio: '#2D6A4F',
    contenedorPrimario: '#D8F3DC',
    acento: '#95D5B2',
    sobrePrimario: '#FFFFFF',
    sobreContenedor: '#0B2A1E',
    fondo: '#F4F7F5',
    superficie: '#FFFFFF',
    superficieVariante: '#EAF2EC',
    borde: '#C9D6CD',
    bordeFuerte: '#6F8277',
    texto: '#15211B',
    textoSuave: '#46564D',
    textoTenue: '#5E6E65',
    error: '#B3261E',
    contenedorError: '#FCE4E1',
    sobreContenedorError: '#7A1712',
    incumplimiento: '#5C1410',
    alerta: '#5E3B00',
    contenedorAlerta: '#FFEDC2',
    info: '#123A68',
    contenedorInfo: '#DDEAF8',
    deshabilitadoFondo: '#E3E8E5',
    deshabilitadoTexto: '#6B7770',
    alertaFuerte: '#A36F00',
    seleccion: '#F0F8F2',
    reporte: '#1D6FD1',
    vencidoOscuro: '#8C1D18',
    sobreVencido: '#FFD9D4',
    bloqueadaFondo: '#F7F9F8',
    errorSuave: '#FFF7F6'
  },
  radio: { xs: 6, sm: 8, md: 12, lg: 16, lgx: 20, xl: 24, xxl: 28, pill: 999 },
  esp: { xxs: 2, xs: 4, s6: 6, sm: 8, s10: 10, md: 12, s14: 14, lg: 16, s20: 20, xl: 24, xxl: 32 },
  tipo: {
    display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
    titular: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.2 },
    tituloL: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
    tituloM: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
    tituloS: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
    cuerpoL: { fontSize: 16, lineHeight: 24 },
    cuerpo: { fontSize: 15, lineHeight: 22 },
    cuerpoS: { fontSize: 13, lineHeight: 19 },
    etiquetaL: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
    etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },
    etiquetaS: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.3 },
    sobretitulo: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
    numeroHero: { fontSize: 56, lineHeight: 60, fontWeight: '800', letterSpacing: -1 }
  },
  sombra: {
    n1: { shadowColor: '#0B2A1E', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    n2: { shadowColor: '#0B2A1E', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    n3: { shadowColor: '#0B2A1E', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }
  }
};

// Degradados del sistema de diseño.
T.gradiente = {
  marca: [T.color.primario, T.color.primarioMedio],
  marcaInvertida: [T.color.primarioMedio, T.color.primario],
  vencido: [T.color.vencidoOscuro, T.color.error],
  curso: [T.color.primario, '#24573F'],
  cursoTerminado: ['#14532D', T.color.primarioMedio],
  diapositiva: [T.color.contenedorPrimario, '#F1FAF3'],
  escenario: [T.color.contenedorInfo, '#F2F7FC'],
  veloTarjeta: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)'],
  veloHeroSuperior: ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)'],
  veloHeroInferior: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.82)']
};

// Tonos semánticos para chips, avisos y estados.
const TONOS = {
  exito: { fondo: '#D8F3DC', texto: '#0F3D24' },
  alerta: { fondo: T.color.contenedorAlerta, texto: T.color.alerta },
  error: { fondo: T.color.contenedorError, texto: T.color.sobreContenedorError },
  info: { fondo: T.color.contenedorInfo, texto: T.color.info },
  neutro: { fondo: '#E6ECE8', texto: '#2F3D35' },
  fuerte: { fondo: T.color.incumplimiento, texto: '#FFFFFF' },
  primario: { fondo: T.color.primario, texto: '#FFFFFF' }
};

const INSET_SUPERIOR = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 50;
// En Android el Modal es translúcido bajo la barra de navegación (edge-to-edge): se deja espacio.
const INSET_INFERIOR = Platform.OS === 'ios' ? 28 : 48;

// @@LOGICA-INICIO (bloque sin React: se prueba aislado con node)
// ============================================================================
// 1. CONSTANTES (valores de enumeración de schema.sql)
// ============================================================================
const DIA_MS = 24 * 60 * 60 * 1000;
const VENTANA_DIAS = 5; // días antes de la fecha límite en que se abre el registro del hito

const MUNICIPIOS = ['Bogotá D.C.', 'Soacha'];
const ESTADO_ANIMAL = { DISPONIBLE: 'Disponible', EN_PROCESO: 'En proceso', ADOPTADO: 'Adoptado' };
const ESTADO_SOLICITUD = {
  PENDIENTE: 'Pendiente revisión albergue',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada'
};
const CUMPLIMIENTO = { AL_DIA: 'Al día', PENDIENTE: 'Pendiente', ALERTA: 'Alerta de Incumplimiento' };
const HITOS = [
  { hito_control: 'Día 15', dias: 15 },
  { hito_control: 'Día 30', dias: 30 },
  { hito_control: 'Día 90', dias: 90 }
];
const ESTADO_HITO_UI = {
  PENDIENTE: 'Pendiente',
  AL_DIA: 'Al día',
  VENCIDO: 'Seguimiento vencido',
  INCUMPLIMIENTO: 'Incumplimiento de seguimiento'
};

const TIPOS_REPORTE = [
  {
    id: 'rutina', etiqueta: 'Seguimiento de rutina', corto: 'Rutina', icono: 'clipboard-text-outline',
    descripcion: 'Adaptación, alimentación y ánimo.', tono: 'exito'
  },
  {
    id: 'medico', etiqueta: 'Atención médica o veterinaria', corto: 'Médico', icono: 'stethoscope',
    descripcion: 'Veterinario, vacunas, síntomas o tratamientos.', tono: 'alerta'
  },
  {
    id: 'comportamiento', etiqueta: 'Cambio de comportamiento', corto: 'Comportamiento', icono: 'paw',
    descripcion: 'Miedo, agresividad, apatía u otros cambios.', tono: 'info'
  },
  {
    id: 'urgencia', etiqueta: 'Urgencia', corto: 'Urgencia', icono: 'alert-octagon-outline',
    descripcion: 'Requiere atención inmediata del albergue.', tono: 'error'
  }
];
const buscarTipoReporte = (id) => TIPOS_REPORTE.find((t) => t.id === id);

const TIPOS_VIVIENDA = ['Casa', 'Apartamento', 'Casa campestre / finca', 'Otro'];
const EXPERIENCIAS = [
  'Sí, tengo mascotas actualmente',
  'Sí, he tenido mascotas antes',
  'No, sería mi primera mascota'
];

// ============================================================================
// 2. STORE EN MEMORIA A NIVEL DE MÓDULO (datos de demostración ficticios)
// ============================================================================
const AHORA_SEMILLA = Date.now();
const UNSPLASH = 'https://images.unsplash.com/';

const store = {
  secuencia: 0,
  albergues: [
    {
      id: 'alb-bogota',
      nombre_albergue: 'Albergue Comunitario Huellas del Sur',
      municipio: 'Bogotá D.C.',
      localidad_barrio: 'Localidad de Kennedy',
      telefono_contacto: '300 000 0001 (demo)',
      verificado: true
    },
    {
      id: 'alb-soacha',
      nombre_albergue: 'Refugio Comunitario Patas Libres',
      municipio: 'Soacha',
      localidad_barrio: 'Comuna 1 – Compartir',
      telefono_contacto: '300 000 0002 (demo)',
      verificado: true
    }
  ],
  animales: [
    {
      id: 'ani-luna', albergue_id: 'alb-bogota', nombre: 'Luna', especie: 'Perro',
      edad_aproximada: '2 años', talla: 'Mediana', estado_salud: 'Sana y desparasitada',
      esterilizado: true, vacunado: true, temperamento: ['Juguetona', 'Sociable con niños'],
      historia_resumen: 'Rescatada de una calle en Kennedy. Es juguetona, aprende rápido y se lleva bien con niños.',
      foto_url: `${UNSPLASH}photo-1561037404-61cd46aa615b`, estado_adopcion: ESTADO_ANIMAL.DISPONIBLE
    },
    {
      id: 'ani-canela', albergue_id: 'alb-soacha', nombre: 'Canela', especie: 'Gato',
      edad_aproximada: '1 año', talla: 'Pequeña', estado_salud: 'Sana',
      esterilizado: true, vacunado: true, temperamento: ['Tranquila', 'Hogareña'],
      historia_resumen: 'Llegó con sus hermanos en una caja. Es tranquila y le encanta dormir al sol.',
      foto_url: `${UNSPLASH}photo-1596854407944-bf87f6fdd49e`, estado_adopcion: ESTADO_ANIMAL.DISPONIBLE
    },
    {
      id: 'ani-rocky', albergue_id: 'alb-soacha', nombre: 'Rocky', especie: 'Perro',
      edad_aproximada: '5 años', talla: 'Grande', estado_salud: 'Recuperado de una fractura en la pata trasera',
      esterilizado: true, vacunado: true, temperamento: ['Noble', 'Necesita patio'],
      historia_resumen: 'Fue atropellado y abandonado. Hoy camina bien y busca un hogar con patio.',
      foto_url: `${UNSPLASH}photo-1558788353-f76d92427f16`, estado_adopcion: ESTADO_ANIMAL.DISPONIBLE
    },
    {
      id: 'ani-nube', albergue_id: 'alb-bogota', nombre: 'Nube', especie: 'Gato',
      edad_aproximada: '4 meses', talla: 'Pequeña', estado_salud: 'Sana; pendiente segunda dosis de vacunas',
      esterilizado: false, vacunado: false, temperamento: ['Curiosa', 'Activa'],
      historia_resumen: 'Gatita curiosa encontrada en un parqueadero. El albergue programará su esterilización.',
      foto_url: `${UNSPLASH}photo-1592194996308-7b43878e84a6`, estado_adopcion: ESTADO_ANIMAL.DISPONIBLE
    },
    {
      id: 'ani-max', albergue_id: 'alb-soacha', nombre: 'Max', especie: 'Perro',
      edad_aproximada: '1 año', talla: 'Mediana', estado_salud: 'Sano, con esquema de vacunas completo',
      esterilizado: true, vacunado: true, temperamento: ['Enérgico', 'Le gusta caminar'],
      historia_resumen: 'Lo encontraron solo cerca de la autopista Sur. Es enérgico y disfruta las caminatas largas.',
      foto_url: `${UNSPLASH}photo-1477884213360-7e9d7dcc1e48`, estado_adopcion: ESTADO_ANIMAL.DISPONIBLE
    },
    {
      id: 'ani-toby', albergue_id: 'alb-bogota', nombre: 'Toby', especie: 'Perro',
      edad_aproximada: '3 años', talla: 'Pequeña', estado_salud: 'Sano',
      esterilizado: true, vacunado: true, temperamento: ['Cariñoso', 'Tranquilo'],
      historia_resumen: 'Lo entregó una familia que no podía cuidarlo, en lugar de abandonarlo. Es muy cariñoso.',
      foto_url: `${UNSPLASH}photo-1583337130417-3346a1be7dee`, estado_adopcion: ESTADO_ANIMAL.EN_PROCESO
    },
    {
      id: 'ani-pelusa', albergue_id: 'alb-soacha', nombre: 'Pelusa', especie: 'Gato',
      edad_aproximada: '6 años', talla: 'Mediana', estado_salud: 'Sana; dieta para gato adulto',
      esterilizado: true, vacunado: true, temperamento: ['Serena', 'Independiente'],
      historia_resumen: 'Gata adulta y serena, adoptada recientemente por una familia de Soacha.',
      foto_url: `${UNSPLASH}photo-1518791841217-8f162f1e1131`, estado_adopcion: ESTADO_ANIMAL.ADOPTADO
    },
    {
      id: 'ani-mia', albergue_id: 'alb-bogota', nombre: 'Mía', especie: 'Gato',
      edad_aproximada: '3 años', talla: 'Pequeña', estado_salud: 'Sana',
      esterilizado: true, vacunado: true, temperamento: ['Dulce', 'Observadora'],
      historia_resumen: 'Vivía en un local comercial cerrado. Hoy disfruta de su nuevo hogar en Bogotá.',
      foto_url: `${UNSPLASH}photo-1514888286974-6c03e2ca1dba`, estado_adopcion: ESTADO_ANIMAL.ADOPTADO
    }
  ],
  solicitudes: [
    {
      id: 'sol-demo-toby', animal_id: 'ani-toby', postulante_id: 'usr-laura-gomez', propietario: 'laura gomez',
      nombre_completo: 'Laura Gómez (demo)', telefono: '3001234567', correo: 'laura.demo@correo.com',
      municipio: 'Bogotá D.C.', tipo_vivienda: 'Apartamento', vivienda_propia_o_autorizada: true,
      experiencia_previa: 'Sí, he tenido mascotas antes', mayor_de_edad: true,
      compromiso_cinco_libertades: true, compromiso_recursos: true, compromiso_seguimiento: true,
      declaracion_sin_inhabilidad_ley2455: true,
      motivo_adopcion: 'Vivo sola, trabajo desde casa y quiero darle compañía y cuidado a un perro pequeño.',
      estado_solicitud: ESTADO_SOLICITUD.PENDIENTE, observaciones_albergue: '',
      fecha_solicitud: new Date(AHORA_SEMILLA - 2 * DIA_MS).toISOString(),
      fecha_aprobacion: null, es_demo: false
    },
    {
      // Segunda postulación para Toby: varios ciudadanos pueden postularse al mismo animal.
      id: 'sol-demo-toby-2', animal_id: 'ani-toby', postulante_id: 'usr-andres-perez', propietario: 'andres perez',
      nombre_completo: 'Andrés Pérez (demo)', telefono: '3204567890', correo: 'andres.demo@correo.com',
      municipio: 'Soacha', tipo_vivienda: 'Casa', vivienda_propia_o_autorizada: true,
      experiencia_previa: 'Sí, tengo mascotas actualmente', mayor_de_edad: true,
      compromiso_cinco_libertades: true, compromiso_recursos: true, compromiso_seguimiento: true,
      declaracion_sin_inhabilidad_ley2455: true,
      motivo_adopcion: 'Tenemos patio y otro perro tranquilo; buscamos un compañero pequeño para la familia.',
      estado_solicitud: ESTADO_SOLICITUD.PENDIENTE, observaciones_albergue: '',
      fecha_solicitud: new Date(AHORA_SEMILLA - 1 * DIA_MS).toISOString(),
      fecha_aprobacion: null, es_demo: false
    },
    {
      // Aprobada hace 20 días: su hito "Día 15" está vencido (sin registro).
      id: 'sol-demo-pelusa', animal_id: 'ani-pelusa', postulante_id: 'usr-demo', propietario: 'usr-demo',
      nombre_completo: 'Adoptante de demostración', telefono: '3109876543', correo: 'adoptante.demo@correo.com',
      municipio: 'Soacha', tipo_vivienda: 'Casa', vivienda_propia_o_autorizada: true,
      experiencia_previa: 'Sí, tengo mascotas actualmente', mayor_de_edad: true,
      compromiso_cinco_libertades: true, compromiso_recursos: true, compromiso_seguimiento: true,
      declaracion_sin_inhabilidad_ley2455: true,
      motivo_adopcion: 'Tenemos espacio y experiencia con gatos adultos; queremos darle un hogar tranquilo.',
      estado_solicitud: ESTADO_SOLICITUD.APROBADA,
      observaciones_albergue: 'Visita de verificación satisfactoria. Aprobada.',
      fecha_solicitud: new Date(AHORA_SEMILLA - 24 * DIA_MS).toISOString(),
      fecha_aprobacion: new Date(AHORA_SEMILLA - 20 * DIA_MS).toISOString(),
      // Visible para cualquier ciudadano en la demo, para poder probar el seguimiento.
      es_demo: true
    },
    {
      // Aprobada hace 35 días, con hitos 15 y 30 al día (solo la ve el albergue).
      id: 'sol-demo-mia', animal_id: 'ani-mia', postulante_id: 'usr-carlos-ruiz', propietario: 'carlos ruiz',
      nombre_completo: 'Carlos Ruiz (demo)', telefono: '3157654321', correo: 'carlos.demo@correo.com',
      municipio: 'Bogotá D.C.', tipo_vivienda: 'Apartamento', vivienda_propia_o_autorizada: true,
      experiencia_previa: 'Sí, he tenido mascotas antes', mayor_de_edad: true,
      compromiso_cinco_libertades: true, compromiso_recursos: true, compromiso_seguimiento: true,
      declaracion_sin_inhabilidad_ley2455: true,
      motivo_adopcion: 'Quiero darle un hogar estable a una gata adulta; tengo tiempo y un veterinario cerca.',
      estado_solicitud: ESTADO_SOLICITUD.APROBADA,
      observaciones_albergue: 'Entrevista y visita satisfactorias.',
      fecha_solicitud: new Date(AHORA_SEMILLA - 38 * DIA_MS).toISOString(),
      fecha_aprobacion: new Date(AHORA_SEMILLA - 35 * DIA_MS).toISOString(),
      es_demo: false
    }
  ],
  seguimientos: [
    {
      id: 'seg-demo-mia-15', solicitud_id: 'sol-demo-mia', tipo_reporte: 'rutina', hito_control: 'Día 15',
      estado_animal: 'Se adaptó muy bien al apartamento, come normal y ya usa su arenero sin problema.',
      foto_seguimiento_path: `${UNSPLASH}photo-1514888286974-6c03e2ca1dba?w=800&q=80&auto=format&fit=crop`,
      estado_cumplimiento: CUMPLIMIENTO.AL_DIA, observacion_albergue: 'Excelente adaptación. Gracias por el reporte.',
      fecha_registro: new Date(AHORA_SEMILLA - 21 * DIA_MS).toISOString(), autor: 'adoptante', leido_albergue: true
    },
    {
      id: 'seg-demo-mia-comp', solicitud_id: 'sol-demo-mia', tipo_reporte: 'comportamiento', hito_control: null,
      estado_animal: 'Los primeros días se escondía cuando llegaban visitas; ahora sale a saludar.',
      foto_seguimiento_path: null, estado_cumplimiento: null, observacion_albergue: '',
      fecha_registro: new Date(AHORA_SEMILLA - 12 * DIA_MS).toISOString(), autor: 'adoptante', leido_albergue: true
    },
    {
      id: 'seg-demo-mia-30', solicitud_id: 'sol-demo-mia', tipo_reporte: 'rutina', hito_control: 'Día 30',
      estado_animal: 'Sigue sana y activa. Ya tiene rutina de juego en las tardes.',
      foto_seguimiento_path: null, estado_cumplimiento: CUMPLIMIENTO.AL_DIA, observacion_albergue: '',
      fecha_registro: new Date(AHORA_SEMILLA - 6 * DIA_MS).toISOString(), autor: 'adoptante', leido_albergue: false
    },
    {
      id: 'seg-demo-pelusa-med', solicitud_id: 'sol-demo-pelusa', tipo_reporte: 'medico', hito_control: null,
      estado_animal: 'La llevamos al veterinario por un estornudo frecuente; le recetaron un tratamiento de 5 días.',
      foto_seguimiento_path: null, estado_cumplimiento: null, observacion_albergue: '',
      fecha_registro: new Date(AHORA_SEMILLA - 3 * DIA_MS).toISOString(), autor: 'adoptante', leido_albergue: false
    }
  ],
  educacion: { unidades: {}, escenarios: {} },
  ui: { pestana: 'adopcion' }
};

// ============================================================================
// 3. LÓGICA DE NEGOCIO PURA
// ============================================================================
function crearId(prefijo) {
  store.secuencia += 1;
  return `${prefijo}-${Date.now().toString(36)}-${store.secuencia}`;
}

// Normaliza un nombre para usarlo como clave de propietario (sin tildes, espacios ni mayúsculas).
function normalizarNombre(texto) {
  let t = (texto || '').trim().replace(/\s+/g, ' ').toLowerCase();
  try {
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {
    // Si el motor JS no soporta normalize(), se conserva el texto en minúsculas.
  }
  return t;
}
const buscarAnimal = (id) => store.animales.find((a) => a.id === id);
const buscarAlbergue = (id) => store.albergues.find((a) => a.id === id);
const buscarSolicitud = (id) => store.solicitudes.find((s) => s.id === id);
// Solo las fotos de Unsplash aceptan parámetros de tamaño; las tomadas en el teléfono (file://) se usan tal cual.
const fotoUrl = (url, ancho) =>
  !url ? null : url.indexOf(UNSPLASH) !== 0 || url.indexOf('?') >= 0 ? url : `${url}?w=${ancho}&q=80&auto=format&fit=crop`;

const TALLAS = ['Pequeña', 'Mediana', 'Grande'];
const ESPECIES = ['Perro', 'Gato'];

// Registro de un animal para adopción (tabla animales_adopcion). Solo el rol Albergue puede publicar.
function validarAnimal(d) {
  const e = {};
  if (!d.nombre || d.nombre.trim().length < 2) e.nombre = 'Escribe el nombre del animal.';
  if (!ESPECIES.includes(d.especie)) e.especie = 'Elige si es perro o gato.';
  if (!d.edad_aproximada || !d.edad_aproximada.trim()) e.edad = 'Escribe la edad aproximada (ej.: 2 años, 4 meses).';
  if (!TALLAS.includes(d.talla)) e.talla = 'Elige la talla.';
  if (!d.estado_salud || d.estado_salud.trim().length < 3) e.salud = 'Describe brevemente su estado de salud.';
  if (!d.historia_resumen || d.historia_resumen.trim().length < 20) e.historia = 'Cuenta su historia en al menos 20 caracteres.';
  if (!d.albergue_id || !store.albergues.some((a) => a.id === d.albergue_id)) e.albergue = 'Elige el albergue responsable.';
  if (!d.foto_url) e.foto = 'Agrega una foto: es lo primero que ven los adoptantes.';
  return e;
}

function agregarAnimal(rol, d) {
  if (rol !== 'albergue') return { ok: false, error: 'Solo un albergue puede publicar animales para adopción.' };
  const errores = validarAnimal(d);
  if (Object.keys(errores).length) return { ok: false, errores };
  const temperamento = (d.temperamento || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  const animal = {
    id: crearId('ani'),
    albergue_id: d.albergue_id,
    nombre: d.nombre.trim(),
    especie: d.especie,
    edad_aproximada: d.edad_aproximada.trim(),
    talla: d.talla,
    estado_salud: d.estado_salud.trim(),
    esterilizado: !!d.esterilizado,
    vacunado: !!d.vacunado,
    temperamento,
    historia_resumen: d.historia_resumen.trim(),
    foto_url: d.foto_url,
    estado_adopcion: ESTADO_ANIMAL.DISPONIBLE
  };
  store.animales.unshift(animal);
  return { ok: true, animal };
}

// Clave de propietario: nombre de sesión normalizado; si está vacío, el nombre del formulario.
function claveUsuario(nombreUsuario, nombreFormulario) {
  return normalizarNombre(nombreUsuario) || normalizarNombre(nombreFormulario);
}

// La solicitud pertenece al usuario en sesión (clave tomada de nombreUsuario al postularse).
// Una clave vacía nunca coincide. La adopción demo es visible para cualquier ciudadano.
function esSolicitudPropia(solicitud, nombreUsuario) {
  if (!solicitud) return false;
  if (solicitud.es_demo) return true;
  const clave = claveUsuario(nombreUsuario);
  return !!clave && !!solicitud.propietario && solicitud.propietario === clave;
}

// Teléfono legible: 300 123 4567 o 601 234 5678.
function formatearTelefono(telefono) {
  const d = limpiarTelefono(telefono);
  return /^\d{10}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : (telefono || '');
}
// Solo dígitos, para el enlace tel:.
const digitosTelefono = (telefono) => limpiarTelefono((telefono || '').replace(/[^\d+]/g, ''));

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function formatearFecha(valor) {
  if (!valor) return '—';
  const f = new Date(valor);
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}
function formatearFechaHora(valor) {
  const f = new Date(valor);
  let h = f.getHours();
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${f.getDate()} ${MESES[f.getMonth()]}, ${h}:${String(f.getMinutes()).padStart(2, '0')} ${sufijo}`;
}
function inicioDelDia(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function finDelDia(ms) {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
function sumarDias(ms, dias) {
  const d = new Date(ms);
  d.setDate(d.getDate() + dias);
  return d.getTime();
}
// Diferencia en días de calendario (0 = mismo día, negativo = en el pasado).
function diferenciaDias(desdeMs, hastaMs) {
  return Math.round((inicioDelDia(hastaMs) - inicioDelDia(desdeMs)) / DIA_MS);
}
function textoRelativo(valor, ahora = Date.now()) {
  const n = diferenciaDias(new Date(valor).getTime(), ahora);
  if (n <= 0) return 'Hoy';
  if (n === 1) return 'Ayer';
  return `Hace ${n} días`;
}

function limpiarTelefono(telefono) {
  let d = (telefono || '').replace(/[\s\-().]/g, '');
  if (d.startsWith('+57')) d = d.slice(3);
  else if (d.startsWith('0057')) d = d.slice(4);
  else if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return d;
}
// Celular colombiano (3XX XXX XXXX) o fijo nacional (601-608 + 7 dígitos).
const telefonoValido = (telefono) => /^(3\d{9}|60[1-8]\d{7})$/.test(limpiarTelefono(telefono));
const correoValido = (correo) =>
  /^[^\s@]+@[^\s@.-][^\s@.]*(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test((correo || '').trim());

// Valida la postulación. Devuelve { campo: mensaje }. Incluye el filtro Ley Ángel.
function validarPostulacion(d) {
  const e = {};
  const nombre = (d.nombre_completo || '').trim();
  if (!nombre) e.nombre_completo = 'Escribe tu nombre completo.';
  else if (nombre.split(/\s+/).length < 2) e.nombre_completo = 'Escribe tu nombre y al menos un apellido.';
  if (!(d.telefono || '').trim()) e.telefono = 'Escribe tu número de teléfono.';
  else if (!telefonoValido(d.telefono)) e.telefono = 'Usa un celular de 10 dígitos (ej. 300 123 4567) o un fijo 60X XXX XXXX.';
  if (!(d.correo || '').trim()) e.correo = 'Escribe tu correo electrónico.';
  else if (!correoValido(d.correo)) e.correo = 'Revisa el formato del correo (ej. nombre@correo.com).';
  if (!MUNICIPIOS.includes(d.municipio)) e.municipio = 'Selecciona Bogotá D.C. o Soacha.';
  if (!TIPOS_VIVIENDA.includes(d.tipo_vivienda)) e.tipo_vivienda = 'Selecciona el tipo de vivienda.';
  if (typeof d.vivienda_propia_o_autorizada !== 'boolean') {
    e.vivienda_propia_o_autorizada = 'Indica si la vivienda es propia o autorizada.';
  }
  if (!EXPERIENCIAS.includes(d.experiencia_previa)) e.experiencia_previa = 'Cuéntanos tu experiencia con mascotas.';
  const motivo = (d.motivo_adopcion || '').trim();
  if (motivo.length < 20) e.motivo_adopcion = 'Cuéntanos tu motivo en al menos 20 caracteres.';
  if (!d.mayor_de_edad) e.mayor_de_edad = 'Debes ser mayor de edad para adoptar.';
  if (!d.compromiso_cinco_libertades) e.compromiso_cinco_libertades = 'Este compromiso es obligatorio.';
  if (!d.compromiso_recursos) e.compromiso_recursos = 'Este compromiso es obligatorio.';
  if (!d.compromiso_seguimiento) e.compromiso_seguimiento = 'Este compromiso es obligatorio.';
  if (!d.declaracion_sin_inhabilidad_ley2455) {
    e.declaracion_sin_inhabilidad_ley2455 =
      'Sin esta declaración juramentada no puedes postularte (filtro Ley Ángel).';
  }
  return e;
}

const CAMPOS_FILTRO_LEY_ANGEL = [
  'mayor_de_edad',
  'compromiso_cinco_libertades',
  'compromiso_recursos',
  'compromiso_seguimiento',
  'declaracion_sin_inhabilidad_ley2455'
];

const ETIQUETAS_CAMPOS = {
  nombre_completo: 'Nombre completo',
  telefono: 'Teléfono',
  correo: 'Correo',
  municipio: 'Municipio',
  tipo_vivienda: 'Tipo de vivienda',
  vivienda_propia_o_autorizada: 'Vivienda propia o autorizada',
  experiencia_previa: 'Experiencia previa',
  motivo_adopcion: 'Motivo',
  mayor_de_edad: 'Mayor de edad',
  compromiso_cinco_libertades: 'Compromiso cinco libertades',
  compromiso_recursos: 'Compromiso de recursos',
  compromiso_seguimiento: 'Compromiso de seguimiento',
  declaracion_sin_inhabilidad_ley2455: 'Declaración Ley 2455'
};

const pendientesDeAnimal = (animalId) =>
  store.solicitudes.filter((s) => s.animal_id === animalId && s.estado_solicitud === ESTADO_SOLICITUD.PENDIENTE);

// Solicitud pendiente o aprobada de ESTE usuario (por clave de propietario) para el animal.
function solicitudVigenteDe(animalId, clave) {
  if (!clave) return null;
  return store.solicitudes.find((s) => s.animal_id === animalId && s.propietario === clave &&
    (s.estado_solicitud === ESTADO_SOLICITUD.PENDIENTE || s.estado_solicitud === ESTADO_SOLICITUD.APROBADA)) || null;
}

// ¿Puede postularse? Varios ciudadanos pueden postularse aunque el animal esté "En proceso".
// Se bloquea solo si ya fue adoptado o si este mismo usuario ya tiene una solicitud vigente.
function estadoPostulacion(animalId, rol, nombreUsuario, nombreFormulario) {
  const animal = buscarAnimal(animalId);
  const pendientes = animal ? pendientesDeAnimal(animal.id).length : 0;
  if (!animal) return { puede: false, codigo: 'inexistente', motivo: 'Este animal no existe.', pendientes };
  if (rol !== 'ciudadano') return { puede: false, codigo: 'rol', motivo: 'Solo el rol Ciudadano puede postularse.', pendientes };
  if (animal.estado_adopcion === ESTADO_ANIMAL.ADOPTADO) {
    return { puede: false, codigo: 'adoptado', motivo: `${animal.nombre} ya fue adoptado.`, pendientes };
  }
  const propia = solicitudVigenteDe(animal.id, claveUsuario(nombreUsuario, nombreFormulario));
  if (propia) {
    return {
      puede: false,
      codigo: propia.estado_solicitud === ESTADO_SOLICITUD.APROBADA ? 'propia_aprobada' : 'propia_pendiente',
      motivo: propia.estado_solicitud === ESTADO_SOLICITUD.APROBADA
        ? `Tu solicitud para adoptar a ${animal.nombre} ya fue aprobada.`
        : `Ya tienes una postulación en revisión para ${animal.nombre}. El albergue te responderá en Seguimiento.`,
      pendientes, propia
    };
  }
  return { puede: true, codigo: 'ok', motivo: '', pendientes };
}

function registrarPostulacion(rol, animalId, datos, nombreUsuario) {
  if (rol !== 'ciudadano') return { ok: false, error: 'Solo el rol Ciudadano puede postularse.' };
  const animal = buscarAnimal(animalId);
  if (!animal || animal.estado_adopcion === ESTADO_ANIMAL.ADOPTADO) {
    return { ok: false, error: 'Este animal ya no está disponible para postulación.' };
  }
  const errores = validarPostulacion(datos);
  if (Object.keys(errores).length > 0) return { ok: false, error: 'Revisa los campos marcados.', errores };
  const ep = estadoPostulacion(animal.id, rol, nombreUsuario, datos.nombre_completo);
  if (!ep.puede) return { ok: false, error: ep.motivo, codigo: ep.codigo };
  const propietario = claveUsuario(nombreUsuario, datos.nombre_completo);
  const solicitud = {
    id: crearId('sol'),
    animal_id: animal.id,
    postulante_id: `usr-${propietario.replace(/\s/g, '-')}`,
    propietario, // clave del usuario en sesión (sustituye al UUID de usuarios en la demo)
    nombre_completo: datos.nombre_completo.trim(),
    telefono: limpiarTelefono(datos.telefono),
    correo: datos.correo.trim().toLowerCase(),
    municipio: datos.municipio,
    tipo_vivienda: datos.tipo_vivienda,
    vivienda_propia_o_autorizada: datos.vivienda_propia_o_autorizada === true,
    experiencia_previa: datos.experiencia_previa,
    mayor_de_edad: true,
    compromiso_cinco_libertades: true,
    compromiso_recursos: true,
    compromiso_seguimiento: true,
    declaracion_sin_inhabilidad_ley2455: true,
    motivo_adopcion: datos.motivo_adopcion.trim(),
    estado_solicitud: ESTADO_SOLICITUD.PENDIENTE,
    observaciones_albergue: '',
    fecha_solicitud: new Date().toISOString(),
    fecha_aprobacion: null,
    es_demo: false
  };
  store.solicitudes.push(solicitud);
  animal.estado_adopcion = ESTADO_ANIMAL.EN_PROCESO;
  return { ok: true, solicitud };
}

const MOTIVO_RECHAZO_AUTOMATICO = 'El animal fue adoptado por otro postulante';

// Solo el rol Albergue aprueba o rechaza. La app nunca aprueba automáticamente.
function resolverSolicitud(rol, solicitudId, decision, observaciones) {
  if (rol !== 'albergue') return { ok: false, error: 'Solo el rol Albergue puede aprobar o rechazar solicitudes.' };
  const solicitud = buscarSolicitud(solicitudId);
  if (!solicitud || solicitud.estado_solicitud !== ESTADO_SOLICITUD.PENDIENTE) {
    return { ok: false, error: 'La solicitud ya fue resuelta.' };
  }
  const obs = (observaciones || '').trim();
  const animal = buscarAnimal(solicitud.animal_id);
  if (decision === ESTADO_SOLICITUD.APROBADA) {
    solicitud.estado_solicitud = ESTADO_SOLICITUD.APROBADA;
    solicitud.fecha_aprobacion = new Date().toISOString();
    solicitud.observaciones_albergue = obs;
    if (animal) animal.estado_adopcion = ESTADO_ANIMAL.ADOPTADO;
    // Las demás solicitudes pendientes del mismo animal se rechazan automáticamente.
    const otras = pendientesDeAnimal(solicitud.animal_id);
    otras.forEach((s) => {
      s.estado_solicitud = ESTADO_SOLICITUD.RECHAZADA;
      s.observaciones_albergue = MOTIVO_RECHAZO_AUTOMATICO;
      s.rechazo_automatico = true;
    });
    return { ok: true, autoRechazadas: otras.length, estadoAnimal: ESTADO_ANIMAL.ADOPTADO };
  }
  if (decision === ESTADO_SOLICITUD.RECHAZADA) {
    if (obs.length < 5) return { ok: false, error: 'Escribe el motivo del rechazo en las observaciones.' };
    solicitud.estado_solicitud = ESTADO_SOLICITUD.RECHAZADA;
    solicitud.observaciones_albergue = obs;
    const quedan = pendientesDeAnimal(solicitud.animal_id).length;
    if (animal) animal.estado_adopcion = quedan > 0 ? ESTADO_ANIMAL.EN_PROCESO : ESTADO_ANIMAL.DISPONIBLE;
    return { ok: true, quedan, estadoAnimal: animal ? animal.estado_adopcion : null };
  }
  return { ok: false, error: 'Decisión no válida.' };
}

// Fecha en que ocurrió el seguimiento (elegida por el adoptante); los registros antiguos usan fecha_registro.
const fechaSeguimientoDe = (r) => new Date(r.fecha_seguimiento || r.fecha_registro).getTime();
// Extemporáneo: la fecha del seguimiento es de un día anterior al día en que se registró.
const esExtemporaneo = (r) => !!r && r.autor === 'adoptante' &&
  diferenciaDias(fechaSeguimientoDe(r), new Date(r.fecha_registro).getTime()) > 0;

const reportesDeSolicitud = (solicitudId) =>
  store.seguimientos
    .filter((s) => s.solicitud_id === solicitudId)
    .sort((a, b) => fechaSeguimientoDe(b) - fechaSeguimientoDe(a) || new Date(b.fecha_registro) - new Date(a.fecha_registro));

// Rango permitido para la fecha del seguimiento: desde el día de aprobación hasta hoy (sin fechas futuras).
function limitesFechaSeguimiento(solicitud, ahora = Date.now()) {
  const max = inicioDelDia(ahora);
  const min = solicitud && solicitud.fecha_aprobacion ? inicioDelDia(new Date(solicitud.fecha_aprobacion).getTime()) : max;
  return { min: Math.min(min, max), max };
}
function fechaSeguimientoValida(ms, solicitud, ahora = Date.now()) {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return false;
  const { min, max } = limitesFechaSeguimiento(solicitud, ahora);
  const dia = inicioDelDia(ms);
  return dia >= min && dia <= max;
}

// Calcula los hitos 15/30/90 a partir de la fecha de aprobación.
function calcularHitos(solicitud, ahora = Date.now()) {
  if (!solicitud || solicitud.estado_solicitud !== ESTADO_SOLICITUD.APROBADA || !solicitud.fecha_aprobacion) {
    return [];
  }
  const base = new Date(solicitud.fecha_aprobacion).getTime();
  return HITOS.map(({ hito_control, dias }) => {
    // Por días de calendario (no por milisegundos) para no correrse con cambios de horario (DST).
    const fechaLimite = finDelDia(sumarDias(base, dias));
    const apertura = inicioDelDia(sumarDias(base, dias - VENTANA_DIAS));
    const registro = store.seguimientos.find(
      (s) => s.solicitud_id === solicitud.id && s.hito_control === hito_control
    );
    let estadoUI;
    if (registro && registro.estado_cumplimiento === CUMPLIMIENTO.ALERTA) estadoUI = ESTADO_HITO_UI.INCUMPLIMIENTO;
    else if (registro) estadoUI = ESTADO_HITO_UI.AL_DIA;
    else if (ahora > fechaLimite) estadoUI = ESTADO_HITO_UI.VENCIDO;
    else estadoUI = ESTADO_HITO_UI.PENDIENTE;
    const diasRestantes = diferenciaDias(ahora, fechaLimite);
    // El cumplimiento se mide con la fecha del seguimiento elegida: después del plazo = "Extemporáneo".
    const reportadoTarde = !!registro && registro.estado_cumplimiento === CUMPLIMIENTO.AL_DIA &&
      fechaSeguimientoDe(registro) > fechaLimite;
    return {
      hito_control, dias, fechaLimite, apertura, registro, estadoUI, diasRestantes, reportadoTarde,
      ventanaAbierta: ahora >= apertura
    };
  });
}

// Próximo seguimiento: el primer hito sin registro (vencido o pendiente).
const proximoHito = (hitos) => hitos.find((h) => !h.registro) || null;

// Hito al que se puede vincular un reporte ahora mismo.
// fechaRef: fecha del seguimiento elegida (por defecto, ahora); la ventana se evalúa en esa fecha.
function hitoElegible(solicitud, ahora = Date.now(), fechaRef = ahora) {
  const h = proximoHito(calcularHitos(solicitud, ahora));
  if (!h) return null;
  const ref = Math.min(fechaRef, ahora);
  return { hito: h, habilitado: ref >= h.apertura, abreEl: h.apertura, fueraDePlazo: inicioDelDia(ref) > h.fechaLimite };
}

// Valor inicial del interruptor "Contar como hito": activo si hay hito abierto, salvo urgencias
// y reportes médicos (suelen ser eventos puntuales, no el control del hito).
function contarHitoPorDefecto(elegible, tipo) {
  return !!(elegible && elegible.habilitado) && tipo !== 'urgencia' && tipo !== 'medico';
}

// El adoptante puede enviar un reporte EN CUALQUIER MOMENTO. Si lo marca como hito y hay un hito
// abierto (ventana de 5 días antes del plazo, o vencido), cuenta para el cumplimiento 15/30/90.
function registrarSeguimiento(rol, solicitudId, datos, nombreUsuario, ahora = Date.now()) {
  if (rol !== 'ciudadano') return { ok: false, error: 'Solo el adoptante registra el seguimiento.' };
  const solicitud = buscarSolicitud(solicitudId);
  if (!esSolicitudPropia(solicitud, nombreUsuario)) {
    return { ok: false, error: 'Solo el adoptante de esta solicitud puede registrar su seguimiento.' };
  }
  if (solicitud.estado_solicitud !== ESTADO_SOLICITUD.APROBADA) {
    return { ok: false, error: 'La adopción no está aprobada.' };
  }
  const d = datos || {};
  if (!buscarTipoReporte(d.tipo)) return { ok: false, campo: 'tipo', error: 'Elige el tipo de seguimiento.' };
  if ((d.texto || '').trim().length < 15) {
    return { ok: false, campo: 'texto', error: 'Describe cómo está el animal en al menos 15 caracteres.' };
  }
  // Fecha del seguimiento: hoy por defecto; puede ser anterior (no futura ni previa a la aprobación).
  const fechaSeg = d.fechaSeguimiento === undefined || d.fechaSeguimiento === null ? ahora : d.fechaSeguimiento;
  if (!fechaSeguimientoValida(fechaSeg, solicitud, ahora)) {
    return { ok: false, campo: 'fecha', error: 'Elige una fecha entre la aprobación de la adopción y hoy.' };
  }
  // Si se elige un día anterior se guarda a las 12:00 locales (evita saltos de día por zona u horario).
  const fechaSegMs = diferenciaDias(fechaSeg, ahora) > 0 ? new Date(inicioDelDia(fechaSeg)).setHours(12, 0, 0, 0) : ahora;
  let hitoControl = null;
  if (d.contarComoHito) {
    const el = hitoElegible(solicitud, ahora, fechaSegMs);
    if (!el || !el.habilitado) {
      return { ok: false, campo: 'hito', error: 'No hay un hito de seguimiento abierto en la fecha elegida.' };
    }
    if (!d.fotoUri) {
      return {
        ok: false,
        campo: 'foto',
        error: 'Para que cuente como hito, adjunta una foto reciente del animal o desactiva "Contar como hito".'
      };
    }
    hitoControl = el.hito.hito_control;
  }
  const registro = {
    id: crearId('seg'),
    solicitud_id: solicitudId,
    tipo_reporte: d.tipo,
    hito_control: hitoControl,
    estado_animal: d.texto.trim(),
    foto_seguimiento_path: d.fotoUri || null, // URI local ya sin EXIF
    estado_cumplimiento: hitoControl ? CUMPLIMIENTO.AL_DIA : null,
    observacion_albergue: '',
    fecha_registro: new Date(ahora).toISOString(), // momento real del envío
    fecha_seguimiento: new Date(fechaSegMs).toISOString(), // fecha elegida (campo extra frente a schema.sql)
    autor: 'adoptante',
    leido_albergue: false
  };
  store.seguimientos.push(registro);
  return { ok: true, registro, hito_control: hitoControl, extemporaneo: esExtemporaneo(registro) };
}

function guardarObservacionAlbergue(rol, registroId, texto) {
  if (rol !== 'albergue') return { ok: false, error: 'Solo el rol Albergue puede agregar observaciones.' };
  const registro = store.seguimientos.find((s) => s.id === registroId);
  if (!registro) return { ok: false, error: 'Registro no encontrado.' };
  if (!(texto || '').trim()) return { ok: false, error: 'Escribe una observación.' };
  registro.observacion_albergue = texto.trim();
  registro.leido_albergue = true;
  return { ok: true };
}

function marcarLeido(rol, registroId) {
  if (rol !== 'albergue') return { ok: false, error: 'Solo el rol Albergue revisa los seguimientos.' };
  const registro = store.seguimientos.find((s) => s.id === registroId);
  if (!registro) return { ok: false, error: 'Registro no encontrado.' };
  registro.leido_albergue = true;
  return { ok: true };
}

function marcarIncumplimiento(rol, solicitudId, hitoControl, observacion, ahora = Date.now()) {
  if (rol !== 'albergue') return { ok: false, error: 'Solo el rol Albergue puede marcar incumplimientos.' };
  const solicitud = buscarSolicitud(solicitudId);
  const hito = calcularHitos(solicitud, ahora).find((h) => h.hito_control === hitoControl);
  if (!hito || hito.estadoUI !== ESTADO_HITO_UI.VENCIDO) {
    return { ok: false, error: 'Solo se puede marcar incumplimiento en un hito vencido sin registro.' };
  }
  store.seguimientos.push({
    id: crearId('seg'),
    solicitud_id: solicitudId,
    tipo_reporte: null,
    hito_control: hitoControl,
    estado_animal: 'Sin reporte del adoptante dentro del plazo.',
    foto_seguimiento_path: null,
    estado_cumplimiento: CUMPLIMIENTO.ALERTA,
    observacion_albergue: (observacion || '').trim() || 'Incumplimiento de seguimiento registrado por el albergue.',
    fecha_registro: new Date(ahora).toISOString(),
    autor: 'albergue',
    leido_albergue: true
  });
  return { ok: true };
}

// ---------- Calendario ----------
function claveDia(valor) {
  const d = new Date(valor);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Matriz fija de 6 semanas (lunes a domingo) para el mes indicado.
function construirMes(anio, mes) {
  const desfase = (new Date(anio, mes, 1).getDay() + 6) % 7; // lunes = 0
  const semanas = [];
  for (let s = 0; s < 6; s += 1) {
    const semana = [];
    for (let d = 0; d < 7; d += 1) {
      const fecha = new Date(anio, mes, 1 - desfase + s * 7 + d);
      semana.push({ clave: claveDia(fecha), dia: fecha.getDate(), enMes: fecha.getMonth() === mes, ms: fecha.getTime() });
    }
    semanas.push(semana);
  }
  return semanas;
}
function moverMes(cursor, delta) {
  const f = new Date(cursor.anio, cursor.mes + delta, 1);
  return { anio: f.getFullYear(), mes: f.getMonth() };
}
function eventosCalendario(solicitud, ahora = Date.now()) {
  const mapa = {};
  const agregar = (clave, ev) => {
    if (!mapa[clave]) mapa[clave] = [];
    mapa[clave].push(ev);
  };
  if (!solicitud || !solicitud.fecha_aprobacion) return mapa;
  agregar(claveDia(solicitud.fecha_aprobacion), { tipo: 'inicio' });
  calcularHitos(solicitud, ahora).forEach((h) => agregar(claveDia(h.fechaLimite), { tipo: 'hito', hito: h }));
  reportesDeSolicitud(solicitud.id)
    .filter((r) => r.autor === 'adoptante')
    .forEach((r) => agregar(claveDia(fechaSeguimientoDe(r)), { tipo: 'reporte', reporte: r, extemporaneo: esExtemporaneo(r) }));
  return mapa;
}
function textoCuentaRegresiva(h) {
  if (h.estadoUI === ESTADO_HITO_UI.VENCIDO) {
    const n = Math.max(1, -h.diasRestantes);
    return n === 1 ? 'Venció ayer' : `Venció hace ${n} días`;
  }
  if (h.diasRestantes <= 0) return 'Es hoy';
  if (h.diasRestantes === 1) return 'Mañana';
  return `Faltan ${h.diasRestantes} días`;
}
// Etiqueta corta del estado del hito (mosaicos y chips): "Extemporáneo" si la fecha del seguimiento es posterior al plazo.
function textoEstadoCorto(h) {
  if (h.estadoUI === ESTADO_HITO_UI.VENCIDO) return 'Vencido';
  if (h.estadoUI === ESTADO_HITO_UI.INCUMPLIMIENTO) return 'Incumplido';
  if (h.estadoUI === ESTADO_HITO_UI.AL_DIA && h.reportadoTarde) return 'Extemporáneo';
  return h.estadoUI;
}

// ============================================================================
// 4. RUTA DE APRENDIZAJE (contenido verificado del texto oficial de las leyes)
// ============================================================================
const UNIDADES = [
  {
    id: 'u1', titulo: 'Los animales sienten', categoria: 'Marco legal', norma: 'Ley 1774 de 2016',
    icono: 'heart-pulse', minutos: 4,
    insignia: { nombre: 'Guardián sintiente', icono: 'heart-pulse' },
    diapositivas: [
      {
        icono: 'scale-balance', etiqueta: 'Concepto clave', titulo: 'No son cosas',
        texto: 'En Colombia los animales no son cosas: son seres sintientes y reciben especial protección contra el sufrimiento y el dolor.',
        cita: 'Los animales como seres sintientes no son cosas, recibirán especial protección contra el sufrimiento y el dolor.',
        fuente: 'Ley 1774 de 2016, art. 1'
      },
      {
        icono: 'book-open-variant', etiqueta: 'Código Civil', titulo: 'Un cambio en la ley civil',
        texto: 'La Ley 1774 modificó el artículo 655 del Código Civil para reconocer la calidad de seres sintientes de los animales.',
        fuente: 'Ley 1774 de 2016, art. 2'
      },
      {
        icono: 'hand-heart', etiqueta: 'Principio', titulo: 'Protección al animal',
        texto: 'Proteger a los animales implica respeto, solidaridad, compasión, ética, justicia, cuidado, prevención del sufrimiento y erradicación del cautiverio y el abandono.',
        fuente: 'Ley 1774 de 2016, art. 3, lit. a'
      },
      {
        icono: 'shield-check-outline', etiqueta: 'Bienestar animal', titulo: 'Las cinco libertades',
        texto: 'Quien es responsable o tenedor de un animal debe asegurarle, como mínimo:',
        lista: [
          'Que no sufra hambre ni sed.',
          'Que no sufra injustificadamente malestar físico ni dolor.',
          'Que no le sean provocadas enfermedades por negligencia o descuido.',
          'Que no sea sometido a condiciones de miedo ni estrés.',
          'Que pueda manifestar su comportamiento natural.'
        ],
        fuente: 'Ley 1774 de 2016, art. 3, lit. b'
      },
      {
        icono: 'account-group-outline', etiqueta: 'Principio', titulo: 'Solidaridad social',
        texto: 'El Estado, la sociedad y sus miembros deben asistir y proteger a los animales, y denunciar a los infractores de las conductas señaladas de los que se tenga conocimiento.',
        fuente: 'Ley 1774 de 2016, art. 3, lit. c'
      }
    ],
    quiz: [
      {
        id: 'u1q1', pregunta: 'Según la Ley 1774 de 2016, los animales son…',
        opciones: ['Cosas muebles', 'Seres sintientes', 'Propiedad sin protección'], correcta: 1,
        explicacion: 'El art. 1 establece que los animales, como seres sintientes, no son cosas y reciben especial protección contra el sufrimiento y el dolor.'
      },
      {
        id: 'u1q2', pregunta: '¿Cuál NO es una de las cinco libertades?',
        opciones: ['No sufrir hambre ni sed', 'Ser libre de usar collar', 'Poder manifestar su comportamiento natural'], correcta: 1,
        explicacion: 'Las cinco libertades (art. 3, lit. b) son: no sufrir hambre ni sed; no sufrir injustificadamente malestar físico ni dolor; no padecer enfermedades por negligencia; no vivir con miedo ni estrés; y poder manifestar su comportamiento natural.'
      },
      {
        id: 'u1q3', pregunta: 'Según el principio de solidaridad social, la sociedad y sus miembros deben…',
        opciones: ['Asistir y proteger a los animales y denunciar a los infractores', 'Dejar la protección solo en manos del Estado', 'Intervenir solo si el animal es propio'], correcta: 0,
        explicacion: 'El art. 3, lit. c, pide al Estado, a la sociedad y a sus miembros asistir y proteger a los animales y denunciar a los infractores que conozcan.'
      }
    ]
  },
  {
    id: 'u2', titulo: 'Tus deberes como cuidador', categoria: 'Tenencia responsable', norma: 'Ley 84 de 1989 y Ley 2054 de 2020',
    icono: 'home-heart', minutos: 5,
    insignia: { nombre: 'Cuidador responsable', icono: 'home-heart' },
    diapositivas: [
      {
        icono: 'hand-back-right-outline', etiqueta: 'Deber de todos', titulo: 'Respetar y denunciar',
        texto: 'Toda persona debe respetar a los animales y abstenerse de causarles daño o lesión, y denunciar todo acto de crueldad cometido por terceros que conozca.',
        fuente: 'Ley 84 de 1989, art. 4'
      },
      {
        icono: 'home-outline', etiqueta: 'Deber del cuidador', titulo: 'Un espacio adecuado',
        texto: 'El propietario, tenedor o poseedor debe darle condiciones locativas apropiadas de movilidad, luz, aire, aseo e higiene.',
        fuente: 'Ley 84 de 1989, art. 5, lit. a'
      },
      {
        icono: 'food-variant', etiqueta: 'Deber del cuidador', titulo: 'Alimento, agua y salud',
        texto: 'Debe darle bebida y alimento suficientes en cantidad y calidad, así como medicinas y los cuidados necesarios para su salud.',
        fuente: 'Ley 84 de 1989, art. 5, lit. b'
      },
      {
        icono: 'umbrella-outline', etiqueta: 'Deber del cuidador', titulo: 'Abrigo contra la intemperie',
        texto: 'Debe darle abrigo apropiado contra la intemperie cuando la especie y el clima lo requieran. Si el animal doméstico vive en confinamiento, estas condiciones deben ser especialmente rigurosas.',
        fuente: 'Ley 84 de 1989, art. 5, lit. c y parágrafo'
      },
      {
        icono: 'hand-extended-outline', etiqueta: 'Si ya no puedes', titulo: 'Nunca abandonarlo',
        texto: 'Si no puedes mantener a tu animal, debes entregarlo al Alcalde o al Inspector de Policía. Abandonarlo no es una opción.',
        fuente: 'Ley 84 de 1989, art. 14'
      },
      {
        icono: 'dog-side', etiqueta: 'Espacio público', titulo: 'Traílla y convivencia',
        texto: 'Los perros deben ir con traílla; los de manejo especial (antes llamados potencialmente peligrosos), además, con bozal y permiso. No se puede prohibir el tránsito ni la permanencia de mascotas en las zonas comunes de los conjuntos residenciales.',
        fuente: 'Ley 2054 de 2020, art. 10 (nuevo art. 117 de la Ley 1801)'
      }
    ],
    quiz: [
      {
        id: 'u2q1', pregunta: 'Si no puedes mantener a tu mascota, debes…',
        opciones: ['Soltarla en un parque', 'Dejarla en un lote', 'Entregarla al Alcalde, al Inspector de Policía o a un albergue'], correcta: 2,
        explicacion: 'La Ley 84 de 1989 (art. 14) indica entregarla al Alcalde o al Inspector de Policía; también puedes acudir a un albergue. Abandonarla es un acto de crueldad.'
      },
      {
        id: 'u2q2', pregunta: 'En el espacio público, los perros deben ir…',
        opciones: ['Sueltos, si son tranquilos', 'Con traílla; los de manejo especial, además con bozal y permiso', 'Solo con bozal, sin importar la raza'], correcta: 1,
        explicacion: 'La Ley 2054 de 2020 (art. 10) exige traílla para los perros y, para los de manejo especial, también bozal y permiso.'
      },
      {
        id: 'u2q3', pregunta: '¿Puede un conjunto residencial prohibir el tránsito de mascotas por las zonas comunes?',
        opciones: ['Sí, si lo decide la administración', 'No, la ley no lo permite', 'Solo para gatos'], correcta: 1,
        explicacion: 'La Ley 2054 de 2020 (art. 10) establece que no se puede prohibir el tránsito ni la permanencia de mascotas en las zonas comunes de los conjuntos residenciales.'
      }
    ]
  },
  {
    id: 'u3', titulo: '¿Qué es maltrato?', categoria: 'Marco legal', norma: 'Ley 84 de 1989 y Ley 2455 de 2025',
    icono: 'eye-check-outline', minutos: 5,
    insignia: { nombre: 'Ojo atento', icono: 'eye-check-outline' },
    diapositivas: [
      {
        icono: 'alert-circle-outline', etiqueta: 'Actos de crueldad', titulo: 'La ley los enumera',
        texto: 'El artículo 6 de la Ley 84 de 1989 describe los actos de crueldad contra los animales. En esta unidad verás los más relevantes para perros y gatos.',
        fuente: 'Ley 84 de 1989, art. 6'
      },
      {
        icono: 'bandage', etiqueta: 'Daño directo', titulo: 'Herir, lastimar o matar',
        lista: [
          'Herir o lesionar por golpe, quemadura, cortada, punzada o arma de fuego (lit. a).',
          'Causar la muerte innecesaria o daño grave por motivo abyecto o fútil (lit. b).',
          'Lastimar o arrollar un animal intencionalmente o matarlo por simple perversidad (lit. y).'
        ],
        fuente: 'Ley 84 de 1989, art. 6'
      },
      {
        icono: 'food-off-outline', etiqueta: 'Negligencia', titulo: 'Privarlo de lo esencial',
        lista: [
          'Privarlo de aire, luz, alimento, movimiento, espacio, abrigo, higiene o aseo, causándole daño grave o muerte (lit. j).',
          'Confinarlo en condiciones que le produzcan asfixia (lit. q).',
          'Ahogar a un animal (lit. r).'
        ],
        fuente: 'Ley 84 de 1989, art. 6'
      },
      {
        icono: 'bottle-tonic-skull-outline', etiqueta: 'Veneno', titulo: 'Envenenar o dejar veneno a su alcance',
        lista: [
          'Dejar sustancias venenosas en lugares accesibles a animales (lit. l).',
          'Envenenar o intoxicar a un animal (lit. o).'
        ],
        fuente: 'Ley 84 de 1989, art. 6'
      },
      {
        icono: 'drama-masks', etiqueta: 'Espectáculos', titulo: 'Peleas y espectáculos',
        lista: [
          'Enfrentar animales para que peleen como espectáculo (lit. e).',
          'Convertir en espectáculo el maltrato, la tortura o la muerte de animales (lit. f).'
        ],
        fuente: 'Ley 84 de 1989, art. 6'
      },
      {
        icono: 'road-variant', etiqueta: 'Abandono', titulo: 'Abandonar también es maltrato',
        texto: 'Es crueldad abandonar a su suerte a un animal doméstico en vejez, enfermedad, invalidez o incapacidad de procurarse la subsistencia (lit. v). La Ley Ángel agregó un nuevo literal:',
        cita: 'Abandonar a un animal doméstico o domesticado, cuando sea de su propiedad o custodia.',
        dato: 'En el diagnóstico de AnimalGuard, lo más visto por los encuestados fue el abandono en vía pública (60 %) y la negligencia (33,3 %).',
        fuente: 'Ley 84 de 1989, art. 6, lit. v; Ley 2455 de 2025, art. 27 (literal Z.1)'
      }
    ],
    quiz: [
      {
        id: 'u3q1', pregunta: 'Abandonar a tu perro en la calle…',
        opciones: ['Está permitido si no puedes mantenerlo', 'Es un acto de crueldad', 'Solo es falta si está enfermo'], correcta: 1,
        explicacion: 'La Ley 2455 de 2025 (art. 27) agregó como acto de crueldad abandonar a un animal doméstico o domesticado que sea de tu propiedad o custodia.'
      },
      {
        id: 'u3q2', pregunta: 'Privar a un animal de alimento, abrigo o higiene causándole daño grave es…',
        opciones: ['Un acto de crueldad', 'Una falta sin consecuencias', 'Permitido si el animal es tuyo'], correcta: 0,
        explicacion: 'Está descrito como acto de crueldad en la Ley 84 de 1989, art. 6, lit. j.'
      },
      {
        id: 'u3q3', pregunta: 'Dejar sustancias venenosas en lugares accesibles a animales…',
        opciones: ['Es legal en zonas privadas', 'Es un acto de crueldad', 'Solo es falta si un animal muere'], correcta: 1,
        explicacion: 'La Ley 84 de 1989 (art. 6, lit. l) lo considera un acto de crueldad; envenenar o intoxicar a un animal también lo es (lit. o).'
      }
    ]
  },
  {
    id: 'u4', titulo: 'Consecuencias: Ley Ángel', categoria: 'Marco legal', norma: 'Ley 2455 de 2025',
    icono: 'gavel', minutos: 6,
    insignia: { nombre: 'Conocedor de la Ley Ángel', icono: 'gavel' },
    diapositivas: [
      {
        icono: 'gavel', etiqueta: 'Objeto de la ley', titulo: '¿Qué busca la Ley Ángel?',
        texto: 'Fortalecer la lucha contra el maltrato animal con prevención, investigación y sanción en procesos penales y policivos. También actualiza la Ley 84 de 1989 y subrogó los artículos 339A y 339B del Código Penal que había creado la Ley 1774, por lo que esas penas fueron reemplazadas.',
        fuente: 'Ley 2455 de 2025, arts. 1, 5 y 6'
      },
      {
        icono: 'scale-balance', etiqueta: 'Delito', titulo: 'Muerte al animal',
        lista: [
          'Prisión de 32 a 56 meses.',
          'Inhabilidad especial de 2 a 5 años para profesión u oficio con animales.',
          'Prohibición de adquirir, tener, cuidar o albergar animales.',
          'Multa de 30 a 60 SMLMV.'
        ],
        fuente: 'Ley 2455 de 2025, art. 5 (nuevo art. 339A del Código Penal)'
      },
      {
        icono: 'medical-bag', etiqueta: 'Delito', titulo: 'Lesiones graves',
        texto: 'Lesiones que menoscaben gravemente la salud o integridad del animal:',
        lista: [
          'Prisión de 20 a 42 meses.',
          'Inhabilidad de 1 a 3 años.',
          'Prohibición de tenencia de animales.',
          'Multa de 15 a 30 SMLMV.'
        ],
        fuente: 'Ley 2455 de 2025, art. 7 (nuevo art. 339C del Código Penal)'
      },
      {
        icono: 'arrow-up-bold-circle-outline', etiqueta: 'Agravantes', titulo: 'Cuándo aumenta la pena',
        texto: 'La pena aumenta de la mitad a tres cuartas partes si:',
        lista: [
          'Hay sevicia.',
          'Ocurre en vía o sitio público.',
          'Se usan menores o inimputables, o se comete en su presencia.',
          'Hay actos sexuales con animales.',
          'Lo comete un servidor público.',
          'Se graba, difunde o promueve en redes o medios.',
          'Hay fines de explotación económica.',
          'Deja daño permanente o mutilaciones.',
          'Es represalia o venganza contra el dueño.',
          'Se usan venenos contra muchos animales.',
          'Causa ataques a otros animales o personas, o transmite enfermedades.'
        ],
        fuente: 'Ley 2455 de 2025, art. 6 (nuevo art. 339B del Código Penal)'
      },
      {
        icono: 'account-cancel-outline', etiqueta: 'Inhabilidad', titulo: 'Sin derecho a tener animales',
        texto: 'Quien sea condenado no puede adquirir, tener, cuidar ni refugiar animales por ningún título: compra, donación, adopción o herencia. La inhabilidad dura el doble del tiempo de la pena principal. La Policía Nacional lleva una base de datos de inhabilitados y el certificado de antecedentes tendrá una sección reservada de "Inhabilidades impuestas por delitos contra los animales".',
        fuente: 'Ley 2455 de 2025, arts. 3, 4 y 28'
      },
      {
        icono: 'clipboard-alert-outline', etiqueta: 'Contravención', titulo: 'Maltrato leve',
        texto: 'Lo conocen los inspectores de policía en primera instancia y los alcaldes en segunda. Las multas van de 5 a 50 SMMLV. Si aceptas la conducta, puedes pagar el 50 % de la multa dentro de 5 días asistiendo al Curso de Sensibilización contra el Maltrato Animal de la alcaldía (no aplica a reincidentes).',
        fuente: 'Ley 2455 de 2025, arts. 8 y 9; Ley 1774 de 2016, art. 4'
      }
    ],
    quiz: [
      {
        id: 'u4q1', pregunta: 'Si alguien graba y publica en redes un acto de maltrato para promoverlo…',
        opciones: ['No pasa nada', 'Es libertad de expresión', 'La pena aumenta'], correcta: 2,
        explicacion: 'Es un agravante (Ley 2455, art. 6, lit. f): la pena aumenta de la mitad a tres cuartas partes cuando el maltrato se graba, difunde o promueve en redes o medios.'
      },
      {
        id: 'u4q2', pregunta: '¿Qué pena de prisión fija la Ley 2455 de 2025 para el delito de muerte al animal?',
        opciones: ['De 5 a 10 años', 'De 32 a 56 meses', 'No hay prisión, solo multa'], correcta: 1,
        explicacion: 'El nuevo art. 339A del Código Penal (Ley 2455, art. 5) fija prisión de 32 a 56 meses.'
      },
      {
        id: 'u4q3', pregunta: 'En una contravención por maltrato leve, si aceptas la conducta puedes…',
        opciones: ['Pagar el 50 % de la multa en 5 días asistiendo al Curso de Sensibilización', 'Evitar cualquier sanción', 'Pagar la multa en 5 años'], correcta: 0,
        explicacion: 'La Ley 2455 de 2025 (art. 8) permite pagar el 50 % de la multa dentro de 5 días asistiendo al Curso de Sensibilización contra el Maltrato Animal. No aplica a reincidentes.'
      }
    ]
  },
  {
    id: 'u5', titulo: 'Adopción responsable', categoria: 'Tenencia responsable', norma: 'Ley 2054 de 2020 y Ley 2455 de 2025',
    icono: 'paw', minutos: 5,
    insignia: { nombre: 'Adoptante informado', icono: 'paw' },
    diapositivas: [
      {
        icono: 'hand-heart-outline', etiqueta: 'Objeto de la ley', titulo: 'Menos abandono',
        texto: 'La Ley 2054 de 2020 busca atenuar las consecuencias del abandono, la pérdida y la tenencia irresponsable, apoyando a refugios y fundaciones que rescatan, esterilizan y entregan animales en adopción.',
        fuente: 'Ley 2054 de 2020, art. 1'
      },
      {
        icono: 'home-city-outline', etiqueta: 'Albergues', titulo: 'Un lugar en cada municipio',
        texto: 'Cada municipio o distrito debe tener un centro de bienestar animal, albergue municipal para fauna u hogar de paso. Si en 30 días calendario nadie reclama al animal, se declara en abandono y se promueve su adopción. El antiguo "coso municipal" pasa a llamarse "albergue municipal para fauna".',
        fuente: 'Ley 2054 de 2020, arts. 2 (nuevo art. 119 de la Ley 1801) y 9'
      },
      {
        icono: 'calendar-check-outline', etiqueta: 'Deber del municipio', titulo: 'Salud y jornadas',
        texto: 'Los municipios deben garantizar atención veterinaria a los animales a su cuidado. Mientras no haya un centro público, deben apoyar a refugios y fundaciones con aportes en especie, hacer al menos una jornada de adopción cada trimestre y una de esterilización cada dos meses. Esos lugares deben garantizar las cinco libertades.',
        fuente: 'Ley 2054 de 2020, arts. 3 y 4'
      },
      {
        icono: 'account-cancel-outline', etiqueta: 'Filtro de adopción', titulo: 'Quien maltrata no puede adoptar',
        texto: 'La persona condenada por delitos contra los animales queda inhabilitada para adquirir, tener, cuidar o refugiar animales, incluso por adopción, durante el doble del tiempo de la pena principal. Por eso la postulación en AnimalGuard exige una declaración juramentada. Además, si el dueño de un animal aprehendido no paga los gastos de custodia en 15 días, la entidad puede entregarlo en adopción.',
        fuente: 'Ley 2455 de 2025, arts. 3, 4 y 10, parágrafo 1'
      },
      {
        icono: 'clipboard-check-outline', etiqueta: 'En AnimalGuard', titulo: 'Antes de adoptar',
        lista: [
          'Ser mayor de edad.',
          'Vivir en Bogotá D.C. o Soacha.',
          'Tener vivienda adecuada.',
          'Contar con tiempo y recursos para el veterinario.',
          'Comprometerte con la tenencia responsable.',
          'Declarar que no tienes sanciones por maltrato.',
          'Aceptar el seguimiento a los 15, 30 y 90 días.'
        ],
        fuente: 'Documento Maestro AnimalGuard (RF04)'
      }
    ],
    quiz: [
      {
        id: 'u5q1', pregunta: 'Una persona condenada por maltrato animal…',
        opciones: ['Puede adoptar después de un año', 'No puede adoptar ni tener animales por el doble del tiempo de su pena', 'Solo paga una multa'], correcta: 1,
        explicacion: 'La Ley 2455 de 2025 (arts. 3 y 4) la inhabilita para adquirir, tener, cuidar o refugiar animales, incluida la adopción, durante el doble del tiempo de la pena principal.'
      },
      {
        id: 'u5q2', pregunta: 'Si en 30 días calendario nadie reclama a un animal recogido por el municipio…',
        opciones: ['Se declara en abandono y se promueve su adopción', 'Debe ser sacrificado', 'Se devuelve a la calle'], correcta: 0,
        explicacion: 'La Ley 2054 de 2020 (art. 2) establece que se declara en abandono y se promueve su adopción.'
      },
      {
        id: 'u5q3', pregunta: 'Mientras no haya un centro público, ¿cada cuánto debe el municipio hacer una jornada de adopción?',
        opciones: ['Una vez al año', 'Al menos una cada trimestre', 'Solo cuando haya presupuesto'], correcta: 1,
        explicacion: 'La Ley 2054 de 2020 (art. 4) pide al menos una jornada de adopción cada trimestre y una de esterilización cada dos meses.'
      }
    ]
  },
  {
    id: 'u6', titulo: 'Cómo y dónde denunciar', categoria: 'Rutas de atención', norma: 'Ley 2455 de 2025, arts. 10 y 24',
    icono: 'bullhorn-outline', minutos: 6,
    insignia: { nombre: 'Voz que denuncia', icono: 'bullhorn-outline' },
    diapositivas: [
      {
        icono: 'timer-outline', etiqueta: 'Plazo', titulo: 'Atención en 24 horas',
        cita: 'Toda queja deberá ser atendida como máximo en las siguientes veinticuatro (24) horas.',
        texto: 'La Policía y los inspectores pueden aprehender preventivamente al animal sin orden previa.',
        fuente: 'Ley 2455 de 2025, art. 10 (sustituye el art. 46A de la Ley 84)'
      },
      {
        icono: 'map-marker-path', etiqueta: 'En construcción', titulo: 'Una ruta nacional',
        texto: 'El SINAPYBA, con la Policía y la Fiscalía, expedirá la Ruta de Atención al Maltrato Animal, con un canal confidencial que acepte quejas anónimas.',
        fuente: 'Ley 2455 de 2025, art. 24'
      },
      {
        icono: 'city-variant-outline', etiqueta: 'Bogotá D.C.', titulo: 'Canales del IDPYBA',
        lista: [
          'Emergencia (vida del animal en riesgo): Línea 123, las 24 horas.',
          'Línea del IDPYBA: (601) 439 9801 (actualizada en 2025). Si no responde: 01 8000 115 161.',
          'Correo: proteccionanimal@animalesbog.gov.co',
          'Bogotá Te Escucha (bogota.gov.co/sdqs): permite adjuntar fotos y videos y denunciar de forma anónima.',
          'Presencial: Carrera 10 No. 26-51, Edificio Residencias Tequendama, Torre Sur, piso 5.'
        ],
        texto: 'Después, el Escuadrón Anticrueldad (veterinarios) visita el lugar con la Policía, emite un concepto técnico y clasifica el caso (leve, media o alta); si hay delito, lo traslada a la Inspección de Policía o a la Fiscalía.',
        textoDespues: true,
        fuente: 'bogota.gov.co (2023 y 2026)'
      },
      {
        icono: 'map-marker-radius-outline', etiqueta: 'Soacha', titulo: 'Canales en Soacha',
        lista: [
          'Dependencia: Secretaría de Ambiente, Minas, Desarrollo Rural y Protección Animal.',
          'Emergencia: Línea 123 / Policía. Actúa con el Grupo de Carabineros y Protección Ambiental de la Policía Metropolitana de Soacha.',
          'Maltrato leve: Inspección de Policía del municipio.',
          'Consulta los medios de contacto vigentes en alcaldiasoacha.gov.co.'
        ],
        fuente: 'alcaldiasoacha.gov.co (2026)'
      },
      {
        icono: 'format-list-checks', etiqueta: 'Al denunciar', titulo: 'Qué información dar',
        lista: [
          'Dirección exacta.',
          'Descripción clara de los hechos y del estado del animal.',
          'Fotos o videos.',
          'Datos del presunto agresor, si los conoces.'
        ],
        fuente: 'bogota.gov.co (23 de marzo de 2026)'
      },
      {
        icono: 'shield-lock-outline', etiqueta: 'Consejo', titulo: 'Denuncia de forma segura',
        texto: 'Denuncia por los canales oficiales, no solo en redes sociales, para no alertar al agresor. En AnimalGuard tus fotos se limpian de metadatos y tu identidad se reserva frente a terceros (Ley 1581 de 2012). La app orienta; no reemplaza los canales oficiales.',
        fuente: 'bogota.gov.co; Ley 1581 de 2012'
      }
    ],
    quiz: [
      {
        id: 'u6q1', pregunta: '¿En cuánto tiempo debe atenderse una queja por maltrato?',
        opciones: ['24 horas', '72 horas', '15 días'], correcta: 0,
        explicacion: 'La Ley 2455 de 2025 (art. 10) ordena atender toda queja como máximo en las siguientes 24 horas.'
      },
      {
        id: 'u6q2', pregunta: 'En Bogotá, si la vida del animal corre peligro, llamas a…',
        opciones: ['Una veterinaria', 'La Línea 123', 'Nadie: esperas a mañana'], correcta: 1,
        explicacion: 'Cuando la vida del animal está en riesgo, la Línea 123 atiende las 24 horas. En Soacha también puedes llamar a la Línea 123 / Policía.'
      },
      {
        id: 'u6q3', pregunta: '¿Qué información conviene dar al denunciar?',
        opciones: ['Solo tu nombre completo', 'Dirección exacta, descripción de los hechos, fotos o videos y datos del agresor si los conoces', 'Nada: basta con publicarlo en redes'], correcta: 1,
        explicacion: 'La Alcaldía de Bogotá recomienda dar la dirección exacta, una descripción clara de los hechos y del estado del animal, fotos o videos y los datos del presunto agresor si los conoces.'
      }
    ]
  },
  {
    id: 'u7', tipo: 'practica', titulo: '¿Qué hago si…?', categoria: 'Rutas de atención', norma: 'Práctica con casos reales',
    icono: 'lightning-bolt-outline', minutos: 4,
    insignia: { nombre: 'Respuesta experta', icono: 'star-circle-outline' },
    diapositivas: [],
    escenarios: [
      {
        id: 'e1', icono: 'dog-side', situacion: 'Ves a alguien golpeando a un perro en el parque.',
        opciones: [
          'Enfrentar al agresor tú mismo para detenerlo, sin llamar a nadie ni dejar registro',
          'Llamar al 123, documentar sin exponerte, anotar la dirección exacta y registrarlo en AnimalGuard',
          'Grabar un video y publicarlo solo en redes sociales para que otros identifiquen al agresor'
        ],
        correcta: 1,
        explicacion: 'Llama al 123 (Bogotá o Soacha), documenta sin ponerte en riesgo y usa los canales oficiales. Publicarlo solo en redes puede alertar al agresor.'
      },
      {
        id: 'e2', icono: 'water-off-outline', situacion: 'Un vecino deja a su perro sin agua ni comida varios días.',
        opciones: [
          'No intervenir, porque lo que pase con el perro del vecino no es asunto tuyo ni de nadie más',
          'Esperar a que el animal se enferme o empeore para tener más pruebas antes de avisar a alguien',
          'Reportarlo: en Bogotá al IDPYBA o en Bogotá Te Escucha; en Soacha a la Inspección de Policía o a la Secretaría de Ambiente'
        ],
        correcta: 2,
        explicacion: 'Privarlo de alimento y agua causándole daño grave es un acto de crueldad (Ley 84, art. 6, lit. j). Repórtalo por los canales oficiales de tu municipio.'
      },
      {
        id: 'e3', icono: 'cat', situacion: 'Encuentras un gato abandonado.',
        opciones: [
          'Llevarlo a un albergue o fundación, o avisar a la alcaldía de tu municipio',
          'Dejarlo donde está, porque seguro encontrará solo el camino de regreso',
          'Llevarlo lejos y soltarlo en otro barrio para que alguien más lo recoja'
        ],
        correcta: 0,
        explicacion: 'Llévalo a un albergue o fundación, o avisa a la alcaldía. Si en 30 días calendario nadie lo reclama, puede darse en adopción (Ley 2054, art. 2).'
      },
      {
        id: 'e4', icono: 'home-heart', situacion: 'Quieres adoptar un perro o un gato.',
        opciones: [
          'Ir al albergue y llevarte el animal ese mismo día, sin postularte ni firmar ninguna declaración',
          'Revisar la galería de AnimalGuard, postularte con tu declaración juramentada y prepararte para el seguimiento a los 15, 30 y 90 días',
          'Postularte aunque tengas una sanción por maltrato animal, porque nadie lo va a revisar'
        ],
        correcta: 1,
        explicacion: 'AnimalGuard pide una declaración juramentada por la inhabilidad de la Ley 2455 de 2025 (arts. 3 y 4), y la adopción incluye el seguimiento posadopción a los 15, 30 y 90 días.',
        irAGaleria: true
      }
    ],
    quiz: []
  }
];

// Ampliación del curso (ronda 3): diapositivas de práctica, comparación, "Mito o realidad" y resumen,
// y 2 preguntas más por unidad. Solo hechos del contenido verificado. `pos` = índice de inserción.
const AMPLIACION = {
  u1: {
    diapositivas: [
      {
        tipo: 'practica', icono: 'city-variant-outline', etiqueta: 'En la práctica', titulo: 'Un balcón en Kennedy',
        texto: 'Caso de ejemplo: un perro pasa todo el día solo en el balcón de un apartamento, al sol y sin agua.',
        lista: [
          'Se vulnera la libertad de no sufrir hambre ni sed.',
          'Se vulnera la de no sufrir injustificadamente malestar físico ni dolor.',
          'Quien lo sabe tiene un papel: el principio de solidaridad social pide asistir, proteger y denunciar.'
        ],
        fuente: 'Ley 1774 de 2016, art. 3, lits. b y c'
      },
      {
        tipo: 'mito', icono: 'help-rhombus-outline', etiqueta: 'Mito o realidad',
        afirmacion: 'Mi animal es una cosa mía: puedo hacer con él lo que quiera.', esMito: true,
        explicacion: 'Es un mito. La ley dice que los animales no son cosas y reciben especial protección contra el sufrimiento y el dolor; quien lo tiene debe asegurarle las cinco libertades.',
        fuente: 'Ley 1774 de 2016, arts. 1 y 3'
      },
      {
        tipo: 'resumen', icono: 'star-check-outline', etiqueta: 'Para recordar', titulo: 'Lo esencial de la unidad',
        lista: [
          'Los animales son seres sintientes, no cosas (art. 1).',
          'La ley modificó el art. 655 del Código Civil (art. 2).',
          'Quien tiene un animal debe asegurarle las cinco libertades (art. 3, lit. b).',
          'Todos debemos asistir, proteger y denunciar (art. 3, lit. c).'
        ],
        fuente: 'Ley 1774 de 2016'
      }
    ],
    quiz: [
      {
        id: 'u1q4', pregunta: '¿Qué artículo del Código Civil modificó la Ley 1774 para reconocer que los animales son seres sintientes?',
        opciones: ['El artículo 655', 'El artículo 339A', 'El artículo 46'], correcta: 0,
        explicacion: 'El art. 2 de la Ley 1774 de 2016 modificó el art. 655 del Código Civil. El 339A es del Código Penal y el 46 es de la Ley 84.'
      },
      {
        id: 'u1q5', pregunta: 'Un perro pasa el día al sol sin agua. ¿Qué libertad se vulnera de forma directa?',
        opciones: ['No sufrir hambre ni sed', 'Poder manifestar su comportamiento natural', 'Ninguna, si tiene dueño'], correcta: 0,
        explicacion: 'La primera de las cinco libertades es que no sufra hambre ni sed (Ley 1774, art. 3, lit. b). Tener dueño no elimina el deber: lo crea.'
      }
    ]
  },
  u2: {
    diapositivas: [
      {
        pos: 1, tipo: 'comparacion', icono: 'table-account', etiqueta: 'Compara', titulo: '¿Quién debe qué?',
        columnas: ['Toda persona (art. 4)', 'Propietario o tenedor (art. 5)'],
        filas: [
          { aspecto: 'Respeto', a: 'Respetar y no causar daño ni lesión a ningún animal', b: 'Lo mismo, y además cuidarlo' },
          { aspecto: 'Espacio', a: 'No aplica', b: 'Movilidad, luz, aire, aseo e higiene' },
          { aspecto: 'Salud', a: 'No aplica', b: 'Alimento y bebida suficientes, medicinas y cuidados' },
          { aspecto: 'Denuncia', a: 'Denunciar la crueldad de terceros que conozca', b: 'También le aplica' }
        ],
        fuente: 'Ley 84 de 1989, arts. 4 y 5'
      },
      {
        tipo: 'practica', icono: 'office-building-outline', etiqueta: 'En la práctica', titulo: 'La circular del conjunto en Soacha',
        texto: 'Caso de ejemplo: la administración de tu conjunto en Soacha publica una circular que prohíbe pasear perros por las zonas comunes.',
        lista: [
          'La ley no permite prohibir el tránsito ni la permanencia de mascotas en las zonas comunes.',
          'Tu deber: llevar a tu perro con traílla.',
          'Si es un perro de manejo especial, además con bozal y permiso.'
        ],
        fuente: 'Ley 2054 de 2020, art. 10 (nuevo art. 117 de la Ley 1801)'
      },
      {
        tipo: 'mito', icono: 'help-rhombus-outline', etiqueta: 'Mito o realidad',
        afirmacion: 'Si ya no puedo tenerlo, lo suelto en un parque: alguien lo adoptará.', esMito: true,
        explicacion: 'Es un mito. Si no puedes mantenerlo, la Ley 84 (art. 14) indica entregarlo al Alcalde o al Inspector de Policía. Abandonar a un animal doméstico de tu propiedad o custodia es un acto de crueldad (Ley 2455, art. 27).',
        fuente: 'Ley 84 de 1989, art. 14; Ley 2455 de 2025, art. 27'
      },
      {
        tipo: 'resumen', icono: 'star-check-outline', etiqueta: 'Para recordar', titulo: 'Lo esencial de la unidad',
        lista: [
          'Todos: respetar, no dañar y denunciar (Ley 84, art. 4).',
          'Cuidador: espacio, alimento, salud y abrigo (art. 5).',
          'En confinamiento, condiciones especialmente rigurosas.',
          'Si no puedes cuidarlo, entrégalo; nunca lo abandones (art. 14).',
          'Traílla siempre; zonas comunes abiertas a mascotas (Ley 2054, art. 10).'
        ],
        fuente: 'Ley 84 de 1989; Ley 2054 de 2020'
      }
    ],
    quiz: [
      {
        id: 'u2q4', pregunta: 'Los deberes de cuidado deben ser "especialmente rigurosos" cuando…',
        opciones: ['El animal doméstico vive en confinamiento', 'El animal es de raza', 'El dueño vive en Bogotá'], correcta: 0,
        explicacion: 'El parágrafo del art. 5 de la Ley 84 de 1989 pide condiciones especialmente rigurosas para animales domésticos en confinamiento.'
      },
      {
        id: 'u2q5', pregunta: 'Si sabes que otra persona comete un acto de crueldad contra un animal, la Ley 84 te pide…',
        opciones: ['No intervenir', 'Denunciarlo', 'Esperar a que el animal muera'], correcta: 1,
        explicacion: 'El art. 4 de la Ley 84 de 1989 pide a toda persona denunciar todo acto de crueldad cometido por terceros que conozca.'
      }
    ]
  },
  u3: {
    diapositivas: [
      {
        tipo: 'practica', icono: 'map-marker-alert-outline', etiqueta: 'En la práctica', titulo: 'Comida envenenada en un lote',
        texto: 'Caso de ejemplo: en un lote de Bogotá aparecen trozos de comida mezclados con veneno y varios gatos enfermos.',
        lista: [
          'Dejar sustancias venenosas al alcance de animales es crueldad (lit. l).',
          'Envenenar o intoxicar a un animal también lo es (lit. o).',
          'Usar venenos contra muchos animales es un agravante penal (Ley 2455, art. 6, lit. j).'
        ],
        fuente: 'Ley 84 de 1989, art. 6; Ley 2455 de 2025, art. 6'
      },
      {
        tipo: 'mito', icono: 'help-rhombus-outline', etiqueta: 'Mito o realidad',
        afirmacion: 'Si no hay golpes, no es maltrato.', esMito: true,
        explicacion: 'Es un mito. También es crueldad privarlo de aire, luz, alimento, movimiento, espacio, abrigo, higiene o aseo causándole daño grave o muerte (lit. j), confinarlo hasta la asfixia (lit. q) o abandonarlo (lit. v y literal Z.1).',
        fuente: 'Ley 84 de 1989, art. 6; Ley 2455 de 2025, art. 27'
      },
      {
        tipo: 'resumen', icono: 'star-check-outline', etiqueta: 'Para recordar', titulo: 'Lo esencial de la unidad',
        lista: [
          'El art. 6 de la Ley 84 enumera los actos de crueldad.',
          'Maltrato no es solo golpear: negligencia, veneno y encierro también cuentan.',
          'Peleas y espectáculos con sufrimiento animal son crueldad.',
          'Abandonar a tu animal es crueldad (Ley 2455, art. 27).'
        ],
        fuente: 'Ley 84 de 1989, art. 6; Ley 2455 de 2025, art. 27'
      }
    ],
    quiz: [
      {
        id: 'u3q4', pregunta: 'Organizar peleas entre perros como espectáculo es…',
        opciones: ['Un acto de crueldad', 'Legal si hay apuestas', 'Una tradición permitida'], correcta: 0,
        explicacion: 'Enfrentar animales para que peleen como espectáculo es un acto de crueldad (Ley 84 de 1989, art. 6, lit. e).'
      },
      {
        id: 'u3q5', pregunta: 'Encerrar a un animal en condiciones que le produzcan asfixia es…',
        opciones: ['Permitido si es por poco tiempo', 'Un acto de crueldad', 'Solo falta si muere'], correcta: 1,
        explicacion: 'Confinarlo en condiciones que le produzcan asfixia es un acto de crueldad (Ley 84 de 1989, art. 6, lit. q).'
      }
    ]
  },
  u4: {
    diapositivas: [
      {
        pos: 1, tipo: 'comparacion', icono: 'scale-unbalanced', etiqueta: 'Compara', titulo: 'Contravención o delito',
        columnas: ['Contravención', 'Delito'],
        filas: [
          { aspecto: 'Qué es', a: 'Maltrato leve', b: 'Muerte al animal (339A) o lesiones graves (339C)' },
          { aspecto: 'Proceso', a: 'Policivo: inspector de policía (1.ª instancia) y alcalde (2.ª)', b: 'Penal (Código Penal)' },
          { aspecto: 'Sanción', a: 'Multa de 5 a 50 SMMLV', b: 'Prisión, inhabilidades, prohibición de tenencia y multa' },
          { aspecto: 'Beneficio', a: 'Pagar el 50 % en 5 días con el Curso de Sensibilización (no reincidentes)', b: 'La pena puede aumentar con agravantes' }
        ],
        fuente: 'Ley 2455 de 2025, arts. 1, 5, 7, 8 y 9; Ley 1774 de 2016, art. 4'
      },
      {
        pos: 4, tipo: 'comparacion', icono: 'history', etiqueta: 'Antes y ahora', titulo: 'Ley 1774 frente a Ley 2455',
        columnas: ['Ley 1774 de 2016', 'Ley 2455 de 2025 (vigente)'],
        reemplazadaA: true,
        filas: [
          { aspecto: 'Prisión', a: '12 a 36 meses (reemplazado)', b: 'Muerte: 32 a 56 meses. Lesiones graves: 20 a 42 meses' },
          { aspecto: 'Multa', a: '5 a 60 SMMLV (reemplazado)', b: 'Muerte: 30 a 60 SMLMV. Lesiones graves: 15 a 30 SMLMV' }
        ],
        texto: 'La Ley 2455 subrogó los arts. 339A y 339B del Código Penal creados por la Ley 1774. Si encuentras los valores antiguos en algún compendio, ya no aplican.',
        fuente: 'Ley 2455 de 2025, arts. 5, 6 y 7'
      },
      {
        tipo: 'mito', icono: 'help-rhombus-outline', etiqueta: 'Mito o realidad',
        afirmacion: 'Quien es condenado por maltrato animal puede adoptar otro animal al salir de prisión.', esMito: true,
        explicacion: 'Es un mito. La inhabilidad le impide adquirir, tener, cuidar o refugiar animales por ningún título, incluida la adopción, y dura el doble del tiempo de la pena principal.',
        fuente: 'Ley 2455 de 2025, arts. 3 y 4'
      },
      {
        tipo: 'practica', icono: 'cellphone-play', etiqueta: 'En la práctica', titulo: 'Un video en redes',
        texto: 'Caso de ejemplo: en una calle de Soacha alguien lesiona gravemente a un perro, lo graba y lo publica en redes.',
        lista: [
          'Lesiones que menoscaben gravemente su salud: delito del nuevo art. 339C.',
          'Ocurrió en vía pública: agravante (lit. b).',
          'Se grabó y difundió en redes: agravante (lit. f).',
          'Con agravantes, la pena aumenta de la mitad a tres cuartas partes.'
        ],
        fuente: 'Ley 2455 de 2025, arts. 6 y 7'
      },
      {
        tipo: 'resumen', icono: 'star-check-outline', etiqueta: 'Para recordar', titulo: 'Lo esencial de la unidad',
        lista: [
          'Muerte al animal: 32 a 56 meses de prisión y multa de 30 a 60 SMLMV.',
          'Lesiones graves: 20 a 42 meses y multa de 15 a 30 SMLMV.',
          'Las penas de la Ley 1774 fueron reemplazadas.',
          'El condenado queda inhabilitado para tener animales el doble de la pena.',
          'Maltrato leve: contravención con multa de 5 a 50 SMMLV.'
        ],
        fuente: 'Ley 2455 de 2025; Ley 1774 de 2016, art. 4'
      }
    ],
    quiz: [
      {
        id: 'u4q4', pregunta: '¿Quién conoce en primera instancia una contravención por maltrato leve?',
        opciones: ['Los inspectores de policía', 'La Corte Constitucional', 'El albergue'], correcta: 0,
        explicacion: 'La conocen los inspectores de policía en primera instancia y los alcaldes en segunda (Ley 2455 de 2025, art. 9).'
      },
      {
        id: 'u4q5', pregunta: '¿Qué sección reservada tendrá el certificado de antecedentes?',
        opciones: ['Inhabilidades impuestas por delitos contra los animales', 'Mascotas registradas', 'Multas de tránsito'], correcta: 0,
        explicacion: 'La Ley 2455 de 2025 (art. 28) crea esa sección y una base de datos de inhabilitados a cargo de la Policía Nacional.'
      }
    ]
  },
  u5: {
    diapositivas: [
      {
        tipo: 'practica', icono: 'dog-side', etiqueta: 'En la práctica', titulo: 'Un perro sin collar en Soacha',
        texto: 'Caso de ejemplo: encuentras un perro sin collar y lo llevas a un albergue u hogar de paso.',
        lista: [
          'El municipio debe tener centro de bienestar animal, albergue municipal para fauna u hogar de paso.',
          'Si en 30 días calendario nadie lo reclama, se declara en abandono y se promueve su adopción.',
          'Allí deben garantizarle las cinco libertades y atención veterinaria.'
        ],
        fuente: 'Ley 2054 de 2020, arts. 2, 3 y 4'
      },
      {
        tipo: 'comparacion', icono: 'swap-horizontal', etiqueta: 'En AnimalGuard', titulo: 'Antes y después de adoptar',
        columnas: ['Antes', 'Después'],
        filas: [
          { aspecto: 'Tú', a: 'Te postulas con datos mínimos y declaración juramentada', b: 'Envías foto y reporte a los 15, 30 y 90 días' },
          { aspecto: 'Albergue', a: 'Revisa y decide: la app nunca aprueba sola', b: 'Revisa tus reportes y responde' },
          { aspecto: 'Si falla', a: 'Sin declaración no hay postulación', b: 'Hito vencido: alerta y posible incumplimiento' }
        ],
        fuente: 'Documento Maestro AnimalGuard (RF04); Ley 2455 de 2025, arts. 3 y 4'
      },
      {
        tipo: 'mito', icono: 'help-rhombus-outline', etiqueta: 'Mito o realidad',
        afirmacion: 'El antiguo "coso municipal" sigue llamándose así.', esMito: true,
        explicacion: 'Es un mito. La Ley 2054 de 2020 (art. 9) cambió el nombre: hoy es "albergue municipal para fauna".',
        fuente: 'Ley 2054 de 2020, art. 9'
      },
      {
        tipo: 'resumen', icono: 'star-check-outline', etiqueta: 'Para recordar', titulo: 'Lo esencial de la unidad',
        lista: [
          'La Ley 2054 busca reducir el abandono y apoyar a refugios.',
          'Cada municipio debe tener un lugar de acogida para animales.',
          '30 días sin reclamo: abandono declarado y adopción.',
          'Quien maltrata no puede adoptar: por eso la declaración juramentada.',
          'Adoptar incluye seguimiento a los 15, 30 y 90 días.'
        ],
        fuente: 'Ley 2054 de 2020; Ley 2455 de 2025; Documento Maestro'
      }
    ],
    quiz: [
      {
        id: 'u5q4', pregunta: '¿Cómo se llama hoy el antiguo "coso municipal"?',
        opciones: ['Perrera oficial', 'Albergue municipal para fauna', 'Centro de sacrificio'], correcta: 1,
        explicacion: 'La Ley 2054 de 2020 (art. 9) lo renombró "albergue municipal para fauna".'
      },
      {
        id: 'u5q5', pregunta: 'Si el dueño de un animal aprehendido no paga los gastos de custodia en 15 días…',
        opciones: ['La entidad puede entregarlo en adopción', 'Se le devuelve gratis', 'Se libera en la calle'], correcta: 0,
        explicacion: 'Lo establece la Ley 2455 de 2025, art. 10, parágrafo 1.'
      }
    ]
  },
  u6: {
    diapositivas: [
      {
        pos: 4, tipo: 'comparacion', icono: 'map-legend', etiqueta: 'Compara', titulo: 'Bogotá D.C. y Soacha',
        columnas: ['Bogotá D.C.', 'Soacha'],
        filas: [
          { aspecto: 'Vida en riesgo', a: 'Línea 123 (24 horas)', b: 'Línea 123 / Policía' },
          { aspecto: 'Entidad', a: 'IDPYBA', b: 'Secretaría de Ambiente, Minas, Desarrollo Rural y Protección Animal' },
          { aspecto: 'Maltrato leve', a: 'IDPYBA o Bogotá Te Escucha', b: 'Inspección de Policía' },
          { aspecto: 'En línea', a: 'Bogotá Te Escucha: fotos, videos y anónimo', b: 'Medios vigentes en alcaldiasoacha.gov.co' }
        ],
        fuente: 'bogota.gov.co (2023 y 2026); alcaldiasoacha.gov.co (2026)'
      },
      {
        tipo: 'practica', icono: 'window-open-variant', etiqueta: 'En la práctica', titulo: 'Desde tu ventana',
        texto: 'Caso de ejemplo: ves que un vecino deja a su perro amarrado, sin agua, varios días.',
        lista: [
          'Anota la dirección exacta.',
          'Toma fotos o videos sin exponerte.',
          'En Bogotá, denuncia en Bogotá Te Escucha (puede ser anónimo) o al IDPYBA; en Soacha, en la Inspección de Policía.',
          'Si la vida del animal corre peligro, llama a la Línea 123.'
        ],
        fuente: 'bogota.gov.co (23 de marzo de 2026); Ley 84 de 1989, art. 6, lit. j'
      },
      {
        tipo: 'mito', icono: 'help-rhombus-outline', etiqueta: 'Mito o realidad',
        afirmacion: 'Publicarlo en redes sociales es suficiente para denunciar.', esMito: true,
        explicacion: 'Es un mito. Denuncia por los canales oficiales: publicar solo en redes puede alertar al agresor. Toda queja debe atenderse en máximo 24 horas.',
        fuente: 'bogota.gov.co; Ley 2455 de 2025, art. 10'
      },
      {
        tipo: 'resumen', icono: 'star-check-outline', etiqueta: 'Para recordar', titulo: 'Lo esencial de la unidad',
        lista: [
          'Toda queja se atiende en máximo 24 horas.',
          'Vida en riesgo: Línea 123 en Bogotá y Soacha.',
          'Da dirección, hechos, fotos o videos y datos del agresor si los conoces.',
          'Usa canales oficiales; AnimalGuard orienta, no los reemplaza.'
        ],
        fuente: 'Ley 2455 de 2025, art. 10; bogota.gov.co'
      }
    ],
    quiz: [
      {
        id: 'u6q4', pregunta: '¿Qué canal de Bogotá permite adjuntar fotos y videos y denunciar de forma anónima?',
        opciones: ['Bogotá Te Escucha', 'Un grupo de WhatsApp del barrio', 'Ninguno'], correcta: 0,
        explicacion: 'Bogotá Te Escucha (bogota.gov.co/sdqs) permite adjuntar fotos y videos y denunciar de forma anónima.'
      },
      {
        id: 'u6q5', pregunta: '¿La Policía y los inspectores pueden aprehender preventivamente al animal sin orden previa?',
        opciones: ['No, nunca', 'Sí', 'Solo con orden de un juez'], correcta: 1,
        explicacion: 'La Ley 2455 de 2025 (art. 10) permite la aprehensión preventiva sin orden previa.'
      }
    ]
  }
};
Object.keys(AMPLIACION).forEach((id) => {
  const u = UNIDADES.find((x) => x.id === id);
  if (!u) return;
  AMPLIACION[id].diapositivas
    .slice()
    .sort((a, b) => (b.pos ?? -1) - (a.pos ?? -1))
    .forEach(({ pos, ...d }) => {
      if (typeof pos === 'number') u.diapositivas.splice(pos, 0, d);
      else u.diapositivas.push(d);
    });
  u.quiz.push(...AMPLIACION[id].quiz);
});
// El resumen va al final; los demás agregados sin `pos` quedan antes del resumen (por el orden en que se declaran).

// Anclas para "Ver en el curso" (unidad e índice de diapositiva por título).
function anclaCurso(unidadId, titulo) {
  const u = UNIDADES.find((x) => x.id === unidadId);
  const i = u ? u.diapositivas.findIndex((d) => d.titulo === titulo) : -1;
  return { unidadId, diapositiva: Math.max(0, i) };
}

// Aprobación: 60 % de las preguntas (3 de 5).
const PORCENTAJE_APROBACION = 0.6;
const minimoAprobacion = (total) => Math.max(1, Math.ceil(total * PORCENTAJE_APROBACION));
const APROBACION_MINIMA = minimoAprobacion(5);

// Duración estimada: lectura a ~150 palabras por minuto + 30 s por pregunta o caso.
function estimarMinutos(u) {
  const palabras = JSON.stringify(u.diapositivas).replace(/"\w+":/g, ' ').split(/\s+/).filter(Boolean).length;
  const preguntas = u.quiz.length + (u.escenarios ? u.escenarios.length * 2 : 0);
  return Math.max(3, Math.round(palabras / 150 + preguntas * 0.5));
}

// Glosario: definiciones tomadas solo del contenido verificado de la ruta.
const GLOSARIO = [
  { termino: 'Seres sintientes', definicion: 'Calidad que la ley reconoce a los animales: no son cosas y reciben especial protección contra el sufrimiento y el dolor.', fuente: 'Ley 1774 de 2016, arts. 1 y 2', unidad: 'u1' },
  { termino: 'Cinco libertades', definicion: 'Mínimos que el responsable debe asegurar: no sufrir hambre ni sed; no sufrir injustificadamente malestar físico ni dolor; no padecer enfermedades por negligencia o descuido; no vivir con miedo ni estrés; manifestar su comportamiento natural.', fuente: 'Ley 1774 de 2016, art. 3, lit. b', unidad: 'u1' },
  { termino: 'Propietario, tenedor o poseedor', definicion: 'Quien tiene el animal a su cargo. Debe darle espacio adecuado, alimento, bebida, salud y abrigo.', fuente: 'Ley 84 de 1989, art. 5', unidad: 'u2' },
  { termino: 'Perros de manejo especial', definicion: 'Nombre que reemplazó a "potencialmente peligrosos". Deben ir con traílla, bozal y permiso.', fuente: 'Ley 2054 de 2020, art. 10', unidad: 'u2' },
  { termino: 'Acto de crueldad', definicion: 'Conducta descrita en el art. 6 de la Ley 84 de 1989, como herir, envenenar, privar de lo esencial o abandonar a un animal.', fuente: 'Ley 84 de 1989, art. 6; Ley 2455 de 2025, art. 27', unidad: 'u3' },
  { termino: 'Contravención', definicion: 'Maltrato leve que se tramita en proceso policivo: lo conocen los inspectores de policía en primera instancia y los alcaldes en segunda. Multa de 5 a 50 SMMLV.', fuente: 'Ley 2455 de 2025, art. 9; Ley 1774 de 2016, art. 4', unidad: 'u4' },
  { termino: 'Delito contra los animales', definicion: 'Conducta del Código Penal: muerte al animal (art. 339A) o lesiones que menoscaben gravemente su salud o integridad (art. 339C). Se sanciona con prisión.', fuente: 'Ley 2455 de 2025, arts. 5 y 7', unidad: 'u4' },
  { termino: 'Agravante', definicion: 'Circunstancia que aumenta la pena de la mitad a tres cuartas partes, por ejemplo, sevicia, ocurrir en vía pública o difundirlo en redes.', fuente: 'Ley 2455 de 2025, art. 6', unidad: 'u4' },
  { termino: 'Inhabilidad para tener animales', definicion: 'Prohibición al condenado de adquirir, tener, cuidar o refugiar animales por ningún título (incluida la adopción). Dura el doble del tiempo de la pena principal.', fuente: 'Ley 2455 de 2025, arts. 3 y 4', unidad: 'u4' },
  { termino: 'Inhabilidad especial', definicion: 'Prohibición de ejercer una profesión u oficio con animales: de 2 a 5 años por muerte al animal y de 1 a 3 años por lesiones graves.', fuente: 'Ley 2455 de 2025, arts. 5 y 7', unidad: 'u4' },
  { termino: 'SMLMV / SMMLV', definicion: 'Salario mínimo legal mensual vigente: unidad en la que se fijan las multas. Las leyes usan ambas siglas.', fuente: 'Ley 2455 de 2025; Ley 1774 de 2016', unidad: 'u4' },
  { termino: 'Curso de Sensibilización contra el Maltrato Animal', definicion: 'Curso de la alcaldía. Si aceptas la conducta, asistir te permite pagar el 50 % de la multa dentro de 5 días; no aplica a reincidentes.', fuente: 'Ley 2455 de 2025, art. 8', unidad: 'u4' },
  { termino: 'Albergue municipal para fauna', definicion: 'Nuevo nombre del antiguo "coso municipal". Cada municipio debe tener uno, un centro de bienestar animal o un hogar de paso.', fuente: 'Ley 2054 de 2020, arts. 2 y 9', unidad: 'u5' },
  { termino: 'Aprehensión preventiva', definicion: 'Medida con la que la Policía y los inspectores pueden retirar al animal sin orden previa. Si el dueño no paga la custodia en 15 días, la entidad puede darlo en adopción.', fuente: 'Ley 2455 de 2025, art. 10 y parágrafo 1', unidad: 'u6' },
  { termino: 'IDPYBA', definicion: 'Entidad de Bogotá D.C. que recibe denuncias de maltrato animal (línea (601) 439 9801, proteccionanimal@animalesbog.gov.co). Su Escuadrón Anticrueldad visita los casos con la Policía.', fuente: 'bogota.gov.co (2023 y 2026)', unidad: 'u6' },
  { termino: 'SINAPYBA', definicion: 'Instancia que, con la Policía y la Fiscalía, expedirá la Ruta de Atención al Maltrato Animal con un canal confidencial que acepte quejas anónimas.', fuente: 'Ley 2455 de 2025, art. 24', unidad: 'u6' },
  { termino: 'Escuadrón Anticrueldad', definicion: 'Equipo de veterinarios de Bogotá que visita el lugar con la Policía, emite un concepto técnico, clasifica el caso (leve, media o alta) y, si hay delito, lo traslada.', fuente: 'bogota.gov.co', unidad: 'u6' }
];

// Leyes que se pueden consultar durante la adopción (texto oficial verificado con HTTP 200).
const LEYES_OFICIALES = [
  {
    id: 'l2455', nombre: 'Ley 2455 de 2025 (Ley Ángel)', icono: 'gavel',
    resumen: 'Por qué te pedimos la declaración juramentada: quien sea condenado no puede adoptar animales.',
    url: 'https://apps.procuraduria.gov.co/normograma/compilacion/docs/ley_2455_2025.htm',
    curso: () => anclaCurso('u4', 'Sin derecho a tener animales')
  },
  {
    id: 'l1774', nombre: 'Ley 1774 de 2016', icono: 'heart-pulse',
    resumen: 'Los animales son seres sintientes y debes asegurarles las cinco libertades.',
    url: 'https://cancilleria.gov.co/normograma/compilacion/docs/ley_1774_2016.htm',
    curso: () => anclaCurso('u1', 'Las cinco libertades')
  },
  {
    id: 'l2054', nombre: 'Ley 2054 de 2020', icono: 'home-city-outline',
    resumen: 'Albergues, adopción de animales abandonados y convivencia con mascotas.',
    url: 'https://cancilleria.gov.co/normograma/compilacion/docs/ley_2054_2020.htm',
    curso: () => anclaCurso('u5', 'Un lugar en cada municipio')
  },
  {
    id: 'l84', nombre: 'Ley 84 de 1989', icono: 'book-open-variant',
    resumen: 'Estatuto de protección animal: tus deberes como cuidador y los actos de crueldad.',
    url: 'https://www.saludcapital.gov.co/CZOO/Documents/Ley%2084%20del%2027%20de%20Diciembre%20de%201989.pdf',
    curso: () => anclaCurso('u2', 'Un espacio adecuado')
  }
];

function progresoUnidad(id) {
  if (!store.educacion.unidades[id]) {
    store.educacion.unidades[id] = { vistas: 0, completada: false, mejorPuntaje: null, intentos: 0 };
  }
  return store.educacion.unidades[id];
}
const leerProgreso = (id) =>
  store.educacion.unidades[id] || { vistas: 0, completada: false, mejorPuntaje: null, intentos: 0 };
function unidadDesbloqueada(indice) {
  if (indice <= 0) return true;
  return leerProgreso(UNIDADES[indice - 1].id).completada;
}
function registrarVista(id, indiceDiapositiva) {
  const p = progresoUnidad(id);
  p.vistas = Math.max(p.vistas, indiceDiapositiva + 1);
}
function registrarResultadoQuiz(id, aciertos) {
  const indice = UNIDADES.findIndex((u) => u.id === id);
  if (indice < 0 || !unidadDesbloqueada(indice)) return { ok: false, error: 'Unidad bloqueada.' };
  const u = UNIDADES[indice];
  const p = progresoUnidad(id);
  p.intentos += 1;
  p.mejorPuntaje = p.mejorPuntaje === null ? aciertos : Math.max(p.mejorPuntaje, aciertos);
  const aprobado = aciertos >= minimoAprobacion(u.quiz.length);
  if (aprobado) p.completada = true;
  return { ok: true, aprobado, aciertos, total: u.quiz.length };
}
function responderEscenario(unidadId, escenarioId, opcion) {
  const indice = UNIDADES.findIndex((u) => u.id === unidadId);
  if (indice < 0 || !unidadDesbloqueada(indice)) return { ok: false, correcta: false };
  const u = UNIDADES[indice];
  const e = (u.escenarios || []).find((x) => x.id === escenarioId);
  if (!e) return { ok: false, correcta: false };
  const correcta = opcion === e.correcta;
  if (correcta) store.educacion.escenarios[escenarioId] = true;
  const p = progresoUnidad(unidadId);
  const resueltos = u.escenarios.filter((x) => store.educacion.escenarios[x.id]).length;
  p.vistas = Math.max(p.vistas, resueltos);
  if (resueltos === u.escenarios.length) p.completada = true;
  return { ok: true, correcta, completada: p.completada };
}
function fraccionUnidad(u) {
  const p = leerProgreso(u.id);
  if (p.completada) return 1;
  if (u.tipo === 'practica') {
    const resueltos = u.escenarios.filter((x) => store.educacion.escenarios[x.id]).length;
    return (resueltos / u.escenarios.length) * 0.9;
  }
  return Math.min(0.8, (p.vistas / u.diapositivas.length) * 0.8);
}
function progresoRuta() {
  const completadas = UNIDADES.filter((u) => leerProgreso(u.id).completada).length;
  const fraccion = UNIDADES.reduce((n, u) => n + fraccionUnidad(u), 0) / UNIDADES.length;
  return { completadas, total: UNIDADES.length, porcentaje: Math.round(fraccion * 100), terminada: completadas === UNIDADES.length };
}
// @@LOGICA-FIN

// ============================================================================
// 5. COMPONENTES BASE DEL SISTEMA DE DISEÑO
// ============================================================================
// Respeta la preferencia del sistema "Reducir movimiento".
function useReducirMovimiento() {
  const [reducir, setReducir] = useState(false);
  useEffect(() => {
    let activo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (activo) setReducir(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReducir(!!v));
    return () => {
      activo = false;
      if (sub && sub.remove) sub.remove();
    };
  }, []);
  return reducir;
}

// Entrada suave (opacidad + desplazamiento) al montarse; se usa entre diapositivas y preguntas.
function Entrada({ children, desplazamiento = 16 }) {
  const reducir = useReducirMovimiento();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducir) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reducir, v]);
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [desplazamiento, 0] });
  return <Animated.View style={{ opacity: v, transform: [{ translateX }] }}>{children}</Animated.View>;
}

// Aparición con resorte (escala), para el anillo de resultado y la insignia ganada.
function Rebote({ children, retraso = 0, estilo }) {
  const reducir = useReducirMovimiento();
  const v = useRef(new Animated.Value(reducir ? 1 : 0.6)).current;
  const o = useRef(new Animated.Value(reducir ? 1 : 0)).current;
  useEffect(() => {
    if (reducir) { v.setValue(1); o.setValue(1); return; }
    Animated.parallel([
      Animated.spring(v, { toValue: 1, friction: 5, tension: 80, delay: retraso, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 200, delay: retraso, useNativeDriver: true })
    ]).start();
  }, [reducir, v, o, retraso]);
  return <Animated.View style={[estilo, { opacity: o, transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

// Escala sutil al presionar (tarjetas seleccionables).
function useEscalaPresion() {
  const reducir = useReducirMovimiento();
  const escala = useRef(new Animated.Value(1)).current;
  const animar = (a) => {
    if (reducir) return;
    Animated.spring(escala, { toValue: a, friction: 7, tension: 160, useNativeDriver: true }).start();
  };
  return { escala, alPresionar: () => animar(0.97), alSoltar: () => animar(1) };
}

function Icono({ nombre, tamano = 20, color = T.color.texto, estilo }) {
  return (
    <MaterialCommunityIcons
      name={nombre}
      size={tamano}
      color={color}
      style={estilo}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const VARIANTES_BOTON = {
  relleno: { fondo: T.color.primario, texto: T.color.sobrePrimario, onda: 'rgba(255,255,255,0.22)' },
  tonal: { fondo: T.color.contenedorPrimario, texto: T.color.sobreContenedor, onda: 'rgba(27,67,50,0.16)' },
  contorno: { fondo: 'transparent', texto: T.color.primario, borde: T.color.bordeFuerte, onda: 'rgba(27,67,50,0.12)' },
  texto: { fondo: 'transparent', texto: T.color.primario, onda: 'rgba(27,67,50,0.12)' },
  peligro: { fondo: T.color.error, texto: T.color.sobrePrimario, onda: 'rgba(255,255,255,0.22)' },
  peligroContorno: { fondo: 'transparent', texto: T.color.error, borde: T.color.error, onda: 'rgba(179,38,30,0.12)' },
  peligroTonal: { fondo: T.color.contenedorError, texto: T.color.sobreContenedorError, onda: 'rgba(179,38,30,0.14)' },
  claro: { fondo: T.color.superficie, texto: T.color.primario, onda: 'rgba(27,67,50,0.14)' },
  claroError: { fondo: T.color.superficie, texto: T.color.sobreContenedorError, onda: 'rgba(179,38,30,0.14)' }
};

function Boton({
  titulo, onPress, variante = 'relleno', icono, iconoFinal, tamano = 'md', deshabilitado = false,
  cargando = false, etiqueta, pista, anchoCompleto = false, estilo
}) {
  const v = VARIANTES_BOTON[variante] || VARIANTES_BOTON.relleno;
  const inactivo = deshabilitado || cargando;
  const alto = tamano === 'lg' ? 56 : tamano === 'sm' ? 40 : 48;
  const relleno = v.fondo !== 'transparent';
  const colorTexto = inactivo ? T.color.deshabilitadoTexto : v.texto;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      hitSlop={tamano === 'sm' ? 4 : 0}
      accessibilityRole="button"
      accessibilityLabel={etiqueta || titulo}
      accessibilityHint={pista}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      android_ripple={{ color: v.onda, foreground: true }}
      style={({ pressed }) => [
        styles.boton,
        {
          minHeight: alto,
          paddingHorizontal: tamano === 'lg' ? 28 : tamano === 'sm' ? 16 : 22,
          backgroundColor: inactivo && relleno ? T.color.deshabilitadoFondo : v.fondo,
          borderWidth: v.borde ? 1 : 0,
          borderColor: v.borde ? (inactivo ? T.color.borde : v.borde) : 'transparent'
        },
        anchoCompleto && styles.anchoCompleto,
        pressed && Platform.OS === 'ios' && styles.presionado,
        estilo
      ]}
    >
      {cargando ? (
        <ActivityIndicator size="small" color={colorTexto} />
      ) : icono ? (
        <Icono nombre={icono} tamano={tamano === 'lg' ? 22 : 18} color={colorTexto} />
      ) : null}
      <Text
        style={[tamano === 'lg' ? T.tipo.etiquetaL : T.tipo.etiqueta, { color: colorTexto, textAlign: 'center', flexShrink: 1 }]}
        numberOfLines={2}
      >
        {titulo}
      </Text>
      {iconoFinal ? <Icono nombre={iconoFinal} tamano={18} color={colorTexto} /> : null}
    </Pressable>
  );
}

const VARIANTES_ICONO = {
  estandar: { fondo: 'transparent', color: T.color.textoSuave },
  tonal: { fondo: T.color.contenedorPrimario, color: T.color.sobreContenedor },
  relleno: { fondo: T.color.primario, color: T.color.sobrePrimario },
  sobreImagen: { fondo: 'rgba(0,0,0,0.45)', color: T.color.sobrePrimario },
  claro: { fondo: 'rgba(255,255,255,0.18)', color: T.color.sobrePrimario }
};
function BotonIcono({ icono, onPress, etiqueta, variante = 'estandar', deshabilitado = false, estilo }) {
  const v = VARIANTES_ICONO[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      android_ripple={{ color: 'rgba(127,127,127,0.25)', foreground: true, borderless: false }}
      style={({ pressed }) => [
        styles.botonIcono,
        { backgroundColor: v.fondo, opacity: deshabilitado ? 0.38 : 1 },
        pressed && Platform.OS === 'ios' && styles.presionado,
        estilo
      ]}
    >
      <Icono nombre={icono} tamano={24} color={v.color} />
    </Pressable>
  );
}

function FAB({ titulo, icono, onPress, etiqueta, estilo }) {
  return (
    <View style={[styles.fabSombra, estilo]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={etiqueta || titulo}
        android_ripple={{ color: 'rgba(255,255,255,0.22)', foreground: true }}
        style={({ pressed }) => [styles.fab, pressed && Platform.OS === 'ios' && styles.presionado]}
      >
        <Icono nombre={icono} tamano={24} color={T.color.sobrePrimario} />
        <Text style={[T.tipo.etiquetaL, { color: T.color.sobrePrimario }]}>{titulo}</Text>
      </Pressable>
    </View>
  );
}

// Chip de filtro / selección (forma de píldora, 40 dp + hitSlop = 48 dp de área táctil).
function Chip({ etiqueta, seleccionado, onPress, icono, rol = 'radio', etiquetaAccesible, contador }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole={rol}
      accessibilityState={rol === 'checkbox' ? { checked: seleccionado } : { selected: seleccionado, checked: seleccionado }}
      accessibilityLabel={etiquetaAccesible || etiqueta}
      android_ripple={{ color: 'rgba(27,67,50,0.14)', foreground: true }}
      style={({ pressed }) => [
        styles.chip,
        seleccionado ? styles.chipActivo : styles.chipInactivo,
        pressed && Platform.OS === 'ios' && styles.presionado
      ]}
    >
      {seleccionado ? (
        <Icono nombre="check" tamano={18} color={T.color.sobreContenedor} />
      ) : icono ? (
        <Icono nombre={icono} tamano={18} color={T.color.textoSuave} />
      ) : null}
      <Text style={[T.tipo.etiqueta, { color: seleccionado ? T.color.sobreContenedor : T.color.textoSuave }]}>
        {etiqueta}
      </Text>
      {typeof contador === 'number' ? (
        <Text style={[T.tipo.etiquetaS, { color: seleccionado ? T.color.sobreContenedor : T.color.textoTenue }]}>
          {contador}
        </Text>
      ) : null}
    </Pressable>
  );
}

function tonoEstado(estado) {
  switch (estado) {
    case ESTADO_ANIMAL.DISPONIBLE:
    case ESTADO_SOLICITUD.APROBADA:
    case ESTADO_HITO_UI.AL_DIA:
      return 'exito';
    case ESTADO_ANIMAL.EN_PROCESO:
    case ESTADO_SOLICITUD.PENDIENTE:
      return 'alerta';
    case ESTADO_SOLICITUD.RECHAZADA:
    case ESTADO_HITO_UI.VENCIDO:
      return 'error';
    case ESTADO_HITO_UI.INCUMPLIMIENTO:
      return 'fuerte';
    case ESTADO_HITO_UI.PENDIENTE:
      return 'info';
    default:
      return 'neutro';
  }
}
const ICONO_ESTADO = {
  [ESTADO_ANIMAL.DISPONIBLE]: 'heart-outline',
  [ESTADO_ANIMAL.EN_PROCESO]: 'timer-sand',
  [ESTADO_ANIMAL.ADOPTADO]: 'home-heart',
  [ESTADO_SOLICITUD.PENDIENTE]: 'timer-sand',
  [ESTADO_SOLICITUD.APROBADA]: 'check-circle-outline',
  [ESTADO_SOLICITUD.RECHAZADA]: 'close-circle-outline',
  [ESTADO_HITO_UI.PENDIENTE]: 'calendar-clock',
  [ESTADO_HITO_UI.AL_DIA]: 'check-circle-outline',
  [ESTADO_HITO_UI.VENCIDO]: 'alert-circle-outline',
  [ESTADO_HITO_UI.INCUMPLIMIENTO]: 'alert-decagram'
};

function ChipEstado({ texto, tono, icono, compacto = false, accesible = true, etiquetaAccesible }) {
  const t = TONOS[tono || tonoEstado(texto)];
  const ic = icono || ICONO_ESTADO[texto];
  return (
    <View
      style={[styles.chipEstado, compacto && styles.chipEstadoCompacto, { backgroundColor: t.fondo }]}
      accessible={accesible}
      importantForAccessibility={accesible ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!accesible}
      accessibilityLabel={accesible ? etiquetaAccesible || `Estado: ${texto}` : undefined}
    >
      {ic ? <Icono nombre={ic} tamano={14} color={t.texto} /> : null}
      <Text style={[T.tipo.etiquetaS, { color: t.texto }]} numberOfLines={1}>{texto}</Text>
    </View>
  );
}

function Aviso({ tono = 'info', titulo, children, icono, accion }) {
  const t = TONOS[tono];
  const iconos = { info: 'information-outline', exito: 'check-circle-outline', alerta: 'alert-outline', error: 'alert-circle-outline', neutro: 'information-outline', fuerte: 'alert-decagram' };
  return (
    <View
      style={[styles.aviso, { backgroundColor: t.fondo }]}
      accessibilityLiveRegion={tono === 'error' ? 'assertive' : 'polite'}
    >
      <Icono nombre={icono || iconos[tono]} tamano={22} color={t.texto} />
      <View style={styles.flex1}>
        {titulo ? <Text style={[T.tipo.tituloS, { color: t.texto }]}>{titulo}</Text> : null}
        {children ? <Text style={[T.tipo.cuerpoS, { color: t.texto, marginTop: titulo ? 2 : 0 }]}>{children}</Text> : null}
        {accion ? <View style={{ marginTop: T.esp.sm, alignItems: 'flex-start' }}>{accion}</View> : null}
      </View>
    </View>
  );
}

function Tarjeta({ children, estilo, plana = false }) {
  return <View style={[styles.tarjeta, !plana && T.sombra.n1, estilo]}>{children}</View>;
}

function TituloSeccion({ titulo, subtitulo, accion, contador }) {
  return (
    <View style={styles.tituloSeccion}>
      <View style={styles.flex1}>
        <View style={styles.filaCentro}>
          <Text style={[T.tipo.tituloL, { color: T.color.texto }]} accessibilityRole="header">{titulo}</Text>
          {typeof contador === 'number' && contador > 0 ? (
            <View style={styles.insigniaContador}><Text style={styles.insigniaContadorTexto}>{contador}</Text></View>
          ) : null}
        </View>
        {subtitulo ? <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave, marginTop: 2 }]}>{subtitulo}</Text> : null}
      </View>
      {accion}
    </View>
  );
}

function BarraProgreso({ valor, etiqueta, segmentos, colorRelleno = T.color.primarioMedio, colorPista = T.color.superficieVariante, alto = 8 }) {
  const v = Math.max(0, Math.min(1, valor || 0));
  const reducir = useReducirMovimiento();
  const animado = useRef(new Animated.Value(v)).current;
  useEffect(() => {
    if (reducir) { animado.setValue(v); return; }
    // El ancho no admite el driver nativo.
    Animated.timing(animado, { toValue: v, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, reducir, animado]);
  const ancho = animado.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={segmentos ? styles.filaSegmentos : [styles.pista, { height: alto, backgroundColor: colorPista }]}
    >
      {segmentos
        ? Array.from({ length: segmentos }).map((_, i) => (
          <View
            key={i}
            style={[styles.segmento, { height: alto, backgroundColor: i < Math.round(v * segmentos) ? colorRelleno : colorPista }]}
          />
        ))
        : <Animated.View style={{ width: ancho, height: alto, borderRadius: T.radio.pill, backgroundColor: colorRelleno }} />}
    </View>
  );
}

function EstadoVacio({ icono, titulo, texto, accion }) {
  return (
    <View style={styles.estadoVacio}>
      <View style={styles.estadoVacioIcono}><Icono nombre={icono} tamano={36} color={T.color.primarioMedio} /></View>
      <Text style={[T.tipo.tituloM, { color: T.color.texto, textAlign: 'center' }]}>{titulo}</Text>
      {texto ? <Text style={[T.tipo.cuerpo, { color: T.color.textoSuave, textAlign: 'center' }]}>{texto}</Text> : null}
      {accion ? <View style={{ marginTop: T.esp.sm }}>{accion}</View> : null}
    </View>
  );
}

// Imagen remota con marcador de posición (icono sobre fondo tintado) mientras carga o si falla.
function FotoAnimal({ uri, especie, estilo, tamanoIcono = 40, etiqueta, mostrarTextoError = false }) {
  const [estado, setEstado] = useState(uri ? 'cargando' : 'error');
  useEffect(() => {
    setEstado(uri ? 'cargando' : 'error');
  }, [uri]);
  return (
    <View style={[styles.fotoBase, estilo]} accessible={!!etiqueta} accessibilityRole={etiqueta ? 'image' : undefined} accessibilityLabel={etiqueta}>
      {estado !== 'listo' ? (
        <View style={styles.fotoMarcador}>
          <Icono nombre={especie === 'Gato' ? 'cat' : 'dog'} tamano={tamanoIcono} color={estado === 'error' ? T.color.textoTenue : T.color.acento} />
          {estado === 'error' && mostrarTextoError ? (
            <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue, marginTop: T.esp.xs }]}>Foto no disponible</Text>
          ) : null}
        </View>
      ) : null}
      {uri && estado !== 'error' ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={() => setEstado('listo')}
          onError={() => setEstado('error')}
        />
      ) : null}
    </View>
  );
}

function CampoTexto({ etiqueta, obligatorio = false, error, ayuda, contador, maxLength, value, multiline, ancla, ...props }) {
  const [enfocado, setEnfocado] = useState(false);
  return (
    <View style={styles.campo} onLayout={ancla ? ancla.onLayout : undefined}>
      <Text style={[T.tipo.etiqueta, { color: error ? T.color.error : T.color.texto }]}>
        {etiqueta}{obligatorio ? <Text style={{ color: T.color.error }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        maxLength={maxLength}
        multiline={multiline}
        placeholderTextColor={T.color.textoTenue}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        accessibilityLabel={`${etiqueta}${obligatorio ? ', obligatorio' : ''}`}
        accessibilityHint={error ? `Error: ${error}` : ayuda}
        returnKeyType="done"
        submitBehavior={multiline ? 'blurAndSubmit' : undefined}
        style={[
          styles.input,
          multiline && styles.inputMultilinea,
          enfocado && styles.inputEnfocado,
          error && styles.inputError
        ]}
        {...props}
      />
      {error ? (
        <View style={styles.filaAyuda}>
          <Icono nombre="alert-circle-outline" tamano={16} color={T.color.error} />
          <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.error }]}>{error}</Text>
        </View>
      ) : ayuda || contador ? (
        <View style={styles.filaAyuda}>
          <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.textoTenue }]}>{ayuda || ''}</Text>
          {contador ? <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue }]}>{contador}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function Casilla({ marcada, onCambiar, texto, error, ancla }) {
  return (
    <View onLayout={ancla ? ancla.onLayout : undefined}>
      <Pressable
        onPress={() => onCambiar(!marcada)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcada }}
        accessibilityLabel={texto}
        accessibilityHint={error ? `Error: ${error}` : undefined}
        android_ripple={{ color: 'rgba(27,67,50,0.12)', foreground: true }}
        style={({ pressed }) => [
          styles.casilla,
          marcada && styles.casillaMarcada,
          error && styles.casillaError,
          pressed && Platform.OS === 'ios' && styles.presionado
        ]}
      >
        <Icono
          nombre={marcada ? 'checkbox-marked' : 'checkbox-blank-outline'}
          tamano={24}
          color={error ? T.color.error : marcada ? T.color.primarioMedio : T.color.bordeFuerte}
        />
        <Text style={[T.tipo.cuerpo, styles.flex1, { color: T.color.texto }]}>{texto}</Text>
      </Pressable>
      {error ? (
        <View style={[styles.filaAyuda, { marginTop: 0, marginBottom: T.esp.sm }]}>
          <Icono nombre="alert-circle-outline" tamano={16} color={T.color.error} />
          <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.error }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function GrupoOpciones({ etiqueta, opciones, valor, onCambiar, error, obligatorio = true, ancla }) {
  return (
    <View style={styles.campo} onLayout={ancla ? ancla.onLayout : undefined}>
      <Text style={[T.tipo.etiqueta, { color: error ? T.color.error : T.color.texto }]}>
        {etiqueta}{obligatorio ? <Text style={{ color: T.color.error }}> *</Text> : null}
      </Text>
      <View style={styles.filaChips} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
        {opciones.map((op) => (
          <Chip
            key={op}
            etiqueta={op}
            seleccionado={valor === op}
            onPress={() => onCambiar(op)}
            etiquetaAccesible={`${etiqueta}: ${op}`}
          />
        ))}
      </View>
      {error ? (
        <View style={styles.filaAyuda}>
          <Icono nombre="alert-circle-outline" tamano={16} color={T.color.error} />
          <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.error }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function FilaDato({ icono, etiqueta, valor }) {
  return (
    <View style={styles.filaDato}>
      <View style={styles.filaDatoIcono}><Icono nombre={icono} tamano={18} color={T.color.primarioMedio} /></View>
      <View style={styles.flex1}>
        <Text style={[T.tipo.etiquetaS, { color: T.color.textoTenue }]}>{etiqueta}</Text>
        <Text style={[T.tipo.cuerpo, { color: T.color.texto }]}>{valor}</Text>
      </View>
    </View>
  );
}

// Contenedor de pantalla completa (RN Modal) con barra superior opcional.
// Confirma antes de salir de un formulario con datos sin enviar.
function confirmarDescarte(onDescartar) {
  Alert.alert('¿Descartar lo que escribiste?', 'Si sales ahora, se perderán los datos de este formulario.', [
    { text: 'Seguir editando', style: 'cancel' },
    { text: 'Descartar', style: 'destructive', onPress: onDescartar }
  ]);
}

// Abre el marcador del teléfono; si falla, muestra el número para marcarlo a mano.
function llamar(telefono) {
  const d = digitosTelefono(telefono);
  if (!d) return;
  Linking.openURL(`tel:${d}`).catch(() => {
    Alert.alert('No se pudo iniciar la llamada', `Marca manualmente al ${formatearTelefono(d)}.`);
  });
}

// behavior="padding" en ambas plataformas: con edge-to-edge (Expo) Android no redimensiona la ventana.
function PantallaModal({ onCerrar, children, barStyle = 'dark-content' }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.modalRaiz} behavior="padding">
        <StatusBar barStyle={barStyle} />
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function BarraSuperior({ titulo, subtitulo, onAtras, iconoAtras = 'arrow-left', etiquetaAtras = 'Volver', derecha }) {
  return (
    <View style={styles.barraSuperior}>
      <BotonIcono icono={iconoAtras} etiqueta={etiquetaAtras} onPress={onAtras} />
      <View style={styles.flex1}>
        <Text style={[T.tipo.tituloM, { color: T.color.texto }]} numberOfLines={1} accessibilityRole="header">{titulo}</Text>
        {subtitulo ? <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]} numberOfLines={1}>{subtitulo}</Text> : null}
      </View>
      {derecha}
    </View>
  );
}

// ============================================================================
// 6. ENCABEZADO DEL MÓDULO Y PESTAÑAS SEGMENTADAS
// ============================================================================
const PESTANAS = [
  { id: 'adopcion', titulo: 'Adopción', icono: 'paw' },
  { id: 'seguimiento', titulo: 'Seguimiento', icono: 'calendar-heart' },
  { id: 'aprende', titulo: 'Aprende', icono: 'school-outline' }
];

function EncabezadoModulo({ rol, nombreUsuario, pestana, onCambiar, avisos }) {
  const titulos = {
    adopcion: rol === 'albergue' ? 'Gestiona tus adopciones' : 'Encuentra a tu compañero',
    seguimiento: rol === 'albergue' ? 'Adopciones en seguimiento' : 'Tu seguimiento',
    aprende: 'Aprende y protege'
  };
  return (
    <LinearGradient
      colors={T.gradiente.marca}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.encabezado}
    >
      <Icono nombre="paw" tamano={150} color="rgba(255,255,255,0.06)" estilo={styles.encabezadoMarca} />
      <View style={styles.filaEntre}>
        <Text style={[T.tipo.sobretitulo, styles.flex1, { color: T.color.acento }]} numberOfLines={1}>ADOPCIÓN Y BIENESTAR</Text>
        <View style={styles.pildoraRol} accessible accessibilityLabel={`Rol ${rol === 'albergue' ? 'Albergue' : 'Ciudadano'}, ${nombreUsuario}`}>
          <Icono nombre={rol === 'albergue' ? 'home-heart' : 'account-circle-outline'} tamano={16} color={T.color.sobrePrimario} />
          <Text style={[T.tipo.etiquetaS, { color: T.color.sobrePrimario }]}>{rol === 'albergue' ? 'Albergue' : 'Ciudadano'}</Text>
        </View>
      </View>
      <Text
        style={[T.tipo.titular, { color: T.color.sobrePrimario, marginTop: T.esp.xs }]}
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {titulos[pestana]}
      </Text>
      <View style={styles.segmentado} accessibilityRole="tablist">
        {PESTANAS.map((p) => {
          const activa = pestana === p.id;
          const n = avisos[p.id] || 0;
          return (
            <Pressable
              key={p.id}
              onPress={() => onCambiar(p.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={`${p.titulo}${n > 0 ? `, ${n} pendientes` : ''}`}
              android_ripple={{ color: 'rgba(255,255,255,0.2)', foreground: true }}
              style={({ pressed }) => [styles.segmento3, activa && styles.segmentoActivo, pressed && Platform.OS === 'ios' && styles.presionado]}
            >
              <View>
                <Icono nombre={p.icono} tamano={22} color={activa ? T.color.primario : T.color.sobrePrimario} />
                {n > 0 ? <View style={styles.puntoAviso}><Text style={styles.puntoAvisoTexto}>{n > 9 ? '9+' : n}</Text></View> : null}
              </View>
              <Text style={[T.tipo.etiquetaS, { color: activa ? T.color.primario : T.color.sobrePrimario }]} numberOfLines={1}>{p.titulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </LinearGradient>
  );
}

// ============================================================================
// 7. ADOPCIÓN: GALERÍA, PERFIL, POSTULACIÓN (RF04)
// ============================================================================
const FILTROS_ESPECIE = [
  { id: 'Todos', icono: 'paw' },
  { id: 'Perros', icono: 'dog' },
  { id: 'Gatos', icono: 'cat' }
];

// Texto del estado de postulación para la tarjeta y el perfil (varios postulantes por animal).
function lineaPostulacion(animal, rol, nombreUsuario) {
  if (animal.estado_adopcion !== ESTADO_ANIMAL.EN_PROCESO) return null;
  const ep = estadoPostulacion(animal.id, rol, nombreUsuario);
  if (rol === 'albergue') return `${ep.pendientes} ${ep.pendientes === 1 ? 'solicitud' : 'solicitudes'} en revisión`;
  if (ep.codigo === 'propia_pendiente') return 'Tu postulación está en revisión';
  return 'Aún puedes postularte';
}

function TarjetaGaleria({ animal, ancho, onPress, rol, nombreUsuario }) {
  const alto = Math.round(ancho * 1.3);
  const albergue = buscarAlbergue(animal.albergue_id);
  const mostrarEstado = animal.estado_adopcion !== ESTADO_ANIMAL.DISPONIBLE;
  const linea = lineaPostulacion(animal, rol, nombreUsuario);
  return (
    <View style={[styles.galeriaSombra, { width: ancho }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${animal.nombre}, ${animal.especie.toLowerCase()}, ${animal.edad_aproximada}, talla ${animal.talla.toLowerCase()}${albergue ? `, ${albergue.municipio}` : ''}. ${animal.estado_adopcion}${linea ? `, ${linea}` : ''}.`}
        accessibilityHint="Abre su perfil completo"
        android_ripple={{ color: 'rgba(255,255,255,0.18)', foreground: true }}
        style={({ pressed }) => [styles.galeriaTarjeta, { height: alto }, pressed && styles.escalaPresionada]}
      >
        <FotoAnimal uri={fotoUrl(animal.foto_url, 600)} especie={animal.especie} estilo={StyleSheet.absoluteFill} tamanoIcono={48} />
        <LinearGradient
          colors={T.gradiente.veloTarjeta}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {mostrarEstado ? (
          <View style={styles.galeriaArriba} pointerEvents="none">
            <ChipEstado texto={animal.estado_adopcion} compacto accesible={false} />
          </View>
        ) : null}
        <View style={styles.galeriaPie} pointerEvents="none">
          <Text style={[T.tipo.tituloL, { color: T.color.sobrePrimario }]} numberOfLines={1}>{animal.nombre}</Text>
          <View style={styles.filaCentroXs}>
            <Icono nombre={animal.especie === 'Gato' ? 'cat' : 'dog'} tamano={14} color="rgba(255,255,255,0.92)" />
            <Text style={[T.tipo.cuerpoS, { color: 'rgba(255,255,255,0.92)' }]} numberOfLines={1}>
              {animal.edad_aproximada} · {animal.talla}
            </Text>
          </View>
          {albergue ? (
            <View style={styles.filaCentroXs}>
              <Icono nombre="map-marker-outline" tamano={14} color="rgba(255,255,255,0.92)" />
              <Text style={[T.tipo.cuerpoS, styles.flex1, { color: 'rgba(255,255,255,0.92)' }]} numberOfLines={1}>{albergue.municipio}</Text>
            </View>
          ) : null}
          {linea ? (
            <View style={styles.lineaPostulacion}>
              <Icono nombre="account-multiple-outline" tamano={14} color={T.color.sobreContenedor} />
              <Text style={[T.tipo.etiquetaS, styles.flex1, { color: T.color.sobreContenedor }]} numberOfLines={2}>{linea}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function PestanaAdopcion({ rol, nombreUsuario, refrescar, abrirAnimal, abrirNuevoAnimal }) {
  const { width } = useWindowDimensions();
  const [especie, setEspecie] = useState('Todos');
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const anchoTarjeta = Math.floor((width - T.esp.lg * 2 - T.esp.md) / 2);

  const orden = { [ESTADO_ANIMAL.DISPONIBLE]: 0, [ESTADO_ANIMAL.EN_PROCESO]: 1, [ESTADO_ANIMAL.ADOPTADO]: 2 };
  const animales = store.animales
    .filter((a) => (especie === 'Todos' ? true : especie === 'Perros' ? a.especie === 'Perro' : a.especie === 'Gato'))
    .filter((a) => !soloDisponibles || a.estado_adopcion === ESTADO_ANIMAL.DISPONIBLE)
    .sort((a, b) => orden[a.estado_adopcion] - orden[b.estado_adopcion]);
  const disponibles = store.animales.filter((a) => a.estado_adopcion === ESTADO_ANIMAL.DISPONIBLE).length;

  return (
    <View>
      {rol === 'albergue' ? <PanelSolicitudes rol={rol} refrescar={refrescar} /> : null}

      <TituloSeccion
        titulo={rol === 'albergue' ? 'Galería de animales' : 'Esperan un hogar'}
        subtitulo={`${disponibles} ${disponibles === 1 ? 'animal disponible' : 'animales disponibles'} en albergues de Bogotá D.C. y Soacha`}
      />
      {rol === 'albergue' ? (
        <Boton
          titulo="Publicar un animal"
          icono="plus"
          etiqueta="Publicar un animal para adopción"
          onPress={abrirNuevoAnimal}
          estilo={{ marginBottom: T.esp.md }}
        />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSangre} contentContainerStyle={styles.filaChipsScroll}>
        <View style={styles.filaChips} accessibilityRole="radiogroup" accessibilityLabel="Filtrar por especie">
          {FILTROS_ESPECIE.map((f) => (
            <Chip key={f.id} etiqueta={f.id} icono={f.icono} seleccionado={especie === f.id} onPress={() => setEspecie(f.id)} etiquetaAccesible={`Especie: ${f.id}`} />
          ))}
        </View>
        <View style={styles.separadorVertical} />
        <Chip
          etiqueta="Solo disponibles"
          icono="heart-outline"
          rol="checkbox"
          seleccionado={soloDisponibles}
          onPress={() => setSoloDisponibles(!soloDisponibles)}
        />
      </ScrollView>

      {animales.length === 0 ? (
        <EstadoVacio
          icono="paw-off-outline"
          titulo="Sin resultados"
          texto="No hay animales con estos filtros por ahora."
          accion={<Boton titulo="Quitar filtros" variante="tonal" icono="filter-remove-outline" onPress={() => { setEspecie('Todos'); setSoloDisponibles(false); }} />}
        />
      ) : (
        <View style={styles.galeria}>
          {animales.map((a) => (
            <TarjetaGaleria key={a.id} animal={a} ancho={anchoTarjeta} rol={rol} nombreUsuario={nombreUsuario} onPress={() => abrirAnimal(a.id)} />
          ))}
        </View>
      )}
      <Text style={styles.creditoFotos}>Fotos ilustrativas: Unsplash.</Text>
    </View>
  );
}

// Abre el texto oficial de una ley; si el sistema no puede abrirlo, muestra la dirección.
function abrirLey(ley) {
  Linking.openURL(ley.url).catch(() => {
    Alert.alert('No se pudo abrir el enlace', `Copia esta dirección en tu navegador:\n${ley.url}`);
  });
}

// "Conoce las leyes": texto oficial de cada ley y enlace a la unidad relacionada del curso.
function SeccionLeyes({ onVerCurso, titulo = 'Conoce las leyes', subtitulo }) {
  return (
    <View>
      <Text style={[T.tipo.tituloL, styles.tituloBloque, { marginBottom: T.esp.xs }]} accessibilityRole="header">{titulo}</Text>
      <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave, marginBottom: T.esp.md }]}>
        {subtitulo || 'Consulta el texto oficial o repasa lo esencial en el curso.'}
      </Text>
      {LEYES_OFICIALES.map((ley) => (
        <Tarjeta key={ley.id} plana estilo={[styles.tarjetaBorde, styles.espacioAbajo]}>
          <View style={styles.filaCentro}>
            <View style={styles.avatarIcono}><Icono nombre={ley.icono} tamano={22} color={T.color.primarioMedio} /></View>
            <View style={styles.flex1}>
              <Text style={[T.tipo.tituloS, { color: T.color.texto }]}>{ley.nombre}</Text>
              <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>{ley.resumen}</Text>
            </View>
          </View>
          <View style={[styles.filaBotones, { marginTop: T.esp.md, justifyContent: 'flex-start' }]}>
            <Boton titulo="Texto oficial" variante="tonal" icono="open-in-new" etiqueta={`Abrir el texto oficial de la ${ley.nombre}`}
              pista="Se abre en el navegador" onPress={() => abrirLey(ley)} />
            {onVerCurso ? (
              <Boton titulo="Ver en el curso" variante="texto" icono="school-outline" etiqueta={`Ver la ${ley.nombre} en el curso`}
                onPress={() => onVerCurso(ley.curso())} />
            ) : null}
          </View>
        </Tarjeta>
      ))}
    </View>
  );
}

function PantallaAnimal({ animalId, rol, nombreUsuario, onCerrar, refrescar, irASeguimiento }) {
  const { width } = useWindowDimensions();
  const [vista, setVista] = useState('detalle'); // 'detalle' | 'formulario' | 'exito'
  const [solicitud, setSolicitud] = useState(null);
  const [curso, setCurso] = useState(null); // { unidadId, diapositiva }: unidad abierta encima, sin perder el formulario
  const cursoModal = curso ? (
    <ReproductorUnidad
      unidadId={curso.unidadId}
      inicio={curso.diapositiva}
      consulta
      onCerrar={() => { setCurso(null); refrescar(); }}
      refrescar={refrescar}
      abrirUnidad={(id) => setCurso({ unidadId: id, diapositiva: 0 })}
      irAGaleria={() => setCurso(null)}
    />
  ) : null;
  const sucioRef = useRef(false); // el formulario tiene datos sin enviar
  const animal = buscarAnimal(animalId);
  if (!animal) return null;
  const albergue = buscarAlbergue(animal.albergue_id);
  const altoHero = Math.min(Math.round(width * 0.95), 420);
  const ep = estadoPostulacion(animal.id, rol, nombreUsuario);
  const puedePostular = ep.puede;

  const salirFormulario = () => {
    if (!sucioRef.current) { setVista('detalle'); return; }
    confirmarDescarte(() => { sucioRef.current = false; setVista('detalle'); });
  };
  const atras = () => (vista === 'formulario' ? salirFormulario() : onCerrar());

  if (vista === 'formulario') {
    return (
      <PantallaModal onCerrar={atras}>
        <BarraSuperior titulo="Postulación" subtitulo={`Para adoptar a ${animal.nombre}`} onAtras={atras} etiquetaAtras="Volver al perfil" />
        <FormularioPostulacion
          animal={animal}
          nombreUsuario={nombreUsuario}
          rol={rol}
          sucioRef={sucioRef}
          onCancelar={salirFormulario}
          onVerCurso={setCurso}
          onEnviada={(s) => { setSolicitud(s); setVista('exito'); refrescar(); }}
        />
        {cursoModal}
      </PantallaModal>
    );
  }

  if (vista === 'exito') {
    return (
      <PantallaModal onCerrar={onCerrar}>
        <ScrollView contentContainerStyle={[styles.exitoContenido, { paddingTop: INSET_SUPERIOR + T.esp.xxl }]}>
          <View style={styles.exitoIcono}><Icono nombre="check-decagram" tamano={56} color={T.color.primarioMedio} /></View>
          <Text style={[T.tipo.titular, styles.textoCentro, { color: T.color.texto }]} accessibilityRole="header">Postulación enviada</Text>
          <Text style={[T.tipo.cuerpoL, styles.textoCentro, { color: T.color.textoSuave }]}>
            El albergue revisará tu postulación para adoptar a {animal.nombre} y te responderá en la pestaña Seguimiento.
          </Text>
          <Tarjeta estilo={styles.anchoCompleto}>
            <View style={styles.filaCentro}>
              <FotoAnimal uri={fotoUrl(animal.foto_url, 200)} especie={animal.especie} estilo={styles.miniatura} tamanoIcono={24} />
              <View style={styles.flex1}>
                <Text style={[T.tipo.tituloM, { color: T.color.texto }]}>{animal.nombre}</Text>
                <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>{solicitud ? formatearFecha(solicitud.fecha_solicitud) : ''}</Text>
              </View>
            </View>
            <View style={{ marginTop: T.esp.md }}><ChipEstado texto={ESTADO_SOLICITUD.PENDIENTE} /></View>
          </Tarjeta>
          <Tarjeta estilo={styles.anchoCompleto}>
            <Text style={[T.tipo.tituloS, { color: T.color.texto, marginBottom: T.esp.sm }]}>Qué sigue</Text>
            {[
              ['account-search-outline', 'El albergue revisa tu postulación y decide.'],
              ['bell-outline', 'Verás su decisión en la pestaña Seguimiento.'],
              ['calendar-heart', 'Si te aprueban, harás seguimiento a los 15, 30 y 90 días.']
            ].map(([ic, tx], i) => (
              <View key={ic} style={styles.pasoFila}>
                <View style={styles.pasoNumero}><Text style={[T.tipo.etiquetaS, { color: T.color.sobreContenedor }]}>{i + 1}</Text></View>
                <Icono nombre={ic} tamano={20} color={T.color.primarioMedio} />
                <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.texto }]}>{tx}</Text>
              </View>
            ))}
          </Tarjeta>
          <Boton titulo="Ver mi seguimiento" icono="calendar-heart" tamano="lg" anchoCompleto onPress={irASeguimiento} />
          <Boton titulo="Volver a la galería" variante="texto" onPress={onCerrar} />
        </ScrollView>
      </PantallaModal>
    );
  }

  const datos = [
    { icono: animal.especie === 'Gato' ? 'cat' : 'dog', texto: animal.especie },
    { icono: 'cake-variant-outline', texto: animal.edad_aproximada },
    { icono: 'ruler', texto: `Talla ${animal.talla.toLowerCase()}` },
    { icono: animal.esterilizado ? 'check-circle-outline' : 'close-circle-outline', texto: animal.esterilizado ? 'Esterilizado' : 'Sin esterilizar', alerta: !animal.esterilizado },
    { icono: animal.vacunado ? 'needle' : 'close-circle-outline', texto: animal.vacunado ? 'Vacunado' : 'Vacunas pendientes', alerta: !animal.vacunado }
  ];

  return (
    <PantallaModal onCerrar={onCerrar} barStyle="light-content">
      <ScrollView contentContainerStyle={{ paddingBottom: T.esp.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ height: altoHero }}>
          <FotoAnimal
            uri={fotoUrl(animal.foto_url, 1200)}
            especie={animal.especie}
            estilo={StyleSheet.absoluteFill}
            tamanoIcono={72}
            mostrarTextoError
            etiqueta={`Foto de ${animal.nombre}`}
          />
          <LinearGradient colors={T.gradiente.veloHeroSuperior} style={styles.heroVeloSuperior} pointerEvents="none" />
          <LinearGradient colors={T.gradiente.veloHeroInferior} locations={[0, 0.45, 1]} style={styles.heroVeloInferior} pointerEvents="none" />
          <View style={styles.heroPie} pointerEvents="none">
            <ChipEstado texto={animal.estado_adopcion} />
            <Text style={[T.tipo.display, styles.sombraTexto, { color: T.color.sobrePrimario, marginTop: T.esp.sm }]} accessibilityRole="header">{animal.nombre}</Text>
            {albergue ? (
              <View style={styles.filaCentroXs}>
                <Icono nombre="map-marker-outline" tamano={16} color="rgba(255,255,255,0.92)" />
                <Text style={[T.tipo.cuerpo, styles.sombraTexto, { color: 'rgba(255,255,255,0.95)' }]}>{albergue.municipio} · {albergue.localidad_barrio}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.hoja}>
          <View style={styles.filaChips}>
            {datos.map((d) => (
              <View key={d.texto} style={[styles.chipDato, d.alerta && { backgroundColor: TONOS.alerta.fondo }]}>
                <Icono nombre={d.icono} tamano={18} color={d.alerta ? TONOS.alerta.texto : T.color.primarioMedio} />
                <Text style={[T.tipo.etiqueta, { color: d.alerta ? TONOS.alerta.texto : T.color.texto }]}>{d.texto}</Text>
              </View>
            ))}
          </View>

          <Text style={[T.tipo.tituloL, styles.tituloBloque]} accessibilityRole="header">Su historia</Text>
          <Text style={[T.tipo.cuerpoL, { color: T.color.texto }]}>{animal.historia_resumen}</Text>
          {animal.temperamento ? (
            <View style={[styles.filaChips, { marginTop: T.esp.md }]}>
              {animal.temperamento.map((t) => (
                <ChipEstado key={t} texto={t} tono="neutro" icono="star-four-points-outline" etiquetaAccesible={`Temperamento: ${t}`} />
              ))}
            </View>
          ) : null}

          <Text style={[T.tipo.tituloL, styles.tituloBloque]} accessibilityRole="header">Salud</Text>
          <View style={styles.bloqueTonal}>
            <Icono nombre="heart-pulse" tamano={22} color={T.color.primarioMedio} />
            <Text style={[T.tipo.cuerpo, styles.flex1, { color: T.color.texto }]}>{animal.estado_salud}</Text>
          </View>

          {albergue ? (
            <>
              <Text style={[T.tipo.tituloL, styles.tituloBloque]} accessibilityRole="header">Albergue</Text>
              <Tarjeta plana estilo={styles.tarjetaBorde}>
                <View style={styles.filaCentro}>
                  <View style={styles.avatarIcono}><Icono nombre="home-heart" tamano={24} color={T.color.primarioMedio} /></View>
                  <View style={styles.flex1}>
                    <Text style={[T.tipo.tituloS, { color: T.color.texto }]}>{albergue.nombre_albergue}</Text>
                    <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>{albergue.municipio} · {albergue.localidad_barrio}</Text>
                  </View>
                  {albergue.verificado ? (
                    <ChipEstado texto="Verificado" tono="exito" icono="check-decagram" compacto etiquetaAccesible="Albergue verificado" />
                  ) : null}
                </View>
                <View style={styles.divisor} />
                <View style={styles.filaCentro}>
                  <View style={styles.flex1}>
                    <FilaDato icono="phone-outline" etiqueta="Teléfono de contacto" valor={albergue.telefono_contacto} />
                  </View>
                  <Boton
                    titulo="Llamar"
                    variante="tonal"
                    tamano="sm"
                    icono="phone"
                    etiqueta={`Llamar a ${albergue.nombre_albergue}`}
                    onPress={() => llamar(albergue.telefono_contacto)}
                  />
                </View>
              </Tarjeta>
            </>
          ) : null}

          <Text style={[T.tipo.tituloL, styles.tituloBloque]} accessibilityRole="header">Para adoptar</Text>
          {[
            ['account-check-outline', 'Ser mayor de edad y vivir en Bogotá D.C. o Soacha.'],
            ['file-sign', 'Declarar bajo juramento que no tienes sanciones por maltrato (Ley 2455 de 2025).'],
            ['calendar-heart', 'Aceptar el seguimiento a los 15, 30 y 90 días.'],
            ['shield-lock-outline', 'Solo pedimos datos mínimos (Ley 1581 de 2012).']
          ].map(([ic, tx]) => (
            <View key={ic} style={styles.requisito}>
              <Icono nombre={ic} tamano={20} color={T.color.primarioMedio} />
              <Text style={[T.tipo.cuerpo, styles.flex1, { color: T.color.texto }]}>{tx}</Text>
            </View>
          ))}

          <SeccionLeyes onVerCurso={setCurso} subtitulo="Antes de postularte, conoce tus deberes y por qué te pedimos la declaración juramentada." />
        </View>
      </ScrollView>
      {/* Fuera del ScrollView: el botón de volver nunca se desplaza con el contenido. */}
      <BotonIcono icono="arrow-left" etiqueta="Volver a la galería" variante="sobreImagen" onPress={onCerrar} estilo={styles.heroAtras} />

      <View style={styles.barraInferior}>
        {puedePostular ? (
          <View style={{ gap: T.esp.sm }}>
            {animal.estado_adopcion === ESTADO_ANIMAL.EN_PROCESO ? (
              <View style={styles.filaCentroXs}>
                <Icono nombre="account-multiple-outline" tamano={18} color={T.color.alerta} />
                <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.alerta }]}>
                  En proceso · aún puedes postularte. El albergue revisa {ep.pendientes === 1 ? '1 solicitud' : `${ep.pendientes} solicitudes`} y elige un hogar.
                </Text>
              </View>
            ) : null}
            <Boton
              titulo={`Adoptar a ${animal.nombre}`}
              etiqueta={`Postularme para adoptar a ${animal.nombre}`}
              icono="hand-heart"
              tamano="lg"
              anchoCompleto
              onPress={() => setVista('formulario')}
            />
          </View>
        ) : (
          <View style={styles.notaInferior} accessibilityLiveRegion="polite">
            <Icono
              nombre={ep.codigo === 'adoptado' ? 'home-heart' : rol === 'albergue' ? 'information-outline' : 'timer-sand'}
              tamano={22}
              color={T.color.primarioMedio}
            />
            <Text style={[T.tipo.cuerpo, styles.flex1, { color: T.color.texto }]}>
              {ep.codigo === 'adoptado'
                ? `${animal.nombre} ya encontró un hogar.`
                : ep.codigo === 'rol'
                  ? ep.pendientes > 0
                    ? `${ep.pendientes === 1 ? '1 solicitud' : `${ep.pendientes} solicitudes`} en revisión. Decide en la pestaña Adopción.`
                    : 'Los albergues no se postulan: gestionan las solicitudes en la pestaña Adopción.'
                  : ep.motivo}
            </Text>
            {ep.codigo === 'propia_pendiente' || ep.codigo === 'propia_aprobada' ? (
              <Boton titulo="Ver" variante="tonal" tamano="sm" iconoFinal="chevron-right" etiqueta="Ver mi seguimiento" onPress={irASeguimiento} />
            ) : null}
          </View>
        )}
      </View>
      {cursoModal}
    </PantallaModal>
  );
}

const FORM_INICIAL = (nombreUsuario) => ({
  nombre_completo: nombreUsuario || '',
  telefono: '',
  correo: '',
  municipio: '',
  tipo_vivienda: '',
  vivienda_propia_o_autorizada: null, // sin respuesta por defecto
  experiencia_previa: '',
  motivo_adopcion: '',
  mayor_de_edad: false,
  compromiso_cinco_libertades: false,
  compromiso_recursos: false,
  compromiso_seguimiento: false,
  declaracion_sin_inhabilidad_ley2455: false
});

function EncabezadoPaso({ numero, titulo }) {
  return (
    <View style={styles.encabezadoPaso}>
      <View style={styles.pasoCirculo}><Text style={[T.tipo.etiqueta, { color: T.color.sobrePrimario }]}>{numero}</Text></View>
      <Text style={[T.tipo.tituloM, { color: T.color.texto }]} accessibilityRole="header">{titulo}</Text>
    </View>
  );
}

function FormularioPostulacion({ animal, nombreUsuario, rol, sucioRef, onCancelar, onEnviada, onVerCurso }) {
  const [datos, setDatos] = useState(() => FORM_INICIAL(nombreUsuario));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // evita doble envío por toques rápidos
  const scrollRef = useRef(null);
  const posiciones = useRef({}); // y de cada campo dentro del contenido del ScrollView

  // Anclas para desplazarse al primer campo con error.
  const ancla = (campo) => ({
    onLayout: (e) => { posiciones.current[campo] = e.nativeEvent.layout.y; }
  });

  const actualizar = (campo, valor) => {
    const nuevos = { ...datos, [campo]: valor };
    setDatos(nuevos);
    if (sucioRef) sucioRef.current = true;
    if (intentado) setErrores(validarPostulacion(nuevos));
  };

  const irAlPrimerError = (errs) => {
    const ys = Object.keys(errs).map((c) => posiciones.current[c]).filter((y) => typeof y === 'number');
    const y = ys.length ? Math.min(...ys) : 0;
    if (scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, y - T.esp.lg), animated: true });
  };

  const enviar = () => {
    if (enviandoRef.current) return;
    Keyboard.dismiss();
    setIntentado(true);
    const errs = validarPostulacion(datos);
    setErrores(errs);
    const n = Object.keys(errs).length;
    if (n > 0) {
      setErrorGeneral('');
      irAlPrimerError(errs);
      AccessibilityInfo.announceForAccessibility(
        `No se pudo enviar. Revisa ${n === 1 ? 'un campo' : `${n} campos`}: ${Object.keys(errs).map((c) => ETIQUETAS_CAMPOS[c]).join(', ')}.`
      );
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    const r = registrarPostulacion(rol, animal.id, datos, nombreUsuario);
    if (!r.ok) {
      enviandoRef.current = false;
      setEnviando(false);
      setErrorGeneral(r.error);
      if (r.errores) setErrores(r.errores);
      return;
    }
    if (sucioRef) sucioRef.current = false;
    onEnviada(r.solicitud);
  };

  const bloqueoDeclaracion = intentado && !!errores.declaracion_sin_inhabilidad_ley2455;
  const bloqueoCompromisos = intentado && CAMPOS_FILTRO_LEY_ANGEL.some(
    (c) => c !== 'declaracion_sin_inhabilidad_ley2455' && errores[c]
  );
  const camposConError = Object.keys(errores).map((c) => ETIQUETAS_CAMPOS[c] || c);
  const confirmadas = CAMPOS_FILTRO_LEY_ANGEL.filter((c) => datos[c]).length;

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.contenidoModal} keyboardShouldPersistTaps="handled">
      <View style={styles.cabeceraFormulario}>
        <FotoAnimal uri={fotoUrl(animal.foto_url, 200)} especie={animal.especie} estilo={styles.miniatura} tamanoIcono={24} />
        <View style={styles.flex1}>
          <Text style={[T.tipo.tituloM, { color: T.color.texto }]}>Quiero adoptar a {animal.nombre}</Text>
          <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>Te toma unos 3 minutos.</Text>
        </View>
      </View>
      <Aviso tono="info" icono="shield-lock-outline" titulo="Solo datos mínimos (Ley 1581 de 2012)">
        No pedimos copia de tu documento ni datos financieros. El albergue revisa y decide; AnimalGuard nunca aprueba automáticamente.
      </Aviso>

      <EncabezadoPaso numero={1} titulo="Tus datos de contacto" />
      <CampoTexto
        etiqueta="Nombre completo"
        obligatorio
        value={datos.nombre_completo}
        onChangeText={(v) => actualizar('nombre_completo', v)}
        placeholder="Nombre y apellidos"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={80}
        error={errores.nombre_completo} ancla={ancla('nombre_completo')}
      />
      <CampoTexto
        etiqueta="Teléfono"
        obligatorio
        value={datos.telefono}
        onChangeText={(v) => actualizar('telefono', v)}
        placeholder="300 123 4567"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={16}
        error={errores.telefono} ancla={ancla('telefono')}
      />
      <CampoTexto
        etiqueta="Correo electrónico"
        obligatorio
        value={datos.correo}
        onChangeText={(v) => actualizar('correo', v)}
        placeholder="nombre@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={100}
        error={errores.correo} ancla={ancla('correo')}
      />
      <GrupoOpciones
        etiqueta="Municipio donde vives"
        opciones={MUNICIPIOS}
        valor={datos.municipio}
        onCambiar={(v) => actualizar('municipio', v)}
        error={errores.municipio} ancla={ancla('municipio')}
      />

      <EncabezadoPaso numero={2} titulo="Tu hogar y experiencia" />
      <GrupoOpciones
        etiqueta="Tipo de vivienda"
        opciones={TIPOS_VIVIENDA}
        valor={datos.tipo_vivienda}
        onCambiar={(v) => actualizar('tipo_vivienda', v)}
        error={errores.tipo_vivienda} ancla={ancla('tipo_vivienda')}
      />
      <GrupoOpciones
        etiqueta="¿La vivienda es propia o tienes autorización del propietario para tener mascotas?"
        opciones={['Sí', 'No']}
        valor={datos.vivienda_propia_o_autorizada === true ? 'Sí' : datos.vivienda_propia_o_autorizada === false ? 'No' : ''}
        onCambiar={(v) => actualizar('vivienda_propia_o_autorizada', v === 'Sí')}
        error={errores.vivienda_propia_o_autorizada} ancla={ancla('vivienda_propia_o_autorizada')}
      />
      {datos.vivienda_propia_o_autorizada === false ? (
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave, marginTop: -T.esp.sm, marginBottom: T.esp.md }]}>
          Puedes postularte igual; el albergue lo tendrá en cuenta al revisar tu caso.
        </Text>
      ) : null}
      <GrupoOpciones
        etiqueta="Experiencia previa con mascotas"
        opciones={EXPERIENCIAS}
        valor={datos.experiencia_previa}
        onCambiar={(v) => actualizar('experiencia_previa', v)}
        error={errores.experiencia_previa} ancla={ancla('experiencia_previa')}
      />
      <CampoTexto
        etiqueta="¿Por qué quieres adoptar?"
        obligatorio
        ayuda="Tu rutina, tu hogar y quién lo cuidará. Mínimo 20 caracteres."
        contador={`${datos.motivo_adopcion.trim().length}/500`}
        value={datos.motivo_adopcion}
        onChangeText={(v) => actualizar('motivo_adopcion', v)}
        placeholder="Escribe tu motivo"
        maxLength={500}
        multiline
        textAlignVertical="top"
        error={errores.motivo_adopcion} ancla={ancla('motivo_adopcion')}
      />

      <EncabezadoPaso numero={3} titulo="Compromisos y declaración" />
      <View style={styles.filaEntre}>
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>Filtro Ley Ángel (Ley 2455 de 2025)</Text>
        <Text style={[T.tipo.etiquetaS, { color: confirmadas === 5 ? T.color.primarioMedio : T.color.textoTenue }]}>{confirmadas} de 5</Text>
      </View>
      <View style={{ marginVertical: T.esp.sm }}>
        <BarraProgreso valor={confirmadas / 5} segmentos={5} alto={4} etiqueta="Confirmaciones obligatorias" />
      </View>
      <Casilla marcada={datos.mayor_de_edad} onCambiar={(v) => actualizar('mayor_de_edad', v)} texto="Soy mayor de edad." error={errores.mayor_de_edad} ancla={ancla('mayor_de_edad')} />
      <Casilla
        marcada={datos.compromiso_cinco_libertades}
        onCambiar={(v) => actualizar('compromiso_cinco_libertades', v)}
        texto="Me comprometo con la tenencia responsable y las cinco libertades del animal (Ley 1774 de 2016, art. 3)."
        error={errores.compromiso_cinco_libertades} ancla={ancla('compromiso_cinco_libertades')}
      />
      <Casilla
        marcada={datos.compromiso_recursos}
        onCambiar={(v) => actualizar('compromiso_recursos', v)}
        texto="Cuento con tiempo y recursos para su alimentación y atención veterinaria."
        error={errores.compromiso_recursos} ancla={ancla('compromiso_recursos')}
      />
      <Casilla
        marcada={datos.compromiso_seguimiento}
        onCambiar={(v) => actualizar('compromiso_seguimiento', v)}
        texto="Acepto el seguimiento posadopción a los 15, 30 y 90 días con foto y reporte del animal."
        error={errores.compromiso_seguimiento} ancla={ancla('compromiso_seguimiento')}
      />
      <Casilla
        marcada={datos.declaracion_sin_inhabilidad_ley2455}
        onCambiar={(v) => actualizar('declaracion_sin_inhabilidad_ley2455', v)}
        texto="Declaro bajo juramento que no tengo antecedentes, condenas ni sanciones por maltrato animal, ni inhabilidad para tener animales (Ley 2455 de 2025)."
        error={errores.declaracion_sin_inhabilidad_ley2455} ancla={ancla('declaracion_sin_inhabilidad_ley2455')}
      />
      <Aviso
        tono="info"
        icono="gavel"
        titulo="¿Por qué te pedimos esta declaración?"
        accion={
          <View style={styles.filaBotones}>
            <Boton titulo="Ver en el curso" variante="texto" tamano="sm" icono="school-outline"
              onPress={() => onVerCurso && onVerCurso(LEYES_OFICIALES[0].curso())} />
            <Boton titulo="Texto oficial" variante="texto" tamano="sm" icono="open-in-new" etiqueta="Abrir el texto oficial de la Ley 2455 de 2025"
              onPress={() => abrirLey(LEYES_OFICIALES[0])} />
          </View>
        }
      >
        Quien sea condenado por delitos contra los animales no puede adquirir, tener, cuidar ni adoptar animales durante el doble del tiempo de la pena principal (Ley 2455 de 2025, arts. 3 y 4).
      </Aviso>

      {/* Un solo bloque de error: el del filtro Ley Ángel si aplica; si no, el resumen. */}
      {bloqueoDeclaracion ? (
        <Aviso tono="error" icono="cancel" titulo="Postulación bloqueada (filtro Ley Ángel)">
          Sin la declaración juramentada no puedes postularte. La Ley 2455 de 2025 (arts. 3 y 4) inhabilita a quien sea condenado
          por delitos contra los animales para adquirir, tener o adoptar animales durante el doble del tiempo de la pena principal.
        </Aviso>
      ) : bloqueoCompromisos ? (
        <Aviso tono="error" titulo="Faltan compromisos obligatorios (filtro Ley Ángel)">
          Para adoptar debes ser mayor de edad, aceptar la tenencia responsable, contar con tiempo y recursos para su cuidado y aceptar
          el seguimiento a los 15, 30 y 90 días.
        </Aviso>
      ) : intentado && camposConError.length > 0 ? (
        <Aviso tono="error" titulo="No se pudo enviar">
          Revisa {camposConError.length === 1 ? 'este campo' : `estos ${camposConError.length} campos`}: {camposConError.join(', ')}.
        </Aviso>
      ) : null}
      {errorGeneral ? <Aviso tono="error">{errorGeneral}</Aviso> : null}

      <View style={styles.accionesFormulario}>
        <Boton
          titulo="Enviar postulación"
          icono="send"
          tamano="lg"
          anchoCompleto
          onPress={enviar}
          cargando={enviando}
          etiqueta={`Enviar postulación para ${animal.nombre}`}
        />
        <Boton titulo="Cancelar" variante="texto" onPress={onCancelar} />
      </View>
      <SeccionLeyes onVerCurso={onVerCurso} subtitulo="Puedes consultarlas sin perder lo que llevas escrito." />
    </ScrollView>
  );
}

function TarjetaSolicitudPendiente({ solicitud, rol, onResuelta }) {
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const animal = buscarAnimal(solicitud.animal_id);

  const decidir = (decision) => {
    if (rol !== 'albergue') return;
    Keyboard.dismiss();
    if (decision === ESTADO_SOLICITUD.RECHAZADA && observaciones.trim().length < 5) {
      setError('Escribe el motivo del rechazo en las observaciones.');
      return;
    }
    const aprobar = decision === ESTADO_SOLICITUD.APROBADA;
    const nombreAnimal = animal ? animal.nombre : 'este animal';
    const otras = pendientesDeAnimal(solicitud.animal_id).length - 1;
    const detalle = aprobar
      ? otras > 0
        ? `${nombreAnimal} quedará como "Adoptado" y se rechazarán automáticamente ${otras === 1 ? 'la otra solicitud pendiente' : `las otras ${otras} solicitudes pendientes`} con el motivo "${MOTIVO_RECHAZO_AUTOMATICO}".`
        : `${nombreAnimal} quedará como "Adoptado".`
      : otras > 0
        ? `${nombreAnimal} seguirá "En proceso": ${otras === 1 ? 'queda 1 solicitud' : `quedan ${otras} solicitudes`} por revisar.`
        : `${nombreAnimal} volverá a estar "Disponible".`;
    Alert.alert(
      aprobar ? '¿Aprobar esta solicitud?' : '¿Rechazar esta solicitud?',
      `${solicitud.nombre_completo} quiere adoptar a ${nombreAnimal}. ${detalle}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: aprobar ? 'Aprobar' : 'Rechazar',
          style: aprobar ? 'default' : 'destructive',
          onPress: () => {
            const r = resolverSolicitud(rol, solicitud.id, decision, observaciones);
            if (!r.ok) { setError(r.error); return; }
            onResuelta(decision, animal, r);
          }
        }
      ]
    );
  };

  const confirmadas = CAMPOS_FILTRO_LEY_ANGEL.filter((c) => solicitud[c]).length;

  return (
    <Tarjeta estilo={styles.espacioAbajo}>
      <View style={styles.filaCentro}>
        {animal ? <FotoAnimal uri={fotoUrl(animal.foto_url, 200)} especie={animal.especie} estilo={styles.miniatura} tamanoIcono={24} /> : null}
        <View style={styles.flex1}>
          <Text style={[T.tipo.tituloM, { color: T.color.texto }]}>{animal ? animal.nombre : 'Animal'}</Text>
          <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>Recibida {textoRelativo(solicitud.fecha_solicitud).toLowerCase()}</Text>
          {pendientesDeAnimal(solicitud.animal_id).length > 1 ? (
            <Text style={[T.tipo.etiquetaS, { color: T.color.alerta, marginTop: 2 }]}>
              {pendientesDeAnimal(solicitud.animal_id).length} solicitudes para {animal ? animal.nombre : 'este animal'}
            </Text>
          ) : null}
        </View>
        <ChipEstado texto="Por revisar" tono="alerta" icono="timer-sand" compacto />
      </View>
      <View style={styles.divisor} />
      <FilaDato icono="account-outline" etiqueta="Postulante" valor={solicitud.nombre_completo} />
      <View style={styles.filaCentro}>
        <View style={styles.flex1}>
          <FilaDato icono="phone-outline" etiqueta="Contacto" valor={`${formatearTelefono(solicitud.telefono)} · ${solicitud.correo}`} />
        </View>
        <Boton
          titulo="Llamar"
          variante="tonal"
          tamano="sm"
          icono="phone"
          etiqueta={`Llamar a ${solicitud.nombre_completo}`}
          onPress={() => llamar(solicitud.telefono)}
        />
      </View>
      <View style={[styles.filaChips, { marginTop: T.esp.sm }]}>
        {[
          { icono: 'map-marker-outline', texto: solicitud.municipio, etiqueta: 'Municipio' },
          {
            icono: 'home-outline',
            texto: `${solicitud.tipo_vivienda} · ${solicitud.vivienda_propia_o_autorizada ? 'propia o autorizada' : 'sin autorización'}`,
            etiqueta: 'Vivienda'
          },
          { icono: 'paw', texto: solicitud.experiencia_previa, etiqueta: 'Experiencia' }
        ].map((c) => (
          <View key={c.etiqueta} style={styles.chipDato} accessible accessibilityLabel={`${c.etiqueta}: ${c.texto}`}>
            <Icono nombre={c.icono} tamano={16} color={T.color.primarioMedio} />
            <Text style={[T.tipo.cuerpoS, styles.textoChip, { color: T.color.texto }]}>{c.texto}</Text>
          </View>
        ))}
      </View>
      <View style={styles.cita}>
        <Text style={[T.tipo.etiquetaS, { color: T.color.textoTenue }]}>MOTIVO</Text>
        <Text style={[T.tipo.cuerpo, { color: T.color.texto }]}>{solicitud.motivo_adopcion}</Text>
      </View>
      <View style={[styles.filaChips, { marginBottom: T.esp.md }]}>
        <ChipEstado
          texto={`Filtro Ley Ángel ${confirmadas}/${CAMPOS_FILTRO_LEY_ANGEL.length}`}
          tono={confirmadas === CAMPOS_FILTRO_LEY_ANGEL.length ? 'exito' : 'error'}
          icono="shield-check-outline"
          etiquetaAccesible={`Filtro Ley Ángel: ${confirmadas} de ${CAMPOS_FILTRO_LEY_ANGEL.length} confirmaciones, incluida la declaración juramentada`}
        />
      </View>
      <CampoTexto
        etiqueta="Observaciones del albergue"
        ayuda="Obligatorias si rechazas. El postulante las verá."
        value={observaciones}
        onChangeText={(v) => { setObservaciones(v); setError(''); }}
        placeholder="Ej.: visita de verificación programada"
        multiline
        textAlignVertical="top"
        error={error}
      />
      <View style={styles.filaBotones}>
        <Boton titulo="Rechazar" variante="peligroContorno" icono="close" estilo={styles.flex1}
          etiqueta={`Rechazar solicitud de ${solicitud.nombre_completo}`} onPress={() => decidir(ESTADO_SOLICITUD.RECHAZADA)} />
        <Boton titulo="Aprobar" icono="check" estilo={styles.flex1}
          etiqueta={`Aprobar solicitud de ${solicitud.nombre_completo}`} onPress={() => decidir(ESTADO_SOLICITUD.APROBADA)} />
      </View>
    </Tarjeta>
  );
}

// Fila de un animal con postulaciones pendientes: el albergue entra al animal y ve a sus postulantes.
function FilaAnimalSolicitudes({ animal, cantidad, masAntigua, onPress }) {
  const nombre = animal ? animal.nombre : 'Animal';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}: ${cantidad} ${cantidad === 1 ? 'postulante' : 'postulantes'} por revisar. Abrir`}
      android_ripple={{ color: 'rgba(27,67,50,0.1)', foreground: true }}
      style={({ pressed }) => [styles.itemBandeja, pressed && Platform.OS === 'ios' && styles.presionado]}
    >
      {animal ? <FotoAnimal uri={fotoUrl(animal.foto_url, 200)} especie={animal.especie} estilo={styles.miniatura} tamanoIcono={22} /> : null}
      <View style={styles.flex1}>
        <Text style={[T.tipo.tituloS, { color: T.color.texto }]} numberOfLines={1}>{nombre}</Text>
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]} numberOfLines={1}>
          {animal ? `${animal.especie} · ${animal.edad_aproximada}` : ''}
        </Text>
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue }]} numberOfLines={1}>
          Primera solicitud {textoRelativo(masAntigua).toLowerCase()}
        </Text>
      </View>
      <ChipEstado texto={`${cantidad} ${cantidad === 1 ? 'postulante' : 'postulantes'}`} tono="alerta" icono="account-multiple-outline" compacto accesible={false} />
      <Icono nombre="chevron-right" tamano={22} color={T.color.textoTenue} />
    </Pressable>
  );
}

function PanelSolicitudes({ rol, refrescar }) {
  const [mensaje, setMensaje] = useState(null);
  const [animalAbierto, setAnimalAbierto] = useState(null);
  if (rol !== 'albergue') return null;
  const pendientes = store.solicitudes.filter((s) => s.estado_solicitud === ESTADO_SOLICITUD.PENDIENTE);
  // Agrupadas por animal; dentro de cada animal, la solicitud más antigua primero.
  const grupos = {};
  pendientes.forEach((s) => { (grupos[s.animal_id] = grupos[s.animal_id] || []).push(s); });
  Object.values(grupos).forEach((lista) => lista.sort((a, b) => new Date(a.fecha_solicitud) - new Date(b.fecha_solicitud)));
  const animalesConSolicitudes = Object.keys(grupos)
    .map((id) => ({ id, animal: buscarAnimal(id), solicitudes: grupos[id] }))
    .sort((a, b) => b.solicitudes.length - a.solicitudes.length || new Date(a.solicitudes[0].fecha_solicitud) - new Date(b.solicitudes[0].fecha_solicitud));
  const grupoAbierto = animalAbierto ? animalesConSolicitudes.find((g) => g.id === animalAbierto) : null;
  const alResolver = (decision, animal, r = {}) => {
    const nombre = animal ? animal.nombre : 'El animal';
    const auto = r.autoRechazadas || 0;
    setMensaje(decision === ESTADO_SOLICITUD.APROBADA
      ? { tono: 'exito', texto: `Solicitud aprobada. ${nombre} quedó como "Adoptado" y su seguimiento ya está activo.${auto ? ` ${auto === 1 ? 'Otra solicitud se rechazó' : `${auto} solicitudes se rechazaron`} automáticamente.` : ''}` }
      : r.quedan > 0
        ? { tono: 'neutro', texto: `Solicitud rechazada. ${nombre} sigue "En proceso": ${r.quedan === 1 ? 'queda 1 solicitud' : `quedan ${r.quedan} solicitudes`} por revisar.` }
        : { tono: 'neutro', texto: `Solicitud rechazada. ${nombre} volvió a estar "Disponible".` });
    // Al aprobar se cierran todas las del animal; al rechazar la última, el grupo desaparece. En ambos casos se vuelve a la lista.
    const quedanDelAnimal = animal ? pendientesDeAnimal(animal.id).length : 0;
    if (quedanDelAnimal === 0) setAnimalAbierto(null);
    refrescar();
  };

  if (grupoAbierto) {
    const nombre = grupoAbierto.animal ? grupoAbierto.animal.nombre : 'este animal';
    const n = grupoAbierto.solicitudes.length;
    return (
      <View style={styles.espacioSeccion}>
        <View style={styles.filaCentro}>
          <BotonIcono icono="arrow-left" etiqueta="Volver a las mascotas con solicitudes" onPress={() => { setAnimalAbierto(null); setMensaje(null); }} />
          <View style={styles.flex1}>
            <Text style={[T.tipo.tituloM, { color: T.color.texto }]} accessibilityRole="header">Postulantes para {nombre}</Text>
            <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>
              {n === 1 ? '1 solicitud por revisar' : `${n} solicitudes por revisar · de la más antigua a la más reciente`}
            </Text>
          </View>
        </View>
        {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}
        {n > 1 ? (
          <Aviso tono="neutro" icono="information-outline">
            Si apruebas a un postulante, las demás solicitudes de {nombre} se rechazarán automáticamente.
          </Aviso>
        ) : null}
        {grupoAbierto.solicitudes.map((s) => (
          <TarjetaSolicitudPendiente key={s.id} solicitud={s} rol={rol} onResuelta={alResolver} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.espacioSeccion}>
      <TituloSeccion
        titulo="Solicitudes por revisar"
        contador={pendientes.length}
        subtitulo={animalesConSolicitudes.length > 0
          ? `${animalesConSolicitudes.length} ${animalesConSolicitudes.length === 1 ? 'mascota tiene' : 'mascotas tienen'} postulantes. Entra a cada una para compararlos.`
          : 'Revisa cada postulación y decide si la apruebas.'}
      />
      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}
      {animalesConSolicitudes.length === 0 ? (
        <Tarjeta>
          <EstadoVacio icono="inbox-outline" titulo="Bandeja al día" texto="Cuando un ciudadano se postule, verás aquí la mascota y sus postulantes." />
        </Tarjeta>
      ) : (
        <Tarjeta estilo={{ padding: 0, overflow: 'hidden' }}>
          {animalesConSolicitudes.map((g, i) => (
            <View key={g.id}>
              {i > 0 ? <View style={styles.divisorPleno} /> : null}
              <FilaAnimalSolicitudes
                animal={g.animal}
                cantidad={g.solicitudes.length}
                masAntigua={g.solicitudes[0].fecha_solicitud}
                onPress={() => { setAnimalAbierto(g.id); setMensaje(null); }}
              />
            </View>
          ))}
        </Tarjeta>
      )}
    </View>
  );
}

// Pantalla para que el albergue publique un animal en la galería de adopción.
function PantallaNuevoAnimal({ rol, onCerrar, onPublicado }) {
  const [d, setD] = useState({
    nombre: '', especie: '', edad_aproximada: '', talla: '', estado_salud: '',
    esterilizado: false, vacunado: false, temperamento: '', historia_resumen: '',
    albergue_id: store.albergues.length === 1 ? store.albergues[0].id : '', foto_url: null
  });
  const [errores, setErrores] = useState({});
  const [cargandoFoto, setCargandoFoto] = useState(null);
  const [permisoNegado, setPermisoNegado] = useState(null);
  const sucio = useRef(false);

  const cambiar = (campo, valor, claveError) => {
    sucio.current = true;
    setD((x) => ({ ...x, [campo]: valor }));
    if (claveError) setErrores((x) => ({ ...x, [claveError]: undefined, general: undefined }));
  };
  const salir = () => (sucio.current ? confirmarDescarte(onCerrar) : onCerrar());

  // Mismo patrón de DenunciasComponent: re-codificar con expo-image-manipulator elimina el EXIF.
  const obtenerFoto = async (origen) => {
    setPermisoNegado(null);
    try {
      setCargandoFoto(origen);
      const camara = origen === 'camara';
      const permiso = camara
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        setPermisoNegado({ origen: camara ? 'cámara' : 'galería', puedePedir: permiso.canAskAgain !== false });
        return;
      }
      const r = camara
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
      if (!r.canceled && r.assets && r.assets.length > 0) {
        const limpia = await ImageManipulator.manipulateAsync(r.assets[0].uri, [], {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG
        });
        cambiar('foto_url', limpia.uri, 'foto');
      }
    } catch (e) {
      setErrores((x) => ({ ...x, general: 'No fue posible obtener la foto. Intenta nuevamente.' }));
    } finally {
      setCargandoFoto(null);
    }
  };

  const publicar = () => {
    Keyboard.dismiss();
    const r = agregarAnimal(rol, d);
    if (!r.ok) {
      setErrores(r.errores ? { ...r.errores, general: 'Revisa los campos marcados.' } : { general: r.error });
      return;
    }
    sucio.current = false;
    onPublicado(r.animal);
  };

  return (
    <PantallaModal onCerrar={salir}>
      <BarraSuperior titulo="Publicar animal" subtitulo="Aparecerá en la galería como Disponible" onAtras={salir} iconoAtras="close" etiquetaAtras="Cerrar sin publicar" />
      <ScrollView contentContainerStyle={styles.contenidoModal} keyboardShouldPersistTaps="handled">
        <Text style={[T.tipo.etiqueta, { color: errores.foto ? T.color.error : T.color.texto }]}>
          Foto principal<Text style={{ color: T.color.error }}> *</Text>
        </Text>
        {d.foto_url ? (
          <View style={styles.vistaFoto}>
            <Image source={{ uri: d.foto_url }} style={styles.fotoReporteGrande} resizeMode="cover" accessibilityLabel="Vista previa de la foto del animal" />
            <BotonIcono icono="close" etiqueta="Quitar foto" variante="sobreImagen" onPress={() => cambiar('foto_url', null)} estilo={styles.quitarFoto} />
          </View>
        ) : (
          <Pressable
            onPress={() => obtenerFoto('camara')}
            disabled={!!cargandoFoto}
            accessibilityRole="button"
            accessibilityLabel="Agrega la foto del animal. Abre la cámara."
            style={[styles.fotoMarcadorVacio, errores.foto && { borderColor: T.color.error }]}
          >
            <Icono nombre="camera-plus-outline" tamano={36} color={errores.foto ? T.color.error : T.color.bordeFuerte} />
            <Text style={[T.tipo.etiqueta, { color: errores.foto ? T.color.error : T.color.textoSuave }]}>La foto es la protagonista de la galería</Text>
          </Pressable>
        )}
        <View style={[styles.filaBotones, { marginTop: T.esp.sm }]}>
          <Boton titulo={d.foto_url ? 'Tomar otra' : 'Tomar foto'} variante="tonal" icono="camera-outline"
            cargando={cargandoFoto === 'camara'} deshabilitado={!!cargandoFoto} onPress={() => obtenerFoto('camara')} estilo={styles.flex1} />
          <Boton titulo="Galería" variante="contorno" icono="image-outline"
            cargando={cargandoFoto === 'galeria'} deshabilitado={!!cargandoFoto} onPress={() => obtenerFoto('galeria')} estilo={styles.flex1} />
        </View>
        <View style={{ marginTop: T.esp.sm }}><FilaError texto={errores.foto} /></View>
        <View style={styles.filaCentroXs}>
          <Icono nombre="shield-check-outline" tamano={16} color={T.color.primarioMedio} />
          <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.textoSuave }]}>
            Eliminamos los metadatos EXIF (ubicación y dispositivo) antes de publicar la foto.
          </Text>
        </View>
        {permisoNegado ? (
          <View style={{ marginTop: T.esp.md }}>
            <Aviso
              tono="alerta"
              icono="camera-off-outline"
              titulo={`Sin permiso de ${permisoNegado.origen}`}
              accion={!permisoNegado.puedePedir ? (
                <Boton titulo="Abrir ajustes" variante="texto" tamano="sm" icono="cog-outline" onPress={() => Linking.openSettings().catch(() => {})} />
              ) : null}
            >
              {permisoNegado.origen === 'cámara' ? 'Sin acceso a la cámara. Puedes elegir una foto de la galería.' : 'Sin acceso a tus fotos. Puedes tomar una con la cámara.'}
            </Aviso>
          </View>
        ) : null}

        <EncabezadoPaso numero={1} titulo="Datos del animal" />
        <CampoTexto etiqueta="Nombre" obligatorio value={d.nombre} onChangeText={(v) => cambiar('nombre', v, 'nombre')}
          placeholder="Ej.: Rocky" maxLength={40} error={errores.nombre} />
        <GrupoOpciones etiqueta="Especie" opciones={ESPECIES} valor={d.especie} onCambiar={(v) => cambiar('especie', v, 'especie')} error={errores.especie} />
        <CampoTexto etiqueta="Edad aproximada" obligatorio value={d.edad_aproximada} onChangeText={(v) => cambiar('edad_aproximada', v, 'edad')}
          placeholder="Ej.: 2 años" maxLength={20} error={errores.edad} />
        <GrupoOpciones etiqueta="Talla" opciones={TALLAS} valor={d.talla} onCambiar={(v) => cambiar('talla', v, 'talla')} error={errores.talla} />
        <CampoTexto etiqueta="Temperamento" ayuda="Hasta 3 rasgos separados por comas. Opcional." value={d.temperamento}
          onChangeText={(v) => cambiar('temperamento', v)} placeholder="Ej.: juguetón, tranquilo, sociable" maxLength={80} />

        <EncabezadoPaso numero={2} titulo="Salud" />
        <CampoTexto etiqueta="Estado de salud" obligatorio value={d.estado_salud} onChangeText={(v) => cambiar('estado_salud', v, 'salud')}
          placeholder="Ej.: Sano y desparasitado" maxLength={120} error={errores.salud} />
        <Casilla marcada={d.esterilizado} onCambiar={() => cambiar('esterilizado', !d.esterilizado)} texto="Está esterilizado" />
        <Casilla marcada={d.vacunado} onCambiar={() => cambiar('vacunado', !d.vacunado)} texto="Tiene sus vacunas al día" />

        <EncabezadoPaso numero={3} titulo="Historia y albergue" />
        <CampoTexto etiqueta="Su historia" obligatorio ayuda="Cómo llegó al albergue y cómo es su carácter."
          value={d.historia_resumen} onChangeText={(v) => cambiar('historia_resumen', v, 'historia')}
          placeholder="Ej.: Lo rescatamos en Bosa. Es noble y le encanta pasear." maxLength={400} multiline textAlignVertical="top" error={errores.historia} />
        <GrupoOpciones
          etiqueta="Albergue responsable"
          opciones={store.albergues.map((a) => a.nombre_albergue)}
          valor={(store.albergues.find((a) => a.id === d.albergue_id) || {}).nombre_albergue}
          onCambiar={(nombre) => cambiar('albergue_id', (store.albergues.find((a) => a.nombre_albergue === nombre) || {}).id, 'albergue')}
          error={errores.albergue}
        />

        {errores.general ? <View style={{ marginTop: T.esp.md }}><Aviso tono="error">{errores.general}</Aviso></View> : null}
        <View style={styles.accionesFormulario}>
          <Boton titulo="Publicar en la galería" icono="paw" onPress={publicar} />
          <Boton titulo="Cancelar" variante="texto" onPress={salir} />
        </View>
      </ScrollView>
    </PantallaModal>
  );
}

// ============================================================================
// 8. SEGUIMIENTO: CALENDARIO, PRÓXIMO SEGUIMIENTO, REPORTES Y BANDEJA (RF04 / RNF05)
// ============================================================================
const DIAS_CORTOS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

// Estados del día de un hito con forma, no solo color: contorno (futuro), relleno con anillo
// (próximo), relleno + borde + visto (al día), relleno + "!" (vencido), relleno oscuro (incumplido).
function estiloDiaHito(h, esProximo) {
  if (h.estadoUI === ESTADO_HITO_UI.AL_DIA) {
    return { fondo: T.color.acento, texto: T.color.sobreContenedor, borde: T.color.primarioMedio, anchoBorde: 2, insignia: 'check', colorInsignia: T.color.primarioMedio };
  }
  if (h.estadoUI === ESTADO_HITO_UI.VENCIDO) {
    return { fondo: T.color.error, texto: T.color.sobrePrimario, insignia: 'exclamation', colorInsignia: T.color.error };
  }
  if (h.estadoUI === ESTADO_HITO_UI.INCUMPLIMIENTO) {
    return { fondo: T.color.incumplimiento, texto: T.color.sobrePrimario, insignia: 'close', colorInsignia: T.color.incumplimiento };
  }
  if (esProximo) return { fondo: T.color.primario, texto: T.color.sobrePrimario, borde: T.color.acento, anchoBorde: 3 };
  return { fondo: 'transparent', texto: T.color.primario, borde: T.color.primarioMedio, anchoBorde: 2 };
}

function Calendario({ solicitud, hitos, cursor, onCursor, seleccion, onSeleccionar }) {
  const ahora = Date.now();
  const eventos = eventosCalendario(solicitud, ahora);
  const semanas = construirMes(cursor.anio, cursor.mes);
  const hoyClave = claveDia(ahora);
  const prox = proximoHito(hitos);
  const proxClave = prox ? claveDia(prox.fechaLimite) : null;
  const hoy = new Date(ahora);
  const esMesActual = cursor.anio === hoy.getFullYear() && cursor.mes === hoy.getMonth();

  return (
    <Tarjeta estilo={styles.tarjetaCalendario}>
      <View style={styles.calendarioCabecera}>
        <Text style={[T.tipo.tituloM, { color: T.color.texto, textTransform: 'capitalize' }]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {MESES_LARGOS[cursor.mes]} {cursor.anio}
        </Text>
        <View style={styles.filaCentroXs}>
          {!esMesActual || seleccion !== hoyClave ? (
            <Boton titulo="Hoy" variante="texto" tamano="sm" onPress={() => { onCursor({ anio: hoy.getFullYear(), mes: hoy.getMonth() }); onSeleccionar(hoyClave); }} />
          ) : null}
          <BotonIcono icono="chevron-left" etiqueta="Mes anterior" onPress={() => onCursor(moverMes(cursor, -1))} />
          <BotonIcono icono="chevron-right" etiqueta="Mes siguiente" onPress={() => onCursor(moverMes(cursor, 1))} />
        </View>
      </View>
      <View style={styles.calendarioFila}>
        {DIAS_CORTOS.map((d) => (
          <Text key={d} style={[styles.calendarioDiaSemana, T.tipo.etiquetaS]} importantForAccessibility="no">{d}</Text>
        ))}
      </View>
      {semanas.map((semana, i) => (
        <View key={i} style={styles.calendarioFila}>
          {semana.map((c) => {
            const evs = eventos[c.clave] || [];
            const hitoEv = evs.find((e) => e.tipo === 'hito');
            const reportes = evs.filter((e) => e.tipo === 'reporte').length;
            const extemp = evs.some((e) => e.tipo === 'reporte' && e.extemporaneo);
            const inicio = evs.some((e) => e.tipo === 'inicio');
            const esHoy = c.clave === hoyClave;
            const esProximo = c.clave === proxClave;
            const seleccionado = c.clave === seleccion;
            const est = hitoEv ? estiloDiaHito(hitoEv.hito, esProximo) : null;
            const fecha = new Date(c.ms);
            const partes = [`${c.dia} de ${MESES_LARGOS[fecha.getMonth()]}`];
            if (esHoy) partes.push('hoy');
            if (hitoEv) partes.push(`hito ${hitoEv.hito.hito_control}, ${hitoEv.hito.estadoUI}`);
            if (esProximo) partes.push('próximo seguimiento');
            if (inicio) partes.push('inicio de la adopción');
            if (reportes) partes.push(`${reportes} ${reportes === 1 ? 'reporte' : 'reportes'}${extemp ? ', extemporáneo' : ''}`);
            return (
              <Pressable
                key={c.clave}
                onPress={() => onSeleccionar(c.clave)}
                accessibilityRole="button"
                accessibilityState={{ selected: seleccionado }}
                accessibilityLabel={partes.join(', ')}
                style={[styles.calendarioCelda, seleccionado && styles.calendarioCeldaSeleccionada]}
              >
                <View
                  style={[
                    styles.calendarioNumero,
                    est && { backgroundColor: est.fondo, borderColor: est.borde || 'transparent', borderWidth: est.anchoBorde || 0 }
                  ]}
                >
                  <Text
                    style={[
                      T.tipo.etiqueta,
                      { color: est ? est.texto : c.enMes ? T.color.texto : T.color.textoTenue },
                      !c.enMes && !est && { opacity: 0.55 },
                      (esHoy || est) && { fontWeight: '800' }
                    ]}
                  >
                    {c.dia}
                  </Text>
                  {est && est.insignia ? (
                    <View style={[styles.calendarioInsignia, { backgroundColor: est.colorInsignia }]}>
                      <Icono nombre={est.insignia} tamano={10} color={T.color.sobrePrimario} />
                    </View>
                  ) : null}
                </View>
                <View style={[styles.calendarioHoyBarra, esHoy && { backgroundColor: T.color.primarioMedio }]} />
                <View style={styles.calendarioPuntos}>
                  {inicio ? <View style={[styles.punto, { backgroundColor: T.color.primarioMedio }]} /> : null}
                  {reportes > 0 ? <View style={[styles.punto, { backgroundColor: T.color.reporte }]} /> : null}
                  {extemp ? <View style={[styles.punto, styles.puntoExtemporaneo]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.leyenda}>
        {[
          { texto: 'Próximo', muestra: { backgroundColor: T.color.primario, borderWidth: 2, borderColor: T.color.acento } },
          { texto: 'Pendiente', muestra: { borderWidth: 2, borderColor: T.color.primarioMedio } },
          { texto: 'Al día', muestra: { backgroundColor: T.color.acento, borderWidth: 2, borderColor: T.color.primarioMedio } },
          { texto: 'Vencido', muestra: { backgroundColor: T.color.error } },
          { texto: 'Incumplido', muestra: { backgroundColor: T.color.incumplimiento } },
          { texto: 'Reporte', punto: T.color.reporte },
          { texto: 'Extemporáneo', punto: T.color.alertaFuerte, cuadrado: true },
          { texto: 'Inicio', punto: T.color.primarioMedio }
        ].map((l) => (
          <View key={l.texto} style={styles.leyendaItem}>
            <View style={l.punto ? [styles.punto, { backgroundColor: l.punto }, l.cuadrado && styles.puntoExtemporaneo] : [styles.leyendaMuestra, l.muestra]} />
            <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>{l.texto}</Text>
          </View>
        ))}
        <View style={styles.leyendaItem}>
          <View style={[styles.calendarioHoyBarra, { backgroundColor: T.color.primarioMedio, marginTop: 0 }]} />
          <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>Hoy</Text>
        </View>
      </View>
    </Tarjeta>
  );
}

function DetalleDia({ solicitud, clave }) {
  const evs = eventosCalendario(solicitud)[clave] || [];
  const [a, m, d] = clave.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  return (
    <View style={styles.detalleDia} accessibilityLiveRegion="polite">
      <Text style={[T.tipo.etiqueta, { color: T.color.texto, textTransform: 'capitalize' }]}>
        {DIAS_LARGOS[fecha.getDay()]} {d} de {MESES_LARGOS[m - 1]}
      </Text>
      {evs.length === 0 ? (
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>Sin eventos este día.</Text>
      ) : (
        evs.map((e, i) => {
          if (e.tipo === 'inicio') {
            return <View key={i} style={styles.filaCentroXs}><Icono nombre="flag-outline" tamano={18} color={T.color.primarioMedio} /><Text style={[T.tipo.cuerpoS, { color: T.color.texto }]}>Inicio de la adopción</Text></View>;
          }
          if (e.tipo === 'hito') {
            return (
              <View key={i} style={styles.filaCentroXs}>
                <Icono nombre="calendar-star" tamano={18} color={T.color.primarioMedio} />
                <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.texto }]}>Fecha límite del hito {e.hito.hito_control}</Text>
                <ChipEstado texto={e.hito.estadoUI} compacto />
              </View>
            );
          }
          const tipo = buscarTipoReporte(e.reporte.tipo_reporte);
          return (
            <View key={i} style={styles.filaCentroXs}>
              <Icono nombre={tipo ? tipo.icono : 'clipboard-text-outline'} tamano={18} color={T.color.info} />
              <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.texto }]}>
                Reporte: {tipo ? tipo.etiqueta.toLowerCase() : 'seguimiento'}{e.reporte.hito_control ? ` (cuenta como ${e.reporte.hito_control})` : ''}
                {e.extemporaneo ? `. Enviado el ${formatearFecha(e.reporte.fecha_registro)}` : ''}
              </Text>
              {e.extemporaneo ? <ChipEstado texto="Extemporáneo" tono="alerta" icono="clock-alert-outline" compacto /> : null}
            </View>
          );
        })
      )}
    </View>
  );
}

function PasosHitos({ hitos, claro = false }) {
  return (
    <View style={styles.pasosHitos}>
      {hitos.map((h, i) => {
        const hecho = h.estadoUI === ESTADO_HITO_UI.AL_DIA;
        const malo = h.estadoUI === ESTADO_HITO_UI.VENCIDO || h.estadoUI === ESTADO_HITO_UI.INCUMPLIMIENTO;
        const colorBase = claro ? T.color.sobrePrimario : T.color.primarioMedio;
        return (
          <React.Fragment key={h.hito_control}>
            <View style={styles.pasoHito} accessible accessibilityLabel={`${h.hito_control}: ${h.estadoUI}`}>
              <View
                style={[
                  styles.pasoHitoCirculo,
                  { borderColor: colorBase },
                  hecho && { backgroundColor: colorBase },
                  malo && { backgroundColor: claro ? T.color.sobrePrimario : T.color.error, borderColor: claro ? T.color.sobrePrimario : T.color.error }
                ]}
              >
                {hecho ? <Icono nombre="check" tamano={14} color={claro ? T.color.primario : T.color.sobrePrimario} /> : null}
                {malo ? <Icono nombre="exclamation" tamano={14} color={claro ? T.color.error : T.color.sobrePrimario} /> : null}
              </View>
              <Text style={[T.tipo.etiquetaS, { color: claro ? T.color.sobrePrimario : T.color.textoSuave }]}>{h.hito_control}</Text>
            </View>
            {i < hitos.length - 1 ? <View style={[styles.pasoHitoLinea, { backgroundColor: claro ? 'rgba(255,255,255,0.45)' : T.color.borde }]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function TarjetaProximo({ hitos, rol, onEnviar, compacta = false }) {
  const prox = proximoHito(hitos);
  if (!prox) {
    return (
      <LinearGradient colors={T.gradiente.marcaInvertida} style={styles.proximo}>
        <View style={styles.filaCentro}>
          <Icono nombre="trophy-outline" tamano={32} color={T.color.acento} />
          <View style={styles.flex1}>
            <Text style={[T.tipo.sobretitulo, { color: T.color.acento }]}>SEGUIMIENTO COMPLETO</Text>
            <Text style={[T.tipo.tituloM, { color: T.color.sobrePrimario }]}>Los 3 hitos tienen registro</Text>
          </View>
        </View>
        <PasosHitos hitos={hitos} claro />
        {rol === 'ciudadano' && onEnviar ? (
          <Boton titulo="Enviar un reporte" variante="claro" icono="send" onPress={onEnviar} estilo={{ marginTop: T.esp.md }} anchoCompleto />
        ) : null}
      </LinearGradient>
    );
  }
  const vencido = prox.estadoUI === ESTADO_HITO_UI.VENCIDO;
  const f = new Date(prox.fechaLimite);
  return (
    <LinearGradient
      colors={vencido ? T.gradiente.vencido : T.gradiente.marca}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.proximo}
    >
      <View
        accessible
        accessibilityLabel={`${vencido ? 'Seguimiento vencido' : 'Próximo seguimiento'}: hito ${prox.hito_control}, ${DIAS_LARGOS[f.getDay()]} ${f.getDate()} de ${MESES_LARGOS[f.getMonth()]}. ${textoCuentaRegresiva(prox)}.`}
      >
        <View style={styles.filaEntre}>
          <Text style={[T.tipo.sobretitulo, { color: vencido ? T.color.sobreVencido : T.color.acento }]}>
            {vencido ? 'SEGUIMIENTO VENCIDO' : 'PRÓXIMO SEGUIMIENTO'}
          </Text>
          <View style={styles.pildoraCuenta}>
            <Icono nombre={vencido ? 'alert-circle-outline' : 'timer-outline'} tamano={14} color={vencido ? T.color.sobreContenedorError : T.color.primario} />
            <Text style={[T.tipo.etiquetaS, { color: vencido ? T.color.sobreContenedorError : T.color.primario }]}>{textoCuentaRegresiva(prox)}</Text>
          </View>
        </View>
        <View style={[styles.filaCentro, { marginTop: T.esp.sm }]}>
          <Text style={[styles.fechaGrande]}>{f.getDate()}</Text>
          <View>
            <Text style={[T.tipo.tituloL, { color: T.color.sobrePrimario, textTransform: 'capitalize' }]}>{MESES_LARGOS[f.getMonth()]}</Text>
            <Text style={[T.tipo.cuerpo, { color: 'rgba(255,255,255,0.88)', textTransform: 'capitalize' }]}>
              {DIAS_LARGOS[f.getDay()]} · Hito {prox.hito_control}
            </Text>
          </View>
        </View>
        {!compacta ? (
          <Text style={[T.tipo.cuerpoS, { color: 'rgba(255,255,255,0.88)', marginTop: T.esp.sm }]}>
            {vencido
              ? rol === 'albergue'
                ? 'El adoptante no reportó dentro del plazo. Puedes contactarlo o marcar el incumplimiento.'
                : 'Envía tu reporte con foto cuanto antes para ponerte al día.'
              : prox.ventanaAbierta
                ? 'El registro de este hito ya está abierto.'
                : `El registro de este hito se abre el ${formatearFecha(prox.apertura)}. Puedes enviar reportes libres cuando quieras.`}
          </Text>
        ) : null}
      </View>
      <PasosHitos hitos={hitos} claro />
      {rol === 'ciudadano' && onEnviar ? (
        <Boton
          titulo={vencido ? 'Ponerme al día' : 'Enviar seguimiento'}
          variante={vencido ? 'claroError' : 'claro'}
          icono="send"
          onPress={onEnviar}
          anchoCompleto
          estilo={{ marginTop: T.esp.md }}
        />
      ) : null}
    </LinearGradient>
  );
}

function TarjetaReporte({ reporte, rol, refrescar, tarde = false }) {
  const [texto, setTexto] = useState(reporte.observacion_albergue || '');
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState('');
  const esIncumplimiento = reporte.estado_cumplimiento === CUMPLIMIENTO.ALERTA;
  const tipo = buscarTipoReporte(reporte.tipo_reporte);
  const tono = esIncumplimiento ? TONOS.fuerte : TONOS[tipo ? tipo.tono : 'neutro'];
  const destacado = !esIncumplimiento && tipo && (tipo.id === 'urgencia' || tipo.id === 'medico');
  const nuevo = rol === 'albergue' && !reporte.leido_albergue;

  const guardar = () => {
    Keyboard.dismiss();
    const r = guardarObservacionAlbergue(rol, reporte.id, texto);
    if (!r.ok) { setError(r.error); return; }
    setEditando(false);
    setError('');
    refrescar();
  };

  return (
    <View style={styles.lineaTiempoItem}>
      <View style={styles.lineaTiempoRiel}>
        <View style={[styles.lineaTiempoNodo, { backgroundColor: tono.fondo }]}>
          <Icono nombre={esIncumplimiento ? 'alert-decagram' : tipo ? tipo.icono : 'clipboard-text-outline'} tamano={18} color={tono.texto} />
        </View>
        <View style={styles.lineaTiempoLinea} />
      </View>
      <Tarjeta estilo={[styles.flex1, styles.espacioAbajo, destacado && { borderWidth: 1.5, borderColor: tipo.id === 'urgencia' ? T.color.error : T.color.alertaFuerte }]}>
        <View style={styles.filaEntre}>
          <View style={[styles.filaChips, styles.flex1]}>
            <ChipEstado
              texto={esIncumplimiento ? 'Incumplimiento' : tipo ? tipo.corto : 'Seguimiento'}
              tono={esIncumplimiento ? 'fuerte' : tipo ? tipo.tono : 'neutro'}
              icono={esIncumplimiento ? 'alert-decagram' : tipo ? tipo.icono : undefined}
              compacto
            />
            {reporte.hito_control ? <ChipEstado texto={`Hito ${reporte.hito_control}`} tono="primario" icono="calendar-star" compacto /> : null}
            {tarde || esExtemporaneo(reporte) ? (
              <ChipEstado texto="Extemporáneo" tono="alerta" icono="clock-alert-outline" compacto
                etiquetaAccesible={tarde ? 'Extemporáneo: fecha del seguimiento posterior al plazo del hito' : 'Extemporáneo: registrado después de la fecha del seguimiento'} />
            ) : null}
          </View>
          {nuevo ? <View style={styles.nuevo}><Text style={[T.tipo.etiquetaS, { color: T.color.sobrePrimario }]}>Nuevo</Text></View> : null}
        </View>
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue, marginTop: T.esp.sm }]}>
          {esExtemporaneo(reporte)
            ? `Seguimiento del ${formatearFecha(reporte.fecha_seguimiento)} · enviado el ${formatearFechaHora(reporte.fecha_registro)}`
            : `${formatearFechaHora(reporte.fecha_registro)} · ${reporte.autor === 'albergue' ? 'Registrado por el albergue' : 'Enviado por el adoptante'}`}
        </Text>
        <Text style={[T.tipo.cuerpo, { color: T.color.texto, marginTop: T.esp.xs }]}>{reporte.estado_animal}</Text>
        {reporte.foto_seguimiento_path ? (
          <Image
            source={{ uri: reporte.foto_seguimiento_path }}
            style={styles.fotoReporte}
            resizeMode="cover"
            accessibilityLabel="Foto del seguimiento"
          />
        ) : null}
        {reporte.observacion_albergue && !editando ? (
          <View style={styles.observacion}>
            <View style={styles.filaCentroXs}>
              <Icono nombre="home-heart" tamano={16} color={T.color.primarioMedio} />
              <Text style={[T.tipo.etiquetaS, { color: T.color.primarioMedio }]}>Observación del albergue</Text>
            </View>
            <Text style={[T.tipo.cuerpoS, { color: T.color.texto, marginTop: 2 }]}>{reporte.observacion_albergue}</Text>
          </View>
        ) : null}
        {rol === 'albergue' && !esIncumplimiento ? (
          editando ? (
            <View style={{ marginTop: T.esp.md }}>
              <CampoTexto
                etiqueta="Observación para el adoptante"
                value={texto}
                onChangeText={(v) => { setTexto(v); setError(''); }}
                placeholder="Ej.: Gracias por el reporte, todo en orden."
                multiline
                textAlignVertical="top"
                error={error}
              />
              <View style={styles.filaBotones}>
                <Boton titulo="Cancelar" variante="texto" onPress={() => { setEditando(false); setTexto(reporte.observacion_albergue || ''); setError(''); }} />
                <Boton titulo="Guardar" variante="tonal" icono="content-save-outline" onPress={guardar} />
              </View>
            </View>
          ) : (
            <View style={[styles.filaBotones, { marginTop: T.esp.sm }]}>
              {nuevo ? (
                <Boton titulo="Marcar revisado" variante="texto" tamano="sm" icono="check" onPress={() => { marcarLeido(rol, reporte.id); refrescar(); }} />
              ) : null}
              <Boton
                titulo={reporte.observacion_albergue ? 'Editar observación' : 'Responder'}
                variante="tonal"
                tamano="sm"
                icono="message-reply-text-outline"
                onPress={() => setEditando(true)}
              />
            </View>
          )
        ) : null}
      </Tarjeta>
    </View>
  );
}

function AccionIncumplimiento({ solicitud, h, rol, refrescar }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  if (rol !== 'albergue' || h.estadoUI !== ESTADO_HITO_UI.VENCIDO) return null;
  const marcar = () => {
    Keyboard.dismiss();
    Alert.alert(
      '¿Marcar incumplimiento de seguimiento?',
      `${h.hito_control} de ${solicitud.nombre_completo}. Quedará registrado como alerta del albergue.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar', style: 'destructive',
          onPress: () => {
            const r = marcarIncumplimiento(rol, solicitud.id, h.hito_control, texto);
            if (!r.ok) { setError(r.error); return; }
            refrescar();
          }
        }
      ]
    );
  };
  return (
    <Tarjeta plana estilo={[styles.tarjetaError, styles.espacioAbajo]}>
      <View style={styles.filaCentro}>
        <Icono nombre="alert-circle-outline" tamano={24} color={T.color.sobreContenedorError} />
        <View style={styles.flex1}>
          <Text style={[T.tipo.tituloS, { color: T.color.sobreContenedorError }]}>{h.hito_control}: seguimiento vencido</Text>
          <Text style={[T.tipo.cuerpoS, { color: T.color.sobreContenedorError }]}>Sin reporte del adoptante. Venció el {formatearFecha(h.fechaLimite)}.</Text>
        </View>
      </View>
      {abierto ? (
        <View style={{ marginTop: T.esp.md }}>
          <CampoTexto
            etiqueta="Observación (opcional)"
            value={texto}
            onChangeText={setTexto}
            placeholder="Ej.: se llamó al adoptante sin respuesta"
            multiline
            textAlignVertical="top"
            error={error}
          />
          <View style={styles.filaBotones}>
            <Boton titulo="Cancelar" variante="texto" onPress={() => { setAbierto(false); setError(''); }} />
            <Boton titulo="Marcar incumplimiento" variante="peligro" icono="alert-decagram" onPress={marcar} />
          </View>
        </View>
      ) : (
        <Boton titulo="Marcar incumplimiento" variante="peligroContorno" icono="alert-decagram" tamano="sm" onPress={() => setAbierto(true)} estilo={{ marginTop: T.esp.md, alignSelf: 'flex-start' }} />
      )}
    </Tarjeta>
  );
}

// Tarjeta de tipo de reporte con escala sutil al presionar.
function TarjetaTipo({ t, sel, onPress }) {
  const { escala, alPresionar, alSoltar } = useEscalaPresion();
  const tono = TONOS[t.tono];
  return (
    <Animated.View style={[styles.tipoTarjetaCaja, { transform: [{ scale: escala }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={alPresionar}
        onPressOut={alSoltar}
        accessibilityRole="radio"
        accessibilityState={{ checked: sel, selected: sel }}
        accessibilityLabel={`${t.etiqueta}. ${t.descripcion}`}
        android_ripple={{ color: 'rgba(27,67,50,0.12)', foreground: true }}
        style={[styles.tipoTarjeta, sel && styles.tipoTarjetaActiva]}
      >
        <View style={styles.filaEntre}>
          <View style={[styles.tipoIcono, { backgroundColor: tono.fondo }]}><Icono nombre={t.icono} tamano={22} color={tono.texto} /></View>
          <Icono nombre={sel ? 'radiobox-marked' : 'radiobox-blank'} tamano={22} color={sel ? T.color.primarioMedio : T.color.bordeFuerte} />
        </View>
        <Text style={[T.tipo.tituloS, { color: T.color.texto, marginTop: T.esp.sm }]}>{t.etiqueta}</Text>
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>{t.descripcion}</Text>
      </Pressable>
    </Animated.View>
  );
}

function FilaError({ texto }) {
  if (!texto) return null;
  return (
    <View style={[styles.filaAyuda, { marginBottom: T.esp.md }]} accessibilityLiveRegion="polite">
      <Icono nombre="alert-circle-outline" tamano={16} color={T.color.error} />
      <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.error }]}>{texto}</Text>
    </View>
  );
}

function FormularioReporte({ solicitud, nombreUsuario, sucioRef, onCancelar, onEnviado }) {
  const animal = buscarAnimal(solicitud.animal_id);
  // Fecha del seguimiento: hoy por defecto; se puede elegir un día anterior (nunca futuro ni previo a la aprobación).
  const [fecha, setFecha] = useState(() => inicioDelDia(Date.now()));
  const limites = limitesFechaSeguimiento(solicitud);
  const esHoy = fecha >= limites.max;
  const fechaRef = esHoy ? Date.now() : new Date(fecha).setHours(12, 0, 0, 0);
  const elegible = hitoElegible(solicitud, Date.now(), fechaRef);
  const habilitado = !!(elegible && elegible.habilitado);
  const [tipo, setTipo] = useState(null);
  const [texto, setTexto] = useState('');
  const [fotoUri, setFotoUri] = useState(null);
  const [contarHito, setContarHito] = useState(() => contarHitoPorDefecto(elegible, null));
  const [hitoTocado, setHitoTocado] = useState(false); // el usuario cambió el interruptor a mano
  const [errores, setErrores] = useState({}); // { tipo, texto, foto, general }
  const [cargandoFoto, setCargandoFoto] = useState(null); // 'camara' | 'galeria' | null
  const [permisoNegado, setPermisoNegado] = useState(null); // { origen, puedePedir }
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // evita doble envío por toques rápidos

  const marcarSucio = () => { if (sucioRef) sucioRef.current = true; };
  const limpiarError = (campo) => setErrores((e) => ({ ...e, [campo]: undefined, general: undefined }));

  const cambiarFecha = (delta) => {
    const nueva = Math.max(limites.min, Math.min(limites.max, inicioDelDia(sumarDias(fecha, delta))));
    setFecha(nueva);
    marcarSucio();
    limpiarError('fecha');
    if (!hitoTocado) {
      const ref = nueva >= limites.max ? Date.now() : new Date(nueva).setHours(12, 0, 0, 0);
      setContarHito(contarHitoPorDefecto(hitoElegible(solicitud, Date.now(), ref), tipo));
    }
    const f = new Date(nueva);
    AccessibilityInfo.announceForAccessibility(`Fecha del seguimiento: ${DIAS_LARGOS[f.getDay()]} ${f.getDate()} de ${MESES_LARGOS[f.getMonth()]}`);
  };

  const elegirTipo = (id) => {
    setTipo(id);
    marcarSucio();
    limpiarError('tipo');
    // Urgencias y reportes médicos no cuentan como hito por defecto, salvo que el usuario lo decida.
    if (!hitoTocado) setContarHito(contarHitoPorDefecto(elegible, id));
  };

  // Mismo patrón de DenunciasComponent: re-codificar con expo-image-manipulator elimina el EXIF.
  const limpiarFoto = async (asset) => {
    const imagenLimpia = await ImageManipulator.manipulateAsync(asset.uri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG
    });
    setFotoUri(imagenLimpia.uri);
    marcarSucio();
    limpiarError('foto');
  };

  const tomarFoto = async () => {
    limpiarError('general');
    setPermisoNegado(null);
    try {
      setCargandoFoto('camara');
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        setPermisoNegado({ origen: 'cámara', puedePedir: permiso.canAskAgain !== false });
        return;
      }
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
      if (!r.canceled && r.assets && r.assets.length > 0) await limpiarFoto(r.assets[0]);
    } catch (e) {
      setErrores((x) => ({ ...x, general: 'No fue posible usar la cámara. Prueba eligiendo una foto de la galería.' }));
    } finally {
      setCargandoFoto(null);
    }
  };

  const elegirFoto = async () => {
    limpiarError('general');
    setPermisoNegado(null);
    try {
      setCargandoFoto('galeria');
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        setPermisoNegado({ origen: 'galería', puedePedir: permiso.canAskAgain !== false });
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
      if (!r.canceled && r.assets && r.assets.length > 0) await limpiarFoto(r.assets[0]);
    } catch (e) {
      setErrores((x) => ({ ...x, general: 'No fue posible seleccionar la fotografía. Intenta nuevamente.' }));
    } finally {
      setCargandoFoto(null);
    }
  };

  const enviar = () => {
    if (enviandoRef.current) return;
    Keyboard.dismiss();
    // Validación en línea (mismos criterios que registrarSeguimiento).
    const e = {};
    if (!buscarTipoReporte(tipo)) e.tipo = 'Elige el tipo de seguimiento.';
    if (texto.trim().length < 15) e.texto = 'Describe cómo está el animal en al menos 15 caracteres.';
    if (contarHito && habilitado && !fotoUri) {
      e.foto = 'Para que cuente como hito, adjunta una foto reciente o desactiva "Contar como hito".';
    }
    if (Object.keys(e).length > 0) {
      setErrores(e);
      AccessibilityInfo.announceForAccessibility(`No se pudo enviar. ${Object.values(e).join(' ')}`);
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    const r = registrarSeguimiento('ciudadano', solicitud.id, {
      tipo, texto, fotoUri, contarComoHito: contarHito && habilitado, fechaSeguimiento: esHoy ? Date.now() : fechaRef
    }, nombreUsuario);
    if (!r.ok) {
      enviandoRef.current = false;
      setEnviando(false);
      setErrores(r.campo && r.campo !== 'hito' ? { [r.campo]: r.error } : { general: r.error });
      AccessibilityInfo.announceForAccessibility(r.error);
      return;
    }
    if (sucioRef) sucioRef.current = false;
    onEnviado(r);
  };

  const nombre = animal ? animal.nombre : 'el animal';
  const fotoObligatoria = contarHito && habilitado;

  return (
    <ScrollView contentContainerStyle={styles.contenidoModal} keyboardShouldPersistTaps="handled">
      <Text style={[T.tipo.tituloM, { color: T.color.texto }]} accessibilityRole="header">¿Qué quieres contarle al albergue?</Text>
      <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave, marginBottom: T.esp.md }]}>Puedes enviar un seguimiento en cualquier momento.</Text>
      <View style={styles.rejillaTipos} accessibilityRole="radiogroup" accessibilityLabel="Tipo de seguimiento">
        {TIPOS_REPORTE.map((t) => (
          <TarjetaTipo key={t.id} t={t} sel={tipo === t.id} onPress={() => elegirTipo(t.id)} />
        ))}
      </View>
      <FilaError texto={errores.tipo} />
      {tipo === 'urgencia' ? (
        <Aviso tono="error" icono="phone-alert-outline" titulo="Si su vida está en riesgo">
          Llama también a la Línea 123 (24 horas). El albergue verá este reporte resaltado como urgencia.
        </Aviso>
      ) : null}

      <Text style={[T.tipo.etiqueta, { color: T.color.texto }]} accessibilityRole="header">Fecha del seguimiento</Text>
      <View style={styles.selectorFecha}>
        <BotonIcono icono="chevron-left" etiqueta="Día anterior" deshabilitado={fecha <= limites.min} onPress={() => cambiarFecha(-1)} />
        <View style={[styles.flex1, { alignItems: 'center' }]} accessible accessibilityLiveRegion="polite"
          accessibilityLabel={`Fecha del seguimiento: ${esHoy ? 'hoy, ' : ''}${DIAS_LARGOS[new Date(fecha).getDay()]} ${new Date(fecha).getDate()} de ${MESES_LARGOS[new Date(fecha).getMonth()]}`}>
          <Text style={[T.tipo.etiquetaS, { color: esHoy ? T.color.primarioMedio : T.color.alerta }]}>
            {esHoy ? 'HOY' : diferenciaDias(fecha, Date.now()) === 1 ? 'AYER' : `HACE ${diferenciaDias(fecha, Date.now())} DÍAS`}
          </Text>
          <Text style={[T.tipo.tituloS, { color: T.color.texto, textTransform: 'capitalize' }]}>
            {DIAS_LARGOS[new Date(fecha).getDay()]} {new Date(fecha).getDate()} de {MESES_LARGOS[new Date(fecha).getMonth()]}
          </Text>
        </View>
        <BotonIcono icono="chevron-right" etiqueta="Día siguiente" deshabilitado={esHoy} onPress={() => cambiarFecha(1)} />
      </View>
      <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue, marginTop: T.esp.xs, marginBottom: T.esp.md }]}>
        Desde el {formatearFecha(limites.min)} (aprobación) hasta hoy. No se permiten fechas futuras.
      </Text>
      {!esHoy ? (
        <Aviso tono="alerta" icono="clock-alert-outline" titulo="Se marcará como Extemporáneo"
          accion={<Boton titulo="Volver a hoy" variante="texto" tamano="sm" icono="calendar-today" onPress={() => cambiarFecha(diferenciaDias(fecha, Date.now()))} />}>
          La fecha elegida es anterior a hoy. El albergue verá la fecha del seguimiento y la fecha real de envío.
        </Aviso>
      ) : null}
      <FilaError texto={errores.fecha} />

      <View style={[styles.hitoInterruptor, !habilitado && { opacity: 0.7 }]}>
        <Icono nombre="calendar-star" tamano={24} color={T.color.primarioMedio} />
        <View style={styles.flex1}>
          <Text style={[T.tipo.tituloS, { color: T.color.texto }]}>
            {elegible ? `Contar como hito ${elegible.hito.hito_control}` : 'Hitos completos'}
          </Text>
          <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>
            {!elegible
              ? 'Ya registraste los 3 hitos. Este reporte será un seguimiento libre.'
              : habilitado
                ? elegible.fueraDePlazo
                  ? `La fecha elegida es posterior al plazo (${formatearFecha(elegible.hito.fechaLimite)}): el hito quedará Extemporáneo. Requiere foto.`
                  : `Cuenta para el cumplimiento del ${elegible.hito.hito_control} (requiere foto).`
                : `Se habilita el ${formatearFecha(elegible.abreEl)}. Con esta fecha se enviará como seguimiento libre.`}
          </Text>
        </View>
        <Switch
          value={contarHito && habilitado}
          onValueChange={(v) => { setContarHito(v); setHitoTocado(true); marcarSucio(); limpiarError('foto'); }}
          disabled={!habilitado}
          trackColor={{ false: T.color.bordeFuerte, true: T.color.primarioMedio }}
          ios_backgroundColor={T.color.bordeFuerte}
          thumbColor={T.color.superficie}
          accessibilityLabel={elegible ? `Contar como hito ${elegible.hito.hito_control}` : 'Contar como hito'}
        />
      </View>

      <CampoTexto
        etiqueta={`¿Cómo está ${nombre}?`}
        obligatorio
        ayuda="Adaptación, alimentación, salud o lo que quieras reportar. Mínimo 15 caracteres."
        contador={`${texto.trim().length}/500`}
        value={texto}
        onChangeText={(v) => { setTexto(v); marcarSucio(); limpiarError('texto'); }}
        placeholder="Ej.: Se adaptó bien, come normal y ya fue al veterinario."
        maxLength={500}
        multiline
        textAlignVertical="top"
        error={errores.texto}
      />

      <Text style={[T.tipo.etiqueta, { color: errores.foto ? T.color.error : T.color.texto }]}>
        Foto reciente{fotoObligatoria ? <Text style={{ color: T.color.error }}> *</Text> : <Text style={{ color: T.color.textoTenue, fontWeight: '400' }}> (opcional)</Text>}
      </Text>
      {fotoUri ? (
        <View style={styles.vistaFoto}>
          <Image source={{ uri: fotoUri }} style={styles.fotoReporteGrande} resizeMode="cover" accessibilityLabel="Vista previa de la foto" />
          <BotonIcono icono="close" etiqueta="Quitar foto" variante="sobreImagen" onPress={() => setFotoUri(null)} estilo={styles.quitarFoto} />
        </View>
      ) : fotoObligatoria ? (
        <Pressable
          onPress={tomarFoto}
          disabled={!!cargandoFoto}
          accessibilityRole="button"
          accessibilityLabel="Agrega una foto. Abre la cámara."
          style={[styles.fotoMarcadorVacio, errores.foto && { borderColor: T.color.error }]}
        >
          <Icono nombre="camera-plus-outline" tamano={36} color={errores.foto ? T.color.error : T.color.bordeFuerte} />
          <Text style={[T.tipo.etiqueta, { color: errores.foto ? T.color.error : T.color.textoSuave }]}>Agrega una foto</Text>
        </Pressable>
      ) : null}
      <View style={[styles.filaBotones, { marginTop: T.esp.sm }]}>
        <Boton
          titulo={fotoUri ? 'Tomar otra' : 'Tomar foto'}
          variante="tonal"
          icono="camera-outline"
          cargando={cargandoFoto === 'camara'}
          deshabilitado={!!cargandoFoto}
          onPress={tomarFoto}
          estilo={styles.flex1}
        />
        <Boton
          titulo="Galería"
          variante="contorno"
          icono="image-outline"
          cargando={cargandoFoto === 'galeria'}
          deshabilitado={!!cargandoFoto}
          onPress={elegirFoto}
          estilo={styles.flex1}
        />
      </View>
      <View style={{ marginTop: T.esp.sm }}><FilaError texto={errores.foto} /></View>
      <View style={styles.filaCentroXs}>
        <Icono nombre="shield-check-outline" tamano={16} color={T.color.primarioMedio} />
        <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.textoSuave }]}>
          Eliminamos los metadatos EXIF (ubicación y dispositivo) de la foto antes de guardarla.
        </Text>
      </View>
      {permisoNegado ? (
        <View style={{ marginTop: T.esp.md }}>
          <Aviso
            tono="alerta"
            icono="camera-off-outline"
            titulo={`Sin permiso de ${permisoNegado.origen}`}
            accion={!permisoNegado.puedePedir ? (
              <Boton titulo="Abrir ajustes" variante="texto" tamano="sm" icono="cog-outline" onPress={() => Linking.openSettings().catch(() => {})} />
            ) : null}
          >
            {permisoNegado.origen === 'cámara'
              ? 'No podemos tomar la foto sin acceso a la cámara. Puedes elegir una de tu galería.'
              : 'No podemos acceder a tus fotos. Puedes tomar una con la cámara.'}
            {!permisoNegado.puedePedir ? ' También puedes activarlo en los ajustes del teléfono.' : ''}
          </Aviso>
        </View>
      ) : null}
      {errores.general ? <View style={{ marginTop: T.esp.md }}><Aviso tono="error">{errores.general}</Aviso></View> : null}

      <View style={styles.accionesFormulario}>
        <Boton
          titulo="Enviar al albergue"
          icono="send"
          tamano="lg"
          anchoCompleto
          onPress={enviar}
          cargando={enviando}
          deshabilitado={!!cargandoFoto}
        />
        <Boton titulo="Cancelar" variante="texto" onPress={onCancelar} />
      </View>
    </ScrollView>
  );
}

function PantallaSeguimiento({ solicitudId, rol, nombreUsuario, vistaInicial = 'detalle', onCerrar, refrescar }) {
  const solicitud = buscarSolicitud(solicitudId);
  const hitosIniciales = calcularHitos(solicitud);
  const proxInicial = proximoHito(hitosIniciales);
  const fechaFoco = proxInicial ? proxInicial.fechaLimite : Date.now();
  const [vista, setVista] = useState(vistaInicial);
  const [cursor, setCursor] = useState(() => ({ anio: new Date(fechaFoco).getFullYear(), mes: new Date(fechaFoco).getMonth() }));
  const [seleccion, setSeleccion] = useState(() => claveDia(fechaFoco));
  const [confirmacion, setConfirmacion] = useState(null);
  const sucioRef = useRef(false); // el formulario de reporte tiene datos sin enviar
  if (!solicitud) return null;
  const animal = buscarAnimal(solicitud.animal_id);
  const albergue = animal ? buscarAlbergue(animal.albergue_id) : null;
  const hitos = calcularHitos(solicitud);
  const reportes = reportesDeSolicitud(solicitud.id);
  const esCiudadano = rol === 'ciudadano';
  const puedeReportar = esCiudadano && esSolicitudPropia(solicitud, nombreUsuario);

  const salirReporte = () => {
    if (!sucioRef.current) { setVista('detalle'); return; }
    confirmarDescarte(() => { sucioRef.current = false; setVista('detalle'); });
  };
  const atras = () => (vista === 'reporte' ? salirReporte() : onCerrar());
  const irAFecha = (ms) => {
    const f = new Date(ms);
    setCursor({ anio: f.getFullYear(), mes: f.getMonth() });
    setSeleccion(claveDia(ms));
  };

  if (vista === 'reporte' && puedeReportar) {
    return (
      <PantallaModal onCerrar={atras}>
        <BarraSuperior titulo="Enviar seguimiento" subtitulo={animal ? `${animal.nombre} · ${albergue ? albergue.nombre_albergue : ''}` : ''} onAtras={atras} iconoAtras="close" etiquetaAtras="Cancelar" />
        <FormularioReporte
          solicitud={solicitud}
          nombreUsuario={nombreUsuario}
          sucioRef={sucioRef}
          onCancelar={salirReporte}
          onEnviado={(r) => {
            setConfirmacion(`${r.hito_control ? `Seguimiento enviado. Cuenta como hito ${r.hito_control}.` : 'Seguimiento enviado al albergue.'}${r.extemporaneo ? ' Quedó marcado como Extemporáneo.' : ''}`);
            irAFecha(new Date(r.registro.fecha_seguimiento).getTime());
            setVista('detalle');
            refrescar();
            AccessibilityInfo.announceForAccessibility('Seguimiento enviado al albergue.');
          }}
        />
      </PantallaModal>
    );
  }

  return (
    <PantallaModal onCerrar={onCerrar}>
      <BarraSuperior
        titulo={`Seguimiento de ${animal ? animal.nombre : 'la adopción'}`}
        subtitulo={rol === 'albergue' ? `Adoptante: ${solicitud.nombre_completo}` : albergue ? albergue.nombre_albergue : ''}
        onAtras={onCerrar}
      />
      <ScrollView contentContainerStyle={[styles.contenidoModal, { paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.cabeceraFormulario}>
          {animal ? <FotoAnimal uri={fotoUrl(animal.foto_url, 200)} especie={animal.especie} estilo={styles.avatarGrande} tamanoIcono={28} /> : null}
          <View style={styles.flex1}>
            <Text style={[T.tipo.tituloL, { color: T.color.texto }]}>{animal ? animal.nombre : 'Animal'}</Text>
            <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>Adopción aprobada el {formatearFecha(solicitud.fecha_aprobacion)}</Text>
            {solicitud.es_demo ? <Text style={[T.tipo.etiquetaS, { color: T.color.info, marginTop: 2 }]}>Adopción de demostración</Text> : null}
          </View>
        </View>
        {rol === 'albergue' ? (
          <View style={[styles.filaChips, { marginBottom: T.esp.md }]}>
            <ChipEstado texto={solicitud.telefono} tono="neutro" icono="phone-outline" />
            <ChipEstado texto={solicitud.municipio} tono="neutro" icono="map-marker-outline" />
          </View>
        ) : null}

        {confirmacion ? (
          <View style={styles.espacioAbajo}><Aviso tono="exito" titulo={confirmacion}>El albergue lo verá en el seguimiento de esta adopción.</Aviso></View>
        ) : null}

        {/* Sin botón propio: en esta pantalla la acción de enviar es el FAB. */}
        <TarjetaProximo hitos={hitos} rol={puedeReportar ? 'ciudadano' : rol} onEnviar={null} />

        {hitos.filter((h) => h.estadoUI === ESTADO_HITO_UI.VENCIDO).map((h) => (
          <AccionIncumplimiento key={h.hito_control} solicitud={solicitud} h={h} rol={rol} refrescar={refrescar} />
        ))}
        {esCiudadano && hitos.some((h) => h.estadoUI === ESTADO_HITO_UI.INCUMPLIMIENTO) ? (
          <View style={styles.espacioAbajo}>
            <Aviso tono="error" titulo="El albergue registró un incumplimiento">Comunícate con el albergue para ponerte al día.</Aviso>
          </View>
        ) : null}

        <TituloSeccion titulo="Calendario" subtitulo="Toca un día para ver qué pasó o qué viene." />
        <Calendario
          solicitud={solicitud}
          hitos={hitos}
          cursor={cursor}
          onCursor={setCursor}
          seleccion={seleccion}
          onSeleccionar={setSeleccion}
        />
        <DetalleDia solicitud={solicitud} clave={seleccion} />

        <View style={styles.hitosResumen}>
          {hitos.map((h) => {
            const t = TONOS[tonoEstado(h.estadoUI)];
            const corto = textoEstadoCorto(h);
            return (
              // Sombra en el contenedor y overflow hidden en el Pressable (iOS recorta la sombra si van juntos).
              <View key={h.hito_control} style={styles.hitoTileSombra}>
                <Pressable
                  onPress={() => irAFecha(h.fechaLimite)}
                  accessibilityRole="button"
                  accessibilityLabel={`${h.hito_control}, ${corto}, fecha límite ${formatearFecha(h.fechaLimite)}. Ver en el calendario.`}
                  android_ripple={{ color: 'rgba(27,67,50,0.12)', foreground: true }}
                  style={({ pressed }) => [styles.hitoTile, pressed && Platform.OS === 'ios' && styles.presionado]}
                >
                  <Text style={[T.tipo.etiquetaS, { color: T.color.textoTenue }]}>{h.hito_control.toUpperCase()}</Text>
                  <Text style={[T.tipo.tituloS, { color: T.color.texto }]}>{formatearFecha(h.fechaLimite).replace(/ \d{4}$/, '')}</Text>
                  <View style={[styles.hitoTileEstado, { backgroundColor: t.fondo }]}>
                    <Text style={[T.tipo.etiquetaS, { color: t.texto }]} numberOfLines={1}>{corto}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        <TituloSeccion titulo="Historial" subtitulo={`${reportes.length} ${reportes.length === 1 ? 'registro' : 'registros'}`} />
        {reportes.length === 0 ? (
          <Tarjeta>
            <EstadoVacio
              icono="message-text-outline"
              titulo="Aún no hay reportes"
              texto={puedeReportar ? 'Cuéntale al albergue cómo va la adaptación cuando quieras.' : 'Los reportes del adoptante aparecerán aquí.'}
            />
          </Tarjeta>
        ) : (
          reportes.map((r) => (
            <TarjetaReporte
              key={r.id}
              reporte={r}
              rol={rol}
              refrescar={refrescar}
              tarde={hitos.some((h) => h.reportadoTarde && h.registro && h.registro.id === r.id)}
            />
          ))
        )}
        {rol === 'albergue' ? (
          <Aviso tono="neutro" titulo="Alcance de AnimalGuard">
            La app registra el seguimiento, pero no retira animales. Ante un incumplimiento, el albergue decide según su protocolo
            y, si hay indicios de maltrato, acude a los canales oficiales.
          </Aviso>
        ) : null}
      </ScrollView>
      {puedeReportar ? (
        <FAB titulo="Enviar seguimiento" icono="message-plus-outline" onPress={() => { setConfirmacion(null); setVista('reporte'); }} estilo={styles.fabPosicion} />
      ) : null}
    </PantallaModal>
  );
}

function TarjetaMiSolicitud({ solicitud, abrirSeguimiento }) {
  const animal = buscarAnimal(solicitud.animal_id);
  const hitos = calcularHitos(solicitud);
  const prox = proximoHito(hitos);
  const aprobada = solicitud.estado_solicitud === ESTADO_SOLICITUD.APROBADA;
  return (
    <Tarjeta estilo={styles.espacioAbajo}>
      <View style={styles.filaCentro}>
        {animal ? <FotoAnimal uri={fotoUrl(animal.foto_url, 200)} especie={animal.especie} estilo={styles.miniaturaGrande} tamanoIcono={28} /> : null}
        <View style={styles.flex1}>
          <Text style={[T.tipo.tituloL, { color: T.color.texto }]}>{animal ? animal.nombre : 'Animal'}</Text>
          <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>
            {aprobada ? `Adoptado el ${formatearFecha(solicitud.fecha_aprobacion)}` : `Postulaste el ${formatearFecha(solicitud.fecha_solicitud)}`}
          </Text>
          <View style={{ marginTop: T.esp.xs, flexDirection: 'row' }}>
            <ChipEstado texto={solicitud.estado_solicitud} compacto />
          </View>
        </View>
      </View>
      {solicitud.es_demo ? <Text style={[T.tipo.etiquetaS, { color: T.color.info, marginTop: T.esp.sm }]}>Adopción de demostración</Text> : null}

      {solicitud.estado_solicitud === ESTADO_SOLICITUD.PENDIENTE ? (
        <View style={{ marginTop: T.esp.md }}>
          <Aviso tono="info" icono="timer-sand">El albergue está revisando tu postulación. Verás su decisión aquí.</Aviso>
        </View>
      ) : null}
      {solicitud.estado_solicitud === ESTADO_SOLICITUD.RECHAZADA ? (
        <View style={{ marginTop: T.esp.md }}>
          <Aviso tono="neutro" titulo="Esta postulación no fue aprobada">
            {solicitud.rechazo_automatico
              ? `${animal ? animal.nombre : 'El animal'} fue adoptado por otro postulante. Gracias por postularte: puedes hacerlo con otro animal de la galería.`
              : `${solicitud.observaciones_albergue ? `Motivo: ${solicitud.observaciones_albergue}. ` : ''}Puedes postularte a otro animal de la galería.`}
          </Aviso>
        </View>
      ) : null}
      {aprobada ? (
        <>
          <View style={styles.divisor} />
          {prox ? (
            <View style={styles.filaCentro}>
              <View style={[styles.avatarIcono, prox.estadoUI === ESTADO_HITO_UI.VENCIDO && { backgroundColor: T.color.contenedorError }]}>
                <Icono nombre="calendar-clock" tamano={22} color={prox.estadoUI === ESTADO_HITO_UI.VENCIDO ? T.color.error : T.color.primarioMedio} />
              </View>
              <View style={styles.flex1}>
                <Text style={[T.tipo.etiquetaS, { color: T.color.textoTenue }]}>
                  {prox.estadoUI === ESTADO_HITO_UI.VENCIDO ? 'SEGUIMIENTO VENCIDO' : 'PRÓXIMO SEGUIMIENTO'}
                </Text>
                <Text style={[T.tipo.tituloS, { color: prox.estadoUI === ESTADO_HITO_UI.VENCIDO ? T.color.error : T.color.texto }]}>
                  {prox.hito_control} · {formatearFecha(prox.fechaLimite)}
                </Text>
                <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>{textoCuentaRegresiva(prox)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.filaCentro}>
              <View style={styles.avatarIcono}><Icono nombre="trophy-outline" tamano={22} color={T.color.primarioMedio} /></View>
              <Text style={[T.tipo.tituloS, styles.flex1, { color: T.color.texto }]}>Completaste los 3 hitos de seguimiento.</Text>
            </View>
          )}
          <PasosHitos hitos={hitos} />
          <View style={styles.filaBotones}>
            <Boton titulo="Calendario" variante="tonal" icono="calendar-month-outline" estilo={styles.flex1} onPress={() => abrirSeguimiento(solicitud.id, 'detalle')} />
            <Boton titulo="Enviar" icono="send" estilo={styles.flex1} etiqueta="Enviar seguimiento" onPress={() => abrirSeguimiento(solicitud.id, 'reporte')} />
          </View>
        </>
      ) : null}
    </Tarjeta>
  );
}

// Resumen de una adopción para el albergue: reportes recibidos, sin revisar, emergencia e hitos vencidos.
function resumenAdopcion(s) {
  const reportes = store.seguimientos
    .filter((r) => r.solicitud_id === s.id && r.autor === 'adoptante')
    .sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
  const sinRevisar = reportes.filter((r) => !r.leido_albergue);
  const urgencia = sinRevisar.some((r) => r.tipo_reporte === 'urgencia');
  const medico = !urgencia && sinRevisar.some((r) => r.tipo_reporte === 'medico');
  const hitos = calcularHitos(s);
  const vencidos = hitos.filter((h) => h.estadoUI === ESTADO_HITO_UI.VENCIDO).length;
  return { reportes, sinRevisar: sinRevisar.length, urgencia, medico, hitos, vencidos, ultimo: reportes[0] || null };
}

const FILTROS_ADOPCIONES = [
  { id: 'todas', etiqueta: 'Todas', cumple: () => true },
  { id: 'sinRevisar', etiqueta: 'Reportes sin revisar', cumple: (r) => r.sinRevisar > 0 },
  { id: 'prioritarios', etiqueta: 'Urgentes o médicos', cumple: (r) => r.urgencia || r.medico },
  { id: 'vencidos', etiqueta: 'Hitos vencidos', cumple: (r) => r.vencidos > 0 }
];

// Vista previa de una adopción: foto, adoptante, indicador de emergencia, hitos, próximo seguimiento y último reporte.
function TarjetaAdopcionAlbergue({ solicitud, resumen, onPress }) {
  const animal = buscarAnimal(solicitud.animal_id);
  const nombre = animal ? animal.nombre : 'Animal';
  const prox = proximoHito(resumen.hitos);
  const ultimoTipo = resumen.ultimo ? buscarTipoReporte(resumen.ultimo.tipo_reporte) : null;
  const colorBorde = resumen.urgencia ? T.color.error : resumen.medico ? T.color.alertaFuerte : null;
  const etiqueta = [
    `${nombre}, adoptante ${solicitud.nombre_completo}`,
    resumen.urgencia ? 'tiene una urgencia sin revisar' : resumen.medico ? 'tiene un reporte médico sin revisar' : '',
    resumen.sinRevisar ? `${resumen.sinRevisar} ${resumen.sinRevisar === 1 ? 'reporte nuevo' : 'reportes nuevos'}` : '',
    prox ? `próximo seguimiento ${prox.hito_control}, ${prox.estadoUI}` : 'hitos completos',
    'Abrir calendario y reportes'
  ].filter(Boolean).join('. ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      android_ripple={{ color: 'rgba(27,67,50,0.1)', foreground: true }}
      style={({ pressed }) => [
        styles.tarjeta, T.sombra.n1, styles.espacioAbajo,
        colorBorde && { borderLeftWidth: 5, borderLeftColor: colorBorde },
        pressed && Platform.OS === 'ios' && styles.presionado
      ]}
    >
      <View style={styles.filaCentro}>
        {animal ? <FotoAnimal uri={fotoUrl(animal.foto_url, 200)} especie={animal.especie} estilo={styles.miniaturaGrande} tamanoIcono={28} /> : null}
        <View style={styles.flex1}>
          <Text style={[T.tipo.tituloM, { color: T.color.texto }]} numberOfLines={1}>{nombre}</Text>
          <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]} numberOfLines={1}>
            {solicitud.nombre_completo} · adoptado el {formatearFecha(solicitud.fecha_aprobacion)}
          </Text>
          <View style={[styles.filaChips, { marginTop: T.esp.xs }]}>
            {resumen.urgencia ? <ChipEstado texto="Urgencia" tono="error" icono="alert-octagon" compacto accesible={false} /> : null}
            {resumen.medico ? <ChipEstado texto="Atención médica" tono="alerta" icono="medical-bag" compacto accesible={false} /> : null}
            {resumen.sinRevisar ? (
              <ChipEstado texto={`${resumen.sinRevisar} ${resumen.sinRevisar === 1 ? 'nuevo' : 'nuevos'}`} tono="info" icono="email-outline" compacto accesible={false} />
            ) : null}
            {resumen.vencidos ? <ChipEstado texto="Hito vencido" tono="error" icono="calendar-alert" compacto accesible={false} /> : null}
          </View>
        </View>
        <Icono nombre="chevron-right" tamano={24} color={T.color.textoTenue} />
      </View>
      <PasosHitos hitos={resumen.hitos} />
      {prox ? (
        <View style={styles.filaCentroXs}>
          <Icono nombre="calendar-clock" tamano={18} color={prox.estadoUI === ESTADO_HITO_UI.VENCIDO ? T.color.error : T.color.primarioMedio} />
          <Text style={[T.tipo.cuerpoS, styles.flex1, { color: prox.estadoUI === ESTADO_HITO_UI.VENCIDO ? T.color.error : T.color.textoSuave }]}>
            {prox.estadoUI === ESTADO_HITO_UI.VENCIDO ? 'Vencido' : 'Próximo'} · {prox.hito_control}: {formatearFecha(prox.fechaLimite)} · {textoCuentaRegresiva(prox)}
          </Text>
        </View>
      ) : (
        <View style={styles.filaCentroXs}>
          <Icono nombre="trophy-outline" tamano={18} color={T.color.primarioMedio} />
          <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>Los 3 hitos de seguimiento están completos.</Text>
        </View>
      )}
      {resumen.ultimo ? (
        <View style={[styles.cita, { marginBottom: 0 }]}>
          <View style={styles.filaEntre}>
            <Text style={[T.tipo.etiquetaS, { color: T.color.textoTenue }]}>
              ÚLTIMO REPORTE · {(ultimoTipo ? ultimoTipo.corto : 'Seguimiento').toUpperCase()}
            </Text>
            <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue }]}>{textoRelativo(resumen.ultimo.fecha_registro)}</Text>
          </View>
          <Text style={[T.tipo.cuerpoS, { color: T.color.texto }]} numberOfLines={2}>{resumen.ultimo.estado_animal}</Text>
          {esExtemporaneo(resumen.ultimo) ? (
            <View style={{ flexDirection: 'row', marginTop: T.esp.xs }}>
              <ChipEstado texto="Extemporáneo" tono="alerta" icono="clock-alert-outline" compacto accesible={false} />
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue }]}>Aún no hay reportes del adoptante.</Text>
      )}
    </Pressable>
  );
}

// Mosaico de estadística; si recibe onPress funciona como atajo de filtro.
function Estadistica({ icono, valor, etiqueta, tono = 'neutro', onPress, activa = false, pista }) {
  const t = TONOS[tono];
  return (
    <View style={styles.estadisticaSombra}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={onPress ? { selected: activa } : undefined}
        accessibilityLabel={`${valor} ${etiqueta}`}
        accessibilityHint={pista}
        android_ripple={onPress ? { color: 'rgba(27,67,50,0.12)', foreground: true } : undefined}
        style={({ pressed }) => [styles.estadistica, activa && styles.estadisticaActiva, pressed && Platform.OS === 'ios' && styles.presionado]}
      >
        <View style={[styles.estadisticaIcono, { backgroundColor: t.fondo }]}><Icono nombre={icono} tamano={20} color={t.texto} /></View>
        <Text style={[T.tipo.titular, { color: T.color.texto }]}>{valor}</Text>
        <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]} numberOfLines={2}>{etiqueta}</Text>
      </Pressable>
    </View>
  );
}

function PestanaSeguimiento({ rol, nombreUsuario, abrirSeguimiento, irAAdopcion }) {
  const [filtro, setFiltro] = useState('todas');
  const ordenar = (a, b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud);

  if (rol === 'albergue') {
    // Una sola lista: cada adopción aprobada con sus reportes, su emergencia y sus hitos.
    const adopciones = store.solicitudes
      .filter((s) => s.estado_solicitud === ESTADO_SOLICITUD.APROBADA)
      .map((s) => ({ s, r: resumenAdopcion(s) }))
      .sort((a, b) =>
        Number(b.r.urgencia) - Number(a.r.urgencia) ||
        Number(b.r.medico) - Number(a.r.medico) ||
        Number(b.r.vencidos > 0) - Number(a.r.vencidos > 0) ||
        b.r.sinRevisar - a.r.sinRevisar ||
        new Date(b.r.ultimo ? b.r.ultimo.fecha_registro : b.s.fecha_aprobacion) - new Date(a.r.ultimo ? a.r.ultimo.fecha_registro : a.s.fecha_aprobacion)
      );
    const sinRevisar = adopciones.reduce((n, a) => n + a.r.sinRevisar, 0);
    const prioritarios = adopciones.filter((a) => a.r.urgencia || a.r.medico).length;
    const vencidos = adopciones.reduce((n, a) => n + a.r.vencidos, 0);
    const filtroActual = FILTROS_ADOPCIONES.find((f) => f.id === filtro) || FILTROS_ADOPCIONES[0];
    const filtradas = adopciones.filter((a) => filtroActual.cumple(a.r));
    const alternar = (id) => setFiltro(filtro === id ? 'todas' : id);
    return (
      <View>
        <View style={styles.filaEstadisticas}>
          <Estadistica
            icono="email-outline" valor={sinRevisar} etiqueta="Reportes sin revisar" tono="info"
            onPress={() => alternar('sinRevisar')} activa={filtro === 'sinRevisar'} pista="Filtra las adopciones"
          />
          <Estadistica
            icono="alert-octagon-outline" valor={prioritarios} etiqueta="Con urgencia o atención médica" tono={prioritarios ? 'error' : 'neutro'}
            onPress={() => alternar('prioritarios')} activa={filtro === 'prioritarios'} pista="Filtra las adopciones"
          />
          <Estadistica
            icono="calendar-alert" valor={vencidos} etiqueta="Hitos vencidos" tono={vencidos ? 'alerta' : 'neutro'}
            onPress={() => alternar('vencidos')} activa={filtro === 'vencidos'} pista="Filtra las adopciones"
          />
        </View>
        {vencidos > 0 ? (
          <Aviso tono="error" icono="bell-alert-outline" titulo="Alerta interna">
            {vencidos === 1 ? 'Hay 1 hito' : `Hay ${vencidos} hitos`} con seguimiento vencido. Abre la adopción para revisarlo y, si corresponde, marcar el incumplimiento.
          </Aviso>
        ) : null}

        <TituloSeccion
          titulo="Adopciones en seguimiento"
          contador={adopciones.length}
          subtitulo="Entra a cada adopción para ver su calendario, los hitos 15, 30 y 90 y los reportes del adoptante."
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSangre} contentContainerStyle={styles.filaChipsScroll}>
          <View style={styles.filaChips} accessibilityRole="radiogroup" accessibilityLabel="Filtrar adopciones">
            {FILTROS_ADOPCIONES.map((f) => {
              const n = adopciones.filter((a) => f.cumple(a.r)).length;
              return (
                <Chip
                  key={f.id}
                  etiqueta={f.etiqueta}
                  contador={n}
                  seleccionado={filtro === f.id}
                  onPress={() => setFiltro(f.id)}
                  etiquetaAccesible={`${f.etiqueta}, ${n}`}
                />
              );
            })}
          </View>
        </ScrollView>
        {adopciones.length === 0 ? (
          <Tarjeta><EstadoVacio icono="home-heart" titulo="Sin adopciones aprobadas" texto="Aprueba solicitudes en la pestaña Adopción." /></Tarjeta>
        ) : filtradas.length === 0 ? (
          <Tarjeta><EstadoVacio icono="inbox-outline" titulo="Nada por aquí" texto="Ninguna adopción cumple este filtro." /></Tarjeta>
        ) : (
          filtradas.map((a) => (
            <TarjetaAdopcionAlbergue key={a.s.id} solicitud={a.s} resumen={a.r} onPress={() => abrirSeguimiento(a.s.id, 'detalle')} />
          ))
        )}
      </View>
    );
  }

  const propias = store.solicitudes.filter((s) => esSolicitudPropia(s, nombreUsuario)).sort(ordenar);
  if (propias.length === 0) {
    return (
      <Tarjeta>
        <EstadoVacio
          icono="heart-search"
          titulo="Aún no tienes postulaciones"
          texto="Cuando el albergue apruebe tu adopción, aquí verás tu calendario de seguimiento."
          accion={<Boton titulo="Explorar la galería" icono="paw" onPress={irAAdopcion} />}
        />
      </Tarjeta>
    );
  }
  return (
    <View>
      <TituloSeccion titulo="Mis adopciones" subtitulo="Reporta a los 15, 30 y 90 días, o cuando lo necesites." />
      {propias.map((s) => <TarjetaMiSolicitud key={s.id} solicitud={s} abrirSeguimiento={abrirSeguimiento} />)}
    </View>
  );
}

// ============================================================================
// 9. APRENDE: RUTA DE APRENDIZAJE, LECCIONES, QUIZ E INSIGNIAS (RF05)
// ============================================================================
function NodoRuta({ estado, numero, grande = false }) {
  const tam = grande ? styles.nodoGrande : null;
  if (estado === 'completada') {
    return <View style={[styles.nodo, tam, { backgroundColor: T.color.primarioMedio }]}><Icono nombre="check-bold" tamano={20} color={T.color.sobrePrimario} /></View>;
  }
  if (estado === 'bloqueada') {
    return <View style={[styles.nodo, tam, { backgroundColor: T.color.deshabilitadoFondo }]}><Icono nombre="lock-outline" tamano={18} color={T.color.deshabilitadoTexto} /></View>;
  }
  return (
    <View style={grande ? styles.nodoHalo : null}>
      <View style={[styles.nodo, tam, styles.nodoActivo]}>
        <Text style={[T.tipo.tituloS, { color: T.color.primario }]}>{numero}</Text>
      </View>
    </View>
  );
}

// Unidad de la ruta. La unidad actual se muestra grande y destacada; las completadas y las
// bloqueadas, como filas compactas. Tocar una bloqueada muestra un aviso en línea y una sacudida.
function TarjetaUnidad({ unidad, indice, onAbrir, ultima, actual }) {
  const reducir = useReducirMovimiento();
  const sacudida = useRef(new Animated.Value(0)).current;
  const [avisoBloqueo, setAvisoBloqueo] = useState(false);
  const p = leerProgreso(unidad.id);
  const desbloqueada = unidadDesbloqueada(indice);
  const estado = p.completada ? 'completada' : desbloqueada ? 'disponible' : 'bloqueada';
  const fraccion = fraccionUnidad(unidad);
  const practica = unidad.tipo === 'practica';
  const meta = practica ? `${unidad.escenarios.length} casos` : `${unidad.diapositivas.length} partes · ${unidad.quiz.length} preguntas`;
  const etiquetaEstado = { completada: 'Completada', disponible: fraccion > 0 ? 'En curso' : 'Disponible', bloqueada: 'Bloqueada' }[estado];
  const sobretitulo = `${practica ? 'PRÁCTICA' : `UNIDAD ${indice + 1}`} · ${unidad.categoria.toUpperCase()}`;

  const tocar = () => {
    if (desbloqueada) { onAbrir(unidad.id); return; }
    setAvisoBloqueo(true);
    AccessibilityInfo.announceForAccessibility(`Completa la unidad ${indice} para desbloquear esta.`);
    if (reducir) return;
    sacudida.setValue(0);
    Animated.sequence([
      Animated.timing(sacudida, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(sacudida, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(sacudida, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(sacudida, { toValue: 0, duration: 60, useNativeDriver: true })
    ]).start();
  };
  const translateX = sacudida.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  if (actual) {
    return (
      <View style={styles.rutaFila}>
        <View style={styles.rutaRiel}>
          <NodoRuta estado={estado} numero={indice + 1} grande />
          {!ultima ? <View style={[styles.rutaLinea, { backgroundColor: T.color.borde }]} /> : null}
        </View>
        <View style={[styles.tarjeta, T.sombra.n2, styles.flex1, styles.espacioAbajo, styles.tarjetaActual]}>
          <View style={styles.filaEntre}>
            <Text style={[T.tipo.sobretitulo, styles.flex1, { color: T.color.primarioMedio }]} numberOfLines={1}>{sobretitulo}</Text>
            <ChipEstado texto={etiquetaEstado} tono="info" icono="play-circle-outline" compacto etiquetaAccesible={`Unidad ${etiquetaEstado.toLowerCase()}`} />
          </View>
          <View style={[styles.filaCentro, { marginTop: T.esp.sm }]}>
            <View style={styles.unidadIcono}><Icono nombre={unidad.icono} tamano={24} color={T.color.primarioMedio} /></View>
            <View style={styles.flex1}>
              <Text style={[T.tipo.tituloM, { color: T.color.texto }]} accessibilityRole="header">{unidad.titulo}</Text>
              <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue }]}>{unidad.norma}</Text>
            </View>
          </View>
          <View style={[styles.filaCentroXs, { marginTop: T.esp.sm }]}>
            <Icono nombre="clock-outline" tamano={14} color={T.color.textoTenue} />
            <Text style={[T.tipo.cuerpoS, { color: T.color.textoTenue }]}>{estimarMinutos(unidad)} min · {meta}</Text>
          </View>
          <View style={{ marginTop: T.esp.md }}>
            <BarraProgreso valor={fraccion} etiqueta={`Progreso de la unidad ${indice + 1}`} alto={6} />
          </View>
          <Boton
            titulo={fraccion > 0 ? 'Continuar' : 'Empezar'}
            icono="play"
            anchoCompleto
            etiqueta={`${fraccion > 0 ? 'Continuar' : 'Empezar'} la unidad ${indice + 1}: ${unidad.titulo}`}
            onPress={() => onAbrir(unidad.id)}
            estilo={{ marginTop: T.esp.md }}
          />
        </View>
      </View>
    );
  }

  const bloqueada = estado === 'bloqueada';
  return (
    <View style={styles.rutaFila}>
      <View style={styles.rutaRiel}>
        <NodoRuta estado={estado} numero={indice + 1} />
        {!ultima ? <View style={[styles.rutaLinea, { backgroundColor: p.completada ? T.color.primarioMedio : T.color.borde }]} /> : null}
      </View>
      <Animated.View style={[styles.flex1, styles.espacioAbajo, { transform: [{ translateX }] }]}>
        <Pressable
          onPress={tocar}
          accessibilityRole="button"
          accessibilityState={{ disabled: bloqueada }}
          accessibilityLabel={`Unidad ${indice + 1}: ${unidad.titulo}. ${etiquetaEstado}.${p.completada && !practica && p.mejorPuntaje !== null ? ` Mejor puntaje ${p.mejorPuntaje} de ${unidad.quiz.length}.` : ''}`}
          accessibilityHint={bloqueada ? 'Completa la unidad anterior para desbloquearla' : 'Repasar la unidad'}
          android_ripple={{ color: 'rgba(27,67,50,0.1)', foreground: true }}
          style={({ pressed }) => [styles.filaUnidad, bloqueada && styles.tarjetaBloqueada, pressed && Platform.OS === 'ios' && styles.presionado]}
        >
          <Icono nombre={p.completada ? unidad.insignia.icono : unidad.icono} tamano={22} color={bloqueada ? T.color.deshabilitadoTexto : T.color.primarioMedio} />
          <View style={styles.flex1}>
            <Text style={[T.tipo.sobretitulo, { color: bloqueada ? T.color.textoTenue : T.color.primarioMedio }]} numberOfLines={1}>{sobretitulo}</Text>
            <Text style={[T.tipo.tituloS, { color: bloqueada ? T.color.textoSuave : T.color.texto }]} numberOfLines={2}>{unidad.titulo}</Text>
          </View>
          <Text style={[T.tipo.etiquetaS, { color: p.completada ? T.color.primarioMedio : T.color.textoTenue }]}>
            {p.completada && !practica && p.mejorPuntaje !== null ? `${p.mejorPuntaje}/${unidad.quiz.length}` : etiquetaEstado}
          </Text>
        </Pressable>
        {bloqueada && avisoBloqueo ? (
          <View style={[styles.filaCentroXs, { marginTop: T.esp.xs, paddingHorizontal: T.esp.sm }]} accessibilityLiveRegion="polite">
            <Icono nombre="lock-outline" tamano={14} color={T.color.alerta} />
            <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.alerta }]}>Completa la unidad {indice} para desbloquear esta.</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function PantallaGlosario({ onCerrar, abrirConsulta }) {
  const [abierto, setAbierto] = useState(null);
  return (
    <PantallaModal onCerrar={onCerrar}>
      <BarraSuperior titulo="Glosario" subtitulo={`${GLOSARIO.length} términos de la ruta`} onAtras={onCerrar} iconoAtras="close" etiquetaAtras="Cerrar el glosario" />
      <ScrollView contentContainerStyle={styles.contenidoModal}>
        {GLOSARIO.map((g) => {
          const ab = abierto === g.termino;
          return (
            <Tarjeta key={g.termino} plana estilo={[styles.tarjetaBorde, styles.espacioAbajo, { padding: 0, overflow: 'hidden' }]}>
              <Pressable
                onPress={() => setAbierto(ab ? null : g.termino)}
                accessibilityRole="button"
                accessibilityState={{ expanded: ab }}
                accessibilityLabel={g.termino}
                android_ripple={{ color: 'rgba(27,67,50,0.1)', foreground: true }}
                style={({ pressed }) => [styles.glosarioFila, pressed && Platform.OS === 'ios' && styles.presionado]}
              >
                <Text style={[T.tipo.tituloS, styles.flex1, { color: T.color.texto }]}>{g.termino}</Text>
                <Icono nombre={ab ? 'chevron-up' : 'chevron-down'} tamano={24} color={T.color.textoSuave} />
              </Pressable>
              {ab ? (
                <View style={{ paddingHorizontal: T.esp.lg, paddingBottom: T.esp.lg, gap: T.esp.sm }}>
                  <Text style={[T.tipo.cuerpo, { color: T.color.texto }]}>{g.definicion}</Text>
                  <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>Fuente: {g.fuente}</Text>
                  <Boton titulo="Ver en el curso" variante="texto" tamano="sm" icono="school-outline" estilo={{ alignSelf: 'flex-start' }}
                    onPress={() => abrirConsulta(g.unidad, 0)} />
                </View>
              ) : null}
            </Tarjeta>
          );
        })}
      </ScrollView>
    </PantallaModal>
  );
}

function PestanaAprende({ abrirUnidad, abrirGlosario }) {
  const prog = progresoRuta();
  const indiceSiguiente = UNIDADES.findIndex((u, i) => unidadDesbloqueada(i) && !leerProgreso(u.id).completada);
  const siguiente = indiceSiguiente >= 0 ? UNIDADES[indiceSiguiente] : null;
  const insigniasGanadas = UNIDADES.filter((u) => leerProgreso(u.id).completada).length;
  const minutosTotales = UNIDADES.reduce((n, u) => n + estimarMinutos(u), 0);

  return (
    <View>
      <LinearGradient colors={prog.terminada ? T.gradiente.cursoTerminado : T.gradiente.curso} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cursoCabecera}>
        <Icono nombre={prog.terminada ? 'trophy' : 'school'} tamano={120} color="rgba(255,255,255,0.07)" estilo={styles.cursoMarca} />
        <Text style={[T.tipo.sobretitulo, { color: T.color.acento }]}>{prog.terminada ? 'RUTA COMPLETADA' : 'RUTA DE APRENDIZAJE'}</Text>
        <Text style={[T.tipo.titular, { color: T.color.sobrePrimario, marginTop: T.esp.xs }]} accessibilityRole="header">
          {prog.terminada ? '¡Completaste la ruta!' : 'Protección animal en Colombia'}
        </Text>
        <Text style={[T.tipo.cuerpo, { color: 'rgba(255,255,255,0.88)', marginTop: T.esp.xs }]}>
          {prog.terminada
            ? 'Ya conoces tus derechos y deberes, qué es maltrato y cómo denunciar en Bogotá D.C. y Soacha.'
            : `${UNIDADES.length} unidades · ${minutosTotales} min · Leyes 84, 1774, 2054 y 2455`}
        </Text>
        <View style={[styles.filaEntre, { marginTop: T.esp.lg }]}>
          <Text style={[T.tipo.tituloM, { color: T.color.sobrePrimario }]}>{prog.porcentaje}%</Text>
          <View style={styles.filaCentroXs}>
            <Icono nombre="medal-outline" tamano={16} color={T.color.acento} />
            <Text style={[T.tipo.etiqueta, { color: T.color.sobrePrimario }]}>{insigniasGanadas} de {UNIDADES.length} insignias</Text>
          </View>
        </View>
        <View style={{ marginTop: T.esp.sm }}>
          <BarraProgreso
            valor={prog.porcentaje / 100}
            colorRelleno={T.color.acento}
            colorPista="rgba(255,255,255,0.2)"
            alto={6}
            etiqueta="Progreso de la ruta"
          />
        </View>
        {siguiente ? (
          <View style={{ marginTop: T.esp.lg }}>
            <Text style={[T.tipo.cuerpoS, { color: 'rgba(255,255,255,0.88)', marginBottom: T.esp.xs }]} numberOfLines={1}>
              {fraccionUnidad(siguiente) > 0 ? 'Sigues en' : 'Empieza con'}: {siguiente.titulo}
            </Text>
            <Boton
              titulo={fraccionUnidad(siguiente) > 0 ? 'Continuar' : 'Empezar'}
              variante="claro"
              icono="play"
              anchoCompleto
              etiqueta={`${fraccionUnidad(siguiente) > 0 ? 'Continuar' : 'Empezar'}: ${siguiente.titulo}`}
              onPress={() => abrirUnidad(siguiente.id)}
            />
          </View>
        ) : null}
      </LinearGradient>

      <TituloSeccion titulo="Insignias" subtitulo="Gana una por cada unidad aprobada." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSangre} contentContainerStyle={styles.filaInsignias}>
        {UNIDADES.map((u) => {
          const ganada = leerProgreso(u.id).completada;
          return (
            <View key={u.id} style={styles.insignia} accessible accessibilityLabel={`Insignia ${u.insignia.nombre}: ${ganada ? 'obtenida' : 'pendiente'}`}>
              <View style={[styles.insigniaCirculo, ganada ? styles.insigniaGanada : styles.insigniaPendiente]}>
                <Icono nombre={ganada ? u.insignia.icono : 'lock-outline'} tamano={26} color={ganada ? T.color.sobrePrimario : T.color.textoTenue} />
              </View>
              <Text style={[T.tipo.etiquetaS, styles.textoCentro, { color: ganada ? T.color.texto : T.color.textoTenue }]} numberOfLines={2}>{u.insignia.nombre}</Text>
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={abrirGlosario}
        accessibilityRole="button"
        accessibilityLabel={`Glosario: ${GLOSARIO.length} términos legales explicados`}
        android_ripple={{ color: 'rgba(27,67,50,0.1)', foreground: true }}
        style={({ pressed }) => [styles.filaUnidad, styles.tarjetaBorde, { marginBottom: T.esp.lg }, pressed && Platform.OS === 'ios' && styles.presionado]}
      >
        <View style={styles.unidadIcono}><Icono nombre="book-alphabet" tamano={24} color={T.color.primarioMedio} /></View>
        <View style={styles.flex1}>
          <Text style={[T.tipo.tituloS, { color: T.color.texto }]}>Glosario</Text>
          <Text style={[T.tipo.cuerpoS, { color: T.color.textoSuave }]}>{GLOSARIO.length} términos: seres sintientes, contravención, inhabilidad…</Text>
        </View>
        <Icono nombre="chevron-right" tamano={24} color={T.color.textoSuave} />
      </Pressable>

      <TituloSeccion titulo="Unidades" subtitulo={`Se desbloquean en orden. Aprueba cada quiz con ${APROBACION_MINIMA} de 5 para avanzar.`} />
      {UNIDADES.map((u, i) => (
        <TarjetaUnidad key={u.id} unidad={u} indice={i} onAbrir={abrirUnidad} ultima={i === UNIDADES.length - 1} actual={i === indiceSiguiente} />
      ))}
      <Text style={styles.descargo}>
        Contenido de orientación basado en el texto oficial de las leyes citadas; no reemplaza la asesoría jurídica ni los canales oficiales.
      </Text>
    </View>
  );
}

// "Mito o realidad": el usuario decide y luego se revela la respuesta.
function TarjetaMito({ d }) {
  const [respuesta, setRespuesta] = useState(null); // 'mito' | 'realidad'
  const acierto = respuesta && (respuesta === 'mito') === d.esMito;
  return (
    <View>
      <View style={styles.mitoAfirmacion}>
        <Icono nombre="format-quote-open" tamano={24} color={T.color.info} />
        <Text style={[T.tipo.tituloM, styles.flex1, { color: T.color.texto }]}>{d.afirmacion}</Text>
      </View>
      {!respuesta ? (
        <>
          <Text style={[T.tipo.etiqueta, { color: T.color.textoSuave, marginTop: T.esp.lg, marginBottom: T.esp.sm }]}>¿Qué crees?</Text>
          <View style={styles.filaBotones}>
            <Boton titulo="Es mito" variante="contorno" icono="close-circle-outline" estilo={styles.flex1} onPress={() => setRespuesta('mito')} />
            <Boton titulo="Es realidad" variante="contorno" icono="check-circle-outline" estilo={styles.flex1} onPress={() => setRespuesta('realidad')} />
          </View>
        </>
      ) : (
        <View style={{ marginTop: T.esp.lg }}>
          <ChipEstado texto={d.esMito ? 'MITO' : 'REALIDAD'} tono={d.esMito ? 'error' : 'exito'} icono={d.esMito ? 'close-circle-outline' : 'check-circle-outline'} />
          <Retroalimentacion correcta={!!acierto} explicacion={d.explicacion} />
        </View>
      )}
    </View>
  );
}

// Tabla comparativa en tarjetas apiladas (legible a 360 dp, sin desplazamiento horizontal).
function TablaComparacion({ d }) {
  return (
    <View style={{ marginTop: T.esp.lg, gap: T.esp.sm }}>
      {d.filas.map((f) => (
        <View key={f.aspecto} style={styles.compFila} accessible accessibilityLabel={`${f.aspecto}. ${d.columnas[0]}: ${f.a}. ${d.columnas[1]}: ${f.b}.`}>
          <Text style={[T.tipo.sobretitulo, { color: T.color.primarioMedio }]}>{f.aspecto.toUpperCase()}</Text>
          <View style={styles.compCeldas}>
            {[[d.columnas[0], f.a, d.reemplazadaA], [d.columnas[1], f.b, false]].map(([col, val, viejo]) => (
              <View key={col} style={[styles.compCelda, viejo && styles.compCeldaVieja]}>
                <Text style={[T.tipo.etiquetaS, { color: viejo ? T.color.sobreContenedorError : T.color.textoTenue }]}>{col}</Text>
                <Text style={[T.tipo.cuerpoS, { color: T.color.texto }, viejo && { textDecorationLine: 'line-through' }]}>{val}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function Diapositiva({ d }) {
  return (
    <View>
      <LinearGradient colors={d.tipo === 'practica' || d.tipo === 'mito' ? T.gradiente.escenario : T.gradiente.diapositiva} style={styles.diapoIcono}>
        <Icono nombre={d.icono} tamano={44} color={d.tipo === 'practica' || d.tipo === 'mito' ? T.color.info : T.color.primarioMedio} />
      </LinearGradient>
      <Text style={[T.tipo.sobretitulo, { color: T.color.primarioMedio, marginTop: T.esp.xl }]}>{(d.etiqueta || '').toUpperCase()}</Text>
      {d.titulo ? <Text style={[T.tipo.titular, { color: T.color.texto, marginTop: T.esp.xs }]} accessibilityRole="header">{d.titulo}</Text> : null}
      {d.tipo === 'mito' ? <View style={{ marginTop: T.esp.md }}><TarjetaMito d={d} /></View> : null}
      {d.tipo === 'comparacion' ? <TablaComparacion d={d} /> : null}
      {d.texto && !d.textoDespues ? <Text style={[T.tipo.cuerpoL, styles.diapoTexto]}>{d.texto}</Text> : null}
      {d.cita ? (
        <View style={styles.citaLey}>
          <Icono nombre="format-quote-open" tamano={24} color={T.color.primarioMedio} />
          <Text style={[T.tipo.cuerpoL, { color: T.color.texto, fontStyle: 'italic', flex: 1 }]}>{d.cita}</Text>
        </View>
      ) : null}
      {d.lista ? (
        <View style={{ marginTop: T.esp.lg }}>
          {d.lista.map((item, i) => (
            <View key={item} style={styles.itemLista}>
              <View style={styles.itemListaNumero}>
                {d.tipo === 'resumen'
                  ? <Icono nombre="check" tamano={16} color={T.color.sobreContenedor} />
                  : <Text style={[T.tipo.etiquetaS, { color: T.color.sobreContenedor }]}>{i + 1}</Text>}
              </View>
              <Text style={[T.tipo.cuerpo, styles.flex1, { color: T.color.texto }]}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {d.texto && d.textoDespues ? <Text style={[T.tipo.cuerpo, styles.diapoTexto]}>{d.texto}</Text> : null}
      {d.dato ? (
        <View style={{ marginTop: T.esp.lg }}>
          <Aviso tono="alerta" icono="chart-box-outline" titulo="Dato del diagnóstico">{d.dato}</Aviso>
        </View>
      ) : null}
      <View style={styles.fuente}>
        <Icono nombre="book-open-page-variant-outline" tamano={16} color={T.color.textoSuave} />
        <Text style={[T.tipo.cuerpoS, styles.flex1, { color: T.color.textoSuave }]}>Fuente: {d.fuente}</Text>
      </View>
    </View>
  );
}

function OpcionRespuesta({ texto, indice, seleccionada, comprobado, esCorrecta, onPress }) {
  const letra = String.fromCharCode(65 + indice);
  let estilo = null;
  let icono = seleccionada ? 'radiobox-marked' : 'radiobox-blank';
  let colorIcono = seleccionada ? T.color.primarioMedio : T.color.bordeFuerte;
  if (comprobado && esCorrecta) { estilo = styles.opcionCorrecta; icono = 'check-circle'; colorIcono = '#1E6B3A'; }
  else if (comprobado && seleccionada) { estilo = styles.opcionIncorrecta; icono = 'close-circle'; colorIcono = T.color.error; }
  return (
    <Pressable
      onPress={onPress}
      disabled={comprobado}
      accessibilityRole="radio"
      accessibilityState={{ checked: seleccionada, disabled: comprobado }}
      accessibilityLabel={`Opción ${letra}: ${texto}${comprobado ? (esCorrecta ? ', respuesta correcta' : seleccionada ? ', tu respuesta, incorrecta' : '') : ''}`}
      android_ripple={{ color: 'rgba(27,67,50,0.12)', foreground: true }}
      style={({ pressed }) => [styles.opcion, seleccionada && !comprobado && styles.opcionSeleccionada, estilo, pressed && Platform.OS === 'ios' && styles.presionado]}
    >
      <View style={[styles.opcionLetra, seleccionada && !comprobado && { backgroundColor: T.color.primarioMedio }]}>
        <Text style={[T.tipo.etiqueta, { color: seleccionada && !comprobado ? T.color.sobrePrimario : T.color.textoSuave }]}>{letra}</Text>
      </View>
      <Text style={[T.tipo.cuerpo, styles.flex1, { color: T.color.texto }]}>{texto}</Text>
      <Icono nombre={icono} tamano={24} color={colorIcono} />
    </Pressable>
  );
}

function Retroalimentacion({ correcta, explicacion }) {
  return (
    <View style={[styles.retro, { backgroundColor: correcta ? TONOS.exito.fondo : TONOS.error.fondo }]} accessibilityLiveRegion="polite">
      <View style={styles.filaCentroXs}>
        <Icono nombre={correcta ? 'check-circle' : 'close-circle'} tamano={22} color={correcta ? TONOS.exito.texto : TONOS.error.texto} />
        <Text style={[T.tipo.tituloS, { color: correcta ? TONOS.exito.texto : TONOS.error.texto }]}>{correcta ? '¡Correcto!' : 'No es correcto'}</Text>
      </View>
      <Text style={[T.tipo.cuerpoS, { color: correcta ? TONOS.exito.texto : TONOS.error.texto, marginTop: T.esp.xs }]}>{explicacion}</Text>
    </View>
  );
}

// Anillo segmentado (solo Views): `total` segmentos separados por un hueco, `llenos` coloreados.
function AnilloResultado({ total, llenos, aprobado, children }) {
  const n = Math.max(1, total || 1);
  const porSegmento = Math.max(4, Math.round(36 / n));
  const marcas = n * porSegmento;
  const color = aprobado ? T.color.primarioMedio : T.color.alertaFuerte;
  return (
    <View style={styles.anillo} accessible accessibilityLabel={`${llenos} de ${n} correctas`}>
      {Array.from({ length: marcas }).map((_, i) => {
        const segmento = Math.floor(i / porSegmento);
        if (n > 1 && i % porSegmento === porSegmento - 1) return null; // hueco entre segmentos
        return (
          <View key={i} style={[styles.anilloGiro, { transform: [{ rotate: `${((i + 0.5) * 360) / marcas}deg` }] }]} pointerEvents="none">
            <View style={[styles.anilloMarca, { backgroundColor: segmento < llenos ? color : T.color.superficieVariante }]} />
          </View>
        );
      })}
      <View style={styles.anilloCentro}>{children}</View>
    </View>
  );
}

// consulta = true: abierta desde "Ver en el curso". Si la unidad sigue bloqueada, solo se leen las
// diapositivas (sin quiz ni progreso), para no saltarse el desbloqueo en orden.
function ReproductorUnidad({ unidadId, onCerrar, refrescar, abrirUnidad, irAGaleria, consulta = false, inicio = 0 }) {
  const indice = UNIDADES.findIndex((u) => u.id === unidadId);
  const unidad = UNIDADES[indice];
  const practica = unidad && unidad.tipo === 'practica';
  const desbloqueada = indice >= 0 && unidadDesbloqueada(indice);
  const soloLectura = consulta && !desbloqueada;
  const [fase, setFase] = useState(practica ? 'escenario' : 'leccion'); // leccion | quiz | escenario | resultado
  const [paso, setPaso] = useState(practica ? 0 : Math.min(inicio, unidad ? unidad.diapositivas.length - 1 : 0));
  const [seleccion, setSeleccion] = useState(null);
  const [comprobado, setComprobado] = useState(false);
  const [aciertos, setAciertos] = useState(0);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (unidad && fase === 'leccion' && desbloqueada) {
      registrarVista(unidad.id, paso);
      if (refrescar) refrescar();
    }
  }, [fase, paso]);

  if (!unidad || (!desbloqueada && !(consulta && !practica))) return null;

  const siguienteUnidad = UNIDADES[indice + 1];
  const reiniciarPregunta = () => { setSeleccion(null); setComprobado(false); };

  let total = 1;
  let actual = 0;
  let etiquetaPaso = '';
  if (fase === 'leccion') { total = unidad.diapositivas.length; actual = paso + 1; etiquetaPaso = `${soloLectura ? 'Consulta · ' : ''}Parte ${actual} de ${total}`; }
  if (fase === 'quiz') { total = unidad.quiz.length; actual = paso + 1; etiquetaPaso = `Pregunta ${actual} de ${total}`; }
  if (fase === 'escenario') { total = unidad.escenarios.length; actual = paso + 1; etiquetaPaso = `Caso ${actual} de ${total}`; }
  if (fase === 'resultado') { etiquetaPaso = 'Resultado'; actual = total; }

  const comprobarQuiz = () => {
    const q = unidad.quiz[paso];
    if (seleccion === q.correcta) setAciertos(aciertos + 1);
    setComprobado(true);
  };
  const siguientePregunta = () => {
    if (paso + 1 < unidad.quiz.length) { setPaso(paso + 1); reiniciarPregunta(); return; }
    const r = registrarResultadoQuiz(unidad.id, aciertos);
    setResultado(r);
    setFase('resultado');
    refrescar();
  };
  const comprobarEscenario = () => {
    const e = unidad.escenarios[paso];
    const r = responderEscenario(unidad.id, e.id, seleccion);
    setComprobado(true);
    setResultado({ ...(resultado || {}), ultimoCorrecto: r.correcta });
    refrescar();
  };
  const siguienteEscenario = () => {
    if (paso + 1 < unidad.escenarios.length) { setPaso(paso + 1); reiniciarPregunta(); return; }
    setResultado({ aprobado: leerProgreso(unidad.id).completada, practica: true });
    setFase('resultado');
  };
  const empezarQuiz = () => { setFase('quiz'); setPaso(0); setAciertos(0); reiniciarPregunta(); };

  let contenido = null;
  let barraInferior = null;

  if (fase === 'leccion') {
    const d = unidad.diapositivas[paso];
    const ultima = paso === unidad.diapositivas.length - 1;
    contenido = (
      <View>
        {soloLectura && paso === Math.min(inicio, unidad.diapositivas.length - 1) ? (
          <Aviso tono="info" icono="book-open-page-variant-outline" titulo="Modo consulta">
            Puedes leer esta unidad. Para hacer el quiz y ganar su insignia, completa la ruta en orden en la pestaña Aprende.
          </Aviso>
        ) : null}
        <Diapositiva d={d} />
      </View>
    );
    barraInferior = (
      <View style={styles.filaBotones}>
        <Boton titulo="Anterior" variante="contorno" icono="chevron-left" deshabilitado={paso === 0} onPress={() => setPaso(paso - 1)} estilo={styles.flex1} />
        <Boton
          titulo={ultima ? (soloLectura ? 'Terminar' : 'Ir al quiz') : 'Siguiente'}
          iconoFinal={ultima ? (soloLectura ? 'check' : 'help-circle-outline') : 'chevron-right'}
          onPress={() => (ultima ? (soloLectura ? onCerrar() : empezarQuiz()) : setPaso(paso + 1))}
          estilo={styles.flex1}
        />
      </View>
    );
  }

  if (fase === 'quiz') {
    const q = unidad.quiz[paso];
    contenido = (
      <View>
        <View style={styles.filaCentroXs}>
          <Icono nombre="help-circle-outline" tamano={20} color={T.color.primarioMedio} />
          <Text style={[T.tipo.sobretitulo, { color: T.color.primarioMedio }]}>PON A PRUEBA LO APRENDIDO</Text>
        </View>
        <Text style={[T.tipo.tituloL, { color: T.color.texto, marginTop: T.esp.md, marginBottom: T.esp.lg }]} accessibilityRole="header">{q.pregunta}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={q.pregunta}>
          {q.opciones.map((op, i) => (
            <OpcionRespuesta key={op} texto={op} indice={i} seleccionada={seleccion === i} comprobado={comprobado} esCorrecta={i === q.correcta} onPress={() => setSeleccion(i)} />
          ))}
        </View>
        {comprobado ? <Retroalimentacion correcta={seleccion === q.correcta} explicacion={q.explicacion} /> : null}
      </View>
    );
    barraInferior = comprobado ? (
      <Boton titulo={paso + 1 < unidad.quiz.length ? 'Siguiente pregunta' : 'Ver resultado'} iconoFinal="chevron-right" anchoCompleto tamano="lg" onPress={siguientePregunta} />
    ) : (
      <Boton titulo="Comprobar" icono="check" anchoCompleto tamano="lg" deshabilitado={seleccion === null} onPress={comprobarQuiz} />
    );
  }

  if (fase === 'escenario') {
    const e = unidad.escenarios[paso];
    const correcto = comprobado && seleccion === e.correcta;
    contenido = (
      <View>
        <LinearGradient colors={T.gradiente.escenario} style={styles.escenarioTarjeta}>
          <Icono nombre={e.icono} tamano={32} color={T.color.info} />
          <Text style={[T.tipo.sobretitulo, { color: T.color.info, marginTop: T.esp.sm }]}>¿QUÉ HACES SI…?</Text>
          <Text style={[T.tipo.tituloL, { color: T.color.texto, marginTop: T.esp.xs }]} accessibilityRole="header">{e.situacion}</Text>
        </LinearGradient>
        <Text style={[T.tipo.etiqueta, { color: T.color.textoSuave, marginVertical: T.esp.md }]}>Elige la mejor acción:</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={e.situacion}>
          {e.opciones.map((op, i) => (
            <OpcionRespuesta key={op} texto={op} indice={i} seleccionada={seleccion === i} comprobado={comprobado} esCorrecta={correcto && i === e.correcta} onPress={() => setSeleccion(i)} />
          ))}
        </View>
        {comprobado ? (
          <Retroalimentacion
            correcta={correcto}
            explicacion={correcto ? e.explicacion : 'Esa no es la mejor acción. Piensa en tu seguridad y en los canales oficiales, e inténtalo de nuevo.'}
          />
        ) : null}
        {correcto && e.irAGaleria ? (
          <Boton titulo="Ir a la galería de adopción" variante="tonal" icono="paw" onPress={irAGaleria} estilo={{ marginTop: T.esp.md, alignSelf: 'flex-start' }} />
        ) : null}
      </View>
    );
    barraInferior = !comprobado ? (
      <Boton titulo="Comprobar" icono="check" anchoCompleto tamano="lg" deshabilitado={seleccion === null} onPress={comprobarEscenario} />
    ) : correcto ? (
      <Boton titulo={paso + 1 < unidad.escenarios.length ? 'Siguiente caso' : 'Ver resultado'} iconoFinal="chevron-right" anchoCompleto tamano="lg" onPress={siguienteEscenario} />
    ) : (
      <Boton titulo="Intentar de nuevo" variante="tonal" icono="refresh" anchoCompleto tamano="lg" onPress={reiniciarPregunta} />
    );
  }

  if (fase === 'resultado' && resultado) {
    const aprobado = !!resultado.aprobado;
    const rutaTerminada = progresoRuta().terminada;
    const sinAciertos = !resultado.practica && resultado.aciertos === 0;
    contenido = (
      <View style={styles.resultado}>
        <Rebote>
          <AnilloResultado
            total={resultado.practica ? unidad.escenarios.length : resultado.total}
            llenos={resultado.practica ? unidad.escenarios.length : resultado.aciertos}
            aprobado={aprobado}
          >
            {resultado.practica ? (
              <Icono nombre="check-all" tamano={48} color={T.color.primarioMedio} />
            ) : (
              <Text style={[T.tipo.display, { color: T.color.texto }]}>{resultado.aciertos}/{resultado.total}</Text>
            )}
          </AnilloResultado>
        </Rebote>
        <Text style={[T.tipo.titular, styles.textoCentro, { color: T.color.texto }]} accessibilityRole="header">
          {rutaTerminada && aprobado ? '¡Completaste la ruta!' : aprobado ? '¡Unidad completada!' : sinAciertos ? 'Sigue practicando' : 'Casi lo logras'}
        </Text>
        <Text style={[T.tipo.cuerpoL, styles.textoCentro, { color: T.color.textoSuave }]}>
          {aprobado
            ? rutaTerminada
              ? `Aprobaste todas las unidades y ganaste las ${UNIDADES.length} insignias.`
              : 'Desbloqueaste la siguiente unidad de la ruta.'
            : `Necesitas al menos ${minimoAprobacion(resultado.total || unidad.quiz.length)} de ${resultado.total || unidad.quiz.length} respuestas correctas. Repasa la unidad e inténtalo otra vez.`}
        </Text>
        {aprobado ? (
          <Rebote retraso={250} estilo={styles.anchoCompleto}>
            <LinearGradient colors={T.gradiente.marca} style={styles.insigniaGanadaTarjeta}>
              <View style={styles.insigniaGrande}><Icono nombre={unidad.insignia.icono} tamano={36} color={T.color.primario} /></View>
              <View style={styles.flex1}>
                <Text style={[T.tipo.sobretitulo, { color: T.color.acento }]}>NUEVA INSIGNIA</Text>
                <Text style={[T.tipo.tituloM, { color: T.color.sobrePrimario }]}>{unidad.insignia.nombre}</Text>
              </View>
            </LinearGradient>
          </Rebote>
        ) : null}
      </View>
    );
    barraInferior = aprobado ? (
      <View style={{ gap: T.esp.sm }}>
        {siguienteUnidad ? (
          <>
            <Text style={[T.tipo.cuerpoS, styles.textoCentro, { color: T.color.textoSuave }]} numberOfLines={1}>
              Sigue: {siguienteUnidad.titulo}
            </Text>
            <Boton
              titulo="Siguiente unidad"
              etiqueta={`Siguiente unidad: ${siguienteUnidad.titulo}`}
              iconoFinal="chevron-right"
              tamano="lg"
              anchoCompleto
              onPress={() => abrirUnidad(siguienteUnidad.id)}
            />
          </>
        ) : null}
        <Boton titulo="Volver a la ruta" variante={siguienteUnidad ? 'texto' : 'relleno'} tamano={siguienteUnidad ? 'md' : 'lg'} anchoCompleto onPress={onCerrar} />
      </View>
    ) : (
      <View style={styles.filaBotones}>
        <Boton titulo="Repasar" variante="contorno" icono="book-open-variant" estilo={styles.flex1} onPress={() => { setFase('leccion'); setPaso(0); }} />
        <Boton titulo="Reintentar" icono="refresh" estilo={styles.flex1} onPress={empezarQuiz} />
      </View>
    );
  }

  return (
    <PantallaModal onCerrar={onCerrar}>
      <View style={styles.reproductorCabecera}>
        <View style={styles.filaCentro}>
          <BotonIcono icono="close" etiqueta="Cerrar la unidad" onPress={onCerrar} />
          <View style={styles.flex1}>
            <Text style={[T.tipo.etiquetaS, { color: T.color.textoTenue }]} numberOfLines={1}>
              {practica ? 'PRÁCTICA' : `UNIDAD ${indice + 1}`} · {etiquetaPaso.toUpperCase()} · {estimarMinutos(unidad)} MIN
            </Text>
            <Text style={[T.tipo.tituloS, { color: T.color.texto }]} numberOfLines={1}>{unidad.titulo}</Text>
          </View>
        </View>
        <View style={{ marginTop: T.esp.sm }}>
          <BarraProgreso valor={total ? actual / total : 0} segmentos={fase === 'resultado' ? undefined : total} alto={4} etiqueta={etiquetaPaso} />
        </View>
      </View>
      <ScrollView key={`${fase}-${paso}`} contentContainerStyle={styles.reproductorContenido} keyboardShouldPersistTaps="handled">
        <Entrada>{contenido}</Entrada>
      </ScrollView>
      <View style={styles.barraInferior}>{barraInferior}</View>
    </PantallaModal>
  );
}

// ============================================================================
// 10. COMPONENTE PRINCIPAL
// ============================================================================
export default function AdopcionEducacionComponent({ nombreUsuario, rolUsuario }) {
  const [, refrescar] = useReducer((x) => x + 1, 0);
  const [pestana, setPestana] = useState(store.ui.pestana);
  const [modal, setModal] = useState(null); // { tipo: 'animal' | 'seguimiento' | 'unidad', ... }

  // Al montarse (p. ej. tras "Cerrar sesión" y volver a entrar) vuelve a leer el store del módulo.
  useEffect(() => {
    refrescar();
  }, []);

  const rol = rolUsuario === 'albergue' ? 'albergue' : 'ciudadano';
  const cambiarPestana = (p) => {
    store.ui.pestana = p;
    setPestana(p);
  };
  const cerrarModal = () => {
    setModal(null);
    refrescar();
  };
  const abrirSeguimiento = (solicitudId, vista) => setModal({ tipo: 'seguimiento', solicitudId, vista, clave: Date.now() });

  // Indicadores en las pestañas: reportes sin revisar (albergue) u hitos vencidos (ciudadano).
  const avisos = {};
  if (rol === 'albergue') {
    avisos.adopcion = store.solicitudes.filter((s) => s.estado_solicitud === ESTADO_SOLICITUD.PENDIENTE).length;
    avisos.seguimiento = store.seguimientos.filter((r) => r.autor === 'adoptante' && !r.leido_albergue).length;
  } else {
    avisos.seguimiento = store.solicitudes
      .filter((s) => esSolicitudPropia(s, nombreUsuario))
      .reduce((n, s) => n + calcularHitos(s).filter((h) => h.estadoUI === ESTADO_HITO_UI.VENCIDO).length, 0);
  }

  return (
    <View style={styles.raiz}>
      <EncabezadoModulo rol={rol} nombreUsuario={nombreUsuario} pestana={pestana} onCambiar={cambiarPestana} avisos={avisos} />
      <View style={styles.contenido}>
        {pestana === 'adopcion' ? (
          <PestanaAdopcion rol={rol} nombreUsuario={nombreUsuario} refrescar={refrescar} abrirAnimal={(id) => setModal({ tipo: 'animal', id })} abrirNuevoAnimal={() => setModal({ tipo: 'nuevoAnimal' })} />
        ) : null}
        {pestana === 'seguimiento' ? (
          <PestanaSeguimiento
            rol={rol}
            nombreUsuario={nombreUsuario}
            abrirSeguimiento={abrirSeguimiento}
            irAAdopcion={() => cambiarPestana('adopcion')}
          />
        ) : null}
        {pestana === 'aprende' ? (
          <PestanaAprende abrirUnidad={(id) => setModal({ tipo: 'unidad', id })} abrirGlosario={() => setModal({ tipo: 'glosario' })} />
        ) : null}
      </View>

      {modal && modal.tipo === 'animal' ? (
        <PantallaAnimal
          key={modal.id}
          animalId={modal.id}
          rol={rol}
          nombreUsuario={nombreUsuario}
          onCerrar={cerrarModal}
          refrescar={refrescar}
          irASeguimiento={() => { setModal(null); cambiarPestana('seguimiento'); }}
        />
      ) : null}
      {modal && modal.tipo === 'seguimiento' ? (
        <PantallaSeguimiento
          key={modal.clave}
          solicitudId={modal.solicitudId}
          vistaInicial={modal.vista}
          rol={rol}
          nombreUsuario={nombreUsuario}
          onCerrar={cerrarModal}
          refrescar={refrescar}
        />
      ) : null}
      {modal && modal.tipo === 'unidad' ? (
        <ReproductorUnidad
          key={`${modal.id}-${modal.consulta ? 'c' : 'n'}`}
          unidadId={modal.id}
          consulta={!!modal.consulta}
          inicio={modal.inicio || 0}
          onCerrar={modal.volverGlosario ? () => setModal({ tipo: 'glosario' }) : cerrarModal}
          refrescar={refrescar}
          abrirUnidad={(id) => setModal({ tipo: 'unidad', id })}
          irAGaleria={() => { setModal(null); cambiarPestana('adopcion'); }}
        />
      ) : null}
      {modal && modal.tipo === 'nuevoAnimal' && rol === 'albergue' ? (
        <PantallaNuevoAnimal
          rol={rol}
          onCerrar={cerrarModal}
          onPublicado={(animal) => { refrescar(); setModal({ tipo: 'animal', id: animal.id }); }}
        />
      ) : null}
      {modal && modal.tipo === 'glosario' ? (
        <PantallaGlosario
          onCerrar={cerrarModal}
          abrirConsulta={(id, inicio) => setModal({ tipo: 'unidad', id, consulta: true, inicio, volverGlosario: true })}
        />
      ) : null}
    </View>
  );
}

// ============================================================================
// 11. ESTILOS (todos derivados de los tokens T)
// ============================================================================
const styles = StyleSheet.create({
  // El módulo se dibuja a sangre completa dentro del ScrollView de App.js (padding 14).
  raiz: { marginHorizontal: -14, marginTop: -14 },
  contenido: { paddingHorizontal: T.esp.lg, paddingTop: T.esp.lg },
  flex1: { flex: 1 },
  anchoCompleto: { alignSelf: 'stretch' },
  textoCentro: { textAlign: 'center' },
  presionado: { opacity: 0.82 },
  escalaPresionada: { transform: [{ scale: 0.98 }] },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: T.esp.sm },
  filaCentro: { flexDirection: 'row', alignItems: 'center', gap: T.esp.md },
  filaCentroXs: { flexDirection: 'row', alignItems: 'center', gap: T.esp.s6 },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: T.esp.sm, alignItems: 'center' },
  // Filas horizontales que se desplazan de borde a borde (anulan el padding del contenido).
  scrollSangre: { marginHorizontal: -T.esp.lg, flexGrow: 0 },
  filaChipsScroll: { flexDirection: 'row', alignItems: 'center', gap: T.esp.sm, paddingVertical: T.esp.xs, paddingHorizontal: T.esp.lg, marginBottom: T.esp.md },
  filaBotones: { flexDirection: 'row', gap: T.esp.sm, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' },
  separadorVertical: { width: 1, height: 24, backgroundColor: T.color.borde, marginHorizontal: T.esp.xs },
  espacioAbajo: { marginBottom: T.esp.md },
  espacioSeccion: { marginBottom: T.esp.xl },
  divisor: { height: 1, backgroundColor: T.color.superficieVariante, marginVertical: T.esp.md },
  divisorPleno: { height: 1, backgroundColor: T.color.superficieVariante },
  sombraTexto: { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  textoChip: { flexShrink: 1 },

  // Encabezado y pestañas
  encabezado: { paddingHorizontal: T.esp.lg, paddingTop: T.esp.lg, paddingBottom: T.esp.lg, overflow: 'hidden' },
  encabezadoMarca: { position: 'absolute', right: -20, top: -24, transform: [{ rotate: '-18deg' }] },
  pildoraRol: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.xs, paddingHorizontal: T.esp.md, paddingVertical: T.esp.s6,
    borderRadius: T.radio.pill, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)'
  },
  segmentado: {
    flexDirection: 'row', marginTop: T.esp.lg, padding: T.esp.xs, borderRadius: T.radio.xl,
    backgroundColor: 'rgba(255,255,255,0.12)', gap: T.esp.xs
  },
  segmento3: {
    flex: 1, minHeight: 48, borderRadius: T.radio.lgx, alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: T.esp.xs, overflow: 'hidden'
  },
  segmentoActivo: { backgroundColor: T.color.superficie, ...T.sombra.n1 },
  puntoAviso: {
    position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
    backgroundColor: T.color.error, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: T.color.sobrePrimario
  },
  puntoAvisoTexto: { ...T.tipo.etiquetaS, lineHeight: 14, color: T.color.sobrePrimario, fontWeight: '800' },

  // Primitivas
  boton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: T.esp.sm, borderRadius: T.radio.pill, overflow: 'hidden' },
  botonIcono: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fabSombra: { borderRadius: 20, ...T.sombra.n3 },
  fab: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.md, height: 56, paddingHorizontal: T.esp.s20,
    borderRadius: 20, backgroundColor: T.color.primario, overflow: 'hidden'
  },
  fabPosicion: { position: 'absolute', right: T.esp.lg, bottom: INSET_INFERIOR + T.esp.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.s6, minHeight: 40, paddingHorizontal: T.esp.s14,
    borderRadius: T.radio.pill, overflow: 'hidden'
  },
  chipActivo: { backgroundColor: T.color.contenedorPrimario, borderWidth: 1, borderColor: T.color.contenedorPrimario },
  chipInactivo: { backgroundColor: T.color.superficie, borderWidth: 1, borderColor: T.color.borde },
  chipEstado: { flexDirection: 'row', alignItems: 'center', gap: T.esp.xs, paddingHorizontal: T.esp.s10, paddingVertical: T.esp.s6, borderRadius: T.radio.pill, alignSelf: 'flex-start' },
  chipEstadoCompacto: { paddingHorizontal: T.esp.s10, paddingVertical: 3 },
  chipDato: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.s6, paddingHorizontal: T.esp.md, paddingVertical: T.esp.sm,
    borderRadius: T.radio.pill, backgroundColor: T.color.superficieVariante
  },
  aviso: { flexDirection: 'row', gap: T.esp.md, padding: T.esp.lg, borderRadius: T.radio.lg, marginBottom: T.esp.md, alignItems: 'flex-start' },
  tarjeta: { backgroundColor: T.color.superficie, borderRadius: T.radio.xl, padding: T.esp.lg },
  tarjetaBorde: { borderWidth: 1, borderColor: T.color.superficieVariante },
  tarjetaError: { backgroundColor: T.color.contenedorError },
  tarjetaBloqueada: { backgroundColor: T.color.bloqueadaFondo, shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: T.color.superficieVariante },
  tituloSeccion: { flexDirection: 'row', alignItems: 'flex-end', marginTop: T.esp.sm, marginBottom: T.esp.md, gap: T.esp.sm },
  insigniaContador: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: T.color.error, alignItems: 'center', justifyContent: 'center' },
  insigniaContadorTexto: { color: T.color.sobrePrimario, fontSize: 12, fontWeight: '800' },
  pista: { borderRadius: T.radio.pill, overflow: 'hidden' },
  filaSegmentos: { flexDirection: 'row', gap: T.esp.xs },
  segmento: { flex: 1, borderRadius: T.radio.pill },
  estadoVacio: { alignItems: 'center', gap: T.esp.sm, paddingVertical: T.esp.xl, paddingHorizontal: T.esp.lg },
  estadoVacioIcono: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.color.contenedorPrimario, alignItems: 'center', justifyContent: 'center', marginBottom: T.esp.xs },
  fotoBase: { backgroundColor: T.color.superficieVariante, overflow: 'hidden' },
  fotoMarcador: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  campo: { marginBottom: T.esp.lg, gap: T.esp.s6 },
  input: {
    minHeight: 52, borderWidth: 1, borderColor: T.color.bordeFuerte, borderRadius: T.radio.md, paddingHorizontal: T.esp.lg,
    paddingVertical: T.esp.md, fontSize: 16, color: T.color.texto, backgroundColor: T.color.superficie
  },
  inputMultilinea: { minHeight: 112, paddingTop: T.esp.md },
  inputEnfocado: { borderWidth: 2, borderColor: T.color.primarioMedio, paddingHorizontal: T.esp.s14 },
  inputError: { borderWidth: 2, borderColor: T.color.error },
  filaAyuda: { flexDirection: 'row', alignItems: 'flex-start', gap: T.esp.s6 },
  casilla: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.md, minHeight: 56, paddingHorizontal: T.esp.md, paddingVertical: T.esp.md,
    borderRadius: T.radio.lg, borderWidth: 1, borderColor: T.color.borde, marginBottom: T.esp.sm, overflow: 'hidden', backgroundColor: T.color.superficie
  },
  casillaMarcada: { backgroundColor: T.color.seleccion, borderColor: T.color.acento },
  casillaError: { borderColor: T.color.error, backgroundColor: T.color.errorSuave },
  filaDato: { flexDirection: 'row', gap: T.esp.md, alignItems: 'flex-start', paddingVertical: T.esp.s6 },
  filaDatoIcono: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.color.superficieVariante, alignItems: 'center', justifyContent: 'center' },
  avatarIcono: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.color.superficieVariante, alignItems: 'center', justifyContent: 'center' },
  miniatura: { width: 56, height: 56, borderRadius: T.radio.lg },
  miniaturaGrande: { width: 72, height: 72, borderRadius: T.radio.lgx },
  avatarGrande: { width: 64, height: 64, borderRadius: 32 },

  // Modal / pantallas completas
  modalRaiz: { flex: 1, backgroundColor: T.color.fondo },
  barraSuperior: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.xs, paddingTop: INSET_SUPERIOR + T.esp.xs, paddingBottom: T.esp.sm,
    paddingHorizontal: T.esp.xs, backgroundColor: T.color.superficie, borderBottomWidth: 1, borderBottomColor: T.color.superficieVariante
  },
  contenidoModal: { padding: T.esp.lg, paddingBottom: T.esp.xxl * 2 },
  barraInferior: {
    paddingHorizontal: T.esp.lg, paddingTop: T.esp.md, paddingBottom: INSET_INFERIOR, backgroundColor: T.color.superficie,
    borderTopWidth: 1, borderTopColor: T.color.superficieVariante
  },
  notaInferior: { flexDirection: 'row', alignItems: 'center', gap: T.esp.md, minHeight: 48 },
  cabeceraFormulario: { flexDirection: 'row', alignItems: 'center', gap: T.esp.md, marginBottom: T.esp.lg },
  encabezadoPaso: { flexDirection: 'row', alignItems: 'center', gap: T.esp.md, marginTop: T.esp.lg, marginBottom: T.esp.lg },
  pasoCirculo: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.color.primarioMedio, alignItems: 'center', justifyContent: 'center' },
  accionesFormulario: { marginTop: T.esp.xl, gap: T.esp.sm, alignItems: 'center' },
  exitoContenido: { padding: T.esp.xl, alignItems: 'center', gap: T.esp.lg, paddingBottom: T.esp.xxl * 2 },
  exitoIcono: { width: 104, height: 104, borderRadius: 52, backgroundColor: T.color.contenedorPrimario, alignItems: 'center', justifyContent: 'center' },
  pasoFila: { flexDirection: 'row', alignItems: 'center', gap: T.esp.md, paddingVertical: T.esp.sm },
  pasoNumero: { width: 24, height: 24, borderRadius: 12, backgroundColor: T.color.contenedorPrimario, alignItems: 'center', justifyContent: 'center' },

  // Galería
  galeria: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: T.esp.md },
  galeriaSombra: { borderRadius: T.radio.xl, backgroundColor: T.color.superficie, ...T.sombra.n2 },
  galeriaTarjeta: { borderRadius: T.radio.xl, overflow: 'hidden', backgroundColor: T.color.superficieVariante },
  galeriaArriba: { position: 'absolute', top: T.esp.md, left: T.esp.md },
  galeriaPie: { position: 'absolute', left: T.esp.md, right: T.esp.md, bottom: T.esp.md },
  creditoFotos: { ...T.tipo.cuerpoS, color: T.color.textoTenue, textAlign: 'center', marginTop: T.esp.lg },

  // Perfil del animal
  heroVeloSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  heroVeloInferior: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 300 },
  heroPie: { position: 'absolute', left: T.esp.xl, right: T.esp.xl, bottom: T.esp.xxl + T.esp.md },
  heroAtras: { position: 'absolute', top: INSET_SUPERIOR + T.esp.sm, left: T.esp.lg },
  hoja: {
    marginTop: -T.esp.xl, backgroundColor: T.color.fondo, borderTopLeftRadius: T.radio.xxl, borderTopRightRadius: T.radio.xxl,
    paddingHorizontal: T.esp.s20, paddingTop: T.esp.xl
  },
  tituloBloque: { color: T.color.texto, marginTop: T.esp.xl, marginBottom: T.esp.md },
  bloqueTonal: { flexDirection: 'row', gap: T.esp.md, alignItems: 'center', padding: T.esp.lg, borderRadius: T.radio.lg, backgroundColor: T.color.superficieVariante },
  requisito: { flexDirection: 'row', gap: T.esp.md, alignItems: 'flex-start', paddingVertical: T.esp.sm },
  cita: { backgroundColor: T.color.fondo, borderRadius: T.radio.md, padding: T.esp.md, marginVertical: T.esp.md, borderLeftWidth: 3, borderLeftColor: T.color.acento, gap: 2 },

  // Seguimiento
  proximo: { borderRadius: T.radio.xl, padding: T.esp.s20, marginBottom: T.esp.lg, overflow: 'hidden' },
  pildoraCuenta: { flexDirection: 'row', alignItems: 'center', gap: T.esp.xs, backgroundColor: T.color.superficie, paddingHorizontal: T.esp.s10, paddingVertical: T.esp.xs, borderRadius: T.radio.pill },
  fechaGrande: { ...T.tipo.numeroHero, color: T.color.sobrePrimario },
  pasosHitos: { flexDirection: 'row', alignItems: 'center', marginVertical: T.esp.md },
  pasoHito: { alignItems: 'center', gap: T.esp.xs },
  pasoHitoCirculo: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pasoHitoLinea: { flex: 1, height: 2, marginHorizontal: T.esp.xs, marginBottom: 20 },
  calendarioCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: T.esp.sm, paddingLeft: T.esp.md },
  calendarioFila: { flexDirection: 'row' },
  calendarioDiaSemana: { flex: 1, textAlign: 'center', color: T.color.textoTenue, paddingVertical: T.esp.xs },
  calendarioCelda: { flex: 1, alignItems: 'center', paddingVertical: 3, borderRadius: T.radio.md, minHeight: 52 },
  calendarioCeldaSeleccionada: { backgroundColor: T.color.superficieVariante },
  calendarioNumero: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // Mini insignia (visto / ! / x) sobre el número del día de un hito.
  calendarioInsignia: {
    position: 'absolute', top: -3, right: -3, width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: T.color.superficie
  },
  // Indicador de hoy: barra bajo el número, visible también en días con hito.
  calendarioHoyBarra: { width: 16, height: 3, borderRadius: 2, marginTop: 2, backgroundColor: 'transparent' },
  tarjetaCalendario: { paddingHorizontal: T.esp.xs, marginHorizontal: -T.esp.sm },


  calendarioPuntos: { flexDirection: 'row', gap: 3, height: 6, marginTop: 1 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: T.esp.md, marginTop: T.esp.md, paddingTop: T.esp.md, paddingHorizontal: T.esp.md, borderTopWidth: 1, borderTopColor: T.color.superficieVariante },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: T.esp.s6 },
  leyendaMuestra: { width: 14, height: 14, borderRadius: 7 },

  detalleDia: { backgroundColor: T.color.superficie, borderRadius: T.radio.lg, padding: T.esp.lg, marginTop: T.esp.sm, gap: T.esp.sm, borderWidth: 1, borderColor: T.color.superficieVariante },
  hitosResumen: { flexDirection: 'row', gap: T.esp.sm, marginTop: T.esp.md, marginBottom: T.esp.lg },
  hitoTileSombra: { flex: 1, borderRadius: T.radio.lg, backgroundColor: T.color.superficie, ...T.sombra.n1 },
  hitoTile: { borderRadius: T.radio.lg, padding: T.esp.md, gap: T.esp.xs, overflow: 'hidden' },
  hitoTileEstado: { paddingHorizontal: T.esp.sm, paddingVertical: 2, borderRadius: T.radio.pill, alignSelf: 'flex-start', maxWidth: '100%' },
  lineaTiempoItem: { flexDirection: 'row', gap: T.esp.md },
  lineaTiempoRiel: { alignItems: 'center', width: 36 },
  lineaTiempoNodo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  lineaTiempoLinea: { flex: 1, width: 2, backgroundColor: T.color.borde, marginVertical: T.esp.xs },
  nuevo: { backgroundColor: T.color.error, paddingHorizontal: T.esp.sm, paddingVertical: 2, borderRadius: T.radio.pill },
  fotoReporte: { width: '100%', height: 180, borderRadius: T.radio.lg, marginTop: T.esp.md, backgroundColor: T.color.superficieVariante },
  fotoReporteGrande: { width: '100%', height: 220, borderRadius: T.radio.lg, backgroundColor: T.color.superficieVariante },
  vistaFoto: { marginTop: T.esp.sm },
  quitarFoto: { position: 'absolute', top: T.esp.sm, right: T.esp.sm },
  observacion: { marginTop: T.esp.md, padding: T.esp.md, borderRadius: T.radio.md, backgroundColor: T.color.superficieVariante },
  rejillaTipos: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: T.esp.sm, marginBottom: T.esp.md },
  tipoTarjeta: {
    flexGrow: 1, padding: T.esp.md, borderRadius: T.radio.lg, borderWidth: 1, borderColor: T.color.borde,
    backgroundColor: T.color.superficie, overflow: 'hidden', minHeight: 132
  },
  tipoTarjetaActiva: { borderWidth: 2, borderColor: T.color.primarioMedio, backgroundColor: T.color.seleccion },
  tipoTarjetaCaja: { width: '48.5%' },
  fotoMarcadorVacio: {
    height: 160, marginTop: T.esp.sm, borderRadius: T.radio.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: T.color.bordeFuerte,
    alignItems: 'center', justifyContent: 'center', gap: T.esp.sm, backgroundColor: T.color.superficie
  },
  tipoIcono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hitoInterruptor: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.md, padding: T.esp.lg, borderRadius: T.radio.lg,
    backgroundColor: T.color.superficie, borderWidth: 1, borderColor: T.color.superficieVariante, marginBottom: T.esp.lg
  },
  itemBandeja: { flexDirection: 'row', gap: T.esp.md, padding: T.esp.lg, alignItems: 'flex-start', overflow: 'hidden' },
  puntoNuevo: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.color.error, marginTop: T.esp.xs },
  filaEstadisticas: { flexDirection: 'row', gap: T.esp.sm, marginBottom: T.esp.lg },
  estadisticaSombra: { flex: 1, borderRadius: T.radio.lg, backgroundColor: T.color.superficie, ...T.sombra.n1 },
  estadistica: { borderRadius: T.radio.lg, padding: T.esp.md, gap: 2, overflow: 'hidden', borderWidth: 1.5, borderColor: 'transparent' },
  estadisticaActiva: { borderColor: T.color.primarioMedio, backgroundColor: T.color.seleccion },
  estadisticaIcono: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: T.esp.xs },

  // Aprende
  cursoCabecera: { borderRadius: T.radio.xl, padding: T.esp.s20, marginBottom: T.esp.lg, overflow: 'hidden' },
  cursoMarca: { position: 'absolute', right: -16, top: -10, transform: [{ rotate: '-12deg' }] },
  filaInsignias: { gap: T.esp.md, paddingBottom: T.esp.md, paddingHorizontal: T.esp.lg },
  insignia: { width: 84, alignItems: 'center', gap: T.esp.s6 },
  insigniaCirculo: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  insigniaGanada: { backgroundColor: T.color.primarioMedio, borderWidth: 3, borderColor: T.color.acento },
  insigniaPendiente: { backgroundColor: T.color.superficie, borderWidth: 2, borderColor: T.color.borde, borderStyle: 'dashed' },
  rutaFila: { flexDirection: 'row', gap: T.esp.md },
  rutaRiel: { width: 40, alignItems: 'center' },
  rutaLinea: { flex: 1, width: 3, borderRadius: 2, marginVertical: T.esp.xs },
  nodo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: T.esp.md },
  nodoActivo: { backgroundColor: T.color.contenedorPrimario, borderWidth: 2, borderColor: T.color.primarioMedio },
  nodoGrande: { width: 48, height: 48, borderRadius: 24, marginTop: 0 },
  nodoHalo: { padding: 4, borderRadius: 28, backgroundColor: T.color.acento, marginTop: T.esp.md },
  tarjetaActual: { borderWidth: 2, borderColor: T.color.primarioMedio },
  filaUnidad: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.md, minHeight: 64, paddingHorizontal: T.esp.lg, paddingVertical: T.esp.md,
    borderRadius: T.radio.lg, backgroundColor: T.color.superficie, overflow: 'hidden', marginTop: T.esp.xs
  },
  unidadIcono: { width: 48, height: 48, borderRadius: T.radio.lg, backgroundColor: T.color.superficieVariante, alignItems: 'center', justifyContent: 'center' },
  descargo: { ...T.tipo.cuerpoS, color: T.color.textoTenue, textAlign: 'center', marginTop: T.esp.md, marginBottom: T.esp.lg },
  reproductorCabecera: {
    paddingTop: INSET_SUPERIOR + T.esp.xs, paddingHorizontal: T.esp.sm, paddingBottom: T.esp.md, backgroundColor: T.color.superficie,
    borderBottomWidth: 1, borderBottomColor: T.color.superficieVariante
  },
  reproductorContenido: { padding: T.esp.xl, paddingBottom: T.esp.xxl },
  diapoIcono: { width: 88, height: 88, borderRadius: T.radio.xl, alignItems: 'center', justifyContent: 'center' },
  diapoTexto: { color: T.color.texto, marginTop: T.esp.md },
  citaLey: {
    flexDirection: 'row', gap: T.esp.sm, marginTop: T.esp.lg, padding: T.esp.lg, borderRadius: T.radio.lg,
    backgroundColor: T.color.superficie, borderLeftWidth: 4, borderLeftColor: T.color.primarioMedio
  },
  itemLista: { flexDirection: 'row', gap: T.esp.md, alignItems: 'flex-start', paddingVertical: T.esp.sm, borderBottomWidth: 1, borderBottomColor: T.color.superficieVariante },
  itemListaNumero: { width: 26, height: 26, borderRadius: 13, backgroundColor: T.color.contenedorPrimario, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  fuente: { flexDirection: 'row', gap: T.esp.sm, alignItems: 'center', marginTop: T.esp.xl, padding: T.esp.md, borderRadius: T.radio.md, backgroundColor: T.color.superficieVariante },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: T.esp.md, minHeight: 60, padding: T.esp.md, borderRadius: T.radio.lg,
    borderWidth: 1.5, borderColor: T.color.borde, backgroundColor: T.color.superficie, marginBottom: T.esp.sm, overflow: 'hidden'
  },
  opcionSeleccionada: { borderColor: T.color.primarioMedio, backgroundColor: T.color.seleccion },
  opcionCorrecta: { borderColor: '#1E6B3A', backgroundColor: TONOS.exito.fondo },
  opcionIncorrecta: { borderColor: T.color.error, backgroundColor: TONOS.error.fondo },
  opcionLetra: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.color.superficieVariante, alignItems: 'center', justifyContent: 'center' },
  retro: { padding: T.esp.lg, borderRadius: T.radio.lg, marginTop: T.esp.sm },
  escenarioTarjeta: { padding: T.esp.s20, borderRadius: T.radio.xl },
  resultado: { alignItems: 'center', gap: T.esp.lg, paddingTop: T.esp.xl },
  anillo: { width: 152, height: 152, alignItems: 'center', justifyContent: 'center' },
  anilloGiro: { ...StyleSheet.absoluteFill, alignItems: 'center' },
  anilloMarca: { width: 7, height: 18, borderRadius: 4 },
  anilloCentro: { width: 112, height: 112, borderRadius: 56, backgroundColor: T.color.superficie, alignItems: 'center', justifyContent: 'center' },
  insigniaGanadaTarjeta: { flexDirection: 'row', alignItems: 'center', gap: T.esp.lg, padding: T.esp.lg, borderRadius: T.radio.xl, alignSelf: 'stretch' },
  insigniaGrande: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.color.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: T.color.acento }
});
