// =============================================================================
// SurApícola — Pantalla de Auditoría de Stock (Fase 2)
// =============================================================================
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useStock } from '../hooks/useStock';
import { useInsumos } from '../hooks/useInsumos';
import { useAlertasStock } from '../hooks/useAlertasStock';
import { useConfiguracion } from '../hooks/useConfiguracion';
import { formatearGramos, formatearUnidades, formatearFecha } from '../utils/format';
import type { MovimientoStockUI } from '../types';

// ── Paleta de colores consistente ───────────────────────────────────────────
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
  emoji: string;
}

function KPICard({ titulo, valor, emoji }: KPICardProps) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiHeader}>
        <Text style={styles.kpiEmoji}>{emoji}</Text>
        <Text style={styles.kpiTitulo}>{titulo}</Text>
      </View>
      <Text style={styles.kpiValor}>{valor}</Text>
    </View>
  );
}

export function StockScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { stock, movimientos, loading, error, refresh } = useStock();
  const { insumos, refresh: refreshInsumos } = useInsumos();
  const { alertas, loading: loadingAlertas, refresh: refreshAlertas } = useAlertasStock();
  const { getMielMinimo, getPanalMinimo, actualizarMielMinimo, actualizarPanalMinimo } = useConfiguracion();

  const [refrescando, setRefrescando] = React.useState(false);

  // Configuración de mínimos
  const [minimosModalVisible, setMinimosModalVisible] = React.useState(false);
  const [inputMinMielKg, setInputMinMielKg] = React.useState('');
  const [inputMinPanal, setInputMinPanal] = React.useState('');
  const [guardandoMinimos, setGuardandoMinimos] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      refreshInsumos();
      refreshAlertas();
    }, [refresh, refreshInsumos, refreshAlertas])
  );

  const onRefresh = async () => {
    setRefrescando(true);
    await Promise.all([refresh(), refreshInsumos(), refreshAlertas()]);
    setRefrescando(false);
  };

  const abrirMinimos = async () => {
    try {
      const miel = await getMielMinimo();
      const panal = await getPanalMinimo();
      setInputMinMielKg((miel / 1000).toString());
      setInputMinPanal(panal.toString());
      setMinimosModalVisible(true);
    } catch (err) {
      console.error(err);
    }
  };

  const guardarMinimos = async () => {
    const mielKg = parseFloat(inputMinMielKg);
    const panalUnidades = parseInt(inputMinPanal, 10);
    if (isNaN(mielKg) || mielKg < 0 || isNaN(panalUnidades) || panalUnidades < 0) {
      Alert.alert('Error', 'Ingresá valores válidos mayores o iguales a 0.');
      return;
    }

    setGuardandoMinimos(true);
    const okMiel = await actualizarMielMinimo(Math.round(mielKg * 1000));
    const okPanal = await actualizarPanalMinimo(panalUnidades);
    setGuardandoMinimos(false);

    if (okMiel && okPanal) {
      setMinimosModalVisible(false);
      refreshAlertas();
    } else {
      Alert.alert('Error', 'No se pudieron guardar los límites mínimos.');
    }
  };

  // ── Mapeo de descripción según tipo de origen ──────────────────────────────
  const obtenerDescripcion = (m: MovimientoStockUI): string => {
    const nombre = m.item_nombre || 'Producto';
    const motivo = m.perdida_motivo || 'Motivo no especificado';

    switch (m.origen_tipo) {
      case 'cosecha':
        return 'Cosecha registrada';
      case 'compra':
        return 'Compra a proveedor';
      case 'venta_item':
        return `Venta: ${nombre}`;
      case 'perdida':
        return `Pérdida: ${motivo}`;
      case 'anulacion_cosecha':
        return 'Anulación de cosecha';
      case 'anulacion_compra':
        return 'Anulación de compra';
      case 'anulacion_venta_item':
        return `Anulación de venta: ${nombre}`;
      case 'anulacion_perdida':
        return `Anulación de pérdida: ${motivo}`;
      default:
        return 'Movimiento de stock';
    }
  };

  // ── Renderizado de fila de movimiento ──────────────────────────────────────
  const renderItem = ({ item }: { item: MovimientoStockUI }) => {
    const esEntrada = item.sentido === 'entrada';
    const esAnulado = item.estado_origen === 'anulado';
    const desc = obtenerDescripcion(item);

    // Formatear cantidad absoluta según el producto
    const cantAbs = Math.abs(item.cantidad);
    const cantFormateada =
      item.producto === 'miel' ? formatearGramos(cantAbs) : formatearUnidades(cantAbs);

    return (
      <View style={[styles.movCard, esAnulado && styles.movAnuladoCard]}>
        {/* Indicador de sentido (+ / -) */}
        <View
          style={[
            styles.sentidoBadge,
            esEntrada ? styles.sentidoEntrada : styles.sentidoSalida,
            esAnulado && styles.sentidoAnulado,
          ]}
        >
          <Text style={styles.sentidoTexto}>
            {esAnulado ? '✕' : esEntrada ? '+' : '-'}
          </Text>
        </View>

        {/* Detalles del movimiento */}
        <View style={styles.movDetalles}>
          <Text
            style={[
              styles.movDesc,
              esAnulado && styles.textTachado,
            ]}
            numberOfLines={1}
          >
            {desc}
          </Text>
          <Text style={styles.movFecha}>
            {formatearFecha(item.fecha)}
            {item.nota ? ` • ${item.nota}` : ''}
          </Text>
        </View>

        {/* Cantidad y Badge Anulado */}
        <View style={styles.movDerecha}>
          <Text
            style={[
              styles.movCantidad,
              esAnulado
                ? styles.cantAnulado
                : esEntrada
                ? styles.cantEntrada
                : styles.cantSalida,
              esAnulado && styles.textTachado,
            ]}
          >
            {esEntrada ? '+' : '-'}
            {cantFormateada}
          </Text>
          {esAnulado && (
            <View style={styles.badgeAnulado}>
              <Text style={styles.badgeAnuladoTexto}>Anulado</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Pantalla de Carga ──────────────────────────────────────────────────────
  if (loading && !stock) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.estadoTexto}>Cargando stock...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>📦 Auditoría de Stock</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.btnMinimos}
            activeOpacity={0.8}
            onPress={abrirMinimos}
          >
            <Text style={styles.btnMinimosTexto}>⚙️ Mínimos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnOperaciones}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('CosechasPerdidas')}
          >
            <Text style={styles.btnOperacionesTexto}>Operaciones</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error controlado */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTexto}>⚠️ {error}</Text>
        </View>
      )}

      {/* Grid de KPIs actuales */}
      <View style={styles.kpiGrid}>
        <KPICard
          emoji="🍯"
          titulo="Miel disponible"
          valor={formatearGramos(stock?.mielGramos ?? 0)}
        />
        <KPICard
          emoji="🧱"
          titulo="Panal disponible"
          valor={formatearUnidades(stock?.panalUnidades ?? 0)}
        />
      </View>

      {/* Alertas de Stock */}
      <View style={styles.alertasContainer}>
        <Text style={styles.alertasTitulo}>ALERTAS DE STOCK</Text>
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
      </View>

      {/* Sección: Stock de Envases */}
      <View style={styles.envasesSection}>
        <View style={styles.envasesHeader}>
          <Text style={styles.envasesTitulo}>🧴 ENVASES E INSUMOS</Text>
          <TouchableOpacity
            style={styles.btnGestionar}
            onPress={() => navigation.navigate('Envases')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnGestionarText}>Gestionar →</Text>
          </TouchableOpacity>
        </View>
        {insumos.length === 0 ? (
          <Text style={styles.envasesVacio}>Sin insumos cargados. Tocá "Gestionar" para agregar.</Text>
        ) : (
          <View style={styles.insumosGrid}>
            {insumos.map((ins) => {
              const stock_ins = ins.stock_actual ?? 0;
              const color = stock_ins <= 0 ? '#EF5350' : stock_ins < 10 ? '#FFC107' : '#4CAF50';
              return (
                <TouchableOpacity
                  key={ins.id}
                  style={styles.insumoCard}
                  onPress={() => navigation.navigate('Envases')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.insumoNum, { color }]}>{stock_ins}</Text>
                  <Text style={[styles.insumoUnidad, { color }]}>{ins.unidad}</Text>
                  <Text style={styles.insumoNombre} numberOfLines={2}>{ins.nombre}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <Text style={styles.historialTitulo}>HISTORIAL DE MOVIMIENTOS</Text>

      {/* Historial o Estado Vacío */}
      <FlatList
        data={movimientos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.vacioContainer}>
            <Text style={styles.vacioEmoji}>📦</Text>
            <Text style={styles.vacioTitulo}>Sin movimientos registrados</Text>
            <Text style={styles.vacioSubtitulo}>
              Cuando se registren ingresos o egresos de stock (cosechas, compras o ventas), aparecerán en este historial.
            </Text>
          </View>
        }
      />

      {/* Modal: Configurar Mínimos */}
      <Modal visible={minimosModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚙️ Configurar Stock Mínimo</Text>
            <Text style={styles.modalSub}>Establecé los límites mínimos de stock de miel y panal global para disparar alertas.</Text>

            <Text style={styles.fieldLabel}>Miel Mínima (kg)</Text>
            <TextInput
              style={styles.input}
              value={inputMinMielKg}
              onChangeText={setInputMinMielKg}
              keyboardType="numeric"
              placeholder="Ej: 10.0"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.fieldLabel}>Panal Mínimo (unidades)</Text>
            <TextInput
              style={styles.input}
              value={inputMinPanal}
              onChangeText={setInputMinPanal}
              keyboardType="numeric"
              placeholder="Ej: 5"
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setMinimosModalVisible(false)}>
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGuardar} onPress={guardarMinimos} disabled={guardandoMinimos}>
                <Text style={styles.btnGuardarText}>{guardandoMinimos ? 'Guardando...' : 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
  estadoTexto: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 16,
  },
  headerTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  btnOperaciones: {
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnOperacionesTexto: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: '#3A1515',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  errorTexto: {
    color: COLORS.danger,
    fontSize: 13,
  },
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
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
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  kpiValor: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.accentLight,
  },
  historialTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    flexGrow: 1,
  },
  // Tarjeta de Movimiento
  movCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  movAnuladoCard: {
    borderColor: 'transparent',
    opacity: 0.6,
  },
  sentidoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sentidoEntrada: {
    backgroundColor: '#1B3A2B',
  },
  sentidoSalida: {
    backgroundColor: '#3A1E1E',
  },
  sentidoAnulado: {
    backgroundColor: '#2A2A3A',
  },
  sentidoTexto: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  movDetalles: {
    flex: 1,
    gap: 4,
    marginRight: 8,
  },
  movDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  movFecha: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  movDerecha: {
    alignItems: 'flex-end',
    gap: 4,
  },
  movCantidad: {
    fontSize: 14,
    fontWeight: '700',
  },
  cantEntrada: {
    color: COLORS.success,
  },
  cantSalida: {
    color: COLORS.text,
  },
  cantAnulado: {
    color: COLORS.textMuted,
  },
  textTachado: {
    textDecorationLine: 'line-through',
  },
  badgeAnulado: {
    backgroundColor: '#3A1515',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeAnuladoTexto: {
    color: COLORS.danger,
    fontSize: 9,
    fontWeight: '700',
  },
  // Estado Vacío
  vacioContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  vacioEmoji: {
    fontSize: 48,
    opacity: 0.6,
  },
  vacioTitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  vacioSubtitulo: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Envases
  envasesSection: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  envasesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  envasesTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  btnGestionar: {
    backgroundColor: COLORS.accent + '22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  btnGestionarText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  envasesVacio: {
    color: COLORS.textMuted,
    fontSize: 13,
    padding: 14,
    fontStyle: 'italic',
  },
  insumosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 8,
  },
  insumoCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    alignItems: 'center',
    minWidth: 80,
    maxWidth: 100,
  },
  insumoNum: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  insumoUnidad: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  insumoNombre: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 14,
  },
  btnMinimos: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.accent,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnMinimosTexto: {
    color: COLORS.accent,
    fontWeight: 'bold',
    fontSize: 13,
  },
  alertasContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  alertasTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#16213E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  btnCancelar: {
    flex: 1,
    backgroundColor: '#16213E',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnCancelarText: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  btnGuardar: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnGuardarText: {
    color: COLORS.bg,
    fontWeight: '800',
    fontSize: 15,
  },
});
