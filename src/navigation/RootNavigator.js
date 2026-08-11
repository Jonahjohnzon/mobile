import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import BrowseScreen from '../screens/BrowseScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../constants/theme';

const Tab = createBottomTabNavigator();

// Order here is left-to-right tab order — Profile is declared last so it
// renders as the right-most icon in the bar, per the brief.
const TABS = [
  { name: 'Home', component: HomeScreen, icon: 'home' },
  { name: 'Search', component: SearchScreen, icon: 'search' },
  { name: 'Browse', component: BrowseScreen, icon: 'film' },
  { name: 'Profile', component: ProfileScreen, icon: 'user' },
];

const TabIcon = ({ name, focused }) => (
  <View className="items-center" style={{ width: 44 }}>
    <Feather name={name} size={20} color={focused ? colors.marquee : colors.inkFaint} />
    <View
      style={{
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 5,
        backgroundColor: focused ? colors.marquee : 'transparent',
      }}
    />
  </View>
);

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // Standard docked bar — full width, square corners, sits flush
        // against the bottom edge. React Navigation handles the safe-area
        // inset itself here, so no manual insets/positioning needed.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          height: 60,
        },
        tabBarItemStyle: { paddingTop: 8 },
      }}
    >
      {TABS.map(({ name, component, icon }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon name={icon} focused={focused} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}