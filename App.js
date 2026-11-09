// App.js - Contenedor Principal, Autenticación y Control de Roles (RF01, RNF05)
// Autor: Fabián Andrés Peña González
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar
} from 'react-native';
import DenunciasComponent from './src/components/DenunciasComponent';
import AdopcionEducacionComponent from './src/components/AdopcionEducacionComponent';

export default function App() {
  const [autenticado, setAutenticado] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState('Fabián Peña');
  const [rolUsuario, setRolUsuario] = useState('ciudadano'); // 'ciudadano' | 'albergue'
  const [aceptaHabeasData, setAceptaHabeasData] = useState(false);
  const [moduloActivo, setModuloActivo] = useState('denuncias'); // 'denuncias' | 'adopcion'

  // PANTALLA DE LOGIN, ROLES Y CONSENTIMIENTO HABEAS DATA (LEY 1581 DE 2012)
  if (!autenticado) {
    return (
      <SafeAreaView style={styles.contenedor}>
        <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
        <ScrollView contentContainerStyle={styles.loginBox}>
          <Text style={styles.logoTitulo}>🐾 AnimalGuard</Text>
          <Text style={styles.subtitulo}>
            Bogotá D.C. – Soacha | Prototipo Funcional
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitulo}>
              Autenticación y Control de Privacidad (RF01)
            </Text>

            <Text style={styles.label}>Usuario:</Text>
            <TextInput
              style={styles.input}
              value={nombreUsuario}
              onChangeText={setNombreUsuario}
            />

            <Text style={styles.label}>Rol del sistema (RNF05):</Text>
            <View style={styles.fila}>
              <TouchableOpacity
                style={[
                  styles.btnRol,
                  rolUsuario === 'ciudadano' && styles.btnRolActivo
                ]}
                onPress={() => setRolUsuario('ciudadano')}
              >
                <Text style={styles.txtRol}>Ciudadano</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnRol,
                  rolUsuario === 'albergue' && styles.btnRolActivo
                ]}
                onPress={() => setRolUsuario('albergue')}
              >
                <Text style={styles.txtRol}>Albergue</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.avisoBox}>
              <Text style={styles.avisoTexto}>
                Aviso Ley 1581 de 2012: AnimalGuard protege tu identidad frente a
                terceros eliminando metadatos EXIF y restringiendo el acceso
                público. Actúa como un canal de orientación y estructuración
                preliminar, sin sustituir los canales oficiales (Fiscalía GELMA,
                IDPYBA o Inspecciones de Policía).
              </Text>
            </View>

            <TouchableOpacity
              style={styles.checkFila}
              onPress={() => setAceptaHabeasData(!aceptaHabeasData)}
            >
              <Text style={{ fontSize: 18, marginRight: 8 }}>
                {aceptaHabeasData ? '☑️' : '⬜'}
              </Text>
              <Text style={{ flex: 1, fontSize: 12 }}>
                Autorizo de forma previa, expresa e informada el tratamiento de
                mis datos personales conforme a la Ley 1581 de 2012.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnPrimario,
                !aceptaHabeasData && { backgroundColor: '#94A3B8' }
              ]}
              disabled={!aceptaHabeasData}
              onPress={() => setAutenticado(true)}
            >
              <Text style={styles.txtBtnPrimario}>Ingresar a AnimalGuard</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // CONTENEDOR PRINCIPAL DE MÓDULOS
  return (
    <SafeAreaView style={styles.contenedor}>
      <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitulo}>🐾 AnimalGuard</Text>
          <Text style={styles.headerSub}>
            {nombreUsuario} ({rolUsuario.toUpperCase()})
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setAutenticado(false)}
          style={styles.btnSalir}
        >
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>
            Cambiar Rol
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity
          style={[
            styles.navItem,
            moduloActivo === 'denuncias' && styles.navItemActivo
          ]}
          onPress={() => setModuloActivo('denuncias')}
        >
          <Text style={styles.navTexto}>📍 Denuncias y GPS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.navItem,
            moduloActivo === 'adopcion' && styles.navItemActivo
          ]}
          onPress={() => setModuloActivo('adopcion')}
        >
          <Text style={styles.navTexto}>🐶 Adopción y Leyes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14 }}>
        {moduloActivo === 'denuncias' ? (
          <DenunciasComponent nombreUsuario={nombreUsuario} />
        ) : (
          <AdopcionEducacionComponent
            nombreUsuario={nombreUsuario}
            rolUsuario={rolUsuario}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F4F6F8' },
  loginBox: { padding: 20 },
  logoTitulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B4332',
    textAlign: 'center',
    marginTop: 15
  },
  subtitulo: {
    fontSize: 12,
    color: '#52796F',
    textAlign: 'center',
    marginBottom: 15
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    elevation: 2
  },
  cardTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B4332',
    marginBottom: 10
  },
  label: { fontSize: 12, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FAFAFA'
  },
  fila: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  btnRol: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    borderRadius: 8,
    alignItems: 'center'
  },
  btnRolActivo: { backgroundColor: '#D8F3DC' },
  txtRol: { fontWeight: 'bold', color: '#1B4332', fontSize: 12 },
  avisoBox: {
    backgroundColor: '#EDF2F7',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10
  },
  avisoTexto: { fontSize: 11, color: '#4A5568', lineHeight: 16 },
  checkFila: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  btnPrimario: {
    backgroundColor: '#1B4332',
    padding: 13,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  txtBtnPrimario: { color: '#FFF', fontWeight: 'bold' },
  header: {
    backgroundColor: '#1B4332',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitulo: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#D8F3DC', fontSize: 11 },
  btnSalir: { backgroundColor: '#2D6A4F', padding: 8, borderRadius: 6 },
  navBar: { flexDirection: 'row', backgroundColor: '#2D6A4F' },
  navItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  navItemActivo: {
    borderBottomWidth: 3,
    borderBottomColor: '#95D5B2',
    backgroundColor: '#1B4332'
  },
  navTexto: { color: '#FFF', fontSize: 12, fontWeight: 'bold' }
});
