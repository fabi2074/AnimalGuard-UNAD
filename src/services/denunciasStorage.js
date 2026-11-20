
import * as SecureStore from 'expo-secure-store';

// Espacio donde se almacenarán las denuncias pendientes
const CLAVE_DENUNCIAS = 'animalguard_denuncias_pendientes';

// Consultar las denuncias guardadas en el dispositivo
export const obtenerDenunciasPendientes = async () => {
  try {
    const datos = await SecureStore.getItemAsync(CLAVE_DENUNCIAS);

    if (!datos) {
      return [];
    }

    return JSON.parse(datos);
  } catch (error) {
    console.error('Error al consultar las denuncias:', error);
    throw error;
  }
};

// Guardar una nueva denuncia de forma cifrada en el dispositivo
export const guardarDenuncia = async (denuncia) => {
  try {
    const denuncias = await obtenerDenunciasPendientes();

    const nuevaDenuncia = {
      ...denuncia,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fechaCreacion: new Date().toISOString(),
      estado: 'Pendiente de envío',
    };

    denuncias.push(nuevaDenuncia);

    await SecureStore.setItemAsync(
      CLAVE_DENUNCIAS,
      JSON.stringify(denuncias)
    );

    return nuevaDenuncia;
  } catch (error) {
    console.error('Error al guardar la denuncia:', error);
    throw error;
  }
};

