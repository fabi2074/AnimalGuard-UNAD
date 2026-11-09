// src/components/DenunciasComponent.js
// TODO - Asignado a: Fabián Alexis Hernández Peinado
// Requerimientos a programar aquí:
// 1. Formulario de denuncia (tipo de maltrato y descripción) - RF02
// 2. Captura de GPS con expo-location y llamado a determinarJurisdiccion(lat, lon) - RF02 / RF03
// 3. Adjuntar foto con expo-image-picker y quitar metadatos EXIF con expo-image-manipulator - RNF01
// 4. Cola de guardado cifrado local con expo-secure-store - RF06

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DenunciasComponent({ nombreUsuario }) {
  return (
    <View style={styles.caja}>
      <Text style={styles.titulo}>🚧 Módulo de Denuncias y GPS en construcción</Text>
      <Text style={styles.texto}>Responsable: Fabián Alexis Hernández Peinado</Text>
      <Text style={styles.texto}>Usuario en sesión: {nombreUsuario}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { backgroundColor: '#FFF', padding: 20, borderRadius: 10, elevation: 2 },
  titulo: { fontWeight: 'bold', fontSize: 15, color: '#1B4332', marginBottom: 8 },
  texto: { fontSize: 13, color: '#334155', marginBottom: 4 }
});