// =============================================================================
// SurApícola — Pantalla de Inicio (Dashboard)
// =============================================================================
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useDashboard } from '../hooks/useDashboard';
import { useAlertasStock } from '../hooks/useAlertasStock';
import { formatearDinero, formatearGramos, formatearFecha, formatearUnidades } from '../utils/format';
import { cargarDatosPrueba, limpiarDatosPrueba } from '../database/devSeed';

// ── Paleta de colores ────────────────────────────────────────────────────────
const COLORS = {
  bg: '#0F0F1A',
  surface: '#1A1A2E',
  card: '#16213E',
  accent: '#E8A020',
  accentLight: '#F5C842',
  success: '#4CAF7D',
  danger: '#E05A5A',
  text: '#F0F0F0',
  textMuted: '#8A8A9A',
  border: '#2A2A3E',
};

// ── Componente: Tarjeta KPI ──────────────────────────────────────────────────

interface KPICardProps {
  titulo: string;
  valor: string;
  subtitulo?: string;
  colorValor?: string;
  emoji: string;
  onPress?: () => void;
}

function KPICard({ titulo, valor, subtitulo, colorValor = COLORS.text, emoji, onPress }: KPICardProps) {
  const CardContainer = onPress ? TouchableOpacity : View;
  return (
    <CardContainer style={styles.kpiCard} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.kpiHeader}>
        <Text style={styles.kpiEmoji}>{emoji}</Text>
        <Text style={styles.kpiTitulo}>{titulo}</Text>
      </View>
      <Text style={[styles.kpiValor, { color: colorValor }]}>{valor}</Text>
      {subtitulo ? <Text style={styles.kpiSubtitulo}>{subtitulo}</Text> : null}
    </CardContainer>
  );
}

// ── Componente: Sección con título ───────────────────────────────────────────

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

// ── Pantalla principal ───────────────────────────────────────────────────────

