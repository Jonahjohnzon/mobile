import React, { useState } from 'react';
import { View, Text, Image, Pressable, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../constants/theme';

const FALLBACK_IMG = require('../../assets/poster-fallback.png');

const GAP = 10;
const H_PADDING = 16;

// PosterCard is fixed-width (128px) by design, for horizontal rows where
// items just need to look consistent next to each other. A 3-per-row grid
// needs items that evenly split the actual screen width instead, so this
// is a separate, smaller component rather than a PosterCard style override.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - H_PADDING * 2 - GAP * 2) / 3;

const GridPosterCard = ({ data, onPress }) => {
  const [broken, setBroken] = useState(false);
  const imageBase = process.env.EXPO_PUBLIC_SIZEIMAGE;
  const title = data.title || data.name || data.original_title || data.original_name;
  const rating = Math.ceil(data.vote_average || 0);
  const posterSrc = data.poster_path ? `${imageBase}${data.poster_path}` : null;

  return (
    <Pressable
      onPress={() => onPress?.(data)}
      style={{ width: COLUMN_WIDTH, marginBottom: 16 }}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${title}`}
    >
      <View
        style={{
          width: COLUMN_WIDTH,
          height: COLUMN_WIDTH * 1.5,
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: colors.surface,
        }}
      >
        <Image
          source={broken || !posterSrc ? FALLBACK_IMG : { uri: posterSrc }}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
      <Text
        numberOfLines={1}
        style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.ink, marginTop: 6 }}
      >
        {title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
        <Feather name="star" size={9} color={colors.marquee} />
        <Text
          style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, color: colors.inkMuted, marginLeft: 3 }}
        >
          {rating}/10
        </Text>
      </View>
    </Pressable>
  );
};

export { COLUMN_WIDTH, GAP, H_PADDING };
export default GridPosterCard;