// =============================================================================
// SurApícola — Pantalla de Reportes y Balances (Fase 5)
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useReportes } from '../hooks/useReportes';
import { formatearDinero, formatearGramos, formatearUnidades, formatearFecha } from '../utils/format';
import type { RangoReporte } from '../types';

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

export function ReportesScreen() {
  const {
    reporte,
    loading,
    error,
    rango,
    setRango,
    fechaDesde,
    fechaHasta,
    setCustomFechas,
    refresh,
  } = useReportes();
  const [refrescando, setRefrescando] = React.useState(false);

  const [inputDesde, setInputDesde] = React.useState(fechaDesde);
  const [inputHasta, setInputHasta] = React.useState(fechaHasta);
  const [dateError, setDateError] = React.useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  React.useEffect(() => {
    setInputDesde(fechaDesde);
    setInputHasta(fechaHasta);
  }, [fechaDesde, fechaHasta]);

  const onRefresh = async () => {
    setRefrescando(true);
    await refresh();
    setRefrescando(false);
  };

  const rangos: { key: RangoReporte; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Este mes' },
    { key: 'entre_fechas', label: 'Entre fechas' },
  ];

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

  if (loading && !reporte) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.estadoTexto}>Generando reportes financieros...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Cabecera */}
      <View style={styles.header}>
        <Text style={styles.headerTitulo}>📊 Reportes y Balances</Text>
        <Text style={styles.headerSubtitulo}>Control financiero y operativo</Text>
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
          <TouchableOpacity style={styles.btnAplicarFiltro} onPress={handleAplicarFiltro}>
            <Text style={styles.btnAplicarFiltroTexto}>Aplicar Rango</Text>
          </TouchableOpacity>
        </View>
      )}

      {rango === 'entre_fechas' && dateError && (
        <View style={styles.errorRangoBanner}>
          <Text style={styles.errorRangoTexto}>⚠️ {dateError}</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTexto}>⚠️ {error}</Text>
        </View>
      )}

      {reporte && (
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
          {/* 1. BALANCE GENERAL */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>⚖️ BALANCES DEL RANGO</Text>
            
            <View style={styles.balanceRowPrincipal}>
              <View style={{ flex: 1 }}>
                <Text style={styles.balanceLabelPrincipal}>BALANCE REAL DE CAJA</Text>
                <Text style={styles.balanceSub}>Cobrado - Pagos Prov. - Pagos Gastos</Text>
              </View>
              <Text style={[styles.balanceValorPrincipal, { color: reporte.financiero.balanceCajaReal >= 0 ? COLORS.success : COLORS.danger }]}>
                {formatearDinero(reporte.financiero.balanceCajaReal)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.balanceRowPrincipal}>
              <View style={{ flex: 1 }}>
                <Text style={styles.balanceLabelPrincipal}>RESULTADO OPERATIVO (DEVENGADO)</Text>
                <Text style={styles.balanceSub}>Ventas - Compras - Gastos Cargados</Text>
              </View>
              <Text style={[styles.balanceValorPrincipal, { color: reporte.financiero.resultadoOperativoDevengado >= 0 ? COLORS.success : COLORS.danger }]}>
                {formatearDinero(reporte.financiero.resultadoOperativoDevengado)}
              </Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.miniTitulo}>Flujo de Caja Real (Entradas vs Salidas)</Text>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>🟢 Cobros de Clientes:</Text>
              <Text style={[styles.miniValor, { color: COLORS.success }]}>{formatearDinero(reporte.financiero.cobrosReales)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>🔴 Pagos a Proveedores:</Text>
              <Text style={[styles.miniValor, { color: COLORS.danger }]}>{formatearDinero(reporte.financiero.pagosProveedoresReales)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>🔴 Pagos de Gastos:</Text>
              <Text style={[styles.miniValor, { color: COLORS.danger }]}>{formatearDinero(reporte.financiero.pagosGastosReales)}</Text>
            </View>
          </View>

          {/* 2. VENTAS */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>🛒 RESUMEN DE VENTAS</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Cantidad</Text>
                <Text style={styles.statValor}>{reporte.ventas.cantidad}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Ticket Promedio</Text>
                <Text style={styles.statValor}>{formatearDinero(reporte.ventas.ticketPromedio)}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Total Vendido (Devengado):</Text>
              <Text style={styles.miniValor}>{formatearDinero(reporte.ventas.totalVendido)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Total Cobrado (asoc. a ventas del rango):</Text>
              <Text style={[styles.miniValor, { color: COLORS.success }]}>{formatearDinero(reporte.ventas.totalCobrado)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Saldo Pendiente de estas ventas:</Text>
              <Text style={[styles.miniValor, { color: COLORS.accentLight }]}>{formatearDinero(reporte.ventas.saldoPendiente)}</Text>
            </View>
            {reporte.ventas.ventaMasReciente && (
              <Text style={styles.recienteTexto}>Última venta: {formatearFecha(reporte.ventas.ventaMasReciente)}</Text>
            )}
          </View>

          {/* 3. COMPRAS */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>📦 RESUMEN DE COMPRAS</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Cantidad</Text>
                <Text style={styles.statValor}>{reporte.compras.cantidad}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Comprado</Text>
                <Text style={styles.statValor}>{formatearDinero(reporte.compras.totalComprado)}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />

            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Total Pagado (asoc. a compras del rango):</Text>
              <Text style={[styles.miniValor, { color: COLORS.success }]}>{formatearDinero(reporte.compras.totalPagado)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Saldo Pendiente de estas compras:</Text>
              <Text style={[styles.miniValor, { color: COLORS.accentLight }]}>{formatearDinero(reporte.compras.saldoPendiente)}</Text>
            </View>
            {reporte.compras.compraMasReciente && (
              <Text style={styles.recienteTexto}>Última compra: {formatearFecha(reporte.compras.compraMasReciente)}</Text>
            )}
          </View>

          {/* 4. GASTOS */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>📤 GASTOS OPERATIVOS</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Gastos Cargados</Text>
                <Text style={styles.statValor}>{reporte.gastos.cantidad}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Gastos</Text>
                <Text style={styles.statValor}>{formatearDinero(reporte.gastos.totalDevengado)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Total Pagado (asoc. a gastos del rango):</Text>
              <Text style={[styles.miniValor, { color: COLORS.success }]}>{formatearDinero(reporte.gastos.totalPagado)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Saldo Pendiente de estos gastos:</Text>
              <Text style={[styles.miniValor, { color: COLORS.accentLight }]}>{formatearDinero(reporte.gastos.saldoPendiente)}</Text>
            </View>

            {reporte.gastos.categorias.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.miniTitulo}>Principales categorías de gasto</Text>
                {reporte.gastos.categorias.map((cat, idx) => (
                  <View key={idx} style={styles.miniRow}>
                    <Text style={styles.miniLabel}>{idx + 1}. {cat.categoria}</Text>
                    <Text style={styles.miniValor}>{formatearDinero(cat.total_centavos)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          {/* 5. STOCK */}
          <View style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>🍯 INVENTARIO Y MOVIMIENTOS</Text>
            
            <Text style={styles.miniTitulo}>Stock Actual Disponible</Text>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Miel disponible:</Text>
              <Text style={[styles.miniValor, { color: COLORS.accentLight }]}>{formatearGramos(reporte.stock.stockMielActual)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Panal disponible:</Text>
              <Text style={[styles.miniValor, { color: COLORS.accentLight }]}>{formatearUnidades(reporte.stock.stockPanalActual)}</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.miniTitulo}>Ingresos en Rango (Entradas)</Text>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Total Entradas Miel:</Text>
              <Text style={[styles.miniValor, { color: COLORS.success }]}>+{formatearGramos(reporte.stock.entradasMiel)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Total Entradas Panal:</Text>
              <Text style={[styles.miniValor, { color: COLORS.success }]}>+{formatearUnidades(reporte.stock.entradasPanal)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>  - de los cuales Cosecha Miel:</Text>
              <Text style={styles.subMiniValor}>{formatearGramos(reporte.stock.cosechasMiel)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>  - de los cuales Cosecha Panal:</Text>
              <Text style={styles.subMiniValor}>{formatearUnidades(reporte.stock.cosechasPanal)}</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.miniTitulo}>Egresos en Rango (Salidas)</Text>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Total Salidas Miel:</Text>
              <Text style={[styles.miniValor, { color: COLORS.danger }]}>-{formatearGramos(reporte.stock.salidasMiel)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Total Salidas Panal:</Text>
              <Text style={[styles.miniValor, { color: COLORS.danger }]}>-{formatearUnidades(reporte.stock.salidasPanal)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>  - de los cuales Pérdida Miel:</Text>
              <Text style={styles.subMiniValor}>{formatearGramos(reporte.stock.perdidasMiel)}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>  - de los cuales Pérdida Panal:</Text>
              <Text style={styles.subMiniValor}>{formatearUnidades(reporte.stock.perdidasPanal)}</Text>
            </View>
          </View>

        </ScrollView>
      )}
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
  estadoTexto: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.bg,
  },
  headerTitulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitulo: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
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
  errorBanner: {
    backgroundColor: '#3A1E1E',
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    margin: 16,
    borderRadius: 8,
  },
  errorTexto: {
    color: COLORS.danger,
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  seccionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  seccionTitulo: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.accent,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  balanceRowPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  balanceLabelPrincipal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  balanceSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  balanceValorPrincipal: {
    fontSize: 16,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  miniTitulo: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  miniLabel: {
    fontSize: 13,
    color: COLORS.text,
  },
  miniValor: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subMiniValor: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  statValor: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  recienteTexto: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 8,
    fontStyle: 'italic',
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
  errorRangoBanner: {
    backgroundColor: '#3A1515',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
  },
  errorRangoTexto: {
    color: COLORS.danger,
    fontSize: 12,
  },
});
