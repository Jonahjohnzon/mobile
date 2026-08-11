import React, { useState } from 'react';
import { View, Text, Image, FlatList, Pressable } from 'react-native';
import SectionHeader from './SectionHeader';
import { colors } from '../constants/theme';

const FALLBACK_IMG = require('../../assets/poster-fallback.png');

const CastCard = ({ person, onPress }) => {
  const [broken, setBroken] = useState(false);
  const imageBase = process.env.EXPO_PUBLIC_SIZEIMAGE;
  const showCharacter = person.character && !person.character.startsWith('Self');

  return (
    <Pressable onPress={() => onPress(person)} style={{ width: 84, marginRight: 14, alignItems: 'center' }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Image
          source={broken || !person.profile_path ? FALLBACK_IMG : { uri: `${imageBase}${person.profile_path}` }}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
      <Text
        numberOfLines={1}
        style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.ink, marginTop: 6, textAlign: 'center' }}
      >
        {person.name}
      </Text>
      {showCharacter && (
        <Text
          numberOfLines={1}
          style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.inkFaint, textAlign: 'center' }}
        >
          {person.character}
        </Text>
      )}
    </Pressable>
  );
};

// Port of the web app's Cast.js grid, laid out as a horizontal scroll
// instead of a fixed grid — better fit for a phone-width screen, and
// matches how every other row in this app scrolls.
const CastRow = ({ cast = [], onPressPerson }) => {
  if (!cast.length) return null;

  return (
    <View className="mb-8 px-4">
      <SectionHeader title="Cast" eyebrow="" />
      <FlatList
        data={cast.slice(0, 20)}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${item.id ?? i}`}
        contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
        renderItem={({ item }) => <CastCard person={item} onPress={onPressPerson} />}
      />
    </View>
  );
};

export default CastRow;
