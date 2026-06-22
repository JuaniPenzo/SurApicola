// =============================================================================
// SurApícola — Pantalla de Proveedores (Fase 3C)
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
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/AppNavigator';
import { useProveedores } from '../hooks/useProveedores';
import type { Proveedor, CategoriaProveedor } from '../types';

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

export function ProveedoresScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const insets = useSafeAreaInsets();
  const {
    proveedores,
    loading,
    refreshing,
    error: dbError,
    search,
    setSearch,
    refresh,
    crear,
    actualizar,
    archivar,
  } = useProveedores();

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  // ── Estados para el Modal del Formulario ───────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [categoria, setCategoria] = useState<CategoriaProveedor>('otros');

  // Errores de validación
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Abrir formulario ───────────────────────────────────────────────────────
  const abrirFormulario = (proveedor: Proveedor | null = null) => {
    setFormErrors({});
    if (proveedor) {
      setEditingProveedor(proveedor);
      setNombre(proveedor.nombre);
      setTelefono(proveedor.telefono || '');
      setEmail(proveedor.email || '');
      setDireccion(proveedor.direccion || '');
      setNotas(proveedor.notas || '');
      setCategoria(proveedor.categoria || 'otros');
    } else {
      setEditingProveedor(null);
      setNombre('');
      setTelefono('');
      setEmail('');
      setDireccion('');
      setNotas('');
      setCategoria('otros');
    }
    setModalVisible(true);
  };

  // ── Cerrar formulario ──────────────────────────────────────────────────────
  const cerrarFormulario = () => {
    setModalVisible(false);
    setEditingProveedor(null);
    setFormErrors({});
  };

  // ── Validar y Guardar ──────────────────────────────────────────────────────
  const handleGuardar = async () => {
    const errors: Record<string, string> = {};

    // Validar nombre obligatorio
    if (!nombre || nombre.trim().length === 0) {
      errors.nombre = 'El nombre es obligatorio.';
    } else if (nombre.trim().length < 2) {
      errors.nombre = 'El nombre debe tener al menos 2 caracteres.';
    }

    // Validar formato de email si se completa
    if (email && email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'El correo electrónico no es válido.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      direccion: direccion.trim() || null,
      notas: notas.trim() || null,
      categoria,
    };

    try {
      if (editingProveedor) {
        await actualizar(editingProveedor.id, payload);
      } else {
        await crear(payload);
      }
      cerrarFormulario();
    } catch (err) {
      Alert.alert('Error', 'No se pudieron guardar los cambios en la base de datos.');
    }
  };

  // ── Confirmar y Archivar proveedor ─────────────────────────────────────────
  const handleArchivar = (proveedor: Proveedor) => {
    Alert.alert(
      '¿Archivar proveedor?',
      `El proveedor "${proveedor.nombre}" dejará de mostrarse en el listado activo pero se conservará su historial de compras y pagos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await archivar(proveedor.id);
              cerrarFormulario();
            } catch (err) {
              Alert.alert('Error', 'No se pudo archivar el proveedor.');
            }
          },
        },
      ]
    );
  };

  // ── Renderizado de tarjeta de proveedor ────────────────────────────────────
  const renderProveedor = ({ item }: { item: Proveedor }) => {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => abrirFormulario(item)}
          style={styles.cardMainArea}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.proveedorNombre} numberOfLines={1}>
              {item.nombre}
            </Text>
            <Text style={styles.cardEditIcon}>✏️</Text>
          </View>

          <View style={styles.cardDetalles}>
            {item.telefono && (
              <Text style={styles.detallesTexto} numberOfLines={1}>
                📞 <Text style={styles.infoTexto}>{item.telefono}</Text>
              </Text>
            )}
            {item.email && (
              <Text style={styles.detallesTexto} numberOfLines={1}>
                ✉️ <Text style={styles.infoTexto}>{item.email}</Text>
              </Text>
            )}
            {item.direccion && (
              <Text style={styles.detallesTexto} numberOfLines={1}>
                📍 <Text style={styles.infoTexto}>{item.direccion}</Text>
              </Text>
            )}
            {item.notas && (
              <View style={styles.notasPreview}>
                <Text style={styles.notasTexto} numberOfLines={2}>
                  📝 {item.notas}
                </Text>
              </View>
            )}
            <View style={[styles.categoriaBadge, {
              backgroundColor:
                item.categoria === 'miel_panales' ? '#1B3A2B' :
                item.categoria === 'envases' ? '#1A2A3E' : '#2A2A1E',
            }]}>
              <Text style={[styles.categoriaTexto, {
                color:
                  item.categoria === 'miel_panales' ? '#4CAF7D' :
                  item.categoria === 'envases' ? '#42A5F5' : '#E8A020',
              }]}>
                {item.categoria === 'miel_panales' ? '🍯 Miel/Panales' :
                 item.categoria === 'envases' ? '🧴 Envases' : '📦 Otros'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.btnCuentaCorriente}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ProveedorCuenta', { proveedorId: item.id })}
          >
            <Text style={styles.btnCuentaCorrienteText}>📊 Ver Cuenta Corriente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !refreshing && proveedores.length === 0) {
    return (
      <SafeAreaView style={styles.centrado}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.estadoTexto}>Cargando proveedores...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Cabecera */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitulo}>🚚 Proveedores</Text>
          <Text style={styles.headerSubtitulo}>Listado y gestión activa</Text>
        </View>
        <TouchableOpacity
          style={styles.btnNuevo}
          activeOpacity={0.8}
          onPress={() => abrirFormulario(null)}
        >
          <Text style={styles.btnNuevoTexto}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Error de base de datos */}
      {dbError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTexto}>⚠️ {dbError}</Text>
        </View>
      )}

      {/* Barra de Búsqueda */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, teléfono o notas..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Listado */}
      <FlatList
        data={proveedores}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProveedor}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refresh}
        ListEmptyComponent={
          <View style={styles.vacioContainer}>
            <Text style={styles.vacioEmoji}>🚚</Text>
            <Text style={styles.vacioTitulo}>
              {search.trim().length > 0 ? 'Sin coincidencias' : 'Sin proveedores registrados'}
            </Text>
            <Text style={styles.vacioSubtitulo}>
              {search.trim().length > 0
                ? 'Probá escribiendo otros términos en la búsqueda.'
                : 'Registrá a tus proveedores para poder asociarles compras y pagos en el futuro.'}
            </Text>
            {search.trim().length === 0 && (
              <TouchableOpacity
                style={styles.btnCrearPrimero}
                activeOpacity={0.8}
                onPress={() => abrirFormulario(null)}
              >
                <Text style={styles.btnCrearPrimeroTexto}>Registrar primer proveedor</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Modal del Formulario */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={cerrarFormulario}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitulo}>
                {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </Text>
              <TouchableOpacity onPress={cerrarFormulario} style={styles.modalCerrarBtn}>
                <Text style={styles.modalCerrarBtnTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Campos del Formulario */}
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContainer}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre completo *</Text>
                <TextInput
                  style={[styles.input, formErrors.nombre ? styles.inputError : null]}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Ej: Distribuidora Apícola"
                  placeholderTextColor={COLORS.textMuted}
                />
                {formErrors.nombre ? (
                  <Text style={styles.errorHelperText}>{formErrors.nombre}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  value={telefono}
                  onChangeText={setTelefono}
                  placeholder="Ej: 11 1234 5678"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput
                  style={[styles.input, formErrors.email ? styles.inputError : null]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Ej: info@apicola.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {formErrors.email ? (
                  <Text style={styles.errorHelperText}>{formErrors.email}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Dirección física</Text>
                <TextInput
                  style={styles.input}
                  value={direccion}
                  onChangeText={setDireccion}
                  placeholder="Ej: Ruta 7 Km 105, Luján"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Categoría</Text>
                <View style={styles.categoriaRow}>
                  {(['miel_panales', 'envases', 'otros'] as const).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoriaChip,
                        categoria === cat && styles.categoriaChipActive,
                      ]}
                      onPress={() => setCategoria(cat)}
                    >
                      <Text style={[styles.categoriaChipText, categoria === cat && styles.categoriaChipTextActive]}>
                        {cat === 'miel_panales' ? '🍯 Miel/Panales' :
                         cat === 'envases' ? '🧴 Envases' : '📦 Otros'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notas / Observaciones</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notas}
                  onChangeText={setNotas}
                  placeholder="Detalles sobre entregas, tipo de miel, etc..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Botón de Archivado */}
              {editingProveedor && (
                <TouchableOpacity
                  style={styles.btnArchivar}
                  activeOpacity={0.8}
                  onPress={() => handleArchivar(editingProveedor)}
                >
                  <Text style={styles.btnArchivarTexto}>🗄️ Archivar Proveedor</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity
                style={styles.btnCancelar}
                activeOpacity={0.8}
                onPress={cerrarFormulario}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnGuardar}
                activeOpacity={0.8}
                onPress={handleGuardar}
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

// Estilos de ProveedoresScreen
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  cardMainArea: {
    padding: 16,
    gap: 10,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  btnCuentaCorriente: {
    backgroundColor: COLORS.accent + '15',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCuentaCorrienteText: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proveedorNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  cardEditIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
  cardDetalles: {
    gap: 6,
  },
  detallesTexto: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  infoTexto: {
    color: COLORS.text,
  },
  notasPreview: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
  },
  notasTexto: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
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
  btnCrearPrimero: {
    backgroundColor: 'transparent',
    borderColor: COLORS.accent,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  btnCrearPrimeroTexto: {
    color: COLORS.accentLight,
    fontWeight: '700',
    fontSize: 13,
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
  inputError: {
    borderColor: COLORS.danger,
  },
  errorHelperText: {
    color: COLORS.danger,
    fontSize: 11,
    marginTop: 2,
  },
  textArea: {
    minHeight: 80,
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
  // Categoría de proveedor
  categoriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoriaChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  categoriaChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '22',
  },
  categoriaChipText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  categoriaChipTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  categoriaBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  categoriaTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
});
