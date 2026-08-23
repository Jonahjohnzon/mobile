import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Dimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors } from '../constants/theme';

const { width } = Dimensions.get('window');

/**
 * Replaces the web app's <Top/> hero. Instead of a generic full-width
 * title-over-backdrop banner, this reads as a lit marquee: an eyebrow
 * ("NOW SHOWING") in the ticket-stub accent, a condensed oversized title,
 * and a genre/rating strip laid out like the info printed on a physical
 * ticket. Auto-rotates through the trending list every 6s.
 */
const HeroBanner = ({ items = [], onPressPlay, onPressInfo }) => {
  const [index, setIndex] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (!items.length) return;
    timer.current = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 6000);
    return () => clearInterval(timer.current);
  }, [items.length]);

  if (!items.length) return null;
  const movie = items[index];
  const imageBase = process.env.EXPO_PUBLIC_SIZEIMAGEPHONE;
  const backdrop = movie.backdrop_path ? `${imageBase}${movie.backdrop_path}` : null;
  const title = movie.title || movie.name || movie.original_name;
  
  return (
    <View style={{ width, height: width * 1.15 }}>
      {backdrop ? (
        <Image source={{ uri: backdrop }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', height: '100%', backgroundColor: colors.surface }} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(11,13,16,0.55)', colors.bg]}
        locations={[0.35, 0.7, 1]}
        style={{ position: 'absolute', inset: 0 }}
      />

      <View className="absolute bottom-5 left-0 right-0 px-4">
        <Text
          style={{
            fontFamily: 'JetBrainsMono_500Medium',
            fontSize: 11,
            letterSpacing: 2,
            color: colors.ticket,
          }}
        >
          NOW SHOWING
        </Text>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: 'BebasNeue_400Regular',
            fontSize: 42,
            lineHeight: 44,
            color: colors.ink,
            marginTop: 2,
          }}
        >
          {title}
        </Text>

        <View className="flex-row items-center mt-2">
          <Feather name="star" size={12} color={colors.marquee} />
          <Text
            style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkMuted }}
            className="ml-1 mr-3"
          >
            {Math.ceil(movie.vote_average || 0)}/10
          </Text>
          <View style={{ width: 1, height: 12, backgroundColor: colors.line, marginRight: 12 }} />
          <Text
            numberOfLines={1}
            style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkMuted, flex: 1 }}
          >
            {(movie.original_language || '').toUpperCase()} · {movie.release_date?.slice(0, 4) || movie.first_air_date?.slice(0, 4) || ''}
          </Text>
        </View>

        <View className="flex-row mt-4">
          <Pressable
            onPress={() => onPressPlay?.(movie)}
            className="flex-row items-center rounded-full px-5 py-2.5 mr-3"
            style={{ backgroundColor: colors.marquee }}
          >
            <Feather name="play" size={14} color={colors.bg} />
            <Text
              className="ml-2"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.bg }}
            >
              Play
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onPressInfo?.(movie)}
            className="flex-row items-center rounded-full px-5 py-2.5"
            style={{ backgroundColor: 'rgba(245,243,238,0.12)' }}
          >
            <Feather name="info" size={14} color={colors.ink} />
            <Text
              className="ml-2"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.ink }}
            >
              Details
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default HeroBanner;