export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const db = useSQLiteContext();
  const { data, loading, error, refresh } = useDashboard();
  const { alertas, loading: loadingAlertas } = useAlertasStock();
  const [refrescando, setRefrescando] = React.useState(false);

  const onRefresh = async () => {
    setRefrescando(true);
    await refresh();
    setRefrescando(false);
  };

  const fechaHoy = formatearFecha(new Date().toISOString());

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.cargandoTexto}>Cargando datos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitulo}>🍯 SurApícola</Text>
            <Text style={styles.headerFecha}>{fechaHoy}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Configuracion' as any)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTexto}>⚠️ {error}</Text>
          </View>
        )}

        {/* Stock actual */}
        <Seccion titulo="STOCK ACTUAL">
          <View style={styles.kpiGrid}>
            <KPICard
              emoji="🍯"
              titulo="Miel"
              valor={formatearGramos(data?.stockMielGramos ?? 0)}
              colorValor={COLORS.accentLight}
              onPress={() => navigation.navigate('Stock')}
            />
            <KPICard
              emoji="🧱"
              titulo="Panal"
              valor={formatearUnidades(data?.stockPanalUnidades ?? 0)}
              colorValor={COLORS.accentLight}
              onPress={() => navigation.navigate('Stock')}
            />
          </View>
        </Seccion>

        {/* Alertas de Stock */}
        <Seccion titulo="ALERTAS DE STOCK">
          <View style={styles.alertasCard}>
            {loadingAlertas ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : alertas.length === 0 ? (
              <Text style={styles.sinAlertasTexto}>✅ Sin alertas de stock</Text>
            ) : (
              alertas.map((alerta, index) => (
                <View key={index} style={styles.alertaItem}>
                  <Text style={styles.alertaEmoji}>⚠️</Text>
                  <Text style={styles.alertaTexto}>
                    <Text style={{ fontWeight: 'bold', color: COLORS.accentLight }}>{alerta.nombre}: </Text>
                    {alerta.tipo === 'miel'
                      ? `${(alerta.disponible / 1000).toFixed(1)} kg (mínimo ${(alerta.minimo / 1000).toFixed(1)} kg)`
                      : `${alerta.disponible} ${alerta.unidad} (mínimo ${alerta.minimo})`}
                  </Text>
                </View>
              ))
            )}
          </View>
        </Seccion>

        {/* Resumen del día */}
        <Seccion titulo="HOY">
          <View style={styles.kpiGrid}>
            <KPICard
              emoji="💰"
              titulo="Ventas"
              valor={formatearDinero(data?.ventasHoyCentavos ?? 0)}
              subtitulo="Total facturado"
              colorValor={COLORS.success}
              onPress={() => navigation.navigate('Ventas')}
            />
            <KPICard
              emoji="✅"
              titulo="Cobros"
              valor={formatearDinero(data?.cobrosHoyCentavos ?? 0)}
              subtitulo="Dinero ingresado"
              colorValor={COLORS.success}
              onPress={() => navigation.navigate('Ventas')}
            />
            <KPICard
              emoji="📤"
              titulo="Gastos"
              valor={formatearDinero(data?.gastosHoyCentavos ?? 0)}
              subtitulo="Total cargado"
              colorValor={COLORS.danger}
              onPress={() => navigation.navigate('Gastos')}
            />
          </View>
        </Seccion>

        {/* Accesos rápidos */}
        <Seccion titulo="ACCIONES RÁPIDAS">
          <View style={styles.accionesGrid}>
            <TouchableOpacity
              style={styles.accionCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('NuevaVenta')}
            >
              <Text style={styles.accionEmoji}>🛒</Text>
              <Text style={styles.accionTexto}>Nueva venta</Text>
              <Text style={styles.accionProx}>Registrar factura</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.accionCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Ventas')}
            >
              <Text style={styles.accionEmoji}>📋</Text>
              <Text style={styles.accionTexto}>Ver ventas</Text>
              <Text style={styles.accionProx}>Historial y cobros</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.accionCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('NuevaCompra')}
            >
              <Text style={styles.accionEmoji}>📦</Text>
              <Text style={styles.accionTexto}>Nueva compra</Text>
              <Text style={styles.accionProx}>Registrar entrada</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.accionCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Compras')}
            >
              <Text style={styles.accionEmoji}>🚚</Text>
              <Text style={styles.accionTexto}>Ver compras</Text>
              <Text style={styles.accionProx}>Historial y pagos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.accionCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('NuevoGasto')}
            >
              <Text style={styles.accionEmoji}>💸</Text>
              <Text style={styles.accionTexto}>Nuevo gasto</Text>
              <Text style={styles.accionProx}>Registrar egreso</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.accionCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Gastos')}
            >
              <Text style={styles.accionEmoji}>📤</Text>
              <Text style={styles.accionTexto}>Ver gastos</Text>
              <Text style={styles.accionProx}>Historial y abonos</Text>
            </TouchableOpacity>
          </View>
        </Seccion>

        {/* Herramientas de desarrollo */}
        {__DEV__ && (
          <Seccion titulo="DESARROLLO">
            <DevToolsBanner db={db} onRefresh={onRefresh} />
          </Seccion>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Componente: Herramientas de Desarrollo ──────────────────────────────────
function DevToolsBanner({ db, onRefresh }: { db: any; onRefresh: () => void }) {
  const [loadingDev, setLoadingDev] = React.useState(false);

  const handleLoad = () => {
    Alert.alert(
      'Cargar Datos de Prueba',
      '¿Estás seguro? Esto borrará el estado actual de la base de datos y cargará datos de prueba realistas para desarrollo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Cargar',
          style: 'destructive',
          onPress: async () => {
            setLoadingDev(true);
            try {
              await cargarDatosPrueba(db);
              onRefresh();
              Alert.alert('Éxito', 'Datos de prueba cargados correctamente.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudieron cargar los datos.');
            } finally {
              setLoadingDev(false);
            }
          },
        },
      ]
    );
  };

  const handleClear = () => {
    Alert.alert(
      'Limpiar Base de Datos',
      '¿Estás seguro? Esto borrará permanentemente todos los clientes, proveedores, ventas, compras, gastos y stock de la base de datos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Limpiar',
          style: 'destructive',
          onPress: async () => {
            setLoadingDev(true);
            try {
              await limpiarDatosPrueba(db);
              onRefresh();
              Alert.alert('Éxito', 'Base de datos limpia.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo limpiar la base de datos.');
            } finally {
              setLoadingDev(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.devBanner}>
      <Text style={styles.devBannerTitle}>🛠️ Acciones de Datos de Prueba</Text>
      <Text style={styles.devBannerText}>Este panel solo es visible en modo de desarrollo (__DEV__).</Text>
      <View style={styles.devBannerButtons}>
        <TouchableOpacity style={[styles.devBtn, styles.devBtnLoad]} onPress={handleLoad} disabled={loadingDev}>
          <Text style={styles.devBtnText}>Cargar Datos de Prueba</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.devBtn, styles.devBtnClear]} onPress={handleClear} disabled={loadingDev}>
          <Text style={styles.devBtnText}>Limpiar Base</Text>
        </TouchableOpacity>
      </View>
      {loadingDev && <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 8 }} />}
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centrado: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cargandoTexto: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 24,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingsButton: {
    padding: 8,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitulo: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  headerFecha: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Error
  errorBanner: {
    backgroundColor: '#3A1515',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  errorTexto: {
    color: COLORS.danger,
    fontSize: 13,
  },
  // Alertas
  alertasCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  sinAlertasTexto: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },
  alertaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertaEmoji: {
    fontSize: 14,
  },
  alertaTexto: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },
  // Secciones
  seccion: {
    gap: 10,
  },
  seccionTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  // KPI Cards
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kpiEmoji: {
    fontSize: 18,
  },
  kpiTitulo: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  kpiValor: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  kpiSubtitulo: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  // Acciones rápidas
  accionesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 6,
  },
  accionDisabled: {
    opacity: 0.5,
  },
  accionEmoji: {
    fontSize: 24,
  },
  accionTexto: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  accionProx: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  devBanner: {
    backgroundColor: '#1E1E3A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3E3E5E',
    gap: 8,
    marginTop: 8,
  },
  devBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.accentLight,
  },
  devBannerText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  devBannerButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  devBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devBtnLoad: {
    backgroundColor: COLORS.success,
  },
  devBtnClear: {
    backgroundColor: COLORS.danger,
  },
  devBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
