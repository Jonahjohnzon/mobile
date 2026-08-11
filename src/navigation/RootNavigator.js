import React from 'react';
import { View, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useSnapshot } from 'valtio';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import BrowseScreen from '../screens/BrowseScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { state } from '../store/state';
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

const TabIcon = ({ name, focused, isProfile, loggedIn }) => {
  if (isProfile && loggedIn) {
    return (
      <View className="items-center" style={{ width: 44 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 13,
            overflow: 'hidden',
            borderWidth: focused ? 1.5 : 0,
            borderColor: colors.marquee,
          }}
        >
          <Image source={require('../../assets/13.png')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
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
  }

  return (
    <View className="items-center" style={{ width: 44 }}>
      <Feather name={name} size={24} color={focused ? colors.marquee : colors.inkFaint} />
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
};

export default function RootNavigator() {
  const snap = useSnapshot(state);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          height: 60,
        },
        tabBarItemStyle: { paddingTop: 8 },
      }}
    >
      {TABS.map(({ name, component, icon }) => {
        const isProfile = name === 'Profile';
        return (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon name={icon} focused={focused} isProfile={isProfile} loggedIn={snap.log} />
              ),
            }}
            listeners={
              isProfile
                ? ({ navigation }) => ({
                    tabPress: (e) => {
                      if (!state.log) {
                        e.preventDefault();
                        navigation.navigate('Login');
                      }
                    },
                  })
                : undefined
            }
          />
        );
      })}
    </Tab.Navigator>
  );
}