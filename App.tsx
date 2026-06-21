// =============================================================================
// SurApícola — Punto de entrada de la aplicación
// =============================================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/database';
import { AppNavigator } from './src/navigation/AppNavigator';

/**
 * Pantalla de error que se muestra si la inicialización de SQLite falla.
 * En una app de negocio, es preferible mostrar un error claro a crashear.
 */
function ErrorDB({ error }: { error: Error }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorEmoji}>⚠️</Text>
      <Text style={styles.errorTitulo}>Error al inicializar la base de datos</Text>
      <Text style={styles.errorMensaje}>{error.message}</Text>
      <Text style={styles.errorSugerencia}>
        Cerrá y volvé a abrir la app. Si el error persiste, contactá al soporte.
      </Text>
    </View>
  );
}

export default function App() {
  const [dbError, setDbError] = React.useState<Error | null>(null);

  if (dbError) {
    return (
      <SafeAreaProvider>
        <ErrorDB error={dbError} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName="surapicola.db"
        onInit={initDatabase}
        onError={(error) => {
          console.error('[App] Error SQLite:', error);
          setDbError(error);
        }}
        // Suspense-compatible: muestra ActivityIndicator mientras inicializa
        useSuspense={false}
      >
        <AppNavigator />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E05A5A',
    textAlign: 'center',
  },
  errorMensaje: {
    fontSize: 12,
    color: '#8A8A9A',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  errorSugerencia: {
    fontSize: 13,
    color: '#8A8A9A',
    textAlign: 'center',
    marginTop: 8,
  },
});
