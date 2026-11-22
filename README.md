# AnimalGuard — Prototipo Móvil de Protección y Bienestar Animal

**AnimalGuard** es un prototipo de aplicación móvil diseñado para fortalecer la denuncia ciudadana de maltrato animal, la adopción responsable con trazabilidad y la educación normativa en el corredor **Bogotá D.C. – Soacha (Cundinamarca)**.

Proyecto desarrollado para el programa de **Ingeniería de Sistemas** de la **Universidad Nacional Abierta y a Distancia (UNAD)** — **Grupo 115** (Periodo académico 2026–2), alineado con los Objetivos de Desarrollo Sostenible **ODS 11** (*Ciudades y comunidades sostenibles*) y **ODS 15** (*Vida de ecosistemas terrestres*).

## Alcance Técnico (Nivel TRL 5)

El proyecto alcanza un nivel de madurez tecnológica **TRL 5**

* **Prototipo móvil ejecutable:** Todos los módulos funcionales (acceso con consentimiento, denuncias georreferenciadas, adopción, seguimiento posadopción y educación normativa) operan en dispositivo real mediante **Expo Go**.

* **Base de datos relacional desplegada:** El esquema de 9 tablas (`database/schema.sql`), sus restricciones normativas (`CHECK`) y las políticas de seguridad a nivel de fila (**RLS**) se encuentran creados y validados de forma independiente en **Supabase (PostgreSQL)**.

* **Persistencia actual del prototipo:** En esta etapa, el módulo de denuncias guarda registros localmente en el dispositivo (`denunciasStorage.js`), mientras que los módulos de adopción y educación operan con datos de ejemplo en memoria local (se conservan al cerrar sesión y se reinician al cerrar completamente la aplicación). La integración en tiempo real vía API entre la app móvil y Supabase se proyecta para la siguiente fase de madurez.

## Módulos Implementados

### 1. Acceso, Roles y Privacidad (`App.js`)

* Consentimiento expreso de **Habeas Data (Ley 1581 de 2012)** con enlace directo al texto oficial de la norma.

* Control de acceso basado en roles (**Ciudadano** y **Albergue**) con opción de cierre de sesión y reinicio del consentimiento.

### 2. Denuncias de Maltrato y Jurisdicción (`DenunciasComponent.js`, `jurisdiccionService.js`, `denunciasStorage.js`)

* Registro estructurado del tipo de maltrato y descripción de hechos, priorizando casos graves bajo la **Ley Ángel**.

* **Limpieza automática de metadatos EXIF** en fotografías mediante `expo-image-manipulator` para proteger la identidad y ubicación personal del denunciante.

* **Detección automática de jurisdicción por GPS** (`expo-location`):

  * **Bogotá D.C.:** Enruta al Instituto Distrital de Protección y Bienestar Animal (**IDPYBA**) / Escuadrón Anticrueldad (Línea 123, línea actualizada `(601) 439 9801` y Bogotá Te Escucha).

  * **Soacha (Cundinamarca):** Enruta a las Inspecciones de Policía (Comunas 1 a 6) y Policía Ambiental y Ecológica, recordando el plazo de atención de máximo 24 horas (Art. 10, Ley 2455 de 2025).

* Almacenamiento local de reportes en el dispositivo.

### 3. Adopción Responsable y Seguimiento Posadopción (`AdopcionEducacion`)

* Galería interactiva de animales con filtros y ficha detallada.

* Postulación en **3 pasos** con recolección de datos mínimos (Ley 1581) y filtro obligatorio de declaración juramentada de no inhabilidad (**Ley Ángel — Ley 2455 de 2025**).

* **Panel de Albergue:** Publicación de nuevos animales con foto sin metadatos EXIF y gestión de múltiples postulaciones por mascota (al aprobar una solicitud, las demás del mismo animal se rechazan automáticamente).

* **Seguimiento posadopción:** Calendario con hitos obligatorios a **15, 30 y 90 días**, registro de reportes (rutina, médico, comportamiento, urgencia) y alertas destacadas para el albergue.

### 4. Educación Normativa

* Curso interactivo de **7 unidades** sobre la legislación colombiana de protección animal (**Leyes 84/1989, 1774/2016, 2054/2020 y 2455/2025**).

* Incluye cuestionario (quiz), sistema de insignias y glosario práctico.

