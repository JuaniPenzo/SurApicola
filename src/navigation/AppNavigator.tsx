// =============================================================================
// SurApícola — Navegación principal
// Barra inferior con 5 tabs.
// =============================================================================
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/HomeScreen';
import { StockScreen } from '../screens/StockScreen';
import { ClientesScreen } from '../screens/ClientesScreen';
import { ProveedoresScreen } from '../screens/ProveedoresScreen';
import { PreciosScreen } from '../screens/PreciosScreen';
import { ReportesScreen } from '../screens/ReportesScreen';
import { VentasScreen } from '../screens/VentasScreen';
import { NuevaVentaScreen } from '../screens/NuevaVentaScreen';
import { ComprasScreen } from '../screens/ComprasScreen';
import { NuevaCompraScreen } from '../screens/NuevaCompraScreen';
import { GastosScreen } from '../screens/GastosScreen';
import { NuevoGastoScreen } from '../screens/NuevoGastoScreen';
import { CosechasPerdidasScreen } from '../screens/CosechasPerdidasScreen';
import { EnvasesScreen } from '../screens/EnvasesScreen';
import { ClienteCuentaScreen } from '../screens/ClienteCuentaScreen';
import { ProveedorCuentaScreen } from '../screens/ProveedorCuentaScreen';
import { ConfiguracionScreen } from '../screens/ConfiguracionScreen';

export type TabParamList = {
  Inicio: undefined;
  Stock: undefined;
  Clientes: undefined;
  Proveedores: undefined;
  Precios: undefined;
  Reportes: undefined;
  Ventas: undefined;
  NuevaVenta: undefined;
  Compras: undefined;
  NuevaCompra: undefined;
  Gastos: undefined;
  NuevoGasto: undefined;
  CosechasPerdidas: undefined;
  Envases: undefined;
  ClienteCuenta: { clienteId: number };
  ProveedorCuenta: { proveedorId: number };
  Configuracion: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const COLORS = {
  bg: '#0F0F1A',
  surface: '#16213E',
  accent: '#E8A020',
  textMuted: '#8A8A9A',
  border: '#2A2A3E',
};

interface TabIconProps {
  emoji: string;
  focused: boolean;
}

function TabIcon({ emoji, focused }: TabIconProps) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.6, textAlign: 'center' }}>
      {emoji}
    </Text>
  );
}

export function AppNavigator() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 0;

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            paddingBottom: bottomInset > 0 ? bottomInset : 10,
            paddingTop: 8,
            height: 64 + (bottomInset > 0 ? bottomInset : 10),
          },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
            marginBottom: 2,
          },
        }}
      >
        <Tab.Screen
          name="Inicio"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Stock"
          component={StockScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="🍯" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Clientes"
          component={ClientesScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Proveedores"
          component={ProveedoresScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="🚚" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Precios"
          component={PreciosScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏷️" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Reportes"
          component={ReportesScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Ventas"
          component={VentasScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="NuevaVenta"
          component={NuevaVentaScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Compras"
          component={ComprasScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="NuevaCompra"
          component={NuevaCompraScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Gastos"
          component={GastosScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="NuevoGasto"
          component={NuevoGastoScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="CosechasPerdidas"
          component={CosechasPerdidasScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Envases"
          component={EnvasesScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="ClienteCuenta"
          component={ClienteCuentaScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="ProveedorCuenta"
          component={ProveedorCuentaScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Configuracion"
          component={ConfiguracionScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
