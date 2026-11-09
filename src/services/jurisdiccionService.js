// src/services/jurisdiccionService.js
// Autor: Fabián Andrés Peña González - Motor de Enrutamiento Territorial y Reglas de Negocio

export const determinarJurisdiccion = (lat, lon) => {
  // Umbral geográfico entre Soacha y Sur de Bogotá (Bosa / Ciudad Bolívar)
  const esSoacha = (lat <= 4.6015 && lon <= -74.1750);
  
  if (esSoacha) {
    return {
      municipio: 'Soacha (Cundinamarca)',
      entidad: 'Inspección de Policía de Soacha / Policía Ambiental y Ecológica',
      canales: 'Línea 123 | Inspecciones de Policía (Comunas 1 a 6) | Atención máx. 24h (Art. 10, Ley 2455 de 2025).'
    };
  }
  
  return {
    municipio: 'Bogotá D.C.',
    entidad: 'Instituto Distrital de Protección y Bienestar Animal (IDPYBA) / Escuadrón Anticrueldad',
    canales: 'Línea 123 (Urgencias) | Línea 018000115161 | Bogotá Te Escucha.'
  };
};

export const calcularUrgenciaLeyAngel = (tipoMaltrato) => {
  if (tipoMaltrato === 'Agresión física activa / Sevicia') return 'Alta (Atención Inmediata 24h)';
  if (tipoMaltrato === 'Abandono en vía pública') return 'Media';
  return 'Baja';
};