## Estructura del Repositorio

```
AnimalGuard-UNAD/
├── assets/                          # Íconos y recursos gráficos de la aplicación
├── database/
│   └── schema.sql                   # Modelo relacional (9 tablas, restricciones y datos semilla)
├── src/
│   ├── components/
│   │   ├── DenunciasComponent.js    # Módulo de denuncias, GPS y limpieza EXIF
│   │   └── AdopcionEducacion...     # Módulo de adopción, seguimiento y educación
│   └── services/
│       ├── jurisdiccionService.js   # Lógica de umbral geográfico Bogotá–Soacha y urgencia
│       └── denunciasStorage.js      # Persistencia local de denuncias en el dispositivo
├── App.js                           # Navegación principal, roles y consentimiento Ley 1581
├── app.json                         # Configuración del proyecto Expo
├── package.json                     # Dependencias y scripts
└── README.md

```

## Requisitos e Instalación Local

### Requisitos previos

* **Node.js `v22.13` o superior** (requerido por el entorno Expo del proyecto).

* **Git** instalado en el equipo.

* Aplicación **Expo Go** instalada en un dispositivo móvil (Android o iOS) con conexión a internet (necesaria para cargar las fotografías de la galería de adopción y el acceso a enlaces normativos).

### Pasos para ejecutar el prototipo

1. **Clonar el repositorio:**

   ```
   git clone https://github.com/fabi2074/AnimalGuard-UNAD.git
   cd AnimalGuard-UNAD
   
   ```

2. **Instalar dependencias:**

   ```
   npm install
   
   ```

3. **Iniciar el servidor de desarrollo de Expo:**

   ```
   npx expo start
   
   ```

4. **Ejecutar en el dispositivo móvil:**

   * Escanea el código QR generado en la terminal utilizando la app **Expo Go** (en Android) o la cámara del dispositivo (en iOS).

   * Concede los permisos de **ubicación (GPS)** y **galería/cámara** cuando el módulo de denuncias o albergue los solicite.

### Despliegue del esquema de base de datos (Opcional)

Para replicar la capa de datos de forma independiente en un proyecto de **Supabase**:

1. Abre el **SQL Editor** en tu panel de Supabase.

2. Copia y ejecuta el contenido de `database/schema.sql`.

## Marco Normativo Integrado

| Norma | Aplicación en AnimalGuard | 
| ----- | ----- | 
| **Ley 84 de 1989** | Estatuto Nacional de Protección de los Animales (contenidos educativos). | 
| **Ley Estatutaria 1581 de 2012** | Consentimiento de Habeas Data, minimización de datos y limpieza de metadatos EXIF. | 
| **Ley 1774 de 2016** | Reconocimiento de animales como seres sintientes y tipificación penal del maltrato. | 
| **Ley 2054 de 2020** | Atenuación de consecuencias sociales por abandono y fortalecimiento de albergues. | 
| **Ley 2455 de 2025 (Ley Ángel)** | Priorización de urgencias, atención en 24h y filtro de no inhabilidad para adoptantes. | 

## Equipo de Desarrollo — Grupo 115 (UNAD)

* **Fabián Andrés Peña González** — Arquitectura, base de datos (`schema.sql`), servicio de jurisdicción territorial (`jurisdiccionService.js`) e integración principal (`App.js`).

* **Fabián Alexis Hernández Peinado** — Módulo de Denuncias, geolocalización GPS, eliminación de metadatos EXIF y almacenamiento local (`DenunciasComponent.js`, `denunciasStorage.js`).

* **Iván Antonio Parada Meneses** — Módulo de Adopción responsable, panel de albergue, seguimiento posadopción y curso educativo normativo.

## Trabajo Futuro

* Conexión en tiempo real de los formularios móviles y autenticación mediante `@supabase/supabase-js` contra las tablas y políticas RLS ya desplegadas.

* Configuración del plugin nativo de `expo-image-picker` en `app.json` para generación de compilaciones independientes (`.apk` / `.aab`).

* Validación formal de usabilidad con usuarios finales en campo mediante la escala **SUS** (*System Usability Scale*).

## Licencia

Este proyecto se distribuye bajo la licencia incluida en el archivo `LICENSE` del repositorio, con fines académicos y de impacto social.