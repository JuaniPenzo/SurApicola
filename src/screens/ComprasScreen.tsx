// =============================================================================
// SurApícola — Pantalla de Compras a Proveedores (Fase 3C)
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
import { useCompras } from '../hooks/useCompras';
import { getCompraById } from '../database/compras';
import { useSQLiteContext } from 'expo-sqlite';
import { formatearDinero, formatearGramos, formatearUnidades, formatearFecha, fechaHoy } from '../utils/format';
import type { MedioPago, EstadoCompra } from '../types';
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
};

export function ComprasScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const {
    compras,
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
    registrarPago,
    anularCompra,
  } = useCompras();

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

  // ── Estados de Detalle y Formulario de Pago ────────────────────────────────
  const [selectedCompra, setSelectedCompra] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [pagoModalVisible, setPagoModalVisible] = useState(false);

  // Campos del Pago
  const [montoPago, setMontoPago] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [fechaPago, setFechaPago] = useState(fechaHoy());
  const [notasPago, setNotasPago] = useState('');

  // Recargar al enfocar pantalla
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [])
  );

  const abrirDetalle = async (id: number) => {
    try {
      const fullCompra = await getCompraById(db, id);
      if (fullCompra) {
        setSelectedCompra(fullCompra);
        setDetailModalVisible(true);
      } else {
        Alert.alert('Error', 'No se pudieron cargar los detalles de la compra.');
      }
    } catch (err) {
      Alert.alert('Error', 'Ocurrió un error en la base de datos.');
    }
  };

  const cerrarDetalles = () => {
    setDetailModalVisible(false);
    setSelectedCompra(null);
  };

  // ── Registrar Pago posterior ───────────────────────────────────────────────
  const abrirFormularioPago = () => {
    if (!selectedCompra) return;
    const saldo = selectedCompra.total_centavos - obtenerTotalPagado(selectedCompra);
    setMontoPago((saldo / 100).toString());
    setMedioPago('efectivo');
    setFechaPago(fechaHoy());
    setNotasPago('');
    setPagoModalVisible(true);
  };

  const handleGuardarPago = async () => {
    if (!selectedCompra) return;
    const montoCentavos = Math.round(parseFloat(montoPago) * 100);
    const saldo = selectedCompra.total_centavos - obtenerTotalPagado(selectedCompra);

    if (isNaN(montoCentavos) || montoCentavos <= 0) {
      Alert.alert('Validación', 'El monto a pagar debe ser un número positivo.');
      return;
    }
    if (montoCentavos > saldo) {
      Alert.alert('Validación', `El monto no puede superar el saldo pendiente ($${saldo / 100}).`);
      return;
    }

    try {
      await registrarPago(selectedCompra.id, {
        monto_centavos: montoCentavos,
        medio_pago: medioPago,
        fecha: fechaPago,
        notas: notasPago.trim() || null,
      });

      // Refrescar modal de detalles
      const updated = await getCompraById(db, selectedCompra.id);
      setSelectedCompra(updated);
      setPagoModalVisible(false);
      Alert.alert('Éxito', 'El pago se registró correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el pago.');
    }
  };

  // ── Anular Compra ──────────────────────────────────────────────────────────
  const handleConfirmarAnulacion = () => {
    if (!selectedCompra) return;
    Alert.alert(
      '¿Anular esta compra?',
      'Esta acción retirará las unidades del stock y anulará todos los pagos asociados. Si el stock disponible actual es insuficiente para devolver, la acción será bloqueada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular Compra',
          style: 'destructive',
          onPress: async () => {
            try {
              await anularCompra(selectedCompra.id);
              cerrarDetalles();
              Alert.alert('Éxito', 'La compra ha sido anulada y el stock corregido.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo anular la compra.');
            }
          },
        },
      ]
    );
  };

  // ── Helper para sumar pagos activos ────────────────────────────────────────
  const obtenerTotalPagado = (c: any): number => {
    if (!c.pagos) return 0;
    return c.pagos.reduce((acc: number, p: any) => acc + p.monto_centavos, 0);
  };

  // ── Helper de colores de estado ────────────────────────────────────────────
  const getBadgeColors = (estado: EstadoCompra) => {
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

  // ── Renderizado de fila de compra ──────────────────────────────────────────
  const renderCompra = ({ item }: { item: any }) => {
    const saldo = item.total_centavos - item.pagado_centavos;
    const badge = getBadgeColors(item.estado);

    const cantFormateada =
      item.tipo_stock === 'miel'
        ? formatearGramos(item.cantidad)
        : formatearUnidades(item.cantidad);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => abrirDetalle(item.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.compraNum}>Compra #{item.id}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {item.estado.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.proveedorNombre}>{item.proveedor_nombre}</Text>
        <View style={styles.fechaRow}>
          <Text style={styles.compraFecha}>{formatearFecha(item.fecha)}</Text>
          <Text style={styles.compraProd}>
            • {item.tipo_stock === 'miel' ? '🍯 Miel' : '🧱 Panal'}: {cantFormateada}
          </Text>
        </View>

        <View style={styles.cardValores}>
          <View style={styles.valorCol}>
            <Text style={styles.valorLabel}>Total</Text>
            <Text style={styles.valorPesos}>{formatearDinero(item.total_centavos)}</Text>
          </View>
          <View style={styles.valorCol}>
            <Text style={styles.valorLabel}>Pagado</Text>
            <Text style={[styles.valorPesos, { color: COLORS.success }]}>
              {formatearDinero(item.pagado_centavos)}
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

  if (loading && !refreshing && compras.length === 0) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.estadoTexto}>Cargando compras...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Cabecera */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitulo}>📦 Compras</Text>
          <Text style={styles.headerSubtitulo}>Entradas e historial de pago</Text>
        </View>
        <TouchableOpacity
          style={styles.btnNuevo}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('NuevaCompra')}
        >
          <Text style={styles.btnNuevoTexto}>Nueva compra</Text>
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
          placeholder="Buscar por nombre de proveedor..."
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
        data={compras}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCompra}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refresh}
        ListEmptyComponent={
          <View style={styles.vacioContainer}>
            <Text style={styles.vacioEmoji}>📦</Text>
            <Text style={styles.vacioTitulo}>
              {search.trim().length > 0 ? 'Sin coincidencias' : 'Sin compras registradas'}
            </Text>
            <Text style={styles.vacioSubtitulo}>
              {search.trim().length > 0
                ? 'Probá escribiendo otros términos en la búsqueda.'
                : 'Cargá compras de stock para ver su historial y saldos pendientes.'}
            </Text>
          </View>
        }
      />

      {/* Modal de Detalle */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={cerrarDetalles}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedCompra && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitulo}>
                    Compra #{selectedCompra.id}
                  </Text>
                  <TouchableOpacity onPress={cerrarDetalles} style={styles.modalCerrarBtn}>
                    <Text style={styles.modalCerrarBtnTexto}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.detailContainer}>
                  {/* Detalles Básicos */}
                  <View style={styles.detailCard}>
                    <Text style={styles.detailLabel}>Proveedor</Text>
                    <Text style={styles.detailValue}>{selectedCompra.proveedor_nombre}</Text>

                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Fecha</Text>
                    <Text style={styles.detailValue}>{formatearFecha(selectedCompra.fecha)}</Text>

                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Producto e Ingreso</Text>
                    <Text style={styles.detailValue}>
                      {selectedCompra.tipo_stock === 'miel' ? '🍯 Miel' : '🧱 Panal'}:{' '}
                      {selectedCompra.tipo_stock === 'miel'
                        ? formatearGramos(selectedCompra.cantidad)
                        : formatearUnidades(selectedCompra.cantidad)}
                    </Text>

                    {selectedCompra.notas && (
                      <>
                        <Text style={[styles.detailLabel, { marginTop: 12 }]}>Notas</Text>
                        <Text style={styles.detailNotes}>📝 {selectedCompra.notas}</Text>
                      </>
                    )}
                  </View>

                  {/* Detalle de Pagos */}
                  <Text style={styles.sectionHeader}>PAGOS / ABONOS REGISTRADOS</Text>
                  {selectedCompra.pagos && selectedCompra.pagos.length > 0 ? (
                    selectedCompra.pagos.map((pago: any) => (
                      <View key={pago.id} style={styles.pagoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pagoMetodo}>
                            {pago.medio_pago.toUpperCase()}
                          </Text>
                          <Text style={styles.pagoFecha}>
                            {formatearFecha(pago.fecha)} {pago.notes ? ` • ${pago.notes}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.pagoMonto}>
                          {formatearDinero(pago.monto_centavos)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPagosTexto}>No hay pagos registrados para esta compra.</Text>
                  )}

                  {/* Resumen Final */}
                  <View style={styles.resumenCaja}>
                    <View style={styles.resumenFila}>
                      <Text style={styles.resumenLabel}>Total Compra:</Text>
                      <Text style={styles.resumenValor}>
                        {formatearDinero(selectedCompra.total_centavos)}
                      </Text>
                    </View>
                    <View style={styles.resumenFila}>
                      <Text style={styles.resumenLabel}>Total Pagado:</Text>
                      <Text style={[styles.resumenValor, { color: COLORS.success }]}>
                        {formatearDinero(obtenerTotalPagado(selectedCompra))}
                      </Text>
                    </View>
                    {selectedCompra.total_centavos - obtenerTotalPagado(selectedCompra) > 0 &&
                      selectedCompra.estado !== 'anulada' && (
                        <View style={styles.resumenFila}>
                          <Text style={styles.resumenLabel}>Saldo Pendiente:</Text>
                          <Text style={[styles.resumenValor, { color: COLORS.accentLight }]}>
                            {formatearDinero(
                              selectedCompra.total_centavos - obtenerTotalPagado(selectedCompra)
                            )}
                          </Text>
                        </View>
                      )}
                  </View>

                  {/* Acciones */}
                  {selectedCompra.estado !== 'anulada' && (
                    <View style={styles.detailActions}>
                      {selectedCompra.total_centavos - obtenerTotalPagado(selectedCompra) > 0 && (
                        <TouchableOpacity
                          style={styles.btnRegistrarPago}
                          activeOpacity={0.8}
                          onPress={abrirFormularioPago}
                        >
                          <Text style={styles.btnRegistrarPagoTexto}>💳 Registrar Pago</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.btnAnular}
                        activeOpacity={0.8}
                        onPress={handleConfirmarAnulacion}
                      >
                        <Text style={styles.btnAnularTexto}>🗄️ Anular Compra</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* SubModal de Pago */}
      <Modal
        visible={pagoModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPagoModalVisible(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            <Text style={styles.subModalTitulo}>Registrar Pago</Text>

            <View style={styles.subInputGroup}>
              <Text style={styles.subLabel}>Monto a pagar (ARS)</Text>
              <TextInput
                style={styles.subInput}
                value={montoPago}
                onChangeText={setMontoPago}
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
                      medioPago === medio ? styles.tabMedioActivo : null,
                    ]}
                    onPress={() => setMedioPago(medio)}
                  >
                    <Text
                      style={[
                        styles.tabMedioTexto,
                        medioPago === medio ? styles.tabMedioTextoActivo : null,
                      ]}
                    >
                      {medio.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.subInputGroup}>
              <Text style={styles.subLabel}>Fecha de Pago</Text>
              <TextInput
                style={styles.subInput}
                value={fechaPago}
                onChangeText={setFechaPago}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.subInputGroup}>
              <Text style={styles.subLabel}>Notas / Observaciones</Text>
              <TextInput
                style={[styles.subInput, { minHeight: 60 }]}
                value={notasPago}
                onChangeText={setNotasPago}
                placeholder="Detalle del pago..."
                placeholderTextColor={COLORS.textMuted}
                multiline={true}
              />
            </View>

            <View style={styles.subModalFooter}>
              <TouchableOpacity
                style={styles.btnSubCancelar}
                onPress={() => setPagoModalVisible(false)}
              >
                <Text style={styles.btnSubCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSubGuardar} onPress={handleGuardarPago}>
                <Text style={styles.btnSubGuardarTexto}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Estilos de ComprasScreen
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
  compraNum: {
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
  proveedorNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  fechaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compraFecha: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  compraProd: {
    fontSize: 11,
    color: COLORS.accentLight,
    fontWeight: '600',
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
  pagoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(76, 175, 125, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  pagoMetodo: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  pagoFecha: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  pagoMonto: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  noPagosTexto: {
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
