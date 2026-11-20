// src/components/DenunciasComponent.js
// TODO - Asignado a: Fabián Alexis Hernández Peinado
// Requerimientos a programar aquí:
// 1. Formulario de denuncia (tipo de maltrato y descripción) - RF02
// 2. Captura de GPS con expo-location y llamado a determinarJurisdiccion(lat, lon) - RF02 / RF03
// 3. Adjuntar foto con expo-image-picker y quitar metadatos EXIF con expo-image-manipulator - RNF01
// 4. Cola de guardado cifrado local con expo-secure-store - RF06


import React, { useState } from 'react';
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from 'react-native';

import * as Location from 'expo-location';
import { determinarJurisdiccion } from '../services/jurisdiccionService';
import { guardarDenuncia } from '../services/denunciasStorage'; 
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export default function DenunciasComponent({ nombreUsuario }) {
  const [tipoMaltrato, setTipoMaltrato] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [ubicacion, setUbicacion] = useState(null);
const [cargandoGPS, setCargandoGPS] = useState(false);
const [errorGPS, setErrorGPS] = useState('');
const [jurisdiccion, setJurisdiccion] = useState(null);
const [fotografias, setFotografias] = useState([]);


const [guardando, setGuardando] = useState(false);



const enviarDenuncia = async () => {
  if (!tipoMaltrato) {
    alert('Selecciona el tipo de maltrato.');
    return;
  }

  if (!descripcion.trim()) {
    alert('Escribe la descripción de los hechos.');
    return;
  }

  if (!ubicacion) {
    alert('Primero debes obtener la ubicación GPS.');
    return;
  }

  try {
    setGuardando(true);

    const denuncia = {
      nombreUsuario,
      tipoMaltrato,
      descripcion,
      ubicacion,
      jurisdiccion,
      fotografias: fotografias.map((foto) => ({
        uri: foto.uri,
        nombre: foto.fileName || 'fotografia.jpg',
      })),
    };

    await guardarDenuncia(denuncia);

   

    alert('Denuncia guardada correctamente en el dispositivo.');

    setTipoMaltrato('');
    setDescripcion('');
    setUbicacion(null);
    setJurisdiccion(null);
    setFotografias([]);

  } catch (error) {
    alert('No fue posible guardar la denuncia. Intenta nuevamente.');
    console.error(error);
  } finally {
    setGuardando(false);
  }
};


const seleccionarFotografias = async () => {
  try {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permiso.granted) {
      alert('Necesitamos permiso para acceder a tus fotografías.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    
    if (!resultado.canceled) {
  const fotosLimpias = await Promise.all(
    resultado.assets.map(async (foto) => {
      const imagenLimpia = await ImageManipulator.manipulateAsync(
        foto.uri,
        [],
        {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return {
        ...foto,
        uri: imagenLimpia.uri,
        exif: undefined,
      };
    })
  );

  setFotografias(fotosLimpias);
}


  } catch (error) {
    alert('No fue posible seleccionar las fotografías.');
  }
};

  const tiposMaltrato = [
    'Agresión física activa / Sevicia',
    'Abandono en vía pública',
    'Falta de alimentación',
    'Falta de atención veterinaria',
    'Otros'
  ];

    const obtenerUbicacion = async () => {
    try {
      setCargandoGPS(true);
      setErrorGPS('');

      // Solicitar permiso para acceder a la ubicación
      const permiso = await Location.requestForegroundPermissionsAsync();

      if (permiso.status !== 'granted') {
        setErrorGPS('Debes permitir el acceso a la ubicación.');
        setCargandoGPS(false);
        return;
      }

      // Obtener las coordenadas GPS
      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const lat = posicion.coords.latitude;
      const lon = posicion.coords.longitude;

      setUbicacion({ lat, lon });

      // Determinar si la denuncia corresponde a Bogotá o Soacha
      const resultado = determinarJurisdiccion(lat, lon);
      setJurisdiccion(resultado);

    } catch (error) {
      setErrorGPS('No fue posible obtener la ubicación. Intenta nuevamente.');
    } finally {
      setCargandoGPS(false);
    }
  };

  return (
    <View style={styles.caja}>

      <Text style={styles.titulo}>
        🐾 Registro de denuncia por maltrato animal
      </Text>

      <Text style={styles.texto}>
        Usuario: {nombreUsuario}
      </Text>

      <Text style={styles.subtitulo}>
        1. Tipo de maltrato
      </Text>

      <Text style={styles.texto}>
        Selecciona la situación que deseas denunciar:
      </Text>

      {tiposMaltrato.map((tipo, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.opcion,
            tipoMaltrato === tipo && styles.opcionSeleccionada
          ]}
          onPress={() => setTipoMaltrato(tipo)}
        >
          <Text style={styles.textoOpcion}>
            {tipoMaltrato === tipo ? '🔘 ' : '⚪ '}
            {tipo}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.subtitulo}>
        2. Descripción de los hechos
      </Text>

      <Text style={styles.texto}>
        Cuéntanos qué sucedió, dónde ocurrió y cualquier
        detalle que ayude a comprender la situación.
      </Text>

      <TextInput
        style={styles.areaTexto}
        placeholder="Describe aquí lo sucedido..."
        value={descripcion}
        onChangeText={setDescripcion}
        multiline={true}
        numberOfLines={5}
        textAlignVertical="top"
      />

      <Text style={styles.subtitulo}>
        3. Ubicación y fotografías
      </Text>


<TouchableOpacity
  style={{
    backgroundColor: '#2D6A4F',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  }}
  onPress={seleccionarFotografias}
>
  <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
    📷 Seleccionar fotografías
  </Text>
</TouchableOpacity>
     
{fotografias.length > 0 && (
  <View style={{ marginTop: 12 }}>
    {fotografias.map((foto, index) => (
      <View key={index} style={{ marginBottom: 10 }}>
        <Image
          source={{ uri: foto.uri }}
          style={{
            width: '100%',
            height: 180,
            borderRadius: 8,
          }}
          resizeMode="cover"
        />
      </View>
    ))}
  </View>
)}

<TouchableOpacity
  style={{
    backgroundColor: '#1B4332',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  }}
  onPress={obtenerUbicacion}
  disabled={cargandoGPS}
>
  <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
    {cargandoGPS ? 'Obteniendo ubicación...' : '📍 Obtener mi ubicación'}
  </Text>
</TouchableOpacity>

{errorGPS !== '' && (
  <Text style={{ color: 'red', marginTop: 8 }}>
    {errorGPS}
  </Text>
)}

{ubicacion && (
  <View style={{ marginTop: 12, padding: 12, backgroundColor: '#D8F3DC', borderRadius: 8 }}>
    <Text style={{ color: '#1B4332', fontWeight: 'bold' }}>
      Ubicación obtenida correctamente
    </Text>
    <Text>Latitud: {ubicacion.lat}</Text>
    <Text>Longitud: {ubicacion.lon}</Text>
    {jurisdiccion && (
      <>
        <Text>Municipio: {jurisdiccion.municipio}</Text>
        <Text>Entidad responsable: {jurisdiccion.entidad}</Text>
        <Text>Canales: {jurisdiccion.canales}</Text>
      </>
    )}
  </View>
)}


<TouchableOpacity
  style={{
    backgroundColor: '#2D6A4F',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  }}
  onPress={enviarDenuncia}
  disabled={guardando}
>
  <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
    {guardando ? 'Guardando denuncia...' : '📤 Enviar denuncia'}
  </Text>
</TouchableOpacity>


    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    elevation: 2
  },

  titulo: {
    fontWeight: 'bold',
    fontSize: 17,
    color: '#1B4332',
    marginBottom: 12
  },

  subtitulo: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#1B4332',
    marginTop: 18,
    marginBottom: 8
  },

  texto: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 8,
    lineHeight: 19
  },

  opcion: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    marginBottom: 8
  },

  opcionSeleccionada: {
    backgroundColor: '#D8F3DC',
    borderColor: '#2D6A4F'
  },

  textoOpcion: {
    fontSize: 13,
    color: '#334155'
  },

  areaTexto: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 13,
    backgroundColor: '#FAFAFA'
  },

  aviso: {
    backgroundColor: '#EDF2F7',
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18
  }
});
