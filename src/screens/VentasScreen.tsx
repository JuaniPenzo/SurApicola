// =============================================================================
// SurApícola — Pantalla de Ventas (Fase 3B)
// =============================================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useVentas } from '../hooks/useVentas';
import { getVentaById } from '../database/ventas';
import { useSQLiteContext } from 'expo-sqlite';
import { formatearDinero, formatearFecha, fechaHoy } from '../utils/format';
import type { MedioPago, EstadoVenta } from '../types';
import type { RangoFiltro } from '../utils/fechas';

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
  info: '#3498db',
};

export function VentasScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const {
    ventas,
    loading,
    refreshing,
    error,
    search,
    setSearch,
    rango,
    setRango,
    fechaDesde,
    fechaHasta,
    setCustomFechas,
    refresh,
    registrarCobro,
    anularVenta,
  } = useVentas();

  const [inputDesde, setInputDesde] = useState(fechaDesde);
  const [inputHasta, setInputHasta] = useState(fechaHasta);
  const [dateError, setDateError] = useState<string | null>(null);

  React.useEffect(() => {
    setInputDesde(fechaDesde);
    setInputHasta(fechaHasta);
  }, [fechaDesde, fechaHasta]);

  const handleAplicarFiltro = () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!inputDesde || !inputDesde.trim()) {
      setDateError('Falta ingresar la fecha Desde.');
      return;
    }
    if (!inputHasta || !inputHasta.trim()) {
      setDateError('Falta ingresar la fecha Hasta.');
      return;
    }

    if (!dateRegex.test(inputDesde)) {
      setDateError('La fecha Desde debe tener el formato AAAA-MM-DD.');
      return;
    }
    if (!dateRegex.test(inputHasta)) {
      setDateError('La fecha Hasta debe tener el formato AAAA-MM-DD.');
      return;
    }

    const d1 = new Date(inputDesde + 'T00:00:00');
    const d2 = new Date(inputHasta + 'T00:00:00');

    if (isNaN(d1.getTime())) {
      setDateError('La fecha Desde es inválida.');
      return;
    }
    if (isNaN(d2.getTime())) {
      setDateError('La fecha Hasta es inválida.');
      return;
    }

    if (d1 > d2) {
      setDateError('La fecha Desde no puede ser mayor que la fecha Hasta.');
      return;
    }

    setDateError(null);
    setCustomFechas(inputDesde, inputHasta);
  };

  const rangos: { key: RangoFiltro; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Este mes' },
    { key: 'entre_fechas', label: 'Entre fechas' },
  ];

  // ── Estados de Detalle y Cobro ─────────────────────────────────────────────
  const [selectedVenta, setSelectedVenta] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [cobroModalVisible, setCobroModalVisible] = useState(false);

  // Campos del Formulario de Cobro
  const [montoCobro, setMontoCobro] = useState('');
  const [medioCobro, setMedioCobro] = useState<MedioPago>('efectivo');
  const [fechaCobro, setFechaCobro] = useState(fechaHoy());
  const [notasCobro, setNotasCobro] = useState('');

  // Cargar detalles completos de la venta seleccionada al refrescar la pantalla
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [])
  );

  const abrirDetalle = async (id: number) => {
    try {
      const fullVenta = await getVentaById(db, id);
      if (fullVenta) {
        setSelectedVenta(fullVenta);
        setDetailModalVisible(true);
      } else {
        Alert.alert('Error', 'No se pudieron cargar los detalles de la venta.');
      }
    } catch (err) {
      Alert.alert('Error', 'Ocurrió un error en la base de datos.');
    }
  };

  const cerrarDetalles = () => {
    setDetailModalVisible(false);
    setSelectedVenta(null);
  };

  // ── Registrar un Pago / Cobro ─────────────────────────────────────────────
  const abrirFormularioCobro = () => {
    if (!selectedVenta) return;
    const saldo = selectedVenta.total_centavos - obtenerTotalCobrado(selectedVenta);
    setMontoCobro((saldo / 100).toString());
    setMedioCobro('efectivo');
    setFechaCobro(fechaHoy());
    setNotasCobro('');
    setCobroModalVisible(true);
  };

  const handleGuardarCobro = async () => {
    if (!selectedVenta) return;
    const montoCentavos = Math.round(parseFloat(montoCobro) * 100);
    const saldo = selectedVenta.total_centavos - obtenerTotalCobrado(selectedVenta);

    if (isNaN(montoCentavos) || montoCentavos <= 0) {
      Alert.alert('Validación', 'El monto a cobrar debe ser un número positivo.');
      return;
    }
    if (montoCentavos > saldo) {
      Alert.alert('Validación', `El monto no puede superar el saldo pendiente ($${saldo / 100}).`);
      return;
    }

    try {
      await registrarCobro(selectedVenta.id, {
        monto_centavos: montoCentavos,
        medio_pago: medioCobro,
        fecha: fechaCobro,
        notas: notasCobro.trim() || null,
      });

      // Refrescar modal de detalles
      const updated = await getVentaById(db, selectedVenta.id);
      setSelectedVenta(updated);
      setCobroModalVisible(false);
      Alert.alert('Éxito', 'El cobro se registró correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el cobro.');
    }
  };

  // ── Anular Venta ───────────────────────────────────────────────────────────
  const handleConfirmarAnulacion = () => {
    if (!selectedVenta) return;
    Alert.alert(
      '¿Anular esta venta?',
      'Esta acción devolverá las unidades al stock y marcará todos los cobros asociados como anulados. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular Venta',
          style: 'destructive',
          onPress: async () => {
            try {
              await anularVenta(selectedVenta.id);
              cerrarDetalles();
              Alert.alert('Éxito', 'La venta ha sido anulada.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo anular la venta.');
            }
          },
        },
      ]
    );
  };

  // ── Helper para sumar cobros activos ───────────────────────────────────────
  const obtenerTotalCobrado = (v: any): number => {
    if (!v.cobros) return 0;
    return v.cobros.reduce((acc: number, c: any) => acc + c.monto_centavos, 0);
  };

  // ── Helper de colores de estado ────────────────────────────────────────────
  const getBadgeColors = (estado: EstadoVenta) => {
    switch (estado) {
      case 'pagada':
        return { bg: '#1B3A2B', text: COLORS.success };
      case 'parcial':
        return { bg: '#2B2B1B', text: COLORS.accentLight };
      case 'anulada':
        return { bg: '#3A1E1E', text: COLORS.danger };
      default:
        return { bg: '#2A2A3A', text: COLORS.textMuted };
    }
  };

  // ── Renderizado de tarjeta de venta ────────────────────────────────────────
  const renderVenta = ({ item }: { item: any }) => {
    const saldo = item.total_centavos - item.cobrado_centavos;
    const badge = getBadgeColors(item.estado);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => abrirDetalle(item.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.ventaNum}>Venta #{item.id}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {item.estado.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.clienteNombre}>{item.cliente_nombre}</Text>
        <Text style={styles.ventaFecha}>{formatearFecha(item.fecha)}</Text>

        <View style={styles.cardValores}>
          <View style={styles.valorCol}>
            <Text style={styles.valorLabel}>Total</Text>
            <Text style={styles.valorPesos}>{formatearDinero(item.total_centavos)}</Text>
          </View>
          <View style={styles.valorCol}>
            <Text style={styles.valorLabel}>Cobrado</Text>
            <Text style={[styles.valorPesos, { color: COLORS.success }]}>
              {formatearDinero(item.cobrado_centavos)}
            </Text>
          </View>
          {saldo > 0 && item.estado !== 'anulada' && (
            <View style={styles.valorCol}>
              <Text style={styles.valorLabel}>Saldo</Text>
              <Text style={[styles.valorPesos, { color: COLORS.accentLight }]}>
                {formatearDinero(saldo)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing && ventas.length === 0) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.estadoTexto}>Cargando ventas...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Cabecera */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitulo}>📋 Ventas</Text>
          <Text style={styles.headerSubtitulo}>Facturación e historial</Text>
        </View>
        <TouchableOpacity
          style={styles.btnNuevo}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('NuevaVenta')}
        >
          <Text style={styles.btnNuevoTexto}>Nueva venta</Text>
        </TouchableOpacity>
      </View>

      {/* Error SQLite */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTexto}>⚠️ {error}</Text>
        </View>
      )}

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre de cliente o número..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Rango de Fechas Selector */}
      <View style={styles.rangoContainer}>
        {rangos.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.rangoBtn, rango === r.key && styles.rangoBtnActivo]}
            onPress={() => setRango(r.key)}
          >
            <Text style={[styles.rangoBtnTexto, rango === r.key && styles.rangoBtnTextoActivo]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selector de Rango Personalizado */}
      {rango === 'entre_fechas' && (
        <View style={styles.customRangoContainerWrapper}>
          <View style={styles.customRangoContainer}>
            <View style={styles.customRangoCol}>
              <Text style={styles.customRangoLabel}>Desde (AAAA-MM-DD)</Text>
              <TextInput
                style={[styles.customRangoInput, dateError ? styles.customRangoInputError : null]}
                value={inputDesde}
                onChangeText={(val) => {
                  setInputDesde(val);
                  setDateError(null);
                }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                maxLength={10}
              />
            </View>
            <View style={styles.customRangoCol}>
              <Text style={styles.customRangoLabel}>Hasta (AAAA-MM-DD)</Text>
              <TextInput
                style={[styles.customRangoInput, dateError ? styles.customRangoInputError : null]}
                value={inputHasta}
                onChangeText={(val) => {
                  setInputHasta(val);
                  setDateError(null);
                }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                maxLength={10}
              />
            </View>
          </View>
          {dateError && <Text style={styles.errorRangoTexto}>{dateError}</Text>}
          <TouchableOpacity style={styles.btnAplicarFiltro} onPress={handleAplicarFiltro}>
            <Text style={styles.btnAplicarFiltroTexto}>Aplicar filtro</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Listado */}
      <FlatList
        data={ventas}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderVenta}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refresh}
        ListEmptyComponent={
          <View style={styles.vacioContainer}>
            <Text style={styles.vacioEmoji}>📋</Text>
            <Text style={styles.vacioTitulo}>
              {search.trim().length > 0 ? 'Sin coincidencias' : 'Sin ventas registradas'}
            </Text>
            <Text style={styles.vacioSubtitulo}>
              {search.trim().length > 0
                ? 'Probá escribiendo otros términos en la búsqueda.'
                : 'Cargá ventas para ver su historial y saldos pendientes.'}
            </Text>
          </View>
        }
      />

      {/* ── Modal de Detalle de Venta ───────────────────────────────────────── */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={cerrarDetalles}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedVenta && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitulo}>
                    Venta #{selectedVenta.id}
                  </Text>
                  <TouchableOpacity onPress={cerrarDetalles} style={styles.modalCerrarBtn}>
                    <Text style={styles.modalCerrarBtnTexto}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.detailContainer}>
                  {/* Detalles Básicos */}
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Cliente</Text>
                    <Text style={styles.detailValue}>{selectedVenta.cliente_nombre}</Text>

                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Fecha</Text>
                    <Text style={styles.detailValue}>{formatearFecha(selectedVenta.fecha)}</Text>

                    {selectedVenta.notas && (
                      <>
                        <Text style={[styles.detailLabel, { marginTop: 12 }]}>Notas</Text>
                        <Text style={styles.detailNotes}>📝 {selectedVenta.notas}</Text>
                      </>
                    )}
                  </View>

                  {/* Detalle de Ítems */}
                  <Text style={styles.sectionHeader}>PRODUCTOS</Text>
                  {selectedVenta.items?.map((item: any) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.nombre_snap}</Text>
                        <Text style={styles.itemSub}>
                          {item.cantidad} x {formatearDinero(item.precio_unitario_centavos)}
                        </Text>
                      </View>
                      <Text style={styles.itemSubtotal}>
                        {formatearDinero(item.subtotal_centavos)}
                      </Text>
                    </View>
                  ))}

                  {/* Detalle de Cobros */}
                  <Text style={styles.sectionHeader}>COBROS REGISTRADOS</Text>
                  {selectedVenta.cobros && selectedVenta.cobros.length > 0 ? (
                    selectedVenta.cobros.map((cobro: any) => (
                      <View key={cobro.id} style={styles.cobroRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cobroMetodo}>
                            {cobro.medio_pago.toUpperCase()}
                          </Text>
                          <Text style={styles.cobroFecha}>
                            {formatearFecha(cobro.fecha)} {cobro.notas ? ` • ${cobro.notas}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.cobroMonto}>
                          {formatearDinero(cobro.monto_centavos)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noCobrosTexto}>No hay cobros registrados.</Text>
                  )}

                  {/* Resumen Final */}
                  <View style={styles.resumenCaja}>
                    <View style={styles.resumenFila}>
                      <Text style={styles.resumenLabel}>Total Facturado:</Text>
                      <Text style={styles.resumenValor}>
                        {formatearDinero(selectedVenta.total_centavos)}
                      </Text>
                    </View>
                    <View style={styles.resumenFila}>
                      <Text style={styles.resumenLabel}>Total Cobrado:</Text>
                      <Text style={[styles.resumenValor, { color: COLORS.success }]}>
                        {formatearDinero(obtenerTotalCobrado(selectedVenta))}
                      </Text>
                    </View>
                    {selectedVenta.total_centavos - obtenerTotalCobrado(selectedVenta) > 0 &&
                      selectedVenta.estado !== 'anulada' && (
                        <View style={styles.resumenFila}>
                          <Text style={styles.resumenLabel}>Saldo Pendiente:</Text>
                          <Text style={[styles.resumenValor, { color: COLORS.accentLight }]}>
                            {formatearDinero(
                              selectedVenta.total_centavos - obtenerTotalCobrado(selectedVenta)
                            )}
                          </Text>
                        </View>
                      )}
                  </View>

                  {/* Acciones */}
                  {selectedVenta.estado !== 'anulada' && (
                    <View style={styles.detailActions}>
                      {selectedVenta.total_centavos - obtenerTotalCobrado(selectedVenta) > 0 && (
                        <TouchableOpacity
                          style={styles.btnRegistrarPago}
                          activeOpacity={0.8}
                          onPress={abrirFormularioCobro}
                        >
                          <Text style={styles.btnRegistrarPagoTexto}>💰 Registrar Pago</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.btnAnular}
                        activeOpacity={0.8}
                        onPress={handleConfirmarAnulacion}
                      >
                        <Text style={styles.btnAnularTexto}>🗄️ Anular Venta</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal Secundario: Formulario de Cobro ───────────────────────────── */}
      <Modal
        visible={cobroModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCobroModalVisible(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            <Text style={styles.subModalTitulo}>Registrar Pago</Text>

            <View style={styles.subInputGroup}>
              <Text style={styles.subLabel}>Monto a cobrar (ARS)</Text>
              <TextInput
                style={styles.subInput}
                value={montoCobro}
                onChangeText={setMontoCobro}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.subInputGroup}>
              <Text style={styles.subLabel}>Medio de Pago</Text>
              <View style={styles.tabsMedio}>
                {(['efectivo', 'transferencia', 'otro'] as MedioPago[]).map((medio) => (
                  <TouchableOpacity
                    key={medio}
                    style={[
                      styles.tabMedioBtn,
                      medioCobro === medio ? styles.tabMedioActivo : null,
                    ]}
                    onPress={() => setMedioCobro(medio)}
                  >
                    <Text
                      style={[
                        styles.tabMedioTexto,
                        medioCobro === medio ? styles.tabMedioTextoActivo : null,
                      ]}
                    >
                      {medio.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.subInputGroup}>
              <Text style={styles.subLabel}>Fecha de Cobro</Text>
              <TextInput
                style={styles.subInput}
                value={fechaCobro}
                onChangeText={setFechaCobro}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.subInputGroup}>
              <Text style={styles.subLabel}>Notas / Observaciones</Text>
              <TextInput
                style={[styles.subInput, { minHeight: 60 }]}
                value={notasCobro}
                onChangeText={setNotasCobro}
                placeholder="Detalle del cobro..."
                placeholderTextColor={COLORS.textMuted}
                multiline={true}
              />
            </View>

            <View style={styles.subModalFooter}>
              <TouchableOpacity
                style={styles.btnSubCancelar}
                onPress={() => setCobroModalVisible(false)}
              >
                <Text style={styles.btnSubCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSubGuardar} onPress={handleGuardarCobro}>
                <Text style={styles.btnSubGuardarTexto}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitulo: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  headerSubtitulo: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  btnNuevo: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnNuevoTexto: {
    color: COLORS.bg,
    fontWeight: '700',
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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  // Tarjetas
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ventaNum: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  clienteNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  ventaFecha: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  cardValores: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 24,
  },
  valorCol: {
    gap: 4,
  },
  valorLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  valorPesos: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  // Estado Vacío
  vacioContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 12,
  },
  vacioEmoji: {
    fontSize: 54,
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
  // Modal de Detalle
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCerrarBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCerrarBtnTexto: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailContainer: {
    padding: 20,
  },
  detailCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  detailNotes: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  cobroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(76, 175, 125, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  cobroMetodo: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  cobroFecha: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cobroMonto: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  noCobrosTexto: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingLeft: 4,
  },
  resumenCaja: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
    gap: 8,
  },
  resumenFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resumenLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  resumenValor: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  detailActions: {
    gap: 10,
    marginTop: 24,
  },
  btnRegistrarPago: {
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnRegistrarPagoTexto: {
    color: COLORS.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  btnAnular: {
    borderColor: COLORS.danger,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnAnularTexto: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  // SubModal de Pago
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  subModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  subModalTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subInputGroup: {
    gap: 6,
  },
  subLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  subInput: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 14,
  },
  tabsMedio: {
    flexDirection: 'row',
    gap: 6,
  },
  tabMedioBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabMedioActivo: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  tabMedioTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabMedioTextoActivo: {
    color: COLORS.bg,
  },
  subModalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  btnSubCancelar: {
    flex: 1,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSubCancelarTexto: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  btnSubGuardar: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSubGuardarTexto: {
    color: COLORS.bg,
    fontSize: 13,
    fontWeight: '700',
  },
  rangoContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rangoBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rangoBtnActivo: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  rangoBtnTexto: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textMuted,
  },
  rangoBtnTextoActivo: {
    color: '#000000',
  },
  customRangoContainerWrapper: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  customRangoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  customRangoCol: {
    flex: 1,
    gap: 6,
  },
  customRangoLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  customRangoInput: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 13,
  },
  customRangoInputError: {
    borderColor: COLORS.danger,
  },
  btnAplicarFiltro: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAplicarFiltroTexto: {
    color: COLORS.bg,
    fontWeight: '700',
    fontSize: 13,
  },
  errorRangoTexto: {
    color: COLORS.danger,
    fontSize: 12,
  },
});
