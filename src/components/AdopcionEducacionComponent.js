// src/components/AdopcionEducacionComponent.js
// TODO - Asignado a: Iván Antonio Parada Meneses
// Requerimientos a programar aquí:
// 1. Catálogo de animales en adopción y formulario de postulación (filtro Ley 2455 de 2025) - RF04
// 2. Bitácora de seguimiento posadopción (15, 30 y 90 días) y aprobación desde rol Albergue - RF04 / RNF05
// 3. Tarjetas del Módulo Educativo (Leyes 84/1989, 1774/2016 y 2455/2025) - RF05

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdopcionEducacionComponent({ nombreUsuario, rolUsuario }) {
  return (
    <View style={styles.caja}>
      <Text style={styles.titulo}>🚧 Módulo de Adopción y Educación en construcción</Text>
      <Text style={styles.texto}>Responsable: Iván Antonio Parada Meneses</Text>
      <Text style={styles.texto}>Usuario en sesión: {nombreUsuario} (Rol: {rolUsuario})</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { backgroundColor: '#FFF', padding: 20, borderRadius: 10, elevation: 2 },
  titulo: { fontWeight: 'bold', fontSize: 15, color: '#1B4332', marginBottom: 8 },
  texto: { fontSize: 13, color: '#334155', marginBottom: 4 }
});