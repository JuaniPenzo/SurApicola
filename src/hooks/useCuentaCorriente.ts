// =============================================================================
// SurApícola — Hook de Cuenta Corriente (Prompt 5)
// =============================================================================
import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import {
  getCuentaCliente,
  getMovimientosCuentaCliente,
  getCuentaProveedor,
  getMovimientosCuentaProveedor,
  registrarCobroClienteDirecto,
  registrarPagoProveedorDirecto,
} from '../database/cuentaCorriente';
import type {
  CuentaClienteResumen,
  MovimientoCuentaCliente,
  CuentaProveedorResumen,
  MovimientoCuentaProveedor,
  MedioPago,
} from '../types';

export function useCuentaCliente(clienteId: number) {
  const db = useSQLiteContext();
  const [resumen, setResumen] = useState<CuentaClienteResumen | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCuentaCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCuenta = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCuentaCliente(db, clienteId);
      const movs = await getMovimientosCuentaCliente(db, clienteId);
      setResumen(res);
      setMovimientos(movs);
    } catch (err: any) {
      setError(err.message || 'Error al obtener cuenta del cliente');
    } finally {
      setLoading(false);
    }
  }, [db, clienteId]);

  const registrarCobro = useCallback(async (monto: number, fecha: string, medioPago: MedioPago, notas: string | null) => {
    setLoading(true);
    setError(null);
    try {
      await registrarCobroClienteDirecto(db, clienteId, monto, fecha, medioPago, notas);
      await fetchCuenta();
      return true;
    } catch (err: any) {
      setError(err.message || 'Error al registrar cobro');
      return false;
    } finally {
      setLoading(false);
    }
  }, [db, clienteId, fetchCuenta]);

  useFocusEffect(
    useCallback(() => {
      fetchCuenta();
    }, [fetchCuenta])
  );

  return { resumen, movimientos, loading, error, refresh: fetchCuenta, registrarCobro };
}

export function useCuentaProveedor(proveedorId: number) {
  const db = useSQLiteContext();
  const [resumen, setResumen] = useState<CuentaProveedorResumen | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCuentaProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCuenta = useCallback(async () => {
    if (!proveedorId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCuentaProveedor(db, proveedorId);
      const movs = await getMovimientosCuentaProveedor(db, proveedorId);
      setResumen(res);
      setMovimientos(movs);
    } catch (err: any) {
      setError(err.message || 'Error al obtener cuenta del proveedor');
    } finally {
      setLoading(false);
    }
  }, [db, proveedorId]);

  const registrarPago = useCallback(async (monto: number, fecha: string, medioPago: MedioPago, notas: string | null) => {
    setLoading(true);
    setError(null);
    try {
      await registrarPagoProveedorDirecto(db, proveedorId, monto, fecha, medioPago, notas);
      await fetchCuenta();
      return true;
    } catch (err: any) {
      setError(err.message || 'Error al registrar pago');
      return false;
    } finally {
      setLoading(false);
    }
  }, [db, proveedorId, fetchCuenta]);

  useFocusEffect(
    useCallback(() => {
      fetchCuenta();
    }, [fetchCuenta])
  );

  return { resumen, movimientos, loading, error, refresh: fetchCuenta, registrarPago };
}

