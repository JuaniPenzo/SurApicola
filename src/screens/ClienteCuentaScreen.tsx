// =============================================================================
// SurApícola — Pantalla de Cuenta Corriente de Clientes (Prompt 5)
// =============================================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useCuentaCliente } from '../hooks/useCuentaCorriente';
import { formatearDinero, formatearFecha } from '../utils/format';

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
  green: '#4CAF7D',
  red: '#E05A5A',
};

type RouteProps = RouteProp<TabParamList, 'ClienteCuenta'>;

export function ClienteCuentaScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { clienteId } = route.params;

  const { resumen, movimientos, loading, error, registrarCobro } = useCuentaCliente(clienteId);

  // Estados para registrar cobro
  const [modalVisible, setModalVisible] = useState(false);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [medioPago, setMedioPago] = useState<'efectivo' | 'transferencia' | 'otro'>('efectivo');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (loading && !resumen) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.cargandoTexto}>Cargando cuenta corriente...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centrado}>
        <Text style={styles.errorTexto}>⚠️ {error}</Text>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
          <Text style={styles.btnVolverTexto}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const saldoColor = (resumen?.saldoPendiente ?? 0) > 0 ? COLORS.danger : COLORS.success;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolverHeader} onPress={() => navigation.goBack()}>
          <Text style={styles.volverTexto}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>📊 Cuenta Corriente</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ficha del Cliente */}
        <View style={styles.resumenCard}>
          <Text style={styles.clienteNombre}>{resumen?.nombre}</Text>
          <View style={styles.contactoRow}>
            {resumen?.telefono ? <Text style={styles.contactoText}>📞 {resumen.telefono}</Text> : null}
            {resumen?.email ? <Text style={styles.contactoText}>✉️ {resumen.email}</Text> : null}
          </View>

          <View style={styles.separador} />

          <View style={styles.kpiRow}>
            <View style={styles.kpiCol}>
              <Text style={styles.kpiLabel}>Total Vendido</Text>
              <Text style={[styles.kpiValue, { color: COLORS.text }]}>
                {formatearDinero(resumen?.totalVendido ?? 0)}
              </Text>
            </View>
            <View style={styles.kpiCol}>
              <Text style={styles.kpiLabel}>Total Cobrado</Text>
              <Text style={[styles.kpiValue, { color: COLORS.success }]}>
                {formatearDinero(resumen?.totalCobrado ?? 0)}
              </Text>
            </View>
          </View>

          <View style={styles.separador} />

          <View style={styles.saldoRow}>
            <Text style={styles.saldoLabel}>Saldo Pendiente</Text>
            <Text style={[styles.saldoValue, { color: saldoColor }]}>
              {formatearDinero(resumen?.saldoPendiente ?? 0)}
            </Text>
          </View>

          <View style={styles.fechasRow}>
            <Text style={styles.fechaText}>
              Última venta: <Text style={{ color: COLORS.text }}>{resumen?.ultimaVentaFecha ? formatearFecha(resumen.ultimaVentaFecha) : 'Ninguna'}</Text>
            </Text>
            <Text style={styles.fechaText}>
              Último cobro: <Text style={{ color: COLORS.text }}>{resumen?.ultimoCobroFecha ? formatearFecha(resumen.ultimoCobroFecha) : 'Ninguno'}</Text>
            </Text>
          </View>

          <View style={styles.separador} />

          {/* Botón de registrar cobro */}
          {resumen && resumen.saldoPendiente > 0 ? (
            <TouchableOpacity
              style={styles.btnCobrar}
              onPress={() => {
                setMonto((resumen.saldoPendiente / 100).toString());
                setFecha(new Date().toISOString().split('T')[0]);
                setMedioPago('efectivo');
                setNotas('');
                setModalVisible(true);
              }}
            >
              <Text style={styles.btnCobrarText}>💰 Registrar cobro</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.deudaSaldadaContainer}>
              <Text style={styles.deudaSaldadaText}>✅ Sin deuda pendiente</Text>
            </View>
          )}
        </View>

        <Text style={styles.historialTitulo}>HISTORIAL DE MOVIMIENTOS</Text>

        {/* Historial de Movimientos */}
        {movimientos.length === 0 ? (
          <View style={styles.vacioCard}>
            <Text style={styles.vacioTexto}>El cliente no registra movimientos vigentes.</Text>
          </View>
        ) : (
          movimientos.map((mov) => {
            const esVenta = mov.tipo === 'venta';
            const sign = esVenta ? '+' : '-';
            const color = esVenta ? COLORS.text : COLORS.success;
            return (
              <View key={`${mov.tipo}-${mov.id}`} style={styles.movimientoCard}>
                <View style={styles.movLeft}>
                  <View style={[styles.tipoBadge, { backgroundColor: esVenta ? '#2A2A3E' : '#1B3A2B' }]}>
                    <Text style={[styles.tipoBadgeText, { color }]}>
                      {esVenta ? '🛒 Venta' : '💰 Cobro'}
                    </Text>
                  </View>
                  <Text style={styles.movFecha}>{formatearFecha(mov.fecha)}</Text>
                  <Text style={styles.movDesc}>{mov.descripcion}</Text>
                  {esVenta && (
                    <View style={styles.estadoBadge}>
                      <Text style={styles.estadoTextoPill}>{mov.estado.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.movRight}>
                  <Text style={[styles.movMonto, { color }]}>
                    {sign}
                    {formatearDinero(mov.monto)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal para registrar cobro */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Registrar Cobro</Text>
            <Text style={styles.modalSub}>Se imputará a las deudas más antiguas del cliente.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Monto (ARS)</Text>
              <TextInput
                style={styles.input}
                value={monto}
                onChangeText={setMonto}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
              />
              <Text style={styles.helpText}>Máximo pendiente: {formatearDinero(resumen?.saldoPendiente ?? 0)}</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={fecha}
                onChangeText={setFecha}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Medio de Pago</Text>
              <View style={styles.btnRow}>
                {(['efectivo', 'transferencia', 'otro'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.btnSelect,
                      medioPago === m && styles.btnSelectActive,
                    ]}
                    onPress={() => setMedioPago(m)}
                  >
                    <Text
                      style={[
                        styles.btnSelectText,
                        medioPago === m && styles.btnSelectTextActive,
                      ]}
                    >
                      {m.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Notas / Descripción</Text>
              <TextInput
                style={styles.input}
                value={notas}
                onChangeText={setNotas}
                placeholder="Nota opcional"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={guardando}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={async () => {
                  const mNum = parseFloat(monto);
                  if (isNaN(mNum) || mNum <= 0) {
                    Alert.alert('Error', 'El monto debe ser mayor a 0.');
                    return;
                  }

                  const centavos = Math.round(mNum * 100);
                  if (centavos > (resumen?.saldoPendiente ?? 0)) {
                    Alert.alert('Error', 'El cobro no puede ser mayor al saldo pendiente.');
                    return;
                  }

                  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
                    Alert.alert('Error', 'El formato de fecha debe ser AAAA-MM-DD.');
                    return;
                  }

                  setGuardando(true);
                  const exito = await registrarCobro(centavos, fecha, medioPago, notas.trim() || null);
                  setGuardando(false);
                  
                  if (exito) {
                    setModalVisible(false);
                    Alert.alert('Éxito', 'Cobro registrado y saldo actualizado.');
                  } else {
                    Alert.alert('Error', 'No se pudo guardar el cobro.');
                  }
                }}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  errorTexto: {
    color: COLORS.danger,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  btnVolver: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  btnVolverTexto: {
    color: '#000000',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  btnVolverHeader: {
    marginRight: 12,
  },
  volverTexto: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  resumenCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  clienteNombre: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  contactoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  contactoText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  separador: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  kpiCol: {
    flex: 1,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  saldoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saldoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  saldoValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  fechasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  fechaText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  btnCobrar: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnCobrarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deudaSaldadaContainer: {
    backgroundColor: 'rgba(76, 175, 125, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 125, 0.2)',
    marginTop: 4,
  },
  deudaSaldadaText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },
  historialTitulo: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginTop: 8,
  },
  vacioCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  vacioTexto: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  movimientoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movLeft: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  tipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tipoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  movFecha: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  movDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  estadoBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  estadoTextoPill: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  movRight: {
    alignItems: 'flex-end',
  },
  movMonto: {
    fontSize: 16,
    fontWeight: '800',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -8,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  helpText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSelect: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  btnSelectActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(232, 160, 32, 0.1)',
  },
  btnSelectText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  btnSelectTextActive: {
    color: COLORS.accent,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  modalSaveBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
});

