import React, { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors } from '../constants/theme';

const FALLBACK_IMG = require('../../assets/poster-fallback.png');

/**
 * Shared poster tile — direct port of the web PosterCard's dual-mode
 * design (mode="details" -> info screen, mode="continue" -> resume
 * streaming, with the telenovela custom-source branch preserved).
 *
 * `rank`, new here, draws the numbered marquee-bulb badge used only on
 * the Trending row, where the order is real information worth surfacing.
 */
const PosterCard = ({ data, passType = '', mode = 'details', rank, onPress }) => {
  const [broken, setBroken] = useState(false);
  const imageBase = process.env.EXPO_PUBLIC_SIZEIMAGE;

  const type = data.media_type ? (data.media_type === 'movie' ? 'movie' : 'tv') : passType;
  const season = data?.season || '1';
  const episode = data?.episode || '1';
  const title = data.name || data.original_name || data.title;

  const posterSrc = data?.url ? data.poster_path : `${imageBase}${data.poster_path}`;
  const rating = data?.url ? data.vote_average : Math.ceil(data.vote_average || 0);

  const handlePress = () => {
    if (onPress) return onPress({ type, season, episode, data, mode });
  };

  return (
    <Pressable
      onPress={handlePress}
      className="mr-3 rounded-2xl overflow-hidden bg-surface"
      style={{ width: 128, height: 190 }}
      accessibilityRole="button"
      accessibilityLabel={`${mode === 'continue' ? 'Continue watching' : 'View details for'} ${title}`}
    >
      <Image
        source={broken || !posterSrc ? FALLBACK_IMG : { uri: posterSrc }}
        onError={() => setBroken(true)}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />

      <LinearGradient
        colors={['transparent', 'rgba(11,13,16,0.92)']}
        locations={[0.4, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
      />

      <View className="absolute bottom-0 left-0 right-0 p-2">
        <Text
          numberOfLines={1}
          className="text-ink"
          style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12 }}
        >
          {title}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Feather name="star" size={10} color={colors.marquee} />
          <Text
            className="text-inkMuted ml-1"
            style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 10 }}
          >
            {rating}/10
          </Text>
        </View>
      </View>

      {mode === 'continue' && type === 'tv' && (
        <View
          className="absolute top-0 left-0 px-1.5 py-0.5 rounded-br-lg"
          style={{ backgroundColor: 'rgba(11,13,16,0.85)' }}
        >
          <Text
            className="text-ink"
            style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 9 }}
          >
            S{season} · E{episode}
          </Text>
        </View>
      )}

      {typeof rank === 'number' && (
        <View className="absolute -top-1 -left-1">
          <Text
            style={{
              fontFamily: 'BebasNeue_400Regular',
              fontSize: 56,
              color: colors.bg,
              textShadowColor: colors.marquee,
              textShadowRadius: 0,
              textShadowOffset: { width: -1.5, height: 1.5 },
            }}
          >
            {rank}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export default PosterCard;
