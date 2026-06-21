// =============================================================================
// SurApícola — Pantalla de Gestión de Precios (Fase 8 - Prompt 2)
// =============================================================================
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usePrecios } from '../hooks/usePrecios';
import { formatearDinero } from '../utils/format';
import type { CategoriaPrecio, PrecioPresentacionDetalle } from '../types';

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

export function PreciosScreen() {
  const insets = useSafeAreaInsets();
  const {
    categorias,
    precios,
    loading,
    error: hookError,
    selectedCategoriaId,
    setSelectedCategoriaId,
    refresh,
    crearCategoria,
    actualizarCategoria,
    archivarCategoria,
    guardarPrecio,
  } = usePrecios();

  // Recargar al enfocar pantalla
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  // ── Estados de Modales ─────────────────────────────────────────────────────
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoriaPrecio | null>(null);
  const [catNombre, setCatNombre] = useState('');
  const [catDescripcion, setCatDescripcion] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedPrecio, setSelectedPrecio] = useState<PrecioPresentacionDetalle | null>(null);
  const [precioInput, setPrecioInput] = useState('');
  const [precioError, setPrecioError] = useState<string | null>(null);

  // ── Handlers de Categoría ──────────────────────────────────────────────────
  const abrirCatModal = (cat: CategoriaPrecio | null = null) => {
    setCatError(null);
    if (cat) {
      setEditingCat(cat);
      setCatNombre(cat.nombre);
      setCatDescripcion(cat.descripcion || '');
    } else {
      setEditingCat(null);
      setCatNombre('');
      setCatDescripcion('');
    }
    setCatModalVisible(true);
  };

  const cerrarCatModal = () => {
    setCatModalVisible(false);
    setEditingCat(null);
    setCatNombre('');
    setCatDescripcion('');
    setCatError(null);
  };

  const handleGuardarCat = async () => {
    const nombre = catNombre.trim();
    if (!nombre) {
      setCatError('El nombre de la lista es obligatorio.');
      return;
    }

    try {
      if (editingCat) {
        await actualizarCategoria(editingCat.id, nombre, catDescripcion.trim() || null);
      } else {
        await crearCategoria(nombre, catDescripcion.trim() || null);
      }
      cerrarCatModal();
    } catch (err: any) {
      setCatError(err.message || 'Error al guardar la lista de precios.');
    }
  };

  const handleArchivarCat = () => {
    if (!editingCat) return;

    Alert.alert(
      '¿Archivar Lista de Precios?',
      `La lista "${editingCat.nombre}" y todos sus precios asociados serán archivados. Las ventas históricas no se verán afectadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await archivarCategoria(editingCat.id);
              cerrarCatModal();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo archivar la lista.');
            }
          },
        },
      ]
    );
  };

  // ── Handlers de Precios ────────────────────────────────────────────────────
  const abrirPrecioModal = (precio: PrecioPresentacionDetalle) => {
    setPrecioError(null);
    setSelectedPrecio(precio);
    if (precio.precio_actual_centavos !== null) {
      setPrecioInput((precio.precio_actual_centavos / 100).toString());
    } else {
      setPrecioInput('');
    }
    setPriceModalVisible(true);
  };

  const cerrarPrecioModal = () => {
    setPriceModalVisible(false);
    setSelectedPrecio(null);
    setPrecioInput('');
    setPrecioError(null);
  };

  const handleGuardarPrecio = async () => {
    if (!selectedPrecio) return;

    const raw = precioInput.trim().replace(',', '.');
    if (!raw) {
      setPrecioError('Por favor ingrese un precio.');
      return;
    }

    const valor = parseFloat(raw);
    if (isNaN(valor)) {
      setPrecioError('El precio ingresado no es válido.');
      return;
    }

    if (valor < 0) {
      setPrecioError('El precio no puede ser negativo.');
      return;
    }

    const centavos = Math.round(valor * 100);

    try {
      await guardarPrecio(selectedPrecio.presentacion_id, centavos);
      cerrarPrecioModal();
    } catch (err: any) {
      setPrecioError(err.message || 'Error al guardar el precio.');
    }
  };

  // Categoría actualmente seleccionada en la UI
  const categoriaActual = categorias.find((c) => c.id === selectedCategoriaId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Cabecera */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitulo}>🏷️ Precios</Text>
          <Text style={styles.headerSubtitulo}>Listas de precios y tarifas</Text>
        </View>
        <TouchableOpacity
          style={styles.btnNuevo}
          activeOpacity={0.8}
          onPress={() => abrirCatModal(null)}
        >
          <Text style={styles.btnNuevoTexto}>+ Nueva Lista</Text>
        </TouchableOpacity>
      </View>

      {/* Banner de error general */}
      {hookError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTexto}>⚠️ {hookError}</Text>
        </View>
      )}

      {/* Selector de Categorías (Horizontal Scroll) */}
      <View style={styles.selectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorScroll}
        >
          {categorias.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catTab,
                selectedCategoriaId === cat.id && styles.catTabActivo,
              ]}
              onPress={() => setSelectedCategoriaId(cat.id)}
            >
              <Text
                style={[
                  styles.catTabTexto,
                  selectedCategoriaId === cat.id && styles.catTabTextoActivo,
                ]}
              >
                {cat.nombre}
              </Text>
            </TouchableOpacity>
          ))}
          {categorias.length === 0 && !loading && (
            <Text style={styles.sinCategoriasTexto}>No hay listas de precios activas</Text>
          )}
        </ScrollView>

        {categoriaActual && (
          <TouchableOpacity
            style={styles.btnEditarCat}
            onPress={() => abrirCatModal(categoriaActual)}
          >
            <Text style={styles.btnEditarCatIcon}>✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Listado de Precios por Presentación */}
      {loading && categorias.length === 0 ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingTexto}>Cargando datos...</Text>
        </View>
      ) : selectedCategoriaId === null ? (
        <View style={styles.vacioContainer}>
          <Text style={styles.vacioEmoji}>🏷️</Text>
          <Text style={styles.vacioTitulo}>Sin listas de precios</Text>
          <Text style={styles.vacioSubtitulo}>
            Crea una nueva lista de precios (ej. Minorista, Mayorista) para poder configurar tarifas predefinidas para tus productos.
          </Text>
          <TouchableOpacity style={styles.btnCrearPrimera} onPress={() => abrirCatModal(null)}>
            <Text style={styles.btnCrearPrimeraTexto}>Crear primera lista</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.preciosScroll}
          contentContainerStyle={styles.preciosContainer}
        >
          {categoriaActual?.descripcion && (
            <View style={styles.descCard}>
              <Text style={styles.descTexto}>{categoriaActual.descripcion}</Text>
            </View>
          )}

          <Text style={styles.tablaTitulo}>Precios de venta sugeridos</Text>

          {precios.map((item) => (
            <View key={item.presentacion_id} style={styles.precioCard}>
              <View style={styles.precioInfo}>
                <Text style={styles.presNombre}>{item.nombre}</Text>
                <Text style={styles.presTipo}>
                  {item.tipo === 'miel' ? '🍯 Miel' : '🐝 Panal'} • Código: {item.codigo}
                </Text>
              </View>
              <View style={styles.precioMontoWrapper}>
                <Text
                  style={[
                    styles.precioMonto,
                    item.precio_actual_centavos === null && styles.precioSinConfigurar,
                  ]}
                >
                  {item.precio_actual_centavos !== null
                    ? formatearDinero(item.precio_actual_centavos)
                    : 'Sin configurar'}
                </Text>
                <TouchableOpacity
                  style={styles.btnEditarPrecio}
                  onPress={() => abrirPrecioModal(item)}
                >
                  <Text style={styles.btnEditarPrecioTexto}>✏️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Modal de Categoría (Crear/Editar) ─────────────────────────────────── */}
      <Modal
        visible={catModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={cerrarCatModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>
                {editingCat ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
              </Text>
              <TouchableOpacity onPress={cerrarCatModal} style={styles.modalCerrarBtn}>
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContainer}>
              {catError && (
                <View style={styles.modalErrorBanner}>
                  <Text style={styles.modalErrorTexto}>⚠️ {catError}</Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre de la lista *</Text>
                <TextInput
                  style={styles.input}
                  value={catNombre}
                  onChangeText={(val) => {
                    setCatNombre(val);
                    setCatError(null);
                  }}
                  placeholder="Ej: Minorista, Mayorista, Particular"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Descripción / Notas</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={catDescripcion}
                  onChangeText={setCatDescripcion}
                  placeholder="Ej: Precios sugeridos al consumidor final en ferias..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline={true}
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {editingCat && (
                <TouchableOpacity
                  style={styles.btnArchivar}
                  activeOpacity={0.8}
                  onPress={handleArchivarCat}
                >
                  <Text style={styles.btnArchivarTexto}>🗄️ Archivar Lista de Precios</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity
                style={styles.btnCancelar}
                activeOpacity={0.8}
                onPress={cerrarCatModal}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnGuardar}
                activeOpacity={0.8}
                onPress={handleGuardarCat}
              >
                <Text style={styles.btnGuardarTexto}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal de Precio (Establecer Tarifa) ───────────────────────────────── */}
      <Modal
        visible={priceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={cerrarPrecioModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>Establecer Precio</Text>
              <TouchableOpacity onPress={cerrarPrecioModal} style={styles.modalCerrarBtn}>
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContainer}>
              <Text style={styles.precioModalSub}>
                Producto: <Text style={styles.destaque}>{selectedPrecio?.nombre}</Text>
              </Text>
              <Text style={styles.precioModalSub}>
                Lista: <Text style={styles.destaque}>{categoriaActual?.nombre}</Text>
              </Text>

              {precioError && (
                <View style={styles.modalErrorBanner}>
                  <Text style={styles.modalErrorTexto}>⚠️ {precioError}</Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Precio sugerido en pesos ($) *</Text>
                <TextInput
                  style={styles.input}
                  value={precioInput}
                  onChangeText={(val) => {
                    setPrecioInput(val);
                    setPrecioError(null);
                  }}
                  placeholder="Ej: 1500.00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                  autoFocus={true}
                />
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity
                style={styles.btnCancelar}
                activeOpacity={0.8}
                onPress={cerrarPrecioModal}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnGuardar}
                activeOpacity={0.8}
                onPress={handleGuardarPrecio}
              >
                <Text style={styles.btnGuardarTexto}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingTexto: {
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
    paddingHorizontal: 14,
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
  selectorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  selectorScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  catTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catTabActivo: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  catTabTexto: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  catTabTextoActivo: {
    color: COLORS.bg,
  },
  sinCategoriasTexto: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  btnEditarCat: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  btnEditarCatIcon: {
    fontSize: 16,
  },
  vacioContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
    marginBottom: 8,
  },
  btnCrearPrimera: {
    backgroundColor: 'transparent',
    borderColor: COLORS.accent,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnCrearPrimeraTexto: {
    color: COLORS.accentLight,
    fontWeight: '700',
    fontSize: 13,
  },
  preciosScroll: {
    flex: 1,
  },
  preciosContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  descCard: {
    backgroundColor: 'rgba(232, 160, 32, 0.08)',
    borderColor: 'rgba(232, 160, 32, 0.2)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  descTexto: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  tablaTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  precioCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  precioInfo: {
    flex: 1,
    gap: 4,
  },
  presNombre: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  presTipo: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  precioMontoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  precioMonto: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.success,
  },
  precioSinConfigurar: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  btnEditarPrecio: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEditarPrecioTexto: {
    fontSize: 12,
  },
  // Modal y Formularios
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
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
  formScroll: {
    flexShrink: 1,
  },
  formContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  modalErrorBanner: {
    backgroundColor: '#3A1515',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    marginBottom: 8,
  },
  modalErrorTexto: {
    color: COLORS.danger,
    fontSize: 13,
  },
  precioModalSub: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  destaque: {
    color: COLORS.text,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  input: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
  },
  btnArchivar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: COLORS.danger,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  btnArchivarTexto: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  btnCancelar: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnCancelarTexto: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  btnGuardar: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGuardarTexto: {
    color: COLORS.bg,
    fontWeight: '700',
    fontSize: 14,
  },
});
