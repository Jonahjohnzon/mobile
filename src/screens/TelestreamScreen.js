import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { colors } from '../constants/theme';

// RN port of the web app's /telestream?link=... route — the branch
// PosterCard/LibraryScreen take when `data.media_type === 'telenovela'`.
export default function TelestreamScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { link } = params ?? {};

  return (
    <View className="flex-1 bg-bg">
      <Pressable
        onPress={() => navigation.goBack()}
        className="flex-row items-center px-4"
        style={{ paddingTop: 54, paddingBottom: 12 }}
      >
        <Feather name="chevron-left" size={20} color={colors.ink} />
        <Text className="ml-2" style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.ink }}>
          Back
        </Text>
      </Pressable>

      {link ? (
        <WebView source={{ uri: link }} style={{ flex: 1 }} allowsFullscreenVideo />
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-inkFaint text-center" style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            No source link provided.
          </Text>
        </View>
      )}
    </View>
  );
}
