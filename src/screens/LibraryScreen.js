import React, { useCallback, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import PosterCard from '../components/PosterCard';
import SectionHeader from '../components/SectionHeader';
import { colors } from '../constants/theme';

// RN port of Recent.jsx. AsyncStorage's getItem is async (unlike
// localStorage), so the read happens in an effect either way, but the
// same "don't trust what's in storage" guard applies — a corrupted
// value gets wiped rather than crashing the screen.
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [recent, setRecent] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('recentlyWatched');
          const data = raw ? JSON.parse(raw) : null;
          if (!cancelled && Array.isArray(data)) setRecent(data);
        } catch (err) {
          console.error("Couldn't read recently-watched history:", err);
          await AsyncStorage.removeItem('recentlyWatched');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-3 pb-4">
        <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 32, color: colors.ink }}>
          Continue Watching
        </Text>
      </View>

      {recent.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <Feather name="film" size={28} color={colors.inkFaint} />
          <Text className="text-inkFaint text-center mt-3" style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            Nothing in your reel yet — start something and it'll show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(item, i) => `${item.id ?? item.url ?? i}`}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          ListHeaderComponent={<SectionHeader title="Your Reel" eyebrow="RESUME" />}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 12 }}>
              <PosterCard
                data={item}
                mode="continue"
                onPress={({ type, season, episode, data }) => {
                  if (data.media_type !== 'telenovela') {
                    navigation.navigate('Stream', { id: data.id, type, season, episode });
                  } else {
                    navigation.navigate('Telestream', { link: data.url });
                  }
                }}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}
