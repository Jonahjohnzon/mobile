import React, { useState } from 'react';
import { View, Text, Pressable, Image, Modal, Linking } from 'react-native';
import { useSnapshot } from 'valtio';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { state } from '../store/state';
import { colors } from '../constants/theme';
import { logout as apiLogout } from '../lib/screenOppsApi';

const TELEGRAM_URL = 'https://t.me/+LVonsnTDuK9hYTY0';

const MENU_ITEMS = [
  { label: 'Recent Watch', icon: 'clock', route: 'History' },
  { label: 'Wish List', icon: 'star', route: 'Wishlist' },
  { label: 'Contact Us', icon: 'send', action: 'contact' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const snap = useSnapshot(state);
  const [contactVisible, setContactVisible] = useState(false);

  const handleMenuPress = (item) => {
    if (item.action === 'contact') {
      setContactVisible(true);
      return;
    }
    if (item.route) navigation.navigate(item.route);
  };

  const handleOpenTelegram = async () => {
    try {
      const supported = await Linking.canOpenURL(TELEGRAM_URL);
      if (supported) {
        await Linking.openURL(TELEGRAM_URL);
      } else {
        console.warn('[Profile] Cannot open Telegram URL:', TELEGRAM_URL);
      }
    } catch (err) {
      console.error('Failed to open Telegram URL:', err);
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    state.log = false;
    state.id = null;
    state.name = null;
    navigation.reset({
      index: 0,
      routes: [{ name: 'Tabs', state: { routes: [{ name: 'Home' }] } }],
    });
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-4 pb-6 flex-row items-center">
        <View
          className="rounded-full items-center justify-center mr-4 overflow-hidden"
          style={{ width: 60, height: 60, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.marqueeDim }}
        >
          {snap.log ? (
            <Image
              source={require('../../assets/13.png')}
              style={{ width: 60, height: 60 }}
              resizeMode="cover"
            />
          ) : (
            <Feather name="user" size={24} color={colors.inkFaint} />
          )}
        </View>
        <View>
          <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 26, color: colors.ink }}>
            {snap.log ? snap.name : 'Guest'}
          </Text>
          {!snap.log && (
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.marquee }}>
                Sign in to sync your reel →
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View className="mx-4 rounded-2xl overflow-hidden bg-surface">
        {MENU_ITEMS.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={() => handleMenuPress(item)}
            className="flex-row items-center px-4 py-4"
            style={i !== MENU_ITEMS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.line } : null}
          >
            <Feather name={item.icon} size={17} color={colors.inkMuted} />
            <Text className="ml-3 flex-1" style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.ink }}>
              {item.label}
            </Text>
            <Feather name="chevron-right" size={16} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>

      {snap.log && (
        <Pressable
          onPress={handleLogout}
          className="mx-4 mt-6 rounded-2xl items-center py-4"
          style={{ backgroundColor: 'rgba(228,87,46,0.12)' }}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.ticket }}>
            Sign out
          </Text>
        </Pressable>
      )}

      {/* Contact Us bottom sheet */}
      <Modal
        visible={contactVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setContactVisible(false)}
      >
        <Pressable
          onPress={() => setContactVisible(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: insets.bottom + 20,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.line,
                marginBottom: 20,
              }}
            />

            <View
              className="rounded-full items-center justify-center self-center mb-4"
              style={{ width: 56, height: 56, backgroundColor: 'rgba(41,182,246,0.12)' }}
            >
              <Feather name="send" size={24} color="#29B6F6" />
            </View>

            <Text
              style={{
                fontFamily: 'BebasNeue_400Regular',
                fontSize: 24,
                color: colors.ink,
                textAlign: 'center',
              }}
            >
              Contact Us on Telegram
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontFamily: 'Inter_400Regular',
                fontSize: 13,
                color: colors.inkMuted,
                textAlign: 'center',
                paddingHorizontal: 12,
              }}
            >
              Join our Telegram group for support, updates, and to reach the team directly.
            </Text>

            <Pressable
              onPress={handleOpenTelegram}
              className="flex-row items-center justify-center rounded-full py-3.5 mt-6"
              style={{ backgroundColor: '#29B6F6' }}
            >
              <Feather name="send" size={16} color="#fff" />
              <Text className="ml-2" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' }}>
                Open Telegram
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setContactVisible(false)}
              className="items-center py-3.5 mt-2"
            >
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.inkFaint }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